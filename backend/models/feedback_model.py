"""
EduPredict - Persistent Feedback & Support Ticket Model (Phase 12C)
Module: backend.models.feedback_model
Purpose: Domain entity for persisted student/teacher support inquiries, counseling requests, and admin reviews.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import to_object_id

VALID_FEEDBACK_SENDER_ROLES = {"student", "teacher"}
VALID_FEEDBACK_STATUSES = {"Open", "Reviewed", "Resolved"}
VALID_FEEDBACK_TRANSITIONS = {
    "Open": {"Open", "Reviewed", "Resolved"},
    "Reviewed": {"Reviewed", "Resolved"},
    "Resolved": {"Resolved"},
}
VALID_FEEDBACK_CATEGORIES = {
    "Academic Counseling",
    "Curriculum & Grading",
    "At-Risk Triage",
    "AI Predictions Help",
    "Course Feedback",
    "Platform Usability",
    "Self-Assessment",
    "Technical Issue",
    "IT Support",
}


class FeedbackTicket:
    """Represents a feedback inquiry or counseling ticket in MongoDB `feedback_tickets`."""

    def __init__(
        self,
        sender_id: ObjectId | str,
        sender_role: str,
        sender_name: str,
        category: str,
        title: str,
        message: str,
        subject_id: Optional[ObjectId | str] = None,
        subject: Optional[str] = None,
        academic_term: Optional[str] = None,
        share_with_instructor: bool = False,
        status: str = "Open",
        admin_response: Optional[str] = None,
        intervention_notes: Optional[str] = None,
        reviewed_by: Optional[ObjectId | str] = None,
        reviewed_by_name: Optional[str] = None,
        reviewed_at: Optional[datetime] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        record_id: Optional[ObjectId | str] = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.sender_id = to_object_id(sender_id)
        if not self.sender_id:
            raise ValueError("Valid sender_id is required for feedback ticket.")

        self.sender_role = str(sender_role).strip().lower()
        if self.sender_role not in VALID_FEEDBACK_SENDER_ROLES:
            raise ValueError(f"Invalid sender_role '{sender_role}'.")

        self.sender_name = str(sender_name).strip()
        self.subject_id = to_object_id(subject_id) if subject_id else None
        self.subject = subject.strip() if isinstance(subject, str) and subject.strip() else None
        self.academic_term = academic_term.strip() if isinstance(academic_term, str) and academic_term.strip() else None
        self.category = category if category in VALID_FEEDBACK_CATEGORIES else "Platform Usability"
        self.title = str(title).strip()
        self.message = str(message).strip()
        self.share_with_instructor = bool(share_with_instructor)
        self.status = status if status in VALID_FEEDBACK_STATUSES else "Open"
        self.admin_response = admin_response.strip() if isinstance(admin_response, str) and admin_response.strip() else None
        self.intervention_notes = (
            intervention_notes.strip() if isinstance(intervention_notes, str) and intervention_notes.strip() else None
        )
        self.reviewed_by = to_object_id(reviewed_by) if reviewed_by else None
        self.reviewed_by_name = reviewed_by_name.strip() if isinstance(reviewed_by_name, str) and reviewed_by_name.strip() else None
        self.reviewed_at = reviewed_at

        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "sender_id": self.sender_id,
            "sender_role": self.sender_role,
            "sender_name": self.sender_name,
            "subject_id": self.subject_id,
            "subject": self.subject,
            "academic_term": self.academic_term,
            "category": self.category,
            "title": self.title,
            "message": self.message,
            "share_with_instructor": self.share_with_instructor,
            "status": self.status,
            "admin_response": self.admin_response,
            "intervention_notes": self.intervention_notes,
            "reviewed_by": self.reviewed_by,
            "reviewed_by_name": self.reviewed_by_name,
            "reviewed_at": self.reviewed_at,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        def _iso(dt: Any) -> Any:
            return dt.isoformat() if isinstance(dt, datetime) else dt

        return {
            "id": str(self.id),
            "sender_id": str(self.sender_id),
            "sender_role": self.sender_role,
            "sender_name": self.sender_name,
            "subject_id": str(self.subject_id) if self.subject_id else None,
            "subject": self.subject,
            "academic_term": self.academic_term,
            "category": self.category,
            "title": self.title,
            "message": self.message,
            "share_with_instructor": self.share_with_instructor,
            "status": self.status,
            "admin_response": self.admin_response,
            "intervention_notes": self.intervention_notes,
            "reviewed_by": str(self.reviewed_by) if self.reviewed_by else None,
            "reviewed_by_name": self.reviewed_by_name,
            "reviewed_at": _iso(self.reviewed_at),
            "created_at": _iso(self.created_at),
            "updated_at": _iso(self.updated_at),
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["FeedbackTicket"]:
        if not doc:
            return None
        return cls(
            record_id=doc.get("_id"),
            sender_id=doc.get("sender_id"),
            sender_role=doc.get("sender_role", "student"),
            sender_name=doc.get("sender_name", "Institutional User"),
            subject_id=doc.get("subject_id"),
            subject=doc.get("subject"),
            academic_term=doc.get("academic_term"),
            category=doc.get("category", "Platform Usability"),
            title=doc.get("title", ""),
            message=doc.get("message", ""),
            share_with_instructor=doc.get("share_with_instructor", False),
            status=doc.get("status", "Open"),
            admin_response=doc.get("admin_response"),
            intervention_notes=doc.get("intervention_notes"),
            reviewed_by=doc.get("reviewed_by"),
            reviewed_by_name=doc.get("reviewed_by_name"),
            reviewed_at=doc.get("reviewed_at"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
