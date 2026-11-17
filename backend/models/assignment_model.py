"""
EduPredict - Teacher-Student Assignment Model
Represents mapping between instructor and student in MongoDB.
"""

from datetime import datetime, timezone
from bson import ObjectId
from backend.utils.security import to_object_id


class TeacherStudentAssignment:
    """Represents an active assignment of a student to a teacher."""

    def __init__(
        self,
        teacher_id: ObjectId | str,
        student_id: ObjectId | str,
        assigned_by: ObjectId | str | None = None,
        status: str = "active",
        assignment_id: ObjectId | str | None = None,
        assigned_at: datetime | None = None,
    ):
        self.id = to_object_id(assignment_id) or ObjectId()
        self.teacher_id = to_object_id(teacher_id)
        self.student_id = to_object_id(student_id)
        self.assigned_by = to_object_id(assigned_by)
        if not self.teacher_id or not self.student_id:
            raise ValueError("Both teacher_id and student_id must be valid ObjectIds.")
        self.status = status if status in {"active", "inactive"} else "active"
        self.assigned_at = assigned_at or datetime.now(timezone.utc)

    def to_doc(self) -> dict:
        return {
            "_id": self.id,
            "teacher_id": self.teacher_id,
            "student_id": self.student_id,
            "assigned_by": self.assigned_by,
            "status": self.status,
            "assigned_at": self.assigned_at,
        }

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "teacher_id": str(self.teacher_id),
            "student_id": str(self.student_id),
            "assigned_by": str(self.assigned_by) if self.assigned_by else None,
            "status": self.status,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
        }

    @classmethod
    def from_doc(cls, doc: dict) -> "TeacherStudentAssignment | None":
        if not doc:
            return None
        return cls(
            assignment_id=doc.get("_id"),
            teacher_id=doc.get("teacher_id"),
            student_id=doc.get("student_id"),
            assigned_by=doc.get("assigned_by"),
            status=doc.get("status", "active"),
            assigned_at=doc.get("assigned_at"),
        )
