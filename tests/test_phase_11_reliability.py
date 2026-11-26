"""
EduPredict - Phase 11 Backup, Recovery, Monitoring, Reliability & Scalability Tests
Module: tests.test_phase_11_reliability
"""

import json
import tarfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson import ObjectId

from backend.models.stream_event_model import StreamEvent
from backend.services.backup_service import BackupService
from backend.services.event_streamer import EventStreamer


def _login(client, email: str, password: str):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_backup_creation_bson_types_compression_and_verification(clean_db, test_admin, test_student, tmp_path):
    """Verify compressed BSON backup creation, BSON type preservation, and SHA-256 verification."""
    meta, err = BackupService.create_backup(clean_db, backup_dir=tmp_path, actor_id=test_admin.id, retention_count=5)
    assert err is None and meta is not None
    assert meta["total_documents"] >= 2
    assert meta["archive_filename"].endswith(".tar.gz")
    assert (tmp_path / meta["archive_filename"]).exists()

    ok, details, v_err = BackupService.verify_backup(tmp_path, meta["backup_id"], db=clean_db)
    assert ok is True and v_err is None
    assert details["manifest"]["format_version"] == "1.0-bson-targz"
    assert "users" in details["manifest"]["collections"]


def test_backup_rejects_tampered_incomplete_and_traversal_archives(clean_db, test_admin, tmp_path):
    """Verify tampered archives, incomplete archives, and path traversal attempts are rejected."""
    meta, err = BackupService.create_backup(clean_db, backup_dir=tmp_path, actor_id=test_admin.id)
    assert err is None
    bid = meta["backup_id"]
    arch_path = tmp_path / f"{bid}.tar.gz"

    # Path traversal rejected
    ok_trav, _, trav_err = BackupService.verify_backup(tmp_path, "../../etc/passwd")
    assert ok_trav is False and "traversal" in trav_err.lower()

    # Tamper archive bytes -> SHA-256 mismatch
    raw = arch_path.read_bytes()
    arch_path.write_bytes(raw[:-10] + b"0123456789")
    ok_tamp, _, tamp_err = BackupService.verify_backup(tmp_path, bid)
    assert ok_tamp is False and "mismatch" in tamp_err.lower()

    # Incomplete archive (missing manifest.json)
    bad_id = "incomplete-backup"
    bad_arch = tmp_path / f"{bad_id}.tar.gz"
    with tarfile.open(bad_arch, "w:gz") as tar:
        dummy = tmp_path / "dummy.txt"
        dummy.write_text("x", encoding="utf-8")
        tar.add(dummy, arcname="dummy.txt")
    import hashlib
    sha = hashlib.sha256(bad_arch.read_bytes()).hexdigest()
    (tmp_path / f"{bad_id}.meta.json").write_text(
        json.dumps({"backup_id": bad_id, "archive_sha256": sha}), encoding="utf-8"
    )
    ok_inc, _, inc_err = BackupService.verify_backup(tmp_path, bad_id)
    assert ok_inc is False and "manifest.json" in inc_err


def test_backup_retention_pruning_never_deletes_only_valid_backup(clean_db, test_admin, tmp_path):
    """Retention pruning removes older backups beyond limit while always preserving at least 1 valid backup."""
    b1, _ = BackupService.create_backup(clean_db, tmp_path, actor_id=test_admin.id, retention_count=5)
    b2, _ = BackupService.create_backup(clean_db, tmp_path, actor_id=test_admin.id, retention_count=5)
    b3, _ = BackupService.create_backup(clean_db, tmp_path, actor_id=test_admin.id, retention_count=2)
    assert b1 and b2 and b3

    remaining = BackupService.list_backups(tmp_path)
    assert len(remaining) == 2

    # Even with retention=1, the single newest valid backup is preserved
    BackupService.prune_backups(clean_db, tmp_path, retention_count=1)
    assert len(BackupService.list_backups(tmp_path)) == 1


def test_restore_dry_run_isolated_db_index_rebuild_and_confirmation_guard(clean_db, test_admin, test_student, tmp_path):
    """Verify dry-run restore, isolated DB restore, BSON equality, index rebuild, and destructive confirmation."""
    meta, err = BackupService.create_backup(clean_db, tmp_path, actor_id=test_admin.id)
    assert err is None
    bid = meta["backup_id"]

    # 1. Dry-run verification
    dry_res, dry_err = BackupService.restore_backup(clean_db, tmp_path, bid, dry_run=True)
    assert dry_err is None
    assert dry_res["status"] == "dry_run_verified"

    # 2. Destructive restore without confirmation is rejected
    no_conf, no_conf_err = BackupService.restore_backup(
        clean_db, tmp_path, bid, dry_run=False, replace_existing=True, confirm_destructive=False
    )
    assert no_conf is None and "confirmation" in no_conf_err.lower()

    # 3. Restore into isolated clean target DB
    iso_db_name = "edupredict_restore_test"
    iso_db = clean_db.client[iso_db_name]
    clean_db.client.drop_database(iso_db_name)
    try:
        res, r_err = BackupService.restore_backup(
            iso_db, tmp_path, bid, dry_run=False, replace_existing=False, actor_id=test_admin.id
        )
        assert r_err is None
        assert res["status"] == "restored"
        assert res["integrity_audit"]["passed"] is True
        assert iso_db.users.count_documents({}) == clean_db.users.count_documents({})
        # BSON ObjectId and datetime preserved
        restored_admin = iso_db.users.find_one({"_id": test_admin.id})
        assert restored_admin is not None
        assert isinstance(restored_admin["_id"], ObjectId)
        assert isinstance(restored_admin["created_at"], datetime)
        assert "idx_users_email_unique" in iso_db.users.index_information()
    finally:
        clean_db.client.drop_database(iso_db_name)


