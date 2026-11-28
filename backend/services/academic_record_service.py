"""
EduPredict - Institutional Academic Records Ingestion & CRUD Service (Workstream A / Phase 13)
Module: backend.services.academic_record_service
Purpose: Manages persistent student coursework and examination records in the MongoDB
`academic_records` collection, supporting teacher/admin CRUD, row-validated CSV bulk import,
strict RBAC/enrollment checks, duplicate prevention via (student_id, subject, term),
and complete backward compatibility with EventStreamer._sync_academic_state().
"""

import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from backend.services.system_log_service import log_event
from backend.utils.decorators import can_access_student_subject_data
from backend.utils.security import clean_and_validate_text, to_object_id

MAX_CSV_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_CSV_ROWS = 2000

FIELD_BOUNDS: Dict[str, Tuple[float, float, type]] = {
    "g1": (0.0, 20.0, float),
    "g2": (0.0, 20.0, float),
    "final_exam_marks": (0.0, 20.0, float),
    "study_hours_per_week": (0.0, 60.0, float),
    "assignment_completion_rate": (0.0, 100.0, float),
    "quiz_average": (0.0, 100.0, float),
    "previous_exam_marks": (0.0, 100.0, float),
    "attendance_percentage": (0.0, 100.0, float),
    "studytime": (1, 4, int),
    "failures": (0, 4, int),
    "absences": (0, 93, int),
}


def _parse_bounded_number(
    raw_val: Any,
    field_name: str,
    low: float,
    high: float,
    cast_type: type,
) -> Tuple[Optional[Any], Optional[str]]:
    if raw_val is None or (isinstance(raw_val, str) and not raw_val.strip()):
        return None, None
    if isinstance(raw_val, bool):
        return None, f"Field '{field_name}' must be numeric."
    try:
        num = float(str(raw_val).strip())
    except (ValueError, TypeError):
        return None, f"Field '{field_name}' must be a valid number."
    if cast_type is int:
        if not num.is_integer():
            return None, f"Field '{field_name}' must be an integer between {low} and {high}."
        num_val: Any = int(num)
    else:
        num_val = round(num, 2)
    if num_val < low or num_val > high:
        return None, f"Field '{field_name}' must be between {low} and {high}."
    return num_val, None


