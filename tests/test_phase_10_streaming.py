"""
EduPredict - Phase 10 Real-Time Data Processing & Streaming Tests
Module: tests.test_phase_10_streaming
Covers all 14 required Phase 10 scenarios:
1. Valid real-time event ingestion
2. Invalid event rejection
3. Duplicate event prevention
4. Missing and incomplete data
5. Event processing failures and retries
6. Out-of-order events
7. Batch and streaming data consistency
8. Historical backfill behavior
9. Prediction pipeline compatibility
10. Role-based access control
11. Teacher subject authorization
12. Student record privacy
13. Analyst aggregate privacy
14. Single-institution operation without organization ID dependencies
"""

from datetime import datetime, timedelta, timezone

from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService
from backend.services.subject_service import SubjectService


def _login(client, email: str, password: str):
    return client.post("/auth/login", json={"email": email, "password": password})


def _setup_subject_scope(clean_db, teacher_id, student_id, term="2026-Fall"):
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")
    AssignmentService.assign_teacher_to_subject(clean_db, teacher_id, math_subj.id, academic_term=term)
    EnrollmentService.enroll_student(clean_db, student_id, math_subj.id, academic_term=term)
    EnrollmentService.enroll_student(clean_db, student_id, port_subj.id, academic_term=term)
    return math_subj, port_subj


