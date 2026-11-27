"""
EduPredict - Portable MongoDB 6.x Backup & Safe Restore Service (Phase 11)
Module: backend.services.backup_service
Purpose: Provides atomic, compressed, SHA-256-verified BSON backups,
configurable retention pruning, dry-run & safety-backed restores,
and post-restore index + integrity verification.
"""

import hashlib
import json
import logging
import os
import re
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import bson
from bson import ObjectId
from pymongo.database import Database

from backend.database.schema import init_db_indexes
from backend.services.system_log_service import log_event, sanitize_exception_message

logger = logging.getLogger(__name__)

BACKUP_FORMAT_VERSION = "1.0-bson-targz"
PROTECTED_DATABASES = {"admin", "config", "local"}
_VALID_BACKUP_ID_RE = re.compile(r"^[a-zA-Z0-9_.-]+$")
_VALID_COLL_NAME_RE = re.compile(r"^[a-zA-Z0-9_]+$")
_VALID_SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")
REQUIRED_META_FIELDS = (
    "backup_id",
    "format_version",
    "total_documents",
    "collection_count",
    "archive_sha256",
)

# Core application collections exported in backups
DEFAULT_BACKUP_COLLECTIONS = [
    "users",
    "subjects",
    "teacher_subject_assignments",
    "student_subject_enrollments",
    "teacher_student_assignments",
    "academic_records",
    "analytical_academic_records",
    "predictions",
    "anomaly_records",
    "dropout_records",
    "dropout_prediction_history",
    "demand_forecasts",
    "demand_model_metadata",
    "model_registry",
    "stream_events",
    "notifications",
    "feedback_tickets",
    "system_logs",
]


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe_resolve_backup_paths(backup_dir: str | Path, backup_id: str) -> Tuple[Optional[Path], Optional[Path], Optional[str]]:
    """Validate backup_id and resolve archive & meta paths strictly within backup_dir."""
    clean_id = (backup_id or "").strip()
    if not clean_id or not _VALID_BACKUP_ID_RE.match(clean_id) or ".." in clean_id:
        return None, None, "Invalid backup_id format (potential path traversal rejected)."

    base = Path(backup_dir).resolve()
    archive_path = (base / f"{clean_id}.tar.gz").resolve()
    meta_path = (base / f"{clean_id}.meta.json").resolve()
    if archive_path.parent != base or meta_path.parent != base:
        return None, None, "Invalid backup path outside backup directory."
    return archive_path, meta_path, None


def run_db_integrity_check(db: Database) -> Dict[str, Any]:
    """
    Non-destructive post-restore referential integrity check across core collections.
    Reuses the validation rules from scripts/database_integrity_audit.py.
    """
    if db is None:
        return {"passed": False, "issues": ["Database unavailable."], "counts": {}}

    issues: List[str] = []
    users = list(db.users.find({}, {"_id": 1, "role": 1}))
    user_ids = {u["_id"] for u in users}
    subjects = list(db.subjects.find({}, {"_id": 1, "code": 1, "name": 1, "canonical_key": 1}))
    subject_ids = {s["_id"] for s in subjects}

    for s in subjects:
        if not s.get("code") or not s.get("name") or not s.get("canonical_key"):
            issues.append(f"Subject {s['_id']} missing required fields.")

    for ta in db.teacher_subject_assignments.find({}, {"_id": 1, "teacher_id": 1, "subject_id": 1}):
        if ta.get("teacher_id") not in user_ids:
            issues.append(f"Teacher assignment {ta['_id']} references missing teacher_id.")
        if ta.get("subject_id") not in subject_ids:
            issues.append(f"Teacher assignment {ta['_id']} references missing subject_id.")

    for se in db.student_subject_enrollments.find({}, {"_id": 1, "student_id": 1, "subject_id": 1}):
        if se.get("student_id") not in user_ids:
            issues.append(f"Student enrollment {se['_id']} references missing student_id.")
        if se.get("subject_id") not in subject_ids:
            issues.append(f"Student enrollment {se['_id']} references missing subject_id.")

    for pred in db.predictions.find({}, {"_id": 1, "student_id": 1}):
        if pred.get("student_id") not in user_ids:
            issues.append(f"Prediction {pred['_id']} references missing student_id.")

    for dr in db.dropout_records.find({}, {"_id": 1, "student_id": 1}):
        if dr.get("student_id") not in user_ids:
            issues.append(f"Dropout record {dr['_id']} references missing student_id.")

    seen_event_ids = set()
    for se_ev in db.stream_events.find({}, {"_id": 1, "event_id": 1, "student_id": 1}):
        ev_id = se_ev.get("event_id")
        if not ev_id or ev_id in seen_event_ids:
            issues.append(f"Stream event {se_ev['_id']} has missing or duplicate event_id '{ev_id}'.")
        seen_event_ids.add(ev_id)
        if se_ev.get("student_id") not in user_ids:
            issues.append(f"Stream event {se_ev['_id']} references missing student_id.")

    return {
        "passed": len(issues) == 0,
        "issues": issues[:50],
        "issue_count": len(issues),
        "counts": {
            "users": len(users),
            "subjects": len(subjects),
            "teacher_subject_assignments": db.teacher_subject_assignments.count_documents({}),
            "student_subject_enrollments": db.student_subject_enrollments.count_documents({}),
            "predictions": db.predictions.count_documents({}),
            "dropout_records": db.dropout_records.count_documents({}),
            "stream_events": db.stream_events.count_documents({}),
        },
    }


