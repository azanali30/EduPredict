"""
EduPredict - Academic Subject Model
Represents a first-class academic curriculum/subject entity in MongoDB.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import to_object_id


class Subject:
    """Represents an academic subject in the institutional course catalog."""

    def __init__(
        self,
        code: str,
        name: str,
        canonical_key: str,
        department: str = "",
        description: str = "",
        target_scale: str = "0 - 100",
        is_active: bool = True,
        capacity: Optional[int] = None,
        organization_id: Optional[str] = None,
        subject_id: Optional[ObjectId | str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self.id = to_object_id(subject_id) or ObjectId()

        clean_code = (code or "").strip().upper()
        clean_name = (name or "").strip()
        clean_key = (canonical_key or "").strip().lower()

        if not clean_code:
            raise ValueError("Subject code cannot be empty.")
        if not clean_name:
            raise ValueError("Subject name cannot be empty.")
        if not clean_key:
            raise ValueError("Subject canonical_key cannot be empty.")

        self.code = clean_code
        self.name = clean_name
        self.canonical_key = clean_key
        self.department = (department or "").strip()
        self.description = (description or "").strip()
        self.target_scale = (target_scale or "0 - 100").strip()
        self.is_active = bool(is_active)
        self.capacity = int(capacity) if capacity is not None else None
        self.organization_id = organization_id.strip() if organization_id else None

        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        """Convert domain model to MongoDB document."""
        doc = {
            "_id": self.id,
            "code": self.code,
            "name": self.name,
            "canonical_key": self.canonical_key,
            "department": self.department,
            "description": self.description,
            "target_scale": self.target_scale,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.capacity is not None:
            doc["capacity"] = self.capacity
        if self.organization_id is not None:
            doc["organization_id"] = self.organization_id
        return doc

    def to_dict(self) -> Dict[str, Any]:
        """Convert domain model to JSON-serializable dictionary."""
        return {
            "id": str(self.id),
            "code": self.code,
            "name": self.name,
            "canonical_key": self.canonical_key,
            "department": self.department,
            "description": self.description,
            "target_scale": self.target_scale,
            "is_active": self.is_active,
            "capacity": self.capacity,
            "organization_id": self.organization_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["Subject"]:
        """Instantiate Subject model from MongoDB document."""
        if not doc:
            return None
        return cls(
            subject_id=doc.get("_id"),
            code=doc.get("code", ""),
            name=doc.get("name", ""),
            canonical_key=doc.get("canonical_key", ""),
            department=doc.get("department", ""),
            description=doc.get("description", ""),
            target_scale=doc.get("target_scale", "0 - 100"),
            is_active=doc.get("is_active", True),
            capacity=doc.get("capacity"),
            organization_id=doc.get("organization_id"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