def _resolve_subject(
    db: Database,
    subject_id: Optional[str] = None,
    subject_name: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Resolve an active subject document from subject_id or subject_name."""
    if subject_id:
        s_oid = to_object_id(subject_id)
        if not s_oid:
            return None, "Invalid subject_id format."
        doc = db.subjects.find_one({"_id": s_oid, "is_active": True})
        if not doc:
            return None, "Subject not found or inactive."
        return doc, None

    if subject_name and isinstance(subject_name, str) and subject_name.strip():
        clean_name = subject_name.strip()
        lower = clean_name.lower()
        canonical_map = {
            "math": "Mathematics",
            "mathematics": "Mathematics",
            "port": "Portuguese Language",
            "portuguese": "Portuguese Language",
            "portuguese language": "Portuguese Language",
        }
        target_name = canonical_map.get(lower, clean_name)
        doc = db.subjects.find_one(
            {
                "is_active": True,
                "$or": [
                    {"name": target_name},
                    {"code": clean_name.upper()},
                    {"canonical_key": lower},
                ],
            }
        )
        if not doc:
            return None, f"Active subject '{clean_name}' not found."
        return doc, None

    return None, "Either 'subject_id' or 'subject' name is required."


def _resolve_student(
    db: Database,
    student_id: Optional[str] = None,
    student_email: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Resolve a student user document from ObjectId, institutional student_id code, or email."""
    if student_id and isinstance(student_id, str) and student_id.strip():
        s_str = student_id.strip()
        s_oid = to_object_id(s_str)
        if s_oid:
            doc = db.users.find_one({"_id": s_oid, "role": "student"})
            if not doc:
                return None, f"Student user '{s_str}' not found."
            return doc, None
        # Fallback match against institutional student code field if non-ObjectId string supplied
        doc = db.users.find_one({"student_id": s_str, "role": "student"})
        if not doc:
            return None, f"Invalid or unknown student identifier '{s_str}'."
        return doc, None

    if student_email and isinstance(student_email, str) and student_email.strip():
        doc = db.users.find_one({"email": student_email.strip().lower(), "role": "student"})
        if not doc:
            return None, f"Student with email '{student_email.strip()}' not found."
        return doc, None

    return None, "Either 'student_id' or 'student_email' is required."


def serialize_academic_record(
    doc: Dict[str, Any],
    student_map: Optional[Dict[ObjectId, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Serialize a MongoDB academic_records document into a clean API response dict."""
    s_oid = doc.get("student_id")
    s_info = (student_map or {}).get(s_oid, {})
    return {
        "id": str(doc["_id"]),
        "student_id": str(s_oid) if s_oid else None,
        "student_name": doc.get("student_name") or s_info.get("full_name", ""),
        "student_email": s_info.get("email", ""),
        "student_code": doc.get("student_code") or s_info.get("student_id"),
        "subject_id": str(doc["subject_id"]) if doc.get("subject_id") else None,
        "subject": doc.get("subject", ""),
        "term": doc.get("term", ""),
        "g1": doc.get("g1"),
        "g2": doc.get("g2"),
        "final_exam_marks": doc.get("final_exam_marks"),
        "study_hours_per_week": doc.get("study_hours_per_week"),
        "assignment_completion_rate": doc.get("assignment_completion_rate"),
        "quiz_average": doc.get("quiz_average"),
        "previous_exam_marks": doc.get("previous_exam_marks"),
        "attendance_percentage": doc.get("attendance_percentage"),
        "studytime": doc.get("studytime"),
        "failures": doc.get("failures"),
        "absences": doc.get("absences"),
        "notes": doc.get("notes"),
        "source": doc.get("source") or ("stream_event" if doc.get("last_stream_event_id") else "institutional_entry"),
        "recorded_by": str(doc["recorded_by"]) if doc.get("recorded_by") else None,
        "created_at": doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
        "updated_at": doc["updated_at"].isoformat() if isinstance(doc.get("updated_at"), datetime) else doc.get("updated_at"),
    }


def _extract_and_validate_metrics(payload: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Parse and validate academic numeric metrics & optional notes."""
    metrics: Dict[str, Any] = {}
    has_any_metric = False

    for field, (low, high, cast_t) in FIELD_BOUNDS.items():
        if field in payload and payload[field] is not None and str(payload[field]).strip() != "":
            val, err = _parse_bounded_number(payload[field], field, low, high, cast_t)
            if err:
                return None, err
            if val is not None:
                metrics[field] = val
                has_any_metric = True

    if "notes" in payload:
        raw_notes = payload.get("notes")
        if raw_notes is not None and str(raw_notes).strip():
            clean_n, err_n = clean_and_validate_text(str(raw_notes), field_name="notes", min_len=1, max_len=500)
            if err_n:
                return None, err_n
            metrics["notes"] = clean_n
        else:
            metrics["notes"] = None

    if not has_any_metric:
        return None, "At least one numeric academic metric (e.g., g1, g2, final_exam_marks, quiz_average, assignment_completion_rate, study_hours_per_week) must be provided."

    return metrics, None


class AcademicRecordService:
    """Service layer managing institutional academic coursework & examination records."""

    @classmethod
    def create_record(
        cls,
        db: Database,
        actor_user: Any,
        data: Dict[str, Any],
        source: str = "manual_entry",
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503

        role = getattr(actor_user, "role", None)
        if role not in ("admin", "teacher"):
            return None, "Forbidden: Only teachers and administrators may create academic records.", 403

        student_doc, stu_err = _resolve_student(
            db,
            student_id=data.get("student_id"),
            student_email=data.get("student_email"),
        )
        if stu_err or not student_doc:
            return None, stu_err or "Student not found.", 404 if "not found" in (stu_err or "").lower() else 400

        subject_doc, subj_err = _resolve_subject(
            db,
            subject_id=data.get("subject_id"),
            subject_name=data.get("subject"),
        )
        if subj_err or not subject_doc:
            return None, subj_err or "Subject not found.", 404 if "not found" in (subj_err or "").lower() else 400

        raw_term = data.get("term") or data.get("academic_term")
        if not isinstance(raw_term, str) or not raw_term.strip():
            return None, "'term' (academic term) is required.", 400
        term = raw_term.strip()
        if len(term) > 30:
            return None, "'term' must not exceed 30 characters.", 400

        if role == "teacher":
            if not can_access_student_subject_data(
                actor_user,
                student_doc["_id"],
                subject_doc["_id"],
                db,
                academic_term=term,
            ):
                return (
                    None,
                    "Forbidden: You can only record coursework for students actively enrolled in your assigned subject and term.",
                    403,
                )

        metrics, m_err = _extract_and_validate_metrics(data)
        if m_err or metrics is None:
            return None, m_err, 400

        # Prevent silent duplicates on (student_id, subject, term)
        existing = db.academic_records.find_one(
            {
                "student_id": student_doc["_id"],
                "subject": subject_doc["name"],
                "term": term,
            }
        )
        if existing:
            return (
                None,
                "Conflict: An academic record already exists for this student, subject, and term.",
                409,
            )

        now = datetime.now(timezone.utc)
        doc: Dict[str, Any] = {
            "_id": ObjectId(),
            "student_id": student_doc["_id"],
            "student_name": student_doc.get("full_name", ""),
            "student_code": student_doc.get("student_id"),
            "subject_id": subject_doc["_id"],
            "subject": subject_doc["name"],
            "term": term,
            "source": source,
            "recorded_by": actor_user.id,
            "created_at": now,
            "updated_at": now,
            **metrics,
        }

        try:
            db.academic_records.insert_one(doc)
        except DuplicateKeyError:
            return (
                None,
                "Conflict: An academic record already exists for this student, subject, and term.",
                409,
            )

        log_event(
            db,
            event_type="academic_record_created",
            actor_id=actor_user.id,
            details={
                "record_id": str(doc["_id"]),
                "student_id": str(student_doc["_id"]),
                "subject": subject_doc["name"],
                "term": term,
                "source": source,
            },
        )

        serialized = serialize_academic_record(doc, {student_doc["_id"]: student_doc})
        return {"record": serialized}, None, 201

    @classmethod
    def update_record(
        cls,
        db: Database,
        record_id: str,
        actor_user: Any,
        data: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503

        role = getattr(actor_user, "role", None)
        if role not in ("admin", "teacher"):
            return None, "Forbidden: Only teachers and administrators may update academic records.", 403

        rec_oid = to_object_id(record_id)
        if not rec_oid:
            return None, "Invalid academic record ID format.", 400

        existing = db.academic_records.find_one({"_id": rec_oid})
        if not existing:
            return None, "Academic record not found.", 404

        subject_oid = existing.get("subject_id")
        if not subject_oid and existing.get("subject"):
            s_doc, _ = _resolve_subject(db, subject_name=existing.get("subject"))
            if s_doc:
                subject_oid = s_doc["_id"]

        if role == "teacher":
            if not subject_oid or not can_access_student_subject_data(
                actor_user,
                existing["student_id"],
                subject_oid,
                db,
                academic_term=existing.get("term"),
            ):
                return (
                    None,
                    "Forbidden: You can only modify academic records for students in your assigned subject and term.",
                    403,
                )

        # Validate updatable fields (never reassign student_id / subject_id)
        updates: Dict[str, Any] = {}
        for field, (low, high, cast_t) in FIELD_BOUNDS.items():
            if field in data:
                if data[field] is None or (isinstance(data[field], str) and not data[field].strip()):
                    updates[field] = None
                else:
                    val, err = _parse_bounded_number(data[field], field, low, high, cast_t)
                    if err:
                        return None, err, 400
                    updates[field] = val

        if "notes" in data:
            raw_notes = data.get("notes")
            if raw_notes is not None and str(raw_notes).strip():
                clean_n, err_n = clean_and_validate_text(str(raw_notes), field_name="notes", min_len=1, max_len=500)
                if err_n:
                    return None, err_n, 400
                updates["notes"] = clean_n
            else:
                updates["notes"] = None

        if not updates:
            return None, "No valid fields supplied for update.", 400

        updates["updated_at"] = datetime.now(timezone.utc)
        updates["recorded_by"] = actor_user.id

        db.academic_records.update_one({"_id": rec_oid}, {"$set": updates})
        reloaded = db.academic_records.find_one({"_id": rec_oid})
        student_doc = db.users.find_one({"_id": reloaded["student_id"]}, {"full_name": 1, "email": 1, "student_id": 1})

        log_event(
            db,
            event_type="academic_record_updated",
            actor_id=actor_user.id,
            details={
                "record_id": str(rec_oid),
                "student_id": str(reloaded["student_id"]),
                "subject": reloaded.get("subject"),
                "term": reloaded.get("term"),
                "updated_fields": sorted(k for k in updates.keys() if k not in ("updated_at", "recorded_by")),
            },
        )

        return {
            "record": serialize_academic_record(
                reloaded,
                {reloaded["student_id"]: student_doc} if student_doc else {},
            )
        }, None, 200

    @classmethod
    def list_records(
        cls,
        db: Database,
        actor_user: Any,
        student_id: Optional[str] = None,
        subject: Optional[str] = None,
        subject_id: Optional[str] = None,
        term: Optional[str] = None,
        page: Any = 1,
        limit: Any = 50,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503

        role = getattr(actor_user, "role", None)
        if role not in ("admin", "teacher", "student"):
            return None, "Forbidden: Analysts cannot access student-level academic records.", 403

        try:
            page_num = max(1, int(page))
        except (TypeError, ValueError):
            page_num = 1
        try:
            limit_num = min(100, max(1, int(limit)))
        except (TypeError, ValueError):
            limit_num = 50

        query: Dict[str, Any] = {}

        # Optional subject resolution
        subj_doc: Optional[Dict[str, Any]] = None
        if subject_id or subject:
            subj_doc, subj_err = _resolve_subject(db, subject_id=subject_id, subject_name=subject)
            if subj_err:
                return None, subj_err, 404 if "not found" in subj_err.lower() else 400

        if term and term.strip():
            query["term"] = term.strip()

        if role == "student":
            if student_id and str(student_id) != str(actor_user.id):
                return None, "Forbidden: Students may only view their own academic records.", 403
            query["student_id"] = actor_user.id
            if subj_doc:
                query["$or"] = [{"subject_id": subj_doc["_id"]}, {"subject": subj_doc["name"]}]
        elif role == "teacher":
            assign_q: Dict[str, Any] = {"teacher_id": actor_user.id, "status": "active"}
            if subj_doc:
                assign_q["subject_id"] = subj_doc["_id"]
            if term and term.strip():
                assign_q["academic_term"] = term.strip()

            assignments = list(db.teacher_subject_assignments.find(assign_q))
            if not assignments:
                if subj_doc:
                    return None, "Forbidden: You are not assigned to teach this subject.", 403
                return {"records": [], "total_count": 0, "page": page_num, "limit": limit_num}, None, 200

            subj_ids = [a["subject_id"] for a in assignments if "subject_id" in a]
            subj_names = {
                s["_id"]: s.get("name", "")
                for s in db.subjects.find({"_id": {"$in": subj_ids}}, {"name": 1})
            }

            # Strictly restrict to enrolled students in teacher's active (subject, term) pairs
            pair_scopes = []
            for a in assignments:
                s_id = a.get("subject_id")
                a_term = a.get("academic_term")
                s_name = subj_names.get(s_id)
                enrolls = list(
                    db.student_subject_enrollments.find(
                        {"subject_id": s_id, "academic_term": a_term, "status": "active"},
                        {"student_id": 1},
                    )
                )
                enrolled_sids = [e["student_id"] for e in enrolls if "student_id" in e]
                if not enrolled_sids:
                    continue
                if student_id:
                    req_s_oid = to_object_id(student_id)
                    if not req_s_oid:
                        return None, "Invalid student_id format.", 400
                    enrolled_sids = [sid for sid in enrolled_sids if sid == req_s_oid]
                if enrolled_sids:
                    pair_scopes.append(
                        {
                            "student_id": {"$in": enrolled_sids},
                            "term": a_term,
                            "$or": [{"subject_id": s_id}, {"subject": s_name}],
                        }
                    )

            if not pair_scopes:
                if student_id:
                    req_s_oid = to_object_id(student_id)
                    if not req_s_oid:
                        return None, "Invalid student_id format.", 400
                    return None, "Forbidden: Student is not enrolled in your assigned subject and term.", 403
                return {"records": [], "total_count": 0, "page": page_num, "limit": limit_num}, None, 200

            query["$and"] = [{"$or": pair_scopes}]
        else:  # admin
            if student_id:
                s_oid = to_object_id(student_id)
                if not s_oid:
                    return None, "Invalid student_id format.", 400
                query["student_id"] = s_oid
            if subj_doc:
                query["$or"] = [{"subject_id": subj_doc["_id"]}, {"subject": subj_doc["name"]}]

        total_count = db.academic_records.count_documents(query)
        skip = (page_num - 1) * limit_num
        docs = list(
            db.academic_records.find(query)
            .sort([("updated_at", DESCENDING), ("created_at", DESCENDING)])
            .skip(skip)
            .limit(limit_num)
        )

        s_oids = list({d["student_id"] for d in docs if "student_id" in d})
        student_map = {
            u["_id"]: u
            for u in db.users.find({"_id": {"$in": s_oids}}, {"full_name": 1, "email": 1, "student_id": 1})
        }
        records = [serialize_academic_record(d, student_map) for d in docs]

        return {
            "records": records,
            "total_count": total_count,
            "page": page_num,
            "limit": limit_num,
        }, None, 200

    @classmethod
    def get_record_by_id(
        cls,
        db: Database,
        record_id: str,
        actor_user: Any,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503
        role = getattr(actor_user, "role", None)
        if role not in ("admin", "teacher", "student"):
            return None, "Forbidden.", 403

        rec_oid = to_object_id(record_id)
        if not rec_oid:
            return None, "Invalid academic record ID format.", 400

        doc = db.academic_records.find_one({"_id": rec_oid})
        if not doc:
            return None, "Academic record not found.", 404

        if role == "student" and str(doc.get("student_id")) != str(actor_user.id):
            return None, "Forbidden: Students may only view their own academic records.", 403

        if role == "teacher":
            subject_oid = doc.get("subject_id")
            if not subject_oid and doc.get("subject"):
                s_doc, _ = _resolve_subject(db, subject_name=doc.get("subject"))
                if s_doc:
                    subject_oid = s_doc["_id"]
            if not subject_oid or not can_access_student_subject_data(
                actor_user, doc["student_id"], subject_oid, db, academic_term=doc.get("term")
            ):
                return None, "Forbidden: Not authorized for this student record.", 403

        student_doc = db.users.find_one({"_id": doc["student_id"]}, {"full_name": 1, "email": 1, "student_id": 1})
        return {
            "record": serialize_academic_record(
                doc,
                {doc["student_id"]: student_doc} if student_doc else {},
            )
        }, None, 200

    @classmethod
    def import_csv(
        cls,
        db: Database,
        actor_user: Any,
        csv_bytes: bytes,
        default_subject_id: Optional[str] = None,
        default_term: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503

        role = getattr(actor_user, "role", None)
        if role not in ("admin", "teacher"):
            return None, "Forbidden: Only teachers and administrators may import academic CSV files.", 403

        if not csv_bytes or len(csv_bytes) == 0:
            return None, "Uploaded CSV file is empty.", 400
        if len(csv_bytes) > MAX_CSV_BYTES:
            return None, "CSV file exceeds maximum size limit of 2 MB.", 400

        try:
            text = csv_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            return None, "CSV file must be valid UTF-8 encoded text.", 400

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return None, "CSV file is missing a header row.", 400

        normalized_headers = [h.strip() for h in reader.fieldnames if h]
        reader.fieldnames = normalized_headers

        has_student_col = any(col in normalized_headers for col in ("student_id", "student_email"))
        if not has_student_col:
            return None, "CSV header must include 'student_id' or 'student_email'.", 400

        has_subject_col = any(col in normalized_headers for col in ("subject", "subject_id")) or bool(default_subject_id)
        has_term_col = any(col in normalized_headers for col in ("term", "academic_term")) or bool(default_term)
        if not has_subject_col or not has_term_col:
            return None, "CSV must supply 'subject'/'subject_id' and 'term' (or select defaults in upload request).", 400

        rows = list(reader)
        if len(rows) == 0:
            return None, "CSV file contains headers but 0 data rows.", 400
        if len(rows) > MAX_CSV_ROWS:
            return None, f"CSV exceeds maximum {MAX_CSV_ROWS} rows per import.", 400

        # Pre-check default subject if supplied
        default_subj_doc = None
        if default_subject_id:
            default_subj_doc, def_err = _resolve_subject(db, subject_id=default_subject_id)
            if def_err:
                return None, def_err, 400

        successful = 0
        rejected = 0
        duplicate = 0
        errors: List[Dict[str, Any]] = []
        created_ids: List[str] = []
        seen_in_file = set()

        for row_idx, row in enumerate(rows, start=2):
            clean_row = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}

            student_doc, stu_err = _resolve_student(
                db,
                student_id=clean_row.get("student_id"),
                student_email=clean_row.get("student_email"),
            )
            if stu_err or not student_doc:
                rejected += 1
                errors.append({"row": row_idx, "status": "rejected", "reason": stu_err or "Student not found."})
                continue

            if clean_row.get("subject_id") or clean_row.get("subject"):
                subj_doc, subj_err = _resolve_subject(
                    db,
                    subject_id=clean_row.get("subject_id"),
                    subject_name=clean_row.get("subject"),
                )
            else:
                subj_doc, subj_err = default_subj_doc, None

            if subj_err or not subj_doc:
                rejected += 1
                errors.append({"row": row_idx, "status": "rejected", "reason": subj_err or "Subject not found."})
                continue

            term_val = clean_row.get("term") or clean_row.get("academic_term") or (default_term.strip() if default_term else "")
            if not term_val or len(term_val) > 30:
                rejected += 1
                errors.append({"row": row_idx, "status": "rejected", "reason": "Valid term is required (<= 30 chars)."})
                continue

            if role == "teacher":
                if not can_access_student_subject_data(
                    actor_user, student_doc["_id"], subj_doc["_id"], db, academic_term=term_val
                ):
                    rejected += 1
                    errors.append({
                        "row": row_idx,
                        "status": "rejected",
                        "reason": "Forbidden: Student/subject/term not in your active assigned roster.",
                    })
                    continue

            tuple_key = (str(student_doc["_id"]), subj_doc["name"], term_val)
            if tuple_key in seen_in_file:
                duplicate += 1
                errors.append({
                    "row": row_idx,
                    "status": "duplicate",
                    "reason": f"Duplicate (student, subject='{subj_doc['name']}', term='{term_val}') inside CSV file.",
                })
                continue
            seen_in_file.add(tuple_key)

            existing = db.academic_records.find_one(
                {"student_id": student_doc["_id"], "subject": subj_doc["name"], "term": term_val},
                {"_id": 1},
            )
            if existing:
                duplicate += 1
                errors.append({
                    "row": row_idx,
                    "status": "duplicate",
                    "reason": f"Record already exists for {student_doc.get('full_name', '')} in {subj_doc['name']} ({term_val}).",
                })
                continue

            metrics, m_err = _extract_and_validate_metrics(clean_row)
            if m_err or metrics is None:
                rejected += 1
                errors.append({"row": row_idx, "status": "rejected", "reason": m_err or "Invalid metrics."})
                continue

            now = datetime.now(timezone.utc)
            doc: Dict[str, Any] = {
                "_id": ObjectId(),
                "student_id": student_doc["_id"],
                "student_name": student_doc.get("full_name", ""),
                "student_code": student_doc.get("student_id"),
                "subject_id": subj_doc["_id"],
                "subject": subj_doc["name"],
                "term": term_val,
                "source": "csv_import",
                "recorded_by": actor_user.id,
                "created_at": now,
                "updated_at": now,
                **metrics,
            }
            try:
                db.academic_records.insert_one(doc)
                successful += 1
                created_ids.append(str(doc["_id"]))
            except DuplicateKeyError:
                duplicate += 1
                errors.append({
                    "row": row_idx,
                    "status": "duplicate",
                    "reason": f"Duplicate record for {subj_doc['name']} ({term_val}).",
                })

        log_event(
            db,
            event_type="academic_records_csv_imported",
            actor_id=actor_user.id,
            details={
                "total_rows": len(rows),
                "successful": successful,
                "rejected": rejected,
                "duplicate": duplicate,
            },
        )

        return {
            "summary": {
                "total_rows": len(rows),
                "successful": successful,
                "rejected": rejected,
                "duplicate": duplicate,
                "created_record_ids": created_ids,
                "errors": errors[:100],
            }
        }, None, 200
