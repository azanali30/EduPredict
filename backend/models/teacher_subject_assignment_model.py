"""
EduPredict - Teacher-Subject Assignment Model
Represents instructor allocation to an academic subject and term in MongoDB.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import to_object_id


class TeacherSubjectAssignment:
    """Represents an active or inactive assignment of an instructor to a subject for a term."""

    VALID_STATUSES = {"active", "inactive"}

    def __init__(
        self,
        teacher_id: ObjectId | str,
        subject_id: ObjectId | str,
        academic_term: str,
        assigned_by: Optional[ObjectId | str] = None,
        status: str = "active",
        assignment_id: Optional[ObjectId | str] = None,
        assigned_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self.id = to_object_id(assignment_id) or ObjectId()
        self.teacher_id = to_object_id(teacher_id)
        self.subject_id = to_object_id(subject_id)
        self.assigned_by = to_object_id(assigned_by)

        if not self.teacher_id:
            raise ValueError("Valid teacher_id is required.")
        if not self.subject_id:
            raise ValueError("Valid subject_id is required.")

        clean_term = (academic_term or "").strip()
        if not clean_term:
            raise ValueError("academic_term cannot be empty.")
        self.academic_term = clean_term

        clean_status = (status or "active").strip().lower()
        if clean_status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid assignment status '{status}'. Allowed: {sorted(list(self.VALID_STATUSES))}.")
        self.status = clean_status

        now = datetime.now(timezone.utc)
        self.assigned_at = assigned_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        """Convert domain model to MongoDB document."""
        return {
            "_id": self.id,
            "teacher_id": self.teacher_id,
            "subject_id": self.subject_id,
            "academic_term": self.academic_term,
            "assigned_by": self.assigned_by,
            "status": self.status,
            "assigned_at": self.assigned_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        """Convert domain model to JSON-serializable dictionary."""
        return {
            "id": str(self.id),
            "teacher_id": str(self.teacher_id),
            "subject_id": str(self.subject_id),
            "academic_term": self.academic_term,
            "assigned_by": str(self.assigned_by) if self.assigned_by else None,
            "status": self.status,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["TeacherSubjectAssignment"]:
        """Instantiate TeacherSubjectAssignment model from MongoDB document."""
        if not doc:
            return None
        return cls(
            assignment_id=doc.get("_id"),
            teacher_id=doc.get("teacher_id"),
            subject_id=doc.get("subject_id"),
            academic_term=doc.get("academic_term", ""),
            assigned_by=doc.get("assigned_by"),
            status=doc.get("status", "active"),
            assigned_at=doc.get("assigned_at"),
            updated_at=doc.get("updated_at"),
        )