class BackupService:
    """Manages portable BSON MongoDB backups, verification, retention, and safe restores."""

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        return {
            "primary_engine": "pymongo-bson",
            "format_version": BACKUP_FORMAT_VERSION,
            "mongodump_available": bool(shutil.which("mongodump")),
            "mongorestore_available": bool(shutil.which("mongorestore")),
            "consistency_model": (
                "Non-blocking collection-by-collection BSON snapshot. "
                "Does not lock live traffic and is not a cluster-wide oplog point-in-time snapshot. "
                "Collection validators, views, and ad-hoc custom indexes outside schema.py are not serialized."
            ),
        }

    @classmethod
    def create_backup(
        cls,
        db: Database,
        backup_dir: str | Path,
        actor_id: Optional[ObjectId | str] = None,
        retention_count: int = 7,
        collections: Optional[List[str]] = None,
        backup_id_prefix: str = "edupredict-backup",
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Create a compressed, SHA-256-verified BSON backup archive using atomic staging.
        Returns: (backup_metadata_dict, error_message)
        """
        if db is None:
            return None, "Database service is unavailable."

        base_dir = Path(backup_dir).resolve()
        base_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.now(timezone.utc)
        ts_slug = ts.strftime("%Y%m%dT%H%M%SZ")
        suffix = ObjectId().__str__()[-6:]
        backup_id = f"{backup_id_prefix}-{ts_slug}-{suffix}"

        staging_dir = base_dir / f".staging_{backup_id}"
        coll_dir = staging_dir / "collections"
        coll_dir.mkdir(parents=True, exist_ok=True)

        target_collections = collections or list(
            dict.fromkeys(
                [c for c in DEFAULT_BACKUP_COLLECTIONS]
                + [c for c in db.list_collection_names() if not c.startswith("system.")]
            )
        )

        try:
            coll_manifests: Dict[str, Dict[str, Any]] = {}
            total_docs = 0

            for coll_name in target_collections:
                if not _VALID_COLL_NAME_RE.match(coll_name) or coll_name.startswith("system."):
                    continue
                bson_chunks: List[bytes] = []
                doc_count = 0
                for doc in db[coll_name].find({}):
                    bson_chunks.append(bson.encode(doc))
                    doc_count += 1
                raw_bytes = b"".join(bson_chunks)
                bson_file = coll_dir / f"{coll_name}.bson"
                with open(bson_file, "wb") as bf:
                    bf.write(raw_bytes)
                coll_manifests[coll_name] = {
                    "doc_count": doc_count,
                    "byte_size": len(raw_bytes),
                    "sha256": _sha256_bytes(raw_bytes),
                }
                total_docs += doc_count

            manifest = {
                "backup_id": backup_id,
                "created_at": ts.isoformat(),
                "database": db.name,
                "format_version": BACKUP_FORMAT_VERSION,
                "engine": "pymongo-bson",
                "consistency_note": (
                    "Collection-by-collection non-blocking snapshot; not a cross-collection point-in-time oplog snapshot."
                ),
                "total_documents": total_docs,
                "collections": coll_manifests,
            }
            manifest_path = staging_dir / "manifest.json"
            with open(manifest_path, "w", encoding="utf-8") as mf:
                json.dump(manifest, mf, indent=2)

            staged_archive = staging_dir / f"{backup_id}.tar.gz"
            with tarfile.open(staged_archive, "w:gz") as tar:
                tar.add(manifest_path, arcname="manifest.json")
                for coll_name in sorted(coll_manifests.keys()):
                    tar.add(coll_dir / f"{coll_name}.bson", arcname=f"collections/{coll_name}.bson")

            archive_sha256 = _sha256_file(staged_archive)
            archive_size = staged_archive.stat().st_size

            meta_doc = {
                "backup_id": backup_id,
                "created_at": ts.isoformat(),
                "database": db.name,
                "format_version": BACKUP_FORMAT_VERSION,
                "archive_filename": f"{backup_id}.tar.gz",
                "archive_size": archive_size,
                "archive_sha256": archive_sha256,
                "total_documents": total_docs,
                "collection_count": len(coll_manifests),
                "verified": True,
            }
            staged_meta = staging_dir / f"{backup_id}.meta.json"
            with open(staged_meta, "w", encoding="utf-8") as smf:
                json.dump(meta_doc, smf, indent=2)

            # Verify staged archive integrity before promoting atomically
            ok_v, v_details, v_err = cls._verify_archive_paths(staged_archive, staged_meta)
            if not ok_v:
                raise ValueError(v_err or "Staged backup failed integrity verification.")

            final_archive = base_dir / f"{backup_id}.tar.gz"
            final_meta = base_dir / f"{backup_id}.meta.json"
            os.replace(staged_archive, final_archive)
            os.replace(staged_meta, final_meta)

            try:
                log_event(
                    db,
                    "BACKUP_CREATED",
                    {
                        "backup_id": backup_id,
                        "total_documents": total_docs,
                        "archive_size": archive_size,
                        "archive_sha256": archive_sha256,
                    },
                    actor_id=actor_id,
                )
            except Exception:
                pass

            # Prune old backups beyond retention_count (never prune the only valid backup)
            if retention_count >= 1:
                cls.prune_backups(db, base_dir, retention_count=retention_count, protected_id=backup_id, actor_id=actor_id)

            return meta_doc, None

        except Exception as exc:
            err_msg = sanitize_exception_message(exc)
            logger.error("Backup creation failed: %s", err_msg)
            try:
                log_event(db, "BACKUP_FAILED", {"error": err_msg}, actor_id=actor_id)
            except Exception:
                pass
            return None, f"Backup failed: {err_msg}"
        finally:
            if staging_dir.exists():
                shutil.rmtree(staging_dir, ignore_errors=True)

    @staticmethod
    def _validate_meta_doc(meta: Any) -> Optional[str]:
        """Validate that .meta.json contains all required fields with valid types and formats."""
        if not isinstance(meta, dict):
            return "Malformed backup metadata: expected JSON object."

        for field in REQUIRED_META_FIELDS:
            if field not in meta or meta[field] is None:
                return f"Missing or null required metadata field '{field}'."

        backup_id_val = meta["backup_id"]
        if (
            not isinstance(backup_id_val, str)
            or not backup_id_val.strip()
            or not _VALID_BACKUP_ID_RE.match(backup_id_val.strip())
            or ".." in backup_id_val
        ):
            return "Malformed metadata field 'backup_id'."

        fmt_val = meta["format_version"]
        if not isinstance(fmt_val, str) or not fmt_val.strip():
            return "Malformed metadata field 'format_version'."
        if fmt_val != BACKUP_FORMAT_VERSION:
            return f"Unsupported backup format_version in metadata: {fmt_val}"

        sha_val = meta["archive_sha256"]
        if not isinstance(sha_val, str) or not _VALID_SHA256_RE.match(sha_val.strip()):
            return "Malformed metadata field 'archive_sha256'."

        for int_field in ("total_documents", "collection_count"):
            int_val = meta[int_field]
            if isinstance(int_val, bool) or not isinstance(int_val, int) or int_val < 0:
                return f"Malformed metadata field '{int_field}': expected non-negative integer."

        return None

    @classmethod
    def _verify_archive_paths(
        cls, archive_path: Path, meta_path: Path
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """Verify archive SHA-256, internal manifest, and every BSON collection checksum."""
        if not archive_path.exists():
            return False, None, "Backup archive file is missing."
        if not meta_path.exists():
            return False, None, "Backup metadata file (.meta.json) is missing."

        try:
            with open(meta_path, "r", encoding="utf-8") as mf:
                meta = json.load(mf)
        except Exception as exc:
            return False, None, f"Malformed backup metadata: {exc}"

        meta_err = cls._validate_meta_doc(meta)
        if meta_err:
            return False, None, meta_err

        expected_archive_sha = meta["archive_sha256"].strip()
        actual_archive_sha = _sha256_file(archive_path)
        if actual_archive_sha != expected_archive_sha:
            return False, None, "Archive SHA-256 mismatch (file tampered or corrupted)."

        try:
            with tarfile.open(archive_path, "r:gz") as tar:
                names = set(tar.getnames())
                if "manifest.json" not in names:
                    return False, None, "Missing manifest.json inside backup archive."

                # Reject any path traversal entries inside tar
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in Path(member.name).parts:
                        return False, None, f"Unsafe tar member path rejected: {member.name}"

                manifest_file = tar.extractfile("manifest.json")
                if manifest_file is None:
                    return False, None, "Unable to read manifest.json from archive."
                manifest = json.loads(manifest_file.read().decode("utf-8"))
                if not isinstance(manifest, dict):
                    return False, None, "Malformed manifest.json inside archive: expected JSON object."

                if manifest.get("format_version") != BACKUP_FORMAT_VERSION:
                    return False, None, f"Unsupported backup format_version: {manifest.get('format_version')}"

                if meta["format_version"] != manifest.get("format_version"):
                    return False, None, "Metadata format_version does not match manifest.json."

                if meta["backup_id"] != manifest.get("backup_id"):
                    return False, None, "Metadata backup_id does not match manifest.json."

                colls = manifest.get("collections")
                if not isinstance(colls, dict):
                    return False, None, "Invalid collections map in manifest.json."

                if meta["collection_count"] != len(colls):
                    return False, None, "Metadata collection_count does not match manifest.json."

                expected_total_docs = sum(
                    int(cm.get("doc_count", -1)) for cm in colls.values() if isinstance(cm, dict)
                )
                if manifest.get("total_documents") != expected_total_docs:
                    return False, None, "Manifest total_documents does not match sum of collection doc_counts."
                if meta["total_documents"] != manifest.get("total_documents"):
                    return False, None, "Metadata total_documents does not match manifest.json."

                expected_entries = {"manifest.json"} | {f"collections/{c}.bson" for c in colls.keys()}
                unexpected_bson = [n for n in names if n.startswith("collections/") and n not in expected_entries]
                if unexpected_bson:
                    return False, None, f"Unexpected unverified collection entries in archive: {unexpected_bson}"

                for coll_name, c_meta in colls.items():
                    if not _VALID_COLL_NAME_RE.match(coll_name) or coll_name.startswith("system."):
                        return False, None, f"Invalid collection name in manifest: {coll_name}"
                    arc_entry = f"collections/{coll_name}.bson"
                    if arc_entry not in names:
                        return False, None, f"Incomplete archive: missing {arc_entry}."
                    f_obj = tar.extractfile(arc_entry)
                    if f_obj is None:
                        return False, None, f"Unable to read {arc_entry}."
                    raw = f_obj.read()
                    if _sha256_bytes(raw) != c_meta.get("sha256"):
                        return False, None, f"Checksum mismatch for collection '{coll_name}'."
                    # Verify BSON parses cleanly and doc count matches
                    decoded = bson.decode_all(raw) if raw else []
                    if len(decoded) != c_meta.get("doc_count"):
                        return False, None, f"Document count mismatch for collection '{coll_name}'."

                return True, {"meta": meta, "manifest": manifest}, None
        except tarfile.TarError as te:
            return False, None, f"Corrupted tar.gz archive: {te}"
        except Exception as exc:
            return False, None, f"Archive verification error: {exc}"

    @classmethod
    def verify_backup(
        cls,
        backup_dir: str | Path,
        backup_id: str,
        db: Optional[Database] = None,
        actor_id: Optional[ObjectId | str] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """Public verification entry point with path-traversal protection and audit logging."""
        archive_path, meta_path, path_err = _safe_resolve_backup_paths(backup_dir, backup_id)
        if path_err or archive_path is None or meta_path is None:
            return False, None, path_err

        ok, details, err = cls._verify_archive_paths(archive_path, meta_path)
        if db is not None:
            try:
                log_event(
                    db,
                    "BACKUP_VERIFIED" if ok else "BACKUP_VERIFY_FAILED",
                    {"backup_id": backup_id, "verified": ok, "error": err},
                    actor_id=actor_id,
                )
            except Exception:
                pass
        return ok, details, err

    @classmethod
    def list_backups(cls, backup_dir: str | Path) -> List[Dict[str, Any]]:
        """List all backup metadata records sorted newest first."""
        base_dir = Path(backup_dir).resolve()
        if not base_dir.exists():
            return []
        items: List[Dict[str, Any]] = []
        for meta_file in base_dir.glob("*.meta.json"):
            try:
                with open(meta_file, "r", encoding="utf-8") as mf:
                    data = json.load(mf)
                archive_exists = (base_dir / f"{data.get('backup_id', '')}.tar.gz").exists()
                data["archive_exists"] = archive_exists
                items.append(data)
            except Exception:
                continue
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return items

    @classmethod
    def prune_backups(
        cls,
        db: Optional[Database],
        backup_dir: str | Path,
        retention_count: int = 7,
        protected_id: Optional[str] = None,
        actor_id: Optional[ObjectId | str] = None,
    ) -> List[str]:
        """Prune oldest backups beyond retention_count while never deleting the only valid backup."""
        if retention_count < 1:
            return []
        backups = cls.list_backups(backup_dir)
        valid_backups = [b for b in backups if b.get("archive_exists")]
        if len(valid_backups) <= retention_count or len(valid_backups) <= 1:
            return []

        to_remove = valid_backups[retention_count:]
        pruned: List[str] = []
        base_dir = Path(backup_dir).resolve()
        for item in to_remove:
            bid = item.get("backup_id", "")
            if not bid or bid == protected_id:
                continue
            # Ensure at least one valid backup remains
            remaining = [b for b in valid_backups if b.get("backup_id") not in pruned and b.get("backup_id") != bid]
            if not remaining:
                break
            arch, meta, err = _safe_resolve_backup_paths(base_dir, bid)
            if err or arch is None or meta is None:
                continue
            arch.unlink(missing_ok=True)
            meta.unlink(missing_ok=True)
            pruned.append(bid)

        if pruned and db is not None:
            try:
                log_event(db, "BACKUP_PRUNED", {"pruned_ids": pruned, "retention_count": retention_count}, actor_id=actor_id)
            except Exception:
                pass
        return pruned

    @classmethod
    def restore_backup(
        cls,
        target_db: Database,
        backup_dir: str | Path,
        backup_id: str,
        dry_run: bool = True,
        replace_existing: bool = False,
        confirm_destructive: bool = False,
        actor_id: Optional[ObjectId | str] = None,
        _is_rollback: bool = False,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Verify and restore a backup archive into target_db.
        - `dry_run=True` verifies archive integrity and reports planned counts without writing.
        - `replace_existing=True` requires `confirm_destructive=True` and automatically creates
          a safety backup before modifying existing collections.
        """
        if target_db is None:
            return None, "Target database unavailable."

        target_name = (getattr(target_db, "name", "") or "").strip().lower()
        if not target_name or target_name in PROTECTED_DATABASES:
            return None, f"Access denied: restoring into protected system database '{getattr(target_db, 'name', '')}' is prohibited."

        ok, details, err = cls.verify_backup(backup_dir, backup_id)
        if not ok or not details:
            return None, err or "Backup verification failed."

        manifest = details["manifest"]
        colls_meta = manifest["collections"]

        if dry_run:
            return {
                "status": "dry_run_verified",
                "backup_id": backup_id,
                "target_database": target_db.name,
                "collections": {k: v["doc_count"] for k, v in colls_meta.items()},
                "total_documents": manifest.get("total_documents", 0),
            }, None

        # Check if target_db currently has data
        existing_non_empty = [
            c for c in colls_meta.keys() if target_db[c].count_documents({}) > 0
        ]
        if existing_non_empty and not replace_existing:
            return None, (
                f"Target database '{target_db.name}' already contains documents in {existing_non_empty}. "
                "Use replace_existing=True with explicit confirmation or restore to a clean database."
            )
        if replace_existing and not confirm_destructive:
            return None, "Destructive restore requires explicit confirmation (confirm_destructive=True)."

        safety_backup_id: Optional[str] = None
        if replace_existing and existing_non_empty and not _is_rollback:
            safety_meta, safety_err = cls.create_backup(
                target_db,
                backup_dir=backup_dir,
                actor_id=actor_id,
                retention_count=99,
                backup_id_prefix="safety-pre-restore",
            )
            if safety_err or not safety_meta:
                return None, f"Aborting destructive restore: failed to create pre-restore safety backup ({safety_err})."
            safety_backup_id = safety_meta["backup_id"]

        archive_path, _, _ = _safe_resolve_backup_paths(backup_dir, backup_id)
        restored_counts: Dict[str, int] = {}

        try:
            with tarfile.open(archive_path, "r:gz") as tar:
                for coll_name, c_meta in colls_meta.items():
                    if replace_existing:
                        target_db[coll_name].drop()
                    f_obj = tar.extractfile(f"collections/{coll_name}.bson")
                    raw = f_obj.read() if f_obj else b""
                    docs = bson.decode_all(raw) if raw else []
                    if docs:
                        for i in range(0, len(docs), 500):
                            target_db[coll_name].insert_many(docs[i : i + 500])
                    actual_count = target_db[coll_name].count_documents({})
                    if actual_count != c_meta["doc_count"]:
                        raise RuntimeError(
                            f"Post-restore count mismatch on '{coll_name}': expected {c_meta['doc_count']}, got {actual_count}."
                        )
                    if docs:
                        expected_ids = {d["_id"] for d in docs if "_id" in d}
                        if expected_ids:
                            found_ids = {d["_id"] for d in target_db[coll_name].find({}, {"_id": 1})}
                            if found_ids != expected_ids:
                                raise RuntimeError(
                                    f"Post-restore document ID equality check failed on '{coll_name}'."
                                )
                    restored_counts[coll_name] = actual_count

            init_db_indexes(target_db)
            integrity = run_db_integrity_check(target_db)

            try:
                log_event(
                    target_db,
                    "BACKUP_RESTORED",
                    {
                        "backup_id": backup_id,
                        "safety_backup_id": safety_backup_id,
                        "restored_counts": restored_counts,
                        "integrity_passed": integrity["passed"],
                    },
                    actor_id=actor_id,
                )
            except Exception:
                pass

            return {
                "status": "restored",
                "backup_id": backup_id,
                "safety_backup_id": safety_backup_id,
                "target_database": target_db.name,
                "restored_counts": restored_counts,
                "integrity_audit": integrity,
            }, None

        except Exception as exc:
            err_msg = sanitize_exception_message(exc)
            rollback_msg = (
                f"Automatically rolling back from safety backup '{safety_backup_id}'."
                if safety_backup_id
                else "No safety backup was needed."
            )
            if safety_backup_id and not _is_rollback:
                try:
                    rb_res, rb_err = cls.restore_backup(
                        target_db,
                        backup_dir=backup_dir,
                        backup_id=safety_backup_id,
                        dry_run=False,
                        replace_existing=True,
                        confirm_destructive=True,
                        actor_id=actor_id,
                        _is_rollback=True,
                    )
                    if rb_err or not rb_res:
                        rollback_msg = f"Automatic rollback failed ({rb_err}); manually restore '{safety_backup_id}'."
                    else:
                        rollback_msg = f"Automatically rolled back to safety backup '{safety_backup_id}'."
                except Exception as rb_exc:
                    rollback_msg = f"Automatic rollback failed ({rb_exc}); manually restore '{safety_backup_id}'."
            return None, f"Restore failed: {err_msg}. {rollback_msg}"
