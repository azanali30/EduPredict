"""
EduPredict - System Log Model
Represents audit trail records for security and administrative events.
"""

from datetime import datetime, timezone
from bson import ObjectId
from backend.utils.security import to_object_id


class SystemLog:
    """Represents an audit log entry in the system_logs collection."""

    def __init__(
        self,
        event_type: str,
        details: dict | None = None,
        user_id: ObjectId | str | None = None,
        actor_id: ObjectId | str | None = None,
        ip_address: str | None = None,
        log_id: ObjectId | str | None = None,
        timestamp: datetime | None = None,
    ):
        self.id = to_object_id(log_id) or ObjectId()
        self.event_type = event_type.strip().upper()
        self.details = details or {}
        self.user_id = to_object_id(user_id)
        self.actor_id = to_object_id(actor_id)
        self.ip_address = ip_address
        self.timestamp = timestamp or datetime.now(timezone.utc)

    def to_doc(self) -> dict:
        return {
            "_id": self.id,
            "event_type": self.event_type,
            "details": self.details,
            "user_id": self.user_id,
            "actor_id": self.actor_id,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp,
        }

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "event_type": self.event_type,
            "details": self.details,
            "user_id": str(self.user_id) if self.user_id else None,
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

    @classmethod
    def from_doc(cls, doc: dict) -> "SystemLog | None":
        if not doc:
            return None
        return cls(
            log_id=doc.get("_id"),
            event_type=doc.get("event_type", ""),
            details=doc.get("details", {}),
            user_id=doc.get("user_id"),
            actor_id=doc.get("actor_id"),
            ip_address=doc.get("ip_address"),
            timestamp=doc.get("timestamp"),
        )
