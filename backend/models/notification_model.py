"""
EduPredict - Persistent Notification Model (Phase 12A / 12B)
Module: backend.models.notification_model
Purpose: Domain entity representing persisted in-app notifications, broadcasts, and automated early-warning alerts.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import to_object_id

VALID_NOTIFICATION_CATEGORIES = {
    "early_warning",
    "dropout_risk",
    "anomaly_alert",
    "broadcast",
    "academic_calendar",
    "system",
    "feedback_update",
}

VALID_NOTIFICATION_SEVERITIES = {"info", "warning", "critical", "success"}
VALID_BROADCAST_TARGET_ROLES = {"student", "teacher", "admin"}


class Notification:
    """Represents a persisted user notification in MongoDB `notifications`."""

    def __init__(
        self,
        recipient_id: ObjectId | str,
        recipient_role: str,
        category: str,
        severity: str,
        title: str,
        message: str,
        subject_id: Optional[ObjectId | str] = None,
        subject: Optional[str] = None,
        academic_term: Optional[str] = None,
        is_read: bool = False,
        read_at: Optional[datetime] = None,
        dedup_key: Optional[str] = None,
        provenance: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        record_id: Optional[ObjectId | str] = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.recipient_id = to_object_id(recipient_id)
        if not self.recipient_id:
            raise ValueError("Valid recipient_id is required for notification.")

        self.recipient_role = str(recipient_role).strip().lower()
        self.subject_id = to_object_id(subject_id) if subject_id else None
        self.subject = subject.strip() if isinstance(subject, str) and subject.strip() else None
        self.academic_term = academic_term.strip() if isinstance(academic_term, str) and academic_term.strip() else None
        self.category = category if category in VALID_NOTIFICATION_CATEGORIES else "system"
        self.severity = severity if severity in VALID_NOTIFICATION_SEVERITIES else "info"
        self.title = str(title).strip()
        self.message = str(message).strip()
        self.is_read = bool(is_read)
        self.read_at = read_at
        self.dedup_key = dedup_key.strip() if isinstance(dedup_key, str) and dedup_key.strip() else None
        self.provenance = provenance if isinstance(provenance, dict) else {}

        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        """Convert entity into a MongoDB BSON-compatible document."""
        doc: Dict[str, Any] = {
            "_id": self.id,
            "recipient_id": self.recipient_id,
            "recipient_role": self.recipient_role,
            "subject_id": self.subject_id,
            "subject": self.subject,
            "academic_term": self.academic_term,
            "category": self.category,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "read_at": self.read_at,
            "provenance": self.provenance,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.dedup_key:
            doc["dedup_key"] = self.dedup_key
        return doc

    def to_dict(self) -> Dict[str, Any]:
        """Serialize notification to a JSON-safe response payload."""
        return {
            "id": str(self.id),
            "recipient_id": str(self.recipient_id),
            "recipient_role": self.recipient_role,
            "subject_id": str(self.subject_id) if self.subject_id else None,
            "subject": self.subject,
            "academic_term": self.academic_term,
            "category": self.category,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() if isinstance(self.read_at, datetime) else self.read_at,
            "provenance": self.provenance,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["Notification"]:
        if not doc:
            return None
        return cls(
            record_id=doc.get("_id"),
            recipient_id=doc.get("recipient_id"),
            recipient_role=doc.get("recipient_role", "student"),
            subject_id=doc.get("subject_id"),
            subject=doc.get("subject"),
            academic_term=doc.get("academic_term"),
            category=doc.get("category", "system"),
            severity=doc.get("severity", "info"),
            title=doc.get("title", ""),
            message=doc.get("message", ""),
            is_read=doc.get("is_read", False),
            read_at=doc.get("read_at"),
            dedup_key=doc.get("dedup_key"),
            provenance=doc.get("provenance") or {},
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
