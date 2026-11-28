"""
EduPredict - Attendance Register Service (Workstream A / Phase 13)
Module: backend.services.attendance_service
Purpose: Manages persistent institutional roll-call attendance sessions and student
attendance records with strict subject-term RBAC, duplicate prevention, date validation,
and complete separation from the ML 60-session absence proxy.
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from backend.models.attendance_model import (
    ATTENDANCE_STATUS_LOOKUP,
    AttendanceRecord,
    AttendanceSession,
)
from backend.services.system_log_service import log_event
from backend.utils.decorators import can_access_student_data, can_access_student_subject_data
from backend.utils.security import clean_and_validate_text, to_object_id

ML_PROXY_DISCLOSURE = (
    "Verified Institutional Attendance is calculated strictly from teacher-recorded roll-call "
    "sessions and never alters or overwrites the Estimated ML Attendance Proxy "
    "(max(0, 100 - (absences / 60) * 100))."
)
ATTENDANCE_FORMULA = "Attended (Present + Late) / Non-Excused Marked Sessions * 100"


def _parse_session_date(raw_date: Any) -> Tuple[Optional[str], Optional[str]]:
    """Validate YYYY-MM-DD calendar date and reject strictly future dates."""
    if not isinstance(raw_date, str) or not raw_date.strip():
        return None, "session_date is required in YYYY-MM-DD format."
    cleaned = raw_date.strip()
    try:
        parsed = date.fromisoformat(cleaned)
    except ValueError:
        return None, "session_date must be a valid calendar date in YYYY-MM-DD format."

    if parsed.year < 2000:
        return None, "session_date cannot be earlier than year 2000."
    today_utc = datetime.now(timezone.utc).date()
    if parsed > today_utc:
        return None, "session_date cannot be in the future."
    return parsed.isoformat(), None


def _compute_rate(present: int, late: int, excused: int, total: int) -> Optional[float]:
    """Compute honest institutional percentage; return None when no non-excused sessions exist."""
    effective = total - excused
    if effective <= 0:
        return None
    return round(((present + late) / effective) * 100.0, 1)


def _get_teacher_active_assignments(
    db: Database,
    teacher_oid: ObjectId,
    subject_oid: Optional[ObjectId] = None,
    academic_term: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {"teacher_id": teacher_oid, "status": "active"}
    if subject_oid:
        query["subject_id"] = subject_oid
    if academic_term:
        query["academic_term"] = academic_term.strip()
    return list(db.teacher_subject_assignments.find(query))


def _recompute_session_counts(db: Database, session_oid: ObjectId) -> Dict[str, int]:
    """Aggregate live status counts for a single session from attendance_records."""
    pipeline = [
        {"$match": {"session_id": session_oid}},
        {"$group": {"_id": "$status", "cnt": {"$sum": 1}}},
    ]
    counts = {"Present": 0, "Absent": 0, "Late": 0, "Excused": 0}
    for row in db.attendance_records.aggregate(pipeline):
        if row["_id"] in counts:
            counts[row["_id"]] = int(row["cnt"])
    total = sum(counts.values())
    now = datetime.now(timezone.utc)
    db.attendance_sessions.update_one(
        {"_id": session_oid},
        {
            "$set": {
                "total_students": total,
                "present_count": counts["Present"],
                "absent_count": counts["Absent"],
                "late_count": counts["Late"],
                "excused_count": counts["Excused"],
                "updated_at": now,
            }
        },
    )
    return {
        "total_students": total,
        "present_count": counts["Present"],
        "absent_count": counts["Absent"],
        "late_count": counts["Late"],
        "excused_count": counts["Excused"],
    }


def _validate_records_payload(
    db: Database,
    records_payload: Any,
    subject_oid: ObjectId,
    academic_term: str,
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str], int]:
    """Validate attendance records payload against enrolled roster & allowed statuses."""
    if not isinstance(records_payload, list) or len(records_payload) == 0:
        return None, "'records' must be a non-empty list of student attendance statuses.", 400

    # Batch-fetch active enrollments for (subject_oid, academic_term)
    enrollments = list(
        db.student_subject_enrollments.find(
            {
                "subject_id": subject_oid,
                "academic_term": academic_term,
                "status": "active",
            }
        )
    )
    enrolled_ids = {e["student_id"] for e in enrollments if "student_id" in e}

    parsed_entries: List[Dict[str, Any]] = []
    seen_students = set()

    for idx, item in enumerate(records_payload):
        if not isinstance(item, dict):
            return None, f"Record entry at index {idx} must be an object.", 400

        s_oid = to_object_id(item.get("student_id"))
        if not s_oid:
            return None, f"Invalid student_id at index {idx}.", 400

        if s_oid in seen_students:
            return None, "Duplicate student entry detected in attendance submission.", 400
        seen_students.add(s_oid)

        raw_status = item.get("status")
        if not isinstance(raw_status, str) or not raw_status.strip():
            return None, f"Attendance status is required for student at index {idx}.", 400
        canonical_status = ATTENDANCE_STATUS_LOOKUP.get(raw_status.strip().lower())
        if not canonical_status:
            return (
                None,
                f"Invalid status '{raw_status}'. Must be one of: Present, Absent, Late, Excused.",
                400,
            )

        raw_remarks = item.get("remarks")
        clean_remarks: Optional[str] = None
        if raw_remarks is not None and str(raw_remarks).strip():
            val_rem, err_rem = clean_and_validate_text(
                str(raw_remarks), field_name="remarks", min_len=1, max_len=300
            )
            if err_rem:
                return None, err_rem, 400
            clean_remarks = val_rem

        if s_oid not in enrolled_ids:
            return (
                None,
                f"Student '{str(s_oid)}' is not actively enrolled in this subject and term.",
                403,
            )

        parsed_entries.append(
            {
                "student_id": s_oid,
                "status": canonical_status,
                "remarks": clean_remarks,
            }
        )

    # Fetch student metadata in one query
    student_docs = {
        u["_id"]: u
        for u in db.users.find(
            {"_id": {"$in": list(seen_students)}, "role": "student"},
            {"full_name": 1, "student_id": 1},
        )
    }
    for entry in parsed_entries:
        u_doc = student_docs.get(entry["student_id"])
        if not u_doc:
            return None, f"Student user '{str(entry['student_id'])}' not found.", 404
        entry["student_name"] = u_doc.get("full_name", "")
        entry["student_code"] = u_doc.get("student_id")

    return parsed_entries, None, 200


class AttendanceService:
    """Service layer for Institutional Attendance Register management."""

    @classmethod
    def create_session(
        cls,
        db: Database,
        actor_user: Any,
        data: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503
        if getattr(actor_user, "role", None) != "teacher":
            return None, "Only assigned teachers may create attendance sessions.", 403

        subject_oid = to_object_id(data.get("subject_id"))
        if not subject_oid:
            return None, "Valid 'subject_id' is required.", 400

        raw_term = data.get("academic_term")
        if not isinstance(raw_term, str) or not raw_term.strip():
            return None, "'academic_term' is required (e.g., '2026-T1').", 400
        academic_term = raw_term.strip()
        if len(academic_term) > 30:
            return None, "'academic_term' must not exceed 30 characters.", 400

        session_date, date_err = _parse_session_date(data.get("session_date"))
        if date_err or not session_date:
            return None, date_err or "Invalid session_date.", 400

        # Enforce active teacher assignment to this exact subject & term
        assignments = _get_teacher_active_assignments(
            db, actor_user.id, subject_oid=subject_oid, academic_term=academic_term
        )
        if not assignments:
            return (
                None,
                "Forbidden: You do not have an active teaching assignment for this subject and academic term.",
                403,
            )

        subject_doc = db.subjects.find_one({"_id": subject_oid, "is_active": True})
        if not subject_doc:
            return None, "Subject not found or inactive.", 404

        raw_title = data.get("session_title", "")
        clean_title = ""
        if isinstance(raw_title, str) and raw_title.strip():
            val_t, err_t = clean_and_validate_text(
                raw_title, field_name="session_title", min_len=1, max_len=120
            )
            if err_t:
                return None, err_t, 400
            clean_title = val_t or ""

        raw_notes = data.get("notes")
        clean_notes: Optional[str] = None
        if raw_notes is not None and str(raw_notes).strip():
            val_n, err_n = clean_and_validate_text(
                str(raw_notes), field_name="notes", min_len=1, max_len=500
            )
            if err_n:
                return None, err_n, 400
            clean_notes = val_n

        # Duplicate check before inserting
        existing = db.attendance_sessions.find_one(
            {
                "subject_id": subject_oid,
                "academic_term": academic_term,
                "session_date": session_date,
                "session_title": clean_title,
            }
        )
        if existing:
            return (
                None,
                "Conflict: An attendance session already exists for this subject, term, date, and title.",
                409,
            )

        validated_records: List[Dict[str, Any]] = []
        if "records" in data and data["records"] is not None:
            validated_records, rec_err, rec_status = _validate_records_payload(
                db, data["records"], subject_oid=subject_oid, academic_term=academic_term
            )
            if rec_err or validated_records is None:
                return None, rec_err, rec_status

        session = AttendanceSession(
            subject_id=subject_oid,
            subject_name=subject_doc.get("name", ""),
            subject_code=subject_doc.get("code", ""),
            teacher_id=actor_user.id,
            teacher_name=getattr(actor_user, "full_name", "Teacher"),
            academic_term=academic_term,
            session_date=session_date,
            session_title=clean_title,
            notes=clean_notes,
            created_by=actor_user.id,
        )

        try:
            db.attendance_sessions.insert_one(session.to_doc())
        except DuplicateKeyError:
            return (
                None,
                "Conflict: An attendance session already exists for this subject, term, date, and title.",
                409,
            )

        saved_records: List[Dict[str, Any]] = []
        if validated_records:
            now = datetime.now(timezone.utc)
            record_docs = []
            for entry in validated_records:
                rec = AttendanceRecord(
                    session_id=session.id,
                    student_id=entry["student_id"],
                    subject_id=subject_oid,
                    subject_name=subject_doc.get("name", ""),
                    teacher_id=actor_user.id,
                    academic_term=academic_term,
                    session_date=session_date,
                    status=entry["status"],
                    student_name=entry["student_name"],
                    student_code=entry.get("student_code"),
                    remarks=entry.get("remarks"),
                    marked_by=actor_user.id,
                    marked_at=now,
                    updated_at=now,
                )
                record_docs.append(rec.to_doc())
                saved_records.append(rec.to_dict())
            db.attendance_records.insert_many(record_docs)
            counts = _recompute_session_counts(db, session.id)
            for k, v in counts.items():
                setattr(session, k, v)

        log_event(
            db,
            event_type="attendance_session_created",
            actor_id=actor_user.id,
            details={
                "session_id": str(session.id),
                "subject_id": str(subject_oid),
                "academic_term": academic_term,
                "session_date": session_date,
                "marked_count": len(saved_records),
            },
        )

        return {
            "session": session.to_dict(),
            "records": saved_records,
            "disclosure": ML_PROXY_DISCLOSURE,
        }, None, 201

    @classmethod
    def list_sessions(
        cls,
        db: Database,
        actor_user: Any,
        subject_id: Optional[str] = None,
        academic_term: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: Any = 1,
        limit: Any = 25,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503

        role = getattr(actor_user, "role", None)
        if role not in ("admin", "teacher"):
            return None, "Forbidden: Only teachers and administrators can inspect class attendance sessions.", 403

        try:
            page_num = max(1, int(page))
        except (TypeError, ValueError):
            page_num = 1
        try:
            limit_num = min(100, max(1, int(limit)))
        except (TypeError, ValueError):
            limit_num = 25

        query: Dict[str, Any] = {}
        subj_oid: Optional[ObjectId] = None
        if subject_id:
            subj_oid = to_object_id(subject_id)
            if not subj_oid:
                return None, "Invalid subject_id filter.", 400
            query["subject_id"] = subj_oid

        if academic_term and academic_term.strip():
            query["academic_term"] = academic_term.strip()

        if date_from or date_to:
            date_filter: Dict[str, str] = {}
            if date_from:
                date_filter["$gte"] = date_from.strip()
            if date_to:
                date_filter["$lte"] = date_to.strip()
            query["session_date"] = date_filter

        if role == "teacher":
            assignments = _get_teacher_active_assignments(
                db,
                actor_user.id,
                subject_oid=subj_oid,
                academic_term=academic_term.strip() if academic_term else None,
            )
            if not assignments:
                if subj_oid:
                    return None, "Forbidden: You are not assigned to this subject.", 403
                return {
                    "sessions": [],
                    "total_count": 0,
                    "page": page_num,
                    "limit": limit_num,
                    "disclosure": ML_PROXY_DISCLOSURE,
                }, None, 200

            pair_clauses = [
                {"subject_id": a["subject_id"], "academic_term": a["academic_term"]}
                for a in assignments
                if a.get("subject_id") and a.get("academic_term")
            ]
            if not pair_clauses:
                return {
                    "sessions": [],
                    "total_count": 0,
                    "page": page_num,
                    "limit": limit_num,
                    "disclosure": ML_PROXY_DISCLOSURE,
                }, None, 200
            query["$or"] = pair_clauses

        total_count = db.attendance_sessions.count_documents(query)
        skip = (page_num - 1) * limit_num
        docs = list(
            db.attendance_sessions.find(query)
            .sort([("session_date", -1), ("created_at", -1)])
            .skip(skip)
            .limit(limit_num)
        )
        sessions = [AttendanceSession.from_doc(d).to_dict() for d in docs if d]
        return {
            "sessions": sessions,
            "total_count": total_count,
            "page": page_num,
            "limit": limit_num,
            "disclosure": ML_PROXY_DISCLOSURE,
        }, None, 200

    @classmethod
    def get_session_detail(
        cls,
        db: Database,
        session_id: str,
        actor_user: Any,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503
        role = getattr(actor_user, "role", None)
        if role not in ("admin", "teacher"):
            return None, "Forbidden: Access restricted to assigned teachers and administrators.", 403

        sess_oid = to_object_id(session_id)
        if not sess_oid:
            return None, "Invalid session ID format.", 400

        doc = db.attendance_sessions.find_one({"_id": sess_oid})
        if not doc:
            return None, "Attendance session not found.", 404

        session = AttendanceSession.from_doc(doc)
        if not session:
            return None, "Attendance session not found.", 404

        if role == "teacher":
            assignments = _get_teacher_active_assignments(
                db, actor_user.id, subject_oid=session.subject_id, academic_term=session.academic_term
            )
            if not assignments:
                return None, "Forbidden: You are not assigned to this session's subject and term.", 403

        existing_records = list(
            db.attendance_records.find({"session_id": session.id}).sort("student_name", 1)
        )
        record_by_student = {
            r["student_id"]: AttendanceRecord.from_doc(r).to_dict()
            for r in existing_records
            if r
        }

        # Include enrolled roster so teacher UI can mark/edit unmarked students cleanly
        enrollments = list(
            db.student_subject_enrollments.find(
                {
                    "subject_id": session.subject_id,
                    "academic_term": session.academic_term,
                    "status": "active",
                }
            )
        )
        enrolled_ids = [e["student_id"] for e in enrollments if "student_id" in e]
        student_docs = list(
            db.users.find(
                {"_id": {"$in": enrolled_ids}, "role": "student"},
                {"full_name": 1, "email": 1, "student_id": 1},
            ).sort("full_name", 1)
        )
        roster = []
        for s_doc in student_docs:
            sid = s_doc["_id"]
            existing_rec = record_by_student.get(sid)
            roster.append(
                {
                    "student_id": str(sid),
                    "student_name": s_doc.get("full_name", ""),
                    "student_email": s_doc.get("email", ""),
                    "student_code": s_doc.get("student_id"),
                    "status": existing_rec["status"] if existing_rec else None,
                    "remarks": existing_rec["remarks"] if existing_rec else None,
                    "record_id": existing_rec["id"] if existing_rec else None,
                }
            )

        return {
            "session": session.to_dict(),
            "records": list(record_by_student.values()),
            "roster": roster,
            "disclosure": ML_PROXY_DISCLOSURE,
        }, None, 200

    @classmethod
    def mark_session_records(
        cls,
        db: Database,
        session_id: str,
        actor_user: Any,
        data: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503
        if getattr(actor_user, "role", None) != "teacher":
            return None, "Only assigned teachers may record or update session attendance.", 403

        sess_oid = to_object_id(session_id)
        if not sess_oid:
            return None, "Invalid session ID format.", 400

        doc = db.attendance_sessions.find_one({"_id": sess_oid})
        if not doc:
            return None, "Attendance session not found.", 404

        session = AttendanceSession.from_doc(doc)
        if not session:
            return None, "Attendance session not found.", 404

        assignments = _get_teacher_active_assignments(
            db, actor_user.id, subject_oid=session.subject_id, academic_term=session.academic_term
        )
        if not assignments:
            return None, "Forbidden: You are not assigned to this session's subject and term.", 403

        # Validate optional session notes update
        notes_update = None
        if "notes" in data:
            raw_notes = data.get("notes")
            if raw_notes is not None and str(raw_notes).strip():
                val_n, err_n = clean_and_validate_text(
                    str(raw_notes), field_name="notes", min_len=1, max_len=500
                )
                if err_n:
                    return None, err_n, 400
                notes_update = val_n
            else:
                notes_update = None

        validated_records, rec_err, rec_status = _validate_records_payload(
            db,
            data.get("records"),
            subject_oid=session.subject_id,
            academic_term=session.academic_term,
        )
        if rec_err or validated_records is None:
            return None, rec_err, rec_status

        now = datetime.now(timezone.utc)
        for entry in validated_records:
            db.attendance_records.update_one(
                {"session_id": session.id, "student_id": entry["student_id"]},
                {
                    "$set": {
                        "subject_id": session.subject_id,
                        "subject_name": session.subject_name,
                        "teacher_id": actor_user.id,
                        "academic_term": session.academic_term,
                        "session_date": session.session_date,
                        "status": entry["status"],
                        "student_name": entry["student_name"],
                        "student_code": entry.get("student_code"),
                        "remarks": entry.get("remarks"),
                        "marked_by": actor_user.id,
                        "updated_at": now,
                    },
                    "$setOnInsert": {
                        "marked_at": now,
                    },
                },
                upsert=True,
            )

        if "notes" in data:
            db.attendance_sessions.update_one(
                {"_id": session.id},
                {"$set": {"notes": notes_update, "updated_at": now}},
            )

        _recompute_session_counts(db, session.id)
        updated_doc = db.attendance_sessions.find_one({"_id": session.id})
        updated_session = AttendanceSession.from_doc(updated_doc)
        all_records = [
            AttendanceRecord.from_doc(r).to_dict()
            for r in db.attendance_records.find({"session_id": session.id}).sort("student_name", 1)
        ]

        log_event(
            db,
            event_type="attendance_records_updated",
            actor_id=actor_user.id,
            details={
                "session_id": str(session.id),
                "subject_id": str(session.subject_id),
                "academic_term": session.academic_term,
                "updated_students": len(validated_records),
            },
        )

        return {
            "session": updated_session.to_dict() if updated_session else session.to_dict(),
            "records": all_records,
            "disclosure": ML_PROXY_DISCLOSURE,
        }, None, 200

    @classmethod
    def get_student_attendance_view(
        cls,
        db: Database,
        actor_user: Any,
        target_student_id: Optional[str] = None,
        subject_id: Optional[str] = None,
        academic_term: Optional[str] = None,
        page: Any = 1,
        limit: Any = 50,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503

        role = getattr(actor_user, "role", None)
        if role == "analyst":
            return None, "Forbidden: Analysts cannot access student-level attendance records.", 403

        if target_student_id:
            s_oid = to_object_id(target_student_id)
            if not s_oid:
                return None, "Invalid student_id format.", 400
        elif role == "student":
            s_oid = actor_user.id
        else:
            return None, "student_id is required.", 400

        if role == "student" and str(s_oid) != str(actor_user.id):
            return None, "Forbidden: Students can only view their own attendance records.", 403

        if role == "teacher":
            if subject_id:
                subj_check_oid = to_object_id(subject_id)
                if not subj_check_oid:
                    return None, "Invalid subject_id format.", 400
                if not can_access_student_subject_data(
                    actor_user, s_oid, subj_check_oid, db, academic_term=academic_term
                ):
                    return None, "Forbidden: Not authorized for this student in this subject.", 403
            elif not can_access_student_data(actor_user, s_oid, db):
                return None, "Forbidden: You are not assigned to this student.", 403

        subj_filter_oid: Optional[ObjectId] = None
        if subject_id:
            subj_filter_oid = to_object_id(subject_id)
            if not subj_filter_oid:
                return None, "Invalid subject_id format.", 400

        # Restrict teacher to subjects they actually teach for this student
        allowed_subject_ids: Optional[List[ObjectId]] = None
        if role == "teacher":
            t_assignments = _get_teacher_active_assignments(
                db, actor_user.id, subject_oid=subj_filter_oid, academic_term=academic_term
            )
            allowed_subject_ids = list({a["subject_id"] for a in t_assignments})

        record_query: Dict[str, Any] = {"student_id": s_oid}
        if subj_filter_oid:
            record_query["subject_id"] = subj_filter_oid
        elif allowed_subject_ids is not None:
            record_query["subject_id"] = {"$in": allowed_subject_ids}
        if academic_term and academic_term.strip():
            record_query["academic_term"] = academic_term.strip()

        all_student_records = list(
            db.attendance_records.find(record_query).sort([("session_date", -1), ("marked_at", -1)])
        )

        # Build enrolled subjects baseline so enrolled courses with 0 sessions still appear honestly
        enroll_query: Dict[str, Any] = {"student_id": s_oid, "status": "active"}
        if subj_filter_oid:
            enroll_query["subject_id"] = subj_filter_oid
        elif allowed_subject_ids is not None:
            enroll_query["subject_id"] = {"$in": allowed_subject_ids}
        if academic_term and academic_term.strip():
            enroll_query["academic_term"] = academic_term.strip()

        enrollments = list(db.student_subject_enrollments.find(enroll_query))
        subject_ids_needed = list(
            {e["subject_id"] for e in enrollments if "subject_id" in e}
            | {r["subject_id"] for r in all_student_records if "subject_id" in r}
        )
        subject_map = {
            s["_id"]: s
            for s in db.subjects.find({"_id": {"$in": subject_ids_needed}}, {"name": 1, "code": 1})
        }

        per_subject: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for e in enrollments:
            sid_str = str(e["subject_id"])
            term_str = e.get("academic_term", "")
            s_doc = subject_map.get(e["subject_id"], {})
            per_subject[(sid_str, term_str)] = {
                "subject_id": sid_str,
                "subject_name": s_doc.get("name", "Unknown Subject"),
                "subject_code": s_doc.get("code", ""),
                "academic_term": term_str,
                "total_sessions": 0,
                "present_count": 0,
                "absent_count": 0,
                "late_count": 0,
                "excused_count": 0,
                "effective_sessions": 0,
                "attendance_percentage": None,
                "has_records": False,
            }

        totals = {"total_sessions": 0, "present_count": 0, "absent_count": 0, "late_count": 0, "excused_count": 0}
        for r in all_student_records:
            sid_str = str(r["subject_id"])
            term_str = r.get("academic_term", "")
            key = (sid_str, term_str)
            if key not in per_subject:
                s_doc = subject_map.get(r["subject_id"], {})
                per_subject[key] = {
                    "subject_id": sid_str,
                    "subject_name": r.get("subject_name") or s_doc.get("name", "Unknown Subject"),
                    "subject_code": s_doc.get("code", ""),
                    "academic_term": term_str,
                    "total_sessions": 0,
                    "present_count": 0,
                    "absent_count": 0,
                    "late_count": 0,
                    "excused_count": 0,
                    "effective_sessions": 0,
                    "attendance_percentage": None,
                    "has_records": False,
                }
            bucket = per_subject[key]
            status = r.get("status", "")
            bucket["total_sessions"] += 1
            totals["total_sessions"] += 1
            if status == "Present":
                bucket["present_count"] += 1
                totals["present_count"] += 1
            elif status == "Absent":
                bucket["absent_count"] += 1
                totals["absent_count"] += 1
            elif status == "Late":
                bucket["late_count"] += 1
                totals["late_count"] += 1
            elif status == "Excused":
                bucket["excused_count"] += 1
                totals["excused_count"] += 1

        subject_summaries = []
        for bucket in per_subject.values():
            bucket["effective_sessions"] = bucket["total_sessions"] - bucket["excused_count"]
            bucket["has_records"] = bucket["total_sessions"] > 0
            bucket["attendance_percentage"] = _compute_rate(
                bucket["present_count"],
                bucket["late_count"],
                bucket["excused_count"],
                bucket["total_sessions"],
            )
            subject_summaries.append(bucket)

        subject_summaries.sort(key=lambda x: (x["academic_term"], x["subject_name"]), reverse=False)

        overall_effective = totals["total_sessions"] - totals["excused_count"]
        overall_pct = _compute_rate(
            totals["present_count"],
            totals["late_count"],
            totals["excused_count"],
            totals["total_sessions"],
        )

        # Read-only reference lookup of latest ML prediction absence feature (strictly separated)
        estimated_ml_proxy = None
        latest_pred = db.predictions.find_one(
            {"student_id": s_oid},
            sort=[("created_at", -1)],
            projection={"features_summary": 1, "subject": 1, "created_at": 1, "academic_term": 1},
        )
        if latest_pred and isinstance(latest_pred.get("features_summary"), dict):
            abs_entry = latest_pred["features_summary"].get("absences")
            raw_abs = abs_entry.get("value") if isinstance(abs_entry, dict) else abs_entry
            if isinstance(raw_abs, (int, float)) and raw_abs >= 0:
                proxy_pct = round(max(0.0, 100.0 - (float(raw_abs) / 60.0) * 100.0), 1)
                estimated_ml_proxy = {
                    "label": "Estimated ML Attendance Proxy",
                    "absences": float(raw_abs),
                    "assumed_sessions": 60,
                    "estimated_attendance_percentage": proxy_pct,
                    "subject": latest_pred.get("subject"),
                    "academic_term": latest_pred.get("academic_term"),
                    "formula": "max(0, 100 - (absences / 60) * 100)",
                    "is_verified_roll_call": False,
                }

        try:
            page_num = max(1, int(page))
        except (TypeError, ValueError):
            page_num = 1
        try:
            limit_num = min(100, max(1, int(limit)))
        except (TypeError, ValueError):
            limit_num = 50
        start = (page_num - 1) * limit_num
        end = start + limit_num
        paged_records = [
            AttendanceRecord.from_doc(r).to_dict()
            for r in all_student_records[start:end]
        ]

        return {
            "student_id": str(s_oid),
            "verified_institutional_attendance": {
                "label": "Verified Institutional Attendance",
                "overall_attendance_percentage": overall_pct,
                "total_sessions": totals["total_sessions"],
                "effective_sessions": overall_effective,
                "present_count": totals["present_count"],
                "absent_count": totals["absent_count"],
                "late_count": totals["late_count"],
                "excused_count": totals["excused_count"],
                "has_records": totals["total_sessions"] > 0,
                "formula": ATTENDANCE_FORMULA,
                "subject_summaries": subject_summaries,
            },
            "estimated_ml_proxy": estimated_ml_proxy,
            "records": paged_records,
            "total_count": len(all_student_records),
            "page": page_num,
            "limit": limit_num,
            "disclosure": ML_PROXY_DISCLOSURE,
        }, None, 200

    @classmethod
    def get_summary(
        cls,
        db: Database,
        actor_user: Any,
        student_id: Optional[str] = None,
        subject_id: Optional[str] = None,
        academic_term: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503
        role = getattr(actor_user, "role", None)
        if role == "analyst":
            return None, "Forbidden: Analysts must use aggregate de-identified endpoints.", 403

        if role == "student" or student_id:
            return cls.get_student_attendance_view(
                db,
                actor_user=actor_user,
                target_student_id=student_id or (str(actor_user.id) if role == "student" else None),
                subject_id=subject_id,
                academic_term=academic_term,
            )

        if role not in ("admin", "teacher"):
            return None, "Forbidden.", 403

        subj_oid: Optional[ObjectId] = None
        if subject_id:
            subj_oid = to_object_id(subject_id)
            if not subj_oid:
                return None, "Invalid subject_id format.", 400

        session_query: Dict[str, Any] = {}
        record_query: Dict[str, Any] = {}
        if subj_oid:
            session_query["subject_id"] = subj_oid
            record_query["subject_id"] = subj_oid
        if academic_term and academic_term.strip():
            term_clean = academic_term.strip()
            session_query["academic_term"] = term_clean
            record_query["academic_term"] = term_clean

        if role == "teacher":
            assignments = _get_teacher_active_assignments(
                db,
                actor_user.id,
                subject_oid=subj_oid,
                academic_term=academic_term.strip() if academic_term else None,
            )
            if not assignments:
                if subj_oid:
                    return None, "Forbidden: You are not assigned to this subject.", 403
                return {
                    "subject_summaries": [],
                    "overall": {
                        "total_sessions": 0,
                        "total_marked_entries": 0,
                        "present_count": 0,
                        "absent_count": 0,
                        "late_count": 0,
                        "excused_count": 0,
                        "attendance_percentage": None,
                        "has_records": False,
                    },
                    "formula": ATTENDANCE_FORMULA,
                    "disclosure": ML_PROXY_DISCLOSURE,
                }, None, 200
            pair_clauses = [
                {"subject_id": a["subject_id"], "academic_term": a["academic_term"]}
                for a in assignments
            ]
            session_query["$or"] = pair_clauses
            record_query["$or"] = pair_clauses

        sessions = list(db.attendance_sessions.find(session_query))
        records = list(db.attendance_records.find(record_query))

        subj_buckets: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for s in sessions:
            key = (str(s["subject_id"]), s.get("academic_term", ""))
            if key not in subj_buckets:
                subj_buckets[key] = {
                    "subject_id": str(s["subject_id"]),
                    "subject_name": s.get("subject_name", ""),
                    "subject_code": s.get("subject_code", ""),
                    "academic_term": s.get("academic_term", ""),
                    "session_count": 0,
                    "total_marked_entries": 0,
                    "present_count": 0,
                    "absent_count": 0,
                    "late_count": 0,
                    "excused_count": 0,
                    "attendance_percentage": None,
                }
            subj_buckets[key]["session_count"] += 1

        totals = {
            "total_sessions": len(sessions),
            "total_marked_entries": 0,
            "present_count": 0,
            "absent_count": 0,
            "late_count": 0,
            "excused_count": 0,
        }
        for r in records:
            key = (str(r["subject_id"]), r.get("academic_term", ""))
            if key not in subj_buckets:
                subj_buckets[key] = {
                    "subject_id": str(r["subject_id"]),
                    "subject_name": r.get("subject_name", ""),
                    "subject_code": "",
                    "academic_term": r.get("academic_term", ""),
                    "session_count": 0,
                    "total_marked_entries": 0,
                    "present_count": 0,
                    "absent_count": 0,
                    "late_count": 0,
                    "excused_count": 0,
                    "attendance_percentage": None,
                }
            b = subj_buckets[key]
            b["total_marked_entries"] += 1
            totals["total_marked_entries"] += 1
            st = r.get("status", "")
            if st == "Present":
                b["present_count"] += 1
                totals["present_count"] += 1
            elif st == "Absent":
                b["absent_count"] += 1
                totals["absent_count"] += 1
            elif st == "Late":
                b["late_count"] += 1
                totals["late_count"] += 1
            elif st == "Excused":
                b["excused_count"] += 1
                totals["excused_count"] += 1

        summaries = []
        for b in subj_buckets.values():
            b["attendance_percentage"] = _compute_rate(
                b["present_count"],
                b["late_count"],
                b["excused_count"],
                b["total_marked_entries"],
            )
            summaries.append(b)
        summaries.sort(key=lambda x: (x["academic_term"], x["subject_name"]))

        overall_rate = _compute_rate(
            totals["present_count"],
            totals["late_count"],
            totals["excused_count"],
            totals["total_marked_entries"],
        )
        totals["attendance_percentage"] = overall_rate
        totals["has_records"] = totals["total_sessions"] > 0 or totals["total_marked_entries"] > 0

        return {
            "subject_summaries": summaries,
            "overall": totals,
            "formula": ATTENDANCE_FORMULA,
            "disclosure": ML_PROXY_DISCLOSURE,
        }, None, 200