def test_1_valid_realtime_event_ingestion(client, clean_db, test_admin, test_student):
    """1. Valid real-time event ingestion updates stream_events and academic_records."""
    _login(client, test_admin.email, "AdminPassword123!")
    resp = client.post("/api/stream/ingest", json={
        "event_id": "evt-valid-001",
        "event_type": "attendance_update",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {"absences": 3, "attendance_rate": 94.0},
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["status"] == "processed"
    assert data["event"]["event_id"] == "evt-valid-001"
    assert data["event"]["processing_latency_ms"] >= 0

    ac_rec = clean_db.academic_records.find_one({"student_id": test_student.id, "subject": "Mathematics"})
    assert ac_rec is not None
    assert ac_rec["absences"] == 3


def test_2_invalid_event_rejection(client, clean_db, test_admin, test_student):
    """2. Malformed event types, out-of-range values, and missing required fields are rejected safely."""
    _login(client, test_admin.email, "AdminPassword123!")

    bad_type = client.post("/api/stream/ingest", json={
        "event_id": "evt-bad-1",
        "event_type": "unknown_type",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {},
    })
    assert bad_type.status_code == 400

    bad_range = client.post("/api/stream/ingest", json={
        "event_id": "evt-bad-2",
        "event_type": "assessment_result",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {"score": 150, "max_score": 100},
    })
    assert bad_range.status_code == 400
    assert clean_db.stream_events.count_documents({}) == 0


def test_3_duplicate_event_prevention(client, clean_db, test_admin, test_student):
    """3. Duplicate event_id is idempotently ignored without double counting."""
    _login(client, test_admin.email, "AdminPassword123!")
    payload = {
        "event_id": "evt-dup-001",
        "event_type": "lms_activity",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {"activity_minutes": 45, "studytime": 3},
    }
    r1 = client.post("/api/stream/ingest", json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/stream/ingest", json=payload)
    assert r2.status_code == 200
    assert r2.get_json()["status"] == "duplicate_ignored"
    assert clean_db.stream_events.count_documents({"event_id": "evt-dup-001"}) == 1


def test_4_missing_and_incomplete_data_handling(client, clean_db, test_admin, test_student):
    """4. Incomplete events are flagged gracefully and never trigger fabricated predictions."""
    _login(client, test_admin.email, "AdminPassword123!")
    resp = client.post("/api/stream/ingest", json={
        "event_id": "evt-incomplete-001",
        "event_type": "assessment_result",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {"score": None, "max_score": 100},
    })
    assert resp.status_code == 201
    ev = resp.get_json()["event"]
    assert ev["has_missing_data"] is True
    assert "score" in ev["missing_fields"]
    assert ev["prediction_id"] is None
    assert clean_db.predictions.count_documents({}) == 0


def test_5_event_processing_failures_and_retries(client, clean_db, test_admin, test_student):
    """5. Transient processing failures persist as 'failed' and succeed on admin retry."""
    _login(client, test_admin.email, "AdminPassword123!")
    fail_resp = client.post("/api/stream/ingest", json={
        "event_id": "evt-retry-001",
        "event_type": "progress_update",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {"completion_pct": 60, "studytime": 2},
        "simulate_transient_failure": True,
    })
    assert fail_resp.status_code == 500
    assert fail_resp.get_json()["status"] == "failed"

    retry_resp = client.post("/api/stream/retry/evt-retry-001")
    assert retry_resp.status_code == 201
    retry_data = retry_resp.get_json()
    assert retry_data["status"] == "processed"
    assert retry_data["event"]["retry_count"] == 1


def test_6_out_of_order_events(client, clean_db, test_admin, test_student):
    """6. Older out-of-order events are flagged and do not overwrite newer academic state."""
    _login(client, test_admin.email, "AdminPassword123!")
    now = datetime.now(timezone.utc)
    older = now - timedelta(hours=3)

    r_new = client.post("/api/stream/ingest", json={
        "event_id": "evt-ooo-new",
        "event_type": "attendance_update",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "event_timestamp": now.isoformat(),
        "payload": {"absences": 5},
    })
    assert r_new.status_code == 201

    r_old = client.post("/api/stream/ingest", json={
        "event_id": "evt-ooo-old",
        "event_type": "attendance_update",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "event_timestamp": older.isoformat(),
        "payload": {"absences": 1},
    })
    assert r_old.status_code == 201
    assert r_old.get_json()["event"]["is_out_of_order"] is True

    # Current state remains absences=5
    ac_rec = clean_db.academic_records.find_one({"student_id": test_student.id, "subject": "Mathematics"})
    assert ac_rec["absences"] == 5


def test_7_and_8_batch_backfill_consistency_and_non_corruption(client, clean_db, test_admin, test_student):
    """7 & 8. Parallel batch backfill deduplicates, preserves current state, and reconciles cleanly."""
    _login(client, test_admin.email, "AdminPassword123!")

    # Current real-time state: absences=7
    client.post("/api/stream/ingest", json={
        "event_id": "evt-rt-current",
        "event_type": "attendance_update",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {"absences": 7},
    })

    # Historical backfill for earlier term/event
    backfill_records = [
        {
            "event_type": "attendance_update",
            "student_id": str(test_student.id),
            "subject": "Mathematics",
            "academic_term": "2025-Fall",
            "event_timestamp": "2025-10-01T10:00:00+00:00",
            "payload": {"absences": 2},
        },
        {
            "event_type": "lms_activity",
            "student_id": str(test_student.id),
            "subject": "Mathematics",
            "academic_term": "2025-Fall",
            "event_timestamp": "2025-10-02T10:00:00+00:00",
            "payload": {"activity_minutes": 90, "studytime": 3},
        },
    ]
    bf1 = client.post("/api/stream/batch-backfill", json={"records": backfill_records})
    assert bf1.status_code == 200
    assert bf1.get_json()["processed"] == 2

    # Replay same backfill -> 0 processed, 2 duplicates skipped
    bf2 = client.post("/api/stream/batch-backfill", json={"records": backfill_records})
    assert bf2.status_code == 200
    assert bf2.get_json()["duplicates_skipped"] == 2

    # Current 2026-Fall state was NOT corrupted
    ac_rec = clean_db.academic_records.find_one({"student_id": test_student.id, "term": "2026-Fall"})
    assert ac_rec["absences"] == 7

    status = client.get("/api/stream/status").get_json()
    assert status["reconciliation"]["realtime_processed"] == 1
    assert status["reconciliation"]["batch_backfill_processed"] == 2
    assert status["reconciliation"]["consistent"] is True


def test_9_prediction_pipeline_compatibility(client, clean_db, test_admin, test_student):
    """9. Complete assessment event triggers compatible prediction without duplicating."""
    from backend.data_engineering.leakage_guard import get_milestone_features

    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    _login(client, test_admin.email, "AdminPassword123!")

    # Provide complete Milestone 1 features for real-time prediction compatibility
    m1_features = {
        "school": "GP", "sex": "F", "age": 17, "address": "U", "famsize": "GT3",
        "Pstatus": "T", "Medu": 3, "Fedu": 3, "Mjob": "services", "Fjob": "services",
        "reason": "course", "guardian": "mother", "traveltime": 1, "studytime": 2,
        "failures": 0, "schoolsup": "no", "famsup": "yes", "paid": "no",
        "activities": "yes", "nursery": "yes", "higher": "yes", "internet": "yes",
        "romantic": "no", "famrel": 4, "freetime": 3, "goout": 3, "Dalc": 1,
        "Walc": 1, "health": 4, "absences": 2,
        "study_hours_per_week": 6.0, "attendance_percentage": 96.7,
        "assignment_completion_rate": 85.0, "previous_exam_marks": 75.0,
    }
    # Ensure all milestone 1 features are present
    assert all(k in m1_features for k in get_milestone_features(1))

    resp = client.post("/api/stream/ingest", json={
        "event_id": "evt-pred-001",
        "event_type": "assessment_result",
        "student_id": str(test_student.id),
        "subject_id": str(math_subj.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {
            "score": 78,
            "max_score": 100,
            "milestone": 1,
            "g1": 15,
            "assessment_name": "Midterm",
            "prediction_features": m1_features,
        },
    })
    assert resp.status_code == 201
    ev = resp.get_json()["event"]
    assert ev["prediction_id"] is not None
    assert clean_db.predictions.count_documents({"source_event_id": "evt-pred-001"}) == 1


def test_10_to_13_rbac_teacher_scope_student_privacy_and_analyst_privacy(
    client, clean_db, test_admin, test_teacher, test_student, test_analyst
):
    """10-13. Verify RBAC, teacher subject scope, student IDOR protection, and analyst PII suppression."""
    _setup_subject_scope(clean_db, test_teacher.id, test_student.id)

    # Student & Analyst cannot ingest
    _login(client, test_student.email, "StudentPassword123!")
    assert client.post("/api/stream/ingest", json={}).status_code == 403
    _login(client, test_analyst.email, "AnalystPassword123!")
    assert client.post("/api/stream/ingest", json={}).status_code == 403

    # Analyst CAN view /api/stream/status (aggregate-only, zero PII) but CANNOT view /api/stream/events or /student/<id>
    st_resp = client.get("/api/stream/status")
    assert st_resp.status_code == 200
    assert "student_id" not in str(st_resp.get_json())
    assert client.get("/api/stream/events?format=json").status_code == 403
    assert client.get(f"/api/stream/student/{test_student.id}").status_code == 403

    # Teacher CAN ingest for assigned Mathematics, CANNOT ingest for unassigned Portuguese
    _login(client, test_teacher.email, "TeacherPassword123!")
    ok_t = client.post("/api/stream/ingest", json={
        "event_id": "evt-teacher-math",
        "event_type": "attendance_update",
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2026-Fall",
        "payload": {"absences": 1},
    })
    assert ok_t.status_code == 201

    bad_t = client.post("/api/stream/ingest", json={
        "event_id": "evt-teacher-port",
        "event_type": "attendance_update",
        "student_id": str(test_student.id),
        "subject": "Portuguese Language",
        "academic_term": "2026-Fall",
        "payload": {"absences": 1},
    })
    assert bad_t.status_code == 403

    # Student can view own stream events, cannot view another student's events
    _login(client, test_student.email, "StudentPassword123!")
    own = client.get(f"/api/stream/student/{test_student.id}")
    assert own.status_code == 200
    assert own.get_json()["total"] == 1
    other = client.get(f"/api/stream/student/{test_admin.id}")
    assert other.status_code == 403


def test_14_single_institution_without_organization_id(client, clean_db, test_admin):
    """14. Normal single-institution workflows succeed without any organization_id or X-Institution-ID."""
    _login(client, test_admin.email, "AdminPassword123!")
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/admin/users").status_code == 200
    assert client.get("/api/demand/overview").status_code == 200
    assert client.get("/api/models/registry").status_code == 200
    assert client.get("/api/stream/status").status_code == 200
