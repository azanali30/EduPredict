"""
EduPredict - Student-Subject Enrollment Model
Represents student enrollment in an academic subject and term in MongoDB.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import to_object_id


class StudentSubjectEnrollment:
    """Represents student enrollment status in an academic subject for a term."""

    VALID_STATUSES = {"active", "dropped", "completed"}

    def __init__(
        self,
        student_id: ObjectId | str,
        subject_id: ObjectId | str,
        academic_term: str,
        enrolled_by: Optional[ObjectId | str] = None,
        status: str = "active",
        enrollment_id: Optional[ObjectId | str] = None,
        enrolled_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self.id = to_object_id(enrollment_id) or ObjectId()
        self.student_id = to_object_id(student_id)
        self.subject_id = to_object_id(subject_id)
        self.enrolled_by = to_object_id(enrolled_by)

        if not self.student_id:
            raise ValueError("Valid student_id is required.")
        if not self.subject_id:
            raise ValueError("Valid subject_id is required.")

        clean_term = (academic_term or "").strip()
        if not clean_term:
            raise ValueError("academic_term cannot be empty.")
        self.academic_term = clean_term

        clean_status = (status or "active").strip().lower()
        if clean_status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid enrollment status '{status}'. Allowed: {sorted(list(self.VALID_STATUSES))}.")
        self.status = clean_status

        now = datetime.now(timezone.utc)
        self.enrolled_at = enrolled_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        """Convert domain model to MongoDB document."""
        return {
            "_id": self.id,
            "student_id": self.student_id,
            "subject_id": self.subject_id,
            "academic_term": self.academic_term,
            "enrolled_by": self.enrolled_by,
            "status": self.status,
            "enrolled_at": self.enrolled_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        """Convert domain model to JSON-serializable dictionary."""
        return {
            "id": str(self.id),
            "student_id": str(self.student_id),
            "subject_id": str(self.subject_id),
            "academic_term": self.academic_term,
            "enrolled_by": str(self.enrolled_by) if self.enrolled_by else None,
            "status": self.status,
            "enrolled_at": self.enrolled_at.isoformat() if self.enrolled_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["StudentSubjectEnrollment"]:
        """Instantiate StudentSubjectEnrollment model from MongoDB document."""
        if not doc:
            return None
        return cls(
            enrollment_id=doc.get("_id"),
            student_id=doc.get("student_id"),
            subject_id=doc.get("subject_id"),
            academic_term=doc.get("academic_term", ""),
            enrolled_by=doc.get("enrolled_by"),
            status=doc.get("status", "active"),
            enrolled_at=doc.get("enrolled_at"),
            updated_at=doc.get("updated_at"),
        )
