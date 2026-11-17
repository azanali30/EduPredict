"""
EduPredict - Academic Record Model
Defines structure and validation for student academic indicators in MongoDB.
"""

from datetime import datetime, timezone
from bson import ObjectId
from backend.utils.security import to_object_id


class AcademicRecord:
    """Represents a student's academic metrics for a given term."""

    def __init__(
        self,
        student_id: ObjectId | str,
        term: str,
        attendance_percentage: float,
        study_hours_per_week: float,
        assignment_completion_rate: float,
        quiz_average: float,
        previous_exam_marks: float,
        subject_scores: dict[str, float] | None = None,
        record_id: ObjectId | str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.student_id = to_object_id(student_id)
        if not self.student_id:
            raise ValueError("Valid student_id is required.")
        self.term = term.strip()
        self.attendance_percentage = float(attendance_percentage)
        self.study_hours_per_week = float(study_hours_per_week)
        self.assignment_completion_rate = float(assignment_completion_rate)
        self.quiz_average = float(quiz_average)
        self.previous_exam_marks = float(previous_exam_marks)
        self.subject_scores = subject_scores or {}
        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> dict:
        return {
            "_id": self.id,
            "student_id": self.student_id,
            "term": self.term,
            "attendance_percentage": self.attendance_percentage,
            "study_hours_per_week": self.study_hours_per_week,
            "assignment_completion_rate": self.assignment_completion_rate,
            "quiz_average": self.quiz_average,
            "previous_exam_marks": self.previous_exam_marks,
            "subject_scores": self.subject_scores,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "student_id": str(self.student_id),
            "term": self.term,
            "attendance_percentage": self.attendance_percentage,
            "study_hours_per_week": self.study_hours_per_week,
            "assignment_completion_rate": self.assignment_completion_rate,
            "quiz_average": self.quiz_average,
            "previous_exam_marks": self.previous_exam_marks,
            "subject_scores": self.subject_scores,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_doc(cls, doc: dict) -> "AcademicRecord | None":
        if not doc:
            return None
        return cls(
            record_id=doc.get("_id"),
            student_id=doc.get("student_id"),
            term=doc.get("term", ""),
            attendance_percentage=doc.get("attendance_percentage", 0.0),
            study_hours_per_week=doc.get("study_hours_per_week", 0.0),
            assignment_completion_rate=doc.get("assignment_completion_rate", 0.0),
            quiz_average=doc.get("quiz_average", 0.0),
            previous_exam_marks=doc.get("previous_exam_marks", 0.0),
            subject_scores=doc.get("subject_scores", {}),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