def test_monitoring_overview_rbac_and_zero_pii(app, client, clean_db, test_admin, test_analyst, test_teacher, test_student, tmp_path):
    """Verify /api/monitoring/overview RBAC, backup APIs, and strict zero-PII guarantees."""
    app.config["BACKUP_DIR"] = str(tmp_path)

    # Student & Teacher denied
    _login(client, test_student.email, "StudentPassword123!")
    assert client.get("/api/monitoring/overview").status_code == 403
    assert client.get("/api/monitoring/backups").status_code == 403

    _login(client, test_teacher.email, "TeacherPassword123!")
    assert client.get("/api/monitoring/overview").status_code == 403

    # Analyst allowed aggregate overview (no student PII)
    _login(client, test_analyst.email, "AnalystPassword123!")
    an_res = client.get("/api/monitoring/overview")
    assert an_res.status_code == 200
    raw_an = str(an_res.get_json())
    assert test_student.email not in raw_an
    assert test_student.full_name not in raw_an
    assert str(test_student.id) not in raw_an
    # Analyst cannot trigger or list backups
    assert client.post("/api/monitoring/backups").status_code == 403

    # Admin can create, list, verify backups and view full monitoring overview
    _login(client, test_admin.email, "AdminPassword123!")
    b_res = client.post("/api/monitoring/backups")
    assert b_res.status_code == 201
    bid = b_res.get_json()["backup"]["backup_id"]

    v_res = client.post(f"/api/monitoring/backups/{bid}/verify")
    assert v_res.status_code == 200 and v_res.get_json()["verified"] is True

    ov_res = client.get("/api/monitoring/overview")
    assert ov_res.status_code == 200
    ov = ov_res.get_json()
    assert ov["database"]["connected"] is True
    assert ov["backups"]["latest"]["backup_id"] == bid
    assert test_student.email not in str(ov)


def test_streaming_concurrent_out_of_order_atomic_guard(clean_db, test_student):
    """Verify atomic timestamp guard prevents concurrent older events from overwriting newer academic state."""
    now = datetime.now(timezone.utc)
    newer_ts = now
    older_ts = now - timedelta(hours=2)

    newer_ev = StreamEvent(
        event_id="evt-conc-new",
        event_type="attendance_update",
        student_id=test_student.id,
        subject="Mathematics",
        academic_term="2026-Fall",
        payload={"absences": 9},
        event_timestamp=newer_ts,
    )
    older_ev = StreamEvent(
        event_id="evt-conc-old",
        event_type="attendance_update",
        student_id=test_student.id,
        subject="Mathematics",
        academic_term="2026-Fall",
        payload={"absences": 1},
        event_timestamp=older_ts,
    )

    # Run newer first or concurrently; older must NEVER overwrite absences=9
    assert EventStreamer._sync_academic_state(clean_db, newer_ev) is True
    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(EventStreamer._sync_academic_state, clean_db, older_ev)
        f2 = pool.submit(EventStreamer._sync_academic_state, clean_db, newer_ev)
        f1.result()
        f2.result()

    doc = clean_db.academic_records.find_one({"student_id": test_student.id, "subject": "Mathematics", "term": "2026-Fall"})
    assert doc is not None
    assert doc["absences"] == 9


def test_streaming_bulk_retry_and_stale_pending_recovery(clean_db, test_admin, test_student):
    """Verify bounded bulk retry of failed events, retry limits, and stale pending recovery."""
    # Seed 2 failed events (1 within retry limit, 1 exceeding retry limit) + 1 stale pending event
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    clean_db.stream_events.insert_many([
        StreamEvent(
            event_id="evt-bulk-fail-1",
            event_type="attendance_update",
            student_id=test_student.id,
            subject="Mathematics",
            academic_term="2026-Fall",
            payload={"absences": 4},
            status="failed",
            retry_count=0,
        ).to_doc(),
        StreamEvent(
            event_id="evt-bulk-fail-maxed",
            event_type="attendance_update",
            student_id=test_student.id,
            subject="Mathematics",
            academic_term="2026-Fall",
            payload={"absences": 2},
            status="failed",
            retry_count=3,
        ).to_doc(),
        StreamEvent(
            event_id="evt-stale-pend-1",
            event_type="lms_activity",
            student_id=test_student.id,
            subject="Mathematics",
            academic_term="2026-Fall",
            payload={"activity_minutes": 40, "studytime": 2},
            status="pending",
            received_at=stale_time,
            retry_count=0,
        ).to_doc(),
    ])

    bulk_res, err, code = EventStreamer.retry_failed_events(clean_db, max_batch=10, max_retries=3, actor_user=test_admin)
    assert code == 200 and err is None
    assert bulk_res["attempted"] == 1
    assert bulk_res["succeeded"] == 1

    # Maxed-out event remains failed
    assert clean_db.stream_events.find_one({"event_id": "evt-bulk-fail-maxed"})["status"] == "failed"

    stale_res, s_err, s_code = EventStreamer.recover_stale_pending_events(
        clean_db, stale_seconds=60, max_batch=10, actor_user=test_admin
    )
    assert s_code == 200 and s_err is None
    assert stale_res["recovered"] == 1
    assert clean_db.stream_events.find_one({"event_id": "evt-stale-pend-1"})["status"] == "processed"


def test_deployment_config_single_institution_and_sse_hardening():
    """Verify Apache config removes multi-tenant wildcards and configures SSE flushpackets."""
    httpd_path = Path("deployment/httpd.conf")
    text = httpd_path.read_text(encoding="utf-8")
    assert "*.edupredict.com" not in text
    assert "flushpackets=on" in text
    assert "ProxyTimeout 300" in text
