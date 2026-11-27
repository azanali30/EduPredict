"""
EduPredict - Persistent Feedback & Support Workflow Service (Phase 12C)
Module: backend.services.feedback_service
Purpose: Manages persisted student/teacher feedback inquiries, counseling requests,
strict ownership & subject-authorization checks, and Admin review lifecycle transitions.
"""

import logging
import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError

from backend.models.feedback_model import (
    FeedbackTicket,
    VALID_FEEDBACK_CATEGORIES,
    VALID_FEEDBACK_SENDER_ROLES,
    VALID_FEEDBACK_STATUSES,
    VALID_FEEDBACK_TRANSITIONS,
)
from backend.services.notification_service import NotificationService
from backend.services.system_log_service import log_event
from backend.utils.decorators import can_access_student_subject_data
from backend.utils.security import clean_and_validate_text, to_object_id

logger = logging.getLogger(__name__)

ALLOWED_FEEDBACK_VIEW_ROLES = {"admin", "teacher", "student"}
FORBIDDEN_SUBMIT_FIELDS = {"sender_id", "sender_role", "sender_name", "admin_response", "intervention_notes", "reviewed_by", "reviewed_by_name", "reviewed_at"}


class FeedbackService:
    """Service layer for institutional feedback & academic support tickets."""

    @staticmethod
    def _is_teacher_authorized_for_ticket(db: Database, teacher_user: Any, doc: Dict[str, Any]) -> bool:
        """
        Teacher may read:
        - own submitted tickets, OR
        - student Academic Counseling requests shared for an authorized subject & active student enrollment.
        Private student tickets are strictly excluded.
        """
        teacher_oid = to_object_id(getattr(teacher_user, "id", None))
        if not teacher_oid:
            return False
        if doc.get("sender_id") == teacher_oid:
            return True

        if (
            doc.get("sender_role") == "student"
            and doc.get("category") == "Academic Counseling"
            and doc.get("share_with_instructor") is True
            and doc.get("subject_id") is not None
        ):
            return can_access_student_subject_data(
                teacher_user,
                doc.get("sender_id"),
                doc.get("subject_id"),
                db,
                academic_term=doc.get("academic_term"),
            )
        return False

    @classmethod
    def submit_ticket(
        cls,
        db: Database,
        actor_user: Any,
        data: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Create a persisted feedback/support ticket as Student or Teacher."""
        if db is None:
            return None, "Database service unavailable.", 500

        role = getattr(actor_user, "role", "")
        if role not in VALID_FEEDBACK_SENDER_ROLES:
            return None, "Only students and teachers can submit feedback inquiries.", 403

        if not isinstance(data, dict):
            return None, "Request body must be a JSON object.", 400

        tampered = [k for k in FORBIDDEN_SUBMIT_FIELDS if k in data]
        if tampered or ("status" in data and data.get("status") not in (None, "Open")):
            return None, "Protected ownership, status, or review fields cannot be set on submission.", 403

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        if not actor_oid:
            return None, "Invalid authenticated user identity.", 401

        category = data.get("category")
        if not isinstance(category, str) or category.strip() not in VALID_FEEDBACK_CATEGORIES:
            return None, f"Invalid category. Allowed: {', '.join(sorted(VALID_FEEDBACK_CATEGORIES))}.", 400
        clean_category = category.strip()

        clean_title, title_err = clean_and_validate_text(data.get("title"), "title", min_len=3, max_len=160)
        if title_err or not clean_title:
            return None, title_err or "Invalid title.", 400

        clean_message, msg_err = clean_and_validate_text(data.get("message"), "message", min_len=5, max_len=2000)
        if msg_err or not clean_message:
            return None, msg_err or "Invalid message.", 400

        resolved_subject_oid: Optional[ObjectId] = None
        resolved_subject_name: Optional[str] = None
        raw_subj = data.get("subject_id")
        if raw_subj is not None and str(raw_subj).strip():
            s_oid = to_object_id(str(raw_subj).strip())
            if not s_oid:
                return None, "Invalid subject_id format.", 400
            s_doc = db.subjects.find_one({"_id": s_oid, "is_active": True})
            if not s_doc:
                return None, "Selected subject was not found or is inactive.", 404
            resolved_subject_oid = s_doc["_id"]
            resolved_subject_name = s_doc.get("name")

        academic_term: Optional[str] = None
        if data.get("academic_term") is not None and str(data.get("academic_term")).strip():
            clean_term, term_err = clean_and_validate_text(data.get("academic_term"), "academic_term", min_len=2, max_len=40)
            if term_err:
                return None, term_err, 400
            academic_term = clean_term

        share_with_instructor = False
        if role == "student" and clean_category == "Academic Counseling" and resolved_subject_oid is not None:
            share_with_instructor = bool(data.get("share_with_instructor", True))

        sender_name = str(getattr(actor_user, "full_name", "") or "Institutional User").strip()
        ticket = FeedbackTicket(
            sender_id=actor_oid,
            sender_role=role,
            sender_name=sender_name,
            subject_id=resolved_subject_oid,
            subject=resolved_subject_name,
            academic_term=academic_term,
            category=clean_category,
            title=clean_title,
            message=clean_message,
            share_with_instructor=share_with_instructor,
            status="Open",
        )

        try:
            db.feedback_tickets.insert_one(ticket.to_doc())
            try:
                log_event(
                    db,
                    "FEEDBACK_SUBMITTED",
                    {
                        "ticket_id": str(ticket.id),
                        "sender_role": role,
                        "category": clean_category,
                        "has_subject": resolved_subject_oid is not None,
                    },
                    actor_id=actor_oid,
                )
            except Exception:
                pass
            return {"ticket": ticket.to_dict()}, None, 201
        except PyMongoError as exc:
            logger.error("Failed persisting feedback ticket: %s", type(exc).__name__)
            return None, "Database error saving feedback ticket.", 500

    @classmethod
    def list_tickets(
        cls,
        db: Database,
        actor_user: Any,
        page: Any = 1,
        limit: Any = 20,
        status: Optional[str] = None,
        category: Optional[str] = None,
        role_filter: Optional[str] = None,
        subject_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """List tickets with strict role-based scoping and safe query filtering."""
        if db is None:
            return None, "Database service unavailable.", 500

        role = getattr(actor_user, "role", "")
        if role not in ALLOWED_FEEDBACK_VIEW_ROLES:
            return None, "Access denied. Analysts cannot access individual student or feedback text records.", 403

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        if not actor_oid:
            return None, "Invalid authenticated user identity.", 401

        try:
            p = int(page) if page is not None else 1
            lim = int(limit) if limit is not None else 20
        except (ValueError, TypeError):
            return None, "Pagination parameters 'page' and 'limit' must be integers.", 400
        if p < 1 or lim < 1 or lim > 100:
            return None, "Invalid pagination bounds ('page >= 1' and '1 <= limit <= 100').", 400

        base_filter: Dict[str, Any] = {}
        if status is not None and str(status).strip():
            s_val = str(status).strip()
            if s_val not in VALID_FEEDBACK_STATUSES:
                return None, f"Invalid status filter '{s_val}'.", 400
            base_filter["status"] = s_val

        if category is not None and str(category).strip():
            c_val = str(category).strip()
            if c_val not in VALID_FEEDBACK_CATEGORIES:
                return None, f"Invalid category filter '{c_val}'.", 400
            base_filter["category"] = c_val

        if role_filter is not None and str(role_filter).strip():
            rf_val = str(role_filter).strip().lower()
            if rf_val not in VALID_FEEDBACK_SENDER_ROLES:
                return None, f"Invalid role filter '{rf_val}'.", 400
            base_filter["sender_role"] = rf_val

        if subject_id is not None and str(subject_id).strip():
            subj_oid = to_object_id(str(subject_id).strip())
            if not subj_oid:
                return None, "Invalid subject_id filter.", 400
            base_filter["subject_id"] = subj_oid

        if search is not None and str(search).strip():
            escaped = re.escape(str(search).strip()[:80])
            base_filter["$or"] = [
                {"title": {"$regex": escaped, "$options": "i"}},
                {"message": {"$regex": escaped, "$options": "i"}},
                {"sender_name": {"$regex": escaped, "$options": "i"}},
            ]

        if role == "student":
            scope_filter: Dict[str, Any] = {"sender_id": actor_oid}
            query = {"$and": [scope_filter, base_filter]} if base_filter else scope_filter
            total = db.feedback_tickets.count_documents(query)
            cursor = (
                db.feedback_tickets.find(query)
                .sort([("created_at", DESCENDING), ("_id", DESCENDING)])
                .skip((p - 1) * lim)
                .limit(lim)
            )
            tickets = [FeedbackTicket.from_doc(d).to_dict() for d in cursor]
            summary = {
                "total": db.feedback_tickets.count_documents({"sender_id": actor_oid}),
                "open": db.feedback_tickets.count_documents({"sender_id": actor_oid, "status": "Open"}),
                "reviewed": db.feedback_tickets.count_documents({"sender_id": actor_oid, "status": "Reviewed"}),
                "resolved": db.feedback_tickets.count_documents({"sender_id": actor_oid, "status": "Resolved"}),
            }
        elif role == "teacher":
            scope_filter = {
                "$or": [
                    {"sender_id": actor_oid},
                    {
                        "sender_role": "student",
                        "category": "Academic Counseling",
                        "share_with_instructor": True,
                        "subject_id": {"$ne": None},
                    },
                ]
            }
            all_authorized_docs = [
                d
                for d in db.feedback_tickets.find(scope_filter).sort([("created_at", DESCENDING), ("_id", DESCENDING)])
                if cls._is_teacher_authorized_for_ticket(db, actor_user, d)
            ]
            summary = {
                "total": len(all_authorized_docs),
                "open": sum(1 for d in all_authorized_docs if d.get("status") == "Open"),
                "reviewed": sum(1 for d in all_authorized_docs if d.get("status") == "Reviewed"),
                "resolved": sum(1 for d in all_authorized_docs if d.get("status") == "Resolved"),
            }
            filtered_docs = all_authorized_docs
            if "status" in base_filter:
                filtered_docs = [d for d in filtered_docs if d.get("status") == base_filter["status"]]
            if "category" in base_filter:
                filtered_docs = [d for d in filtered_docs if d.get("category") == base_filter["category"]]
            if "sender_role" in base_filter:
                filtered_docs = [d for d in filtered_docs if d.get("sender_role") == base_filter["sender_role"]]
            if "subject_id" in base_filter:
                filtered_docs = [d for d in filtered_docs if d.get("subject_id") == base_filter["subject_id"]]
            if search is not None and str(search).strip():
                q_low = str(search).strip().lower()
                filtered_docs = [
                    d
                    for d in filtered_docs
                    if q_low in (d.get("title") or "").lower()
                    or q_low in (d.get("message") or "").lower()
                    or q_low in (d.get("sender_name") or "").lower()
                ]
            total = len(filtered_docs)
            page_docs = filtered_docs[(p - 1) * lim : p * lim]
            tickets = [FeedbackTicket.from_doc(d).to_dict() for d in page_docs]
        else:
            total = db.feedback_tickets.count_documents(base_filter)
            cursor = (
                db.feedback_tickets.find(base_filter)
                .sort([("created_at", DESCENDING), ("_id", DESCENDING)])
                .skip((p - 1) * lim)
                .limit(lim)
            )
            tickets = [FeedbackTicket.from_doc(d).to_dict() for d in cursor]
            summary = {
                "total": db.feedback_tickets.count_documents({}),
                "open": db.feedback_tickets.count_documents({"status": "Open"}),
                "reviewed": db.feedback_tickets.count_documents({"status": "Reviewed"}),
                "resolved": db.feedback_tickets.count_documents({"status": "Resolved"}),
            }

        total_pages = max(1, math.ceil(total / lim)) if total else 1
        return {
            "tickets": tickets,
            "summary": summary,
            "total": total,
            "page": p,
            "limit": lim,
            "total_pages": total_pages,
        }, None, 200

    @classmethod
    def get_ticket_by_id(
        cls, db: Database, ticket_id: str, actor_user: Any
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Fetch a single feedback ticket enforcing strict RBAC and private ticket isolation."""
        if db is None:
            return None, "Database service unavailable.", 500

        role = getattr(actor_user, "role", "")
        if role not in ALLOWED_FEEDBACK_VIEW_ROLES:
            return None, "Access denied.", 403

        oid = to_object_id(ticket_id)
        if not oid:
            return None, "Invalid feedback ticket ID format.", 400

        doc = db.feedback_tickets.find_one({"_id": oid})
        if not doc:
            return None, "Feedback ticket not found.", 404

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        if role == "student":
            if not actor_oid or doc.get("sender_id") != actor_oid:
                return None, "Access denied. You cannot view another user's private ticket.", 403
        elif role == "teacher":
            if not cls._is_teacher_authorized_for_ticket(db, actor_user, doc):
                return None, "Access denied. You are not authorized to view this feedback ticket.", 403

        return {"ticket": FeedbackTicket.from_doc(doc).to_dict()}, None, 200

    @classmethod
    def review_ticket(
        cls,
        db: Database,
        ticket_id: str,
        actor_user: Any,
        data: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Admin-only review, response, and status transition (Open -> Reviewed -> Resolved)."""
        if db is None:
            return None, "Database service unavailable.", 500

        if getattr(actor_user, "role", "") != "admin":
            return None, "Administrator privileges required to review or update support tickets.", 403

        if not isinstance(data, dict):
            return None, "Request body must be a JSON object.", 400

        oid = to_object_id(ticket_id)
        if not oid:
            return None, "Invalid feedback ticket ID format.", 400

        doc = db.feedback_tickets.find_one({"_id": oid})
        if not doc:
            return None, "Feedback ticket not found.", 404

        current_status = doc.get("status", "Open")
        new_status = data.get("status", current_status)
        if not isinstance(new_status, str) or new_status.strip() not in VALID_FEEDBACK_STATUSES:
            return None, f"Invalid status '{new_status}'. Allowed: Open, Reviewed, Resolved.", 400
        new_status = new_status.strip()

        allowed_next = VALID_FEEDBACK_TRANSITIONS.get(current_status, set())
        if new_status not in allowed_next:
            return None, f"Invalid status transition from '{current_status}' to '{new_status}'.", 400

        update_fields: Dict[str, Any] = {}
        if "admin_response" in data:
            clean_resp, resp_err = clean_and_validate_text(
                data.get("admin_response"), "admin_response", min_len=1, max_len=2000, allow_empty=True
            )
            if resp_err:
                return None, resp_err, 400
            update_fields["admin_response"] = clean_resp

        if "intervention_notes" in data:
            clean_notes, notes_err = clean_and_validate_text(
                data.get("intervention_notes"), "intervention_notes", min_len=1, max_len=2000, allow_empty=True
            )
            if notes_err:
                return None, notes_err, 400
            update_fields["intervention_notes"] = clean_notes

        actor_oid = to_object_id(getattr(actor_user, "id", None))
        now = datetime.now(timezone.utc)
        update_fields.update({
            "status": new_status,
            "reviewed_by": actor_oid,
            "reviewed_by_name": str(getattr(actor_user, "full_name", "") or "Administrator").strip(),
            "reviewed_at": now,
            "updated_at": now,
        })

        try:
            db.feedback_tickets.update_one({"_id": oid}, {"$set": update_fields})
            updated_doc = db.feedback_tickets.find_one({"_id": oid})
            ticket = FeedbackTicket.from_doc(updated_doc)

            try:
                log_event(
                    db,
                    "FEEDBACK_TICKET_UPDATED",
                    {
                        "ticket_id": str(oid),
                        "old_status": current_status,
                        "new_status": new_status,
                        "has_admin_response": bool(update_fields.get("admin_response")),
                    },
                    actor_id=actor_oid,
                )
            except Exception:
                pass

            if new_status != current_status or "admin_response" in update_fields:
                NotificationService.notify_feedback_status_update(db, ticket)

            return {"ticket": ticket.to_dict()}, None, 200
        except PyMongoError as exc:
            logger.error("Failed updating feedback ticket: %s", type(exc).__name__)
            return None, "Database error updating feedback ticket.", 500
