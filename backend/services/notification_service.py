"""
EduPredict - Notification & Early-Warning Alert Service (Phase 12A / 12B)
Module: backend.services.notification_service
Purpose: Persists user notifications, Admin institutional broadcasts, read-state transitions,
and idempotent failure-isolated early-warning alerts from Prediction, Dropout, and Anomaly services.
"""

import hashlib
import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, PyMongoError

from backend.models.notification_model import (
    Notification,
    VALID_BROADCAST_TARGET_ROLES,
    VALID_NOTIFICATION_CATEGORIES,
    VALID_NOTIFICATION_SEVERITIES,
)
from backend.services.system_log_service import log_event, sanitize_exception_message
from backend.utils.security import clean_and_validate_text, to_object_id

logger = logging.getLogger(__name__)

ALLOWED_NOTIFICATION_ROLES = {"admin", "teacher", "student"}


class NotificationService:
    """Manages persistent notifications, RBAC queries, broadcasts, and automated alerts."""

    @staticmethod
    def _parse_pagination(page: Any, limit: Any) -> Tuple[Optional[int], Optional[int], Optional[str]]:
        try:
            p = int(page) if page is not None else 1
            lim = int(limit) if limit is not None else 20
        except (ValueError, TypeError):
            return None, None, "Pagination parameters 'page' and 'limit' must be integers."
        if p < 1 or lim < 1 or lim > 100:
            return None, None, "Invalid pagination bounds ('page >= 1' and '1 <= limit <= 100')."
        return p, lim, None

    @classmethod
    def create_notification(
        cls,
        db: Database,
        recipient_id: ObjectId | str,
        recipient_role: str,
        category: str,
        severity: str,
        title: str,
        message: str,
        subject_id: Optional[ObjectId | str] = None,
        subject: Optional[str] = None,
        academic_term: Optional[str] = None,
        dedup_key: Optional[str] = None,
        provenance: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Optional[Notification], bool]:
        """
        Insert a notification document idempotently.
        Returns (notification_or_none, created_flag).
        Duplicate dedup_key inserts are suppressed without raising.
        """
        if db is None:
            return None, False

        notif = Notification(
            recipient_id=recipient_id,
            recipient_role=recipient_role,
            category=category,
            severity=severity,
            title=title,
            message=message,
            subject_id=subject_id,
            subject=subject,
            academic_term=academic_term,
            dedup_key=dedup_key,
            provenance=provenance,
        )
        try:
            db.notifications.insert_one(notif.to_doc())
            return notif, True
        except DuplicateKeyError:
            return None, False
        except PyMongoError as exc:
            logger.warning("Failed persisting notification: %s", sanitize_exception_message(exc))
            return None, False

    @classmethod
    def list_notifications(
        cls,
        db: Database,
        actor_user: Any,
        page: Any = 1,
        limit: Any = 20,
        category: Optional[str] = None,
        severity: Optional[str] = None,
        is_read: Optional[str] = None,
        subject_id: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Return paginated notifications strictly scoped to the authenticated user's own inbox."""
        if db is None:
            return None, "Database service unavailable.", 500

        role = getattr(actor_user, "role", "")
        if role not in ALLOWED_NOTIFICATION_ROLES:
            return None, "Access denied. Notification inbox is restricted to authorized personas.", 403

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        if not actor_oid:
            return None, "Invalid authenticated user identity.", 401

        p, lim, page_err = cls._parse_pagination(page, limit)
        if page_err or p is None or lim is None:
            return None, page_err or "Invalid pagination.", 400

        query: Dict[str, Any] = {"recipient_id": actor_oid}

        if category is not None and str(category).strip():
            cat_val = str(category).strip()
            if cat_val not in VALID_NOTIFICATION_CATEGORIES:
                return None, f"Invalid notification category '{cat_val}'.", 400
            query["category"] = cat_val

        if severity is not None and str(severity).strip():
            sev_val = str(severity).strip().lower()
            if sev_val not in VALID_NOTIFICATION_SEVERITIES:
                return None, f"Invalid notification severity '{sev_val}'.", 400
            query["severity"] = sev_val

        if is_read is not None and str(is_read).strip():
            raw_read = str(is_read).strip().lower()
            if raw_read == "true":
                query["is_read"] = True
            elif raw_read == "false":
                query["is_read"] = False
            else:
                return None, "Filter 'is_read' must be 'true' or 'false'.", 400

        if subject_id is not None and str(subject_id).strip():
            subj_oid = to_object_id(str(subject_id).strip())
            if not subj_oid:
                return None, "Invalid subject_id filter.", 400
            query["subject_id"] = subj_oid

        total = db.notifications.count_documents(query)
        unread_count = db.notifications.count_documents({"recipient_id": actor_oid, "is_read": False})
        skip = (p - 1) * lim

        cursor = (
            db.notifications.find(query)
            .sort([("created_at", DESCENDING), ("_id", DESCENDING)])
            .skip(skip)
            .limit(lim)
        )
        items = [Notification.from_doc(d).to_dict() for d in cursor]
        total_pages = max(1, math.ceil(total / lim)) if total else 1

        return {
            "notifications": items,
            "total": total,
            "unread_count": unread_count,
            "page": p,
            "limit": lim,
            "total_pages": total_pages,
        }, None, 200

    @classmethod
    def get_unread_count(cls, db: Database, actor_user: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Return unread count strictly for the authenticated recipient."""
        if db is None:
            return None, "Database service unavailable.", 500

        role = getattr(actor_user, "role", "")
        if role not in ALLOWED_NOTIFICATION_ROLES:
            return None, "Access denied.", 403

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        if not actor_oid:
            return None, "Invalid authenticated user identity.", 401

        unread = db.notifications.count_documents({"recipient_id": actor_oid, "is_read": False})
        return {"unread_count": unread}, None, 200

    @classmethod
    def mark_as_read(
        cls, db: Database, notification_id: str, actor_user: Any
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Mark a single notification as read strictly if owned by actor_user."""
        if db is None:
            return None, "Database service unavailable.", 500

        role = getattr(actor_user, "role", "")
        if role not in ALLOWED_NOTIFICATION_ROLES:
            return None, "Access denied.", 403

        notif_oid = to_object_id(notification_id)
        if not notif_oid:
            return None, "Invalid notification ID format.", 400

        doc = db.notifications.find_one({"_id": notif_oid})
        if not doc:
            return None, "Notification not found.", 404

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        if not actor_oid or doc.get("recipient_id") != actor_oid:
            return None, "Access denied. You cannot modify another user's notification.", 403

        if not doc.get("is_read"):
            now = datetime.now(timezone.utc)
            db.notifications.update_one(
                {"_id": notif_oid, "recipient_id": actor_oid},
                {"$set": {"is_read": True, "read_at": now, "updated_at": now}},
            )
            doc = db.notifications.find_one({"_id": notif_oid})

        return {"notification": Notification.from_doc(doc).to_dict()}, None, 200

    @classmethod
    def mark_all_as_read(cls, db: Database, actor_user: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Mark all unread notifications owned by actor_user as read."""
        if db is None:
            return None, "Database service unavailable.", 500

        role = getattr(actor_user, "role", "")
        if role not in ALLOWED_NOTIFICATION_ROLES:
            return None, "Access denied.", 403

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        if not actor_oid:
            return None, "Invalid authenticated user identity.", 401

        now = datetime.now(timezone.utc)
        res = db.notifications.update_many(
            {"recipient_id": actor_oid, "is_read": False},
            {"$set": {"is_read": True, "read_at": now, "updated_at": now}},
        )
        return {"modified_count": int(res.modified_count)}, None, 200

    @classmethod
    def broadcast_notification(
        cls,
        db: Database,
        data: Dict[str, Any],
        actor_user: Any,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Admin-only institutional announcement persisted for target active users."""
        if db is None:
            return None, "Database service unavailable.", 500

        if getattr(actor_user, "role", "") != "admin":
            return None, "Administrator privileges required to publish institutional broadcasts.", 403

        if not isinstance(data, dict):
            return None, "Request body must be a JSON object.", 400

        clean_title, t_err = clean_and_validate_text(data.get("title") or "Institutional Announcement", "title", min_len=2, max_len=160)
        if t_err or not clean_title:
            return None, t_err or "Invalid title.", 400

        clean_msg, m_err = clean_and_validate_text(data.get("message"), "message", min_len=3, max_len=2000)
        if m_err or not clean_msg:
            return None, m_err or "Invalid message.", 400

        severity = str(data.get("severity") or "info").strip().lower()
        if severity not in VALID_NOTIFICATION_SEVERITIES:
            return None, f"Invalid severity '{severity}'. Allowed: {', '.join(sorted(VALID_NOTIFICATION_SEVERITIES))}.", 400

        raw_roles = data.get("target_roles")
        if raw_roles is None:
            target_roles = ["student", "teacher"]
        else:
            if not isinstance(raw_roles, list) or not raw_roles:
                return None, "Field 'target_roles' must be a non-empty list.", 400
            normalized_roles: List[str] = []
            for r in raw_roles:
                if not isinstance(r, str):
                    return None, "Target roles must be strings.", 400
                r_clean = r.strip().lower()
                if r_clean not in VALID_BROADCAST_TARGET_ROLES:
                    return None, (
                        f"Invalid broadcast target role '{r}'. "
                        "Broadcasts only target student, teacher, or admin accounts."
                    ), 400
                if r_clean not in normalized_roles:
                    normalized_roles.append(r_clean)
            target_roles = normalized_roles

        broadcast_id = str(ObjectId())
        recipients = list(
            db.users.find(
                {"is_active": True, "role": {"$in": target_roles}},
                {"_id": 1, "role": 1},
            )
        )

        created_count = 0
        for rec in recipients:
            _, created = cls.create_notification(
                db=db,
                recipient_id=rec["_id"],
                recipient_role=rec.get("role", "student"),
                category="broadcast",
                severity=severity,
                title=clean_title,
                message=clean_msg,
                dedup_key=f"broadcast:{broadcast_id}",
                provenance={
                    "trigger_type": "admin_broadcast",
                    "broadcast_id": broadcast_id,
                    "actor_id": str(getattr(actor_user, "id", "")),
                    "target_roles": target_roles,
                },
            )
            if created:
                created_count += 1

        try:
            log_event(
                db,
                "NOTIFICATION_BROADCAST_SENT",
                {
                    "broadcast_id": broadcast_id,
                    "target_roles": target_roles,
                    "severity": severity,
                    "recipient_count": created_count,
                },
                actor_id=getattr(actor_user, "id", None),
            )
        except Exception:
            pass

        return {
            "broadcast_id": broadcast_id,
            "recipient_count": created_count,
            "target_roles": target_roles,
            "severity": severity,
            "title": clean_title,
            "message": clean_msg,
        }, None, 201

    @staticmethod
    def _resolve_authorized_teachers(
        db: Database,
        student_oid: ObjectId,
        subject_oid: Optional[ObjectId] = None,
        subject_name: Optional[str] = None,
        academic_term: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Resolve active teachers assigned to subjects/terms matching an active student enrollment.
        Strictly enforces single-institution subject-term alignment; never uses legacy tables.
        """
        has_explicit_subject = False
        resolved_subj_oid: Optional[ObjectId] = None

        if subject_oid is not None and str(subject_oid).strip():
            has_explicit_subject = True
            oid_candidate = to_object_id(subject_oid)
            if oid_candidate:
                subj_doc = db.subjects.find_one(
                    {"_id": oid_candidate, "is_active": {"$ne": False}},
                    {"_id": 1},
                )
                if subj_doc:
                    resolved_subj_oid = subj_doc["_id"]

        if not resolved_subj_oid and isinstance(subject_name, str) and subject_name.strip():
            has_explicit_subject = True
            clean_s = subject_name.strip()
            subj_doc = db.subjects.find_one(
                {
                    "$or": [
                        {"canonical_key": clean_s.lower()},
                        {"name": clean_s},
                        {"code": clean_s.upper()},
                    ]
                },
                {"_id": 1, "is_active": 1},
            )
            if subj_doc and subj_doc.get("is_active", True):
                resolved_subj_oid = subj_doc["_id"]

        # Fail closed when an explicit non-empty subject cannot be resolved
        if has_explicit_subject and not resolved_subj_oid:
            return []

        enroll_q: Dict[str, Any] = {"student_id": student_oid, "status": "active"}
        if resolved_subj_oid:
            enroll_q["subject_id"] = resolved_subj_oid
        if isinstance(academic_term, str) and academic_term.strip() and academic_term.strip() != "Current Term":
            enroll_q["academic_term"] = academic_term.strip()

        enrollments = list(db.student_subject_enrollments.find(enroll_q, {"subject_id": 1, "academic_term": 1}))
        if not enrollments:
            return []

        teacher_ids: set[ObjectId] = set()
        for enr in enrollments:
            s_id = enr.get("subject_id")
            term = enr.get("academic_term")
            if not s_id:
                continue
            t_q: Dict[str, Any] = {"subject_id": s_id, "status": "active"}
            if term:
                t_q["academic_term"] = term
            for assign in db.teacher_subject_assignments.find(t_q, {"teacher_id": 1}):
                t_oid = to_object_id(assign.get("teacher_id"))
                if t_oid:
                    teacher_ids.add(t_oid)

        if not teacher_ids:
            return []

        return list(
            db.users.find(
                {"_id": {"$in": list(teacher_ids)}, "role": "teacher", "is_active": True},
                {"_id": 1, "role": 1},
            )
        )

    @classmethod
    def _dispatch_to_recipients(
        cls,
        db: Database,
        recipients: List[Tuple[ObjectId, str, str, str]],
        category: str,
        severity: str,
        dedup_key: str,
        provenance: Dict[str, Any],
        subject_id: Optional[ObjectId] = None,
        subject: Optional[str] = None,
        academic_term: Optional[str] = None,
    ) -> int:
        """Send deduped alerts safely without duplicating per recipient."""
        sent = 0
        seen_ids: set[ObjectId] = set()
        for rec_oid, rec_role, title, message in recipients:
            if not rec_oid or rec_oid in seen_ids:
                continue
            seen_ids.add(rec_oid)
            _, created = cls.create_notification(
                db=db,
                recipient_id=rec_oid,
                recipient_role=rec_role,
                category=category,
                severity=severity,
                title=title,
                message=message,
                subject_id=subject_id,
                subject=subject,
                academic_term=academic_term,
                dedup_key=dedup_key,
                provenance=provenance,
            )
            if created:
                sent += 1
        return sent

    @classmethod
    def dispatch_prediction_high_risk_alert(cls, db: Database, prediction_record: Any) -> int:
        """
        Safely dispatch deduplicated early-warning notifications for High-Risk ML predictions.
        Failure-isolated: never raises or disrupts prediction creation or stream ingestion.
        """
        if db is None or prediction_record is None:
            return 0
        try:
            status_val = str(getattr(prediction_record, "predicted_status", "")).strip().lower()
            if status_val != "high risk":
                return 0

            student_oid = to_object_id(getattr(prediction_record, "student_id", None))
            if not student_oid:
                return 0

            subject = getattr(prediction_record, "subject", "Subject")
            subject_oid = to_object_id(getattr(prediction_record, "subject_id", None))
            term = getattr(prediction_record, "academic_term", None)
            milestone = int(getattr(prediction_record, "milestone", 0))
            marks = float(getattr(prediction_record, "predicted_marks", 0.0))

            term_slug = term or "unspecified"
            dedup_key = f"pred_high_risk:{str(student_oid)}:{subject}:{milestone}:{term_slug}"
            provenance = {
                "trigger_type": "prediction_high_risk",
                "source_collection": "predictions",
                "source_id": str(getattr(prediction_record, "id", "")),
                "subject": subject,
                "milestone": milestone,
                "academic_term": term,
            }

            student_doc = db.users.find_one({"_id": student_oid, "is_active": True}, {"full_name": 1})
            student_label = (student_doc or {}).get("full_name") or "Enrolled Student"

            recipients: List[Tuple[ObjectId, str, str, str]] = []
            if student_doc:
                recipients.append((
                    student_oid,
                    "student",
                    f"Early Warning Alert: {subject} (Milestone {milestone})",
                    (
                        f"Your Milestone {milestone} academic assessment for {subject} indicates High Risk "
                        f"({marks:.1f}%). Please review study recommendations and reach out to your instructor or advisor."
                    ),
                ))

            for t_doc in cls._resolve_authorized_teachers(db, student_oid, subject_oid=subject_oid, subject_name=subject, academic_term=term):
                recipients.append((
                    t_doc["_id"],
                    "teacher",
                    f"High-Risk Student Alert: {subject} M{milestone}",
                    (
                        f"{student_label} was flagged High Risk ({marks:.1f}%) in {subject} "
                        f"(Milestone {milestone}). Review the At-Risk triage queue for supportive intervention."
                    ),
                ))

            for a_doc in db.users.find({"role": "admin", "is_active": True}, {"_id": 1}):
                recipients.append((
                    a_doc["_id"],
                    "admin",
                    f"Institutional High-Risk Alert: {subject} M{milestone}",
                    (
                        f"High-Risk Milestone {milestone} academic prediction recorded for {student_label} "
                        f"in {subject} ({marks:.1f}%)."
                    ),
                ))

            return cls._dispatch_to_recipients(
                db=db,
                recipients=recipients,
                category="early_warning",
                severity="critical",
                dedup_key=dedup_key,
                provenance=provenance,
                subject_id=subject_oid,
                subject=subject,
                academic_term=term,
            )
        except Exception as exc:
            logger.warning("Prediction alert dispatch failed safely: %s", sanitize_exception_message(exc))
            return 0

    @classmethod
    def dispatch_dropout_high_risk_alert(
        cls,
        db: Database,
        student_id: ObjectId | str,
        risk_tier: str,
        risk_probability: float,
        academic_term: Optional[str] = None,
        history_id: Optional[ObjectId | str] = None,
        subject: Optional[str] = None,
    ) -> int:
        """
        Safely dispatch deduplicated alerts when DropoutService evaluates High attrition risk.
        Failure-isolated and never exposes student PII in server logs.
        """
        if db is None:
            return 0
        try:
            if str(risk_tier).strip().lower() != "high":
                return 0

            student_oid = to_object_id(student_id)
            if not student_oid:
                return 0

            clean_term = (academic_term or "Current Term").strip()
            dedup_key = f"dropout_high_risk:{str(student_oid)}:{clean_term}"
            provenance = {
                "trigger_type": "dropout_high_risk",
                "source_collection": "dropout_prediction_history",
                "source_id": str(history_id) if history_id else "",
                "academic_term": clean_term,
            }

            student_doc = db.users.find_one({"_id": student_oid, "is_active": True}, {"full_name": 1})
            student_label = (student_doc or {}).get("full_name") or "Enrolled Student"
            pct = float(risk_probability) * 100.0

            recipients: List[Tuple[ObjectId, str, str, str]] = []
            if student_doc:
                recipients.append((
                    student_oid,
                    "student",
                    "Academic Retention Support Notice",
                    (
                        f"Your academic retention screening for {clean_term} indicates High vulnerability. "
                        "Academic support, peer tutoring, and advising sessions are available through Student Support."
                    ),
                ))

            for t_doc in cls._resolve_authorized_teachers(db, student_oid, subject_name=subject, academic_term=clean_term):
                recipients.append((
                    t_doc["_id"],
                    "teacher",
                    f"High Dropout Risk Alert: {clean_term}",
                    (
                        f"{student_label} was assessed at High dropout risk ({pct:.1f}% benchmark probability) "
                        f"for {clean_term}. Review retention recommendations in your workspace."
                    ),
                ))

            for a_doc in db.users.find({"role": "admin", "is_active": True}, {"_id": 1}):
                recipients.append((
                    a_doc["_id"],
                    "admin",
                    f"Institutional Dropout Alert: {clean_term}",
                    (
                        f"High dropout risk assessment recorded for {student_label} ({pct:.1f}%, {clean_term})."
                    ),
                ))

            return cls._dispatch_to_recipients(
                db=db,
                recipients=recipients,
                category="dropout_risk",
                severity="critical",
                dedup_key=dedup_key,
                provenance=provenance,
                subject=subject,
                academic_term=clean_term,
            )
        except Exception as exc:
            logger.warning("Dropout alert dispatch failed safely: %s", sanitize_exception_message(exc))
            return 0

    @classmethod
    def dispatch_confirmed_anomaly_alert(cls, db: Database, anomaly_record: Any) -> int:
        """
        Safely notify authorized instructors and admins when an institutional anomaly is confirmed.
        Respects Phase 7C governance: synthetic benchmark rows and students are excluded.
        """
        if db is None or anomaly_record is None:
            return 0
        try:
            if getattr(anomaly_record, "review_status", "") != "Confirmed Anomaly":
                return 0
            if getattr(anomaly_record, "is_benchmark", True):
                return 0

            student_oid = to_object_id(getattr(anomaly_record, "student_id", None))
            if not student_oid:
                return 0

            anomaly_id = str(getattr(anomaly_record, "id", ""))
            subject = getattr(anomaly_record, "subject", "Subject")
            term = getattr(anomaly_record, "academic_term", None)
            severity = getattr(anomaly_record, "anomaly_severity", "High Anomaly")
            dedup_key = f"anomaly_confirmed:{anomaly_id}"

            provenance = {
                "trigger_type": "confirmed_anomaly",
                "source_collection": "anomaly_records",
                "source_id": anomaly_id,
                "subject": subject,
                "academic_term": term,
            }

            student_doc = db.users.find_one({"_id": student_oid}, {"full_name": 1})
            student_label = (student_doc or {}).get("full_name") or "Enrolled Student"

            recipients: List[Tuple[ObjectId, str, str, str]] = []
            for t_doc in cls._resolve_authorized_teachers(db, student_oid, subject_name=subject, academic_term=term):
                recipients.append((
                    t_doc["_id"],
                    "teacher",
                    f"Confirmed Anomaly Alert: {subject}",
                    (
                        f"A behavioral/performance anomaly ({severity}) for {student_label} in {subject} "
                        "has been confirmed for mentor follow-up."
                    ),
                ))

            for a_doc in db.users.find({"role": "admin", "is_active": True}, {"_id": 1}):
                recipients.append((
                    a_doc["_id"],
                    "admin",
                    f"Confirmed Institutional Anomaly: {subject}",
                    (
                        f"Confirmed anomaly record ({anomaly_id}, {severity}) for {student_label} in {subject}."
                    ),
                ))

            return cls._dispatch_to_recipients(
                db=db,
                recipients=recipients,
                category="anomaly_alert",
                severity="warning",
                dedup_key=dedup_key,
                provenance=provenance,
                subject=subject,
                academic_term=term,
            )
        except Exception as exc:
            logger.warning("Confirmed anomaly alert dispatch failed safely: %s", sanitize_exception_message(exc))
            return 0

    @classmethod
    def notify_feedback_status_update(cls, db: Database, ticket: Any) -> int:
        """Notify a feedback ticket owner when Admin updates status or adds response."""
        if db is None or ticket is None:
            return 0
        try:
            sender_oid = to_object_id(getattr(ticket, "sender_id", None))
            if not sender_oid:
                return 0
            status_val = getattr(ticket, "status", "Reviewed")
            admin_response_val = (getattr(ticket, "admin_response", None) or "").strip()
            resp_digest = (
                hashlib.sha256(admin_response_val.encode("utf-8")).hexdigest()[:12]
                if admin_response_val
                else "none"
            )
            title = f"Support Ticket Update: {status_val}"
            if admin_response_val:
                message = (
                    f"Your inquiry '{getattr(ticket, 'title', 'Ticket')}' ({status_val}) "
                    "received an updated administrator response."
                )
            else:
                message = f"Your inquiry '{getattr(ticket, 'title', 'Ticket')}' was updated to status '{status_val}'."
            _, created = cls.create_notification(
                db=db,
                recipient_id=sender_oid,
                recipient_role=getattr(ticket, "sender_role", "student"),
                category="feedback_update",
                severity="success" if status_val == "Resolved" else "info",
                title=title,
                message=message,
                subject_id=getattr(ticket, "subject_id", None),
                subject=getattr(ticket, "subject", None),
                academic_term=getattr(ticket, "academic_term", None),
                dedup_key=f"feedback_update:{getattr(ticket, 'id', '')}:{status_val}:{resp_digest}",
                provenance={
                    "trigger_type": "feedback_status_update",
                    "source_collection": "feedback_tickets",
                    "source_id": str(getattr(ticket, "id", "")),
                    "status": status_val,
                    "response_digest": resp_digest,
                },
            )
            return 1 if created else 0
        except Exception as exc:
            logger.warning("Feedback update notification failed safely: %s", sanitize_exception_message(exc))
            return 0
