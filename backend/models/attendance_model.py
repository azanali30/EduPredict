"""
EduPredict - Institutional Attendance Register Models
Module: backend.models.attendance_model
Collections:
  - attendance_sessions: Teacher-conducted class roll-call sessions per subject & term
  - attendance_records: Individual student attendance entries linked to an attendance session

Strictly separated from the ML 60-session absence proxy (Estimated ML Attendance Proxy).
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId

VALID_ATTENDANCE_STATUSES = ("Present", "Absent", "Late", "Excused")
ATTENDANCE_STATUS_LOOKUP = {s.lower(): s for s in VALID_ATTENDANCE_STATUSES}


class AttendanceSession:
    """Represents a real class attendance session conducted for a subject and term."""

    def __init__(
        self,
        subject_id: ObjectId,
        subject_name: str,
        subject_code: str,
        teacher_id: ObjectId,
        teacher_name: str,
        academic_term: str,
        session_date: str,
        session_title: str = "",
        notes: Optional[str] = None,
        status: str = "recorded",
        total_students: int = 0,
        present_count: int = 0,
        absent_count: int = 0,
        late_count: int = 0,
        excused_count: int = 0,
        created_by: Optional[ObjectId] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        _id: Optional[ObjectId] = None,
    ):
        self.id = _id or ObjectId()
        self.subject_id = subject_id
        self.subject_name = subject_name
        self.subject_code = subject_code
        self.teacher_id = teacher_id
        self.teacher_name = teacher_name
        self.academic_term = academic_term.strip()
        self.session_date = session_date.strip()
        self.session_title = (session_title or "").strip()
        self.notes = notes
        self.status = status
        self.total_students = int(total_students)
        self.present_count = int(present_count)
        self.absent_count = int(absent_count)
        self.late_count = int(late_count)
        self.excused_count = int(excused_count)
        self.created_by = created_by or teacher_id
        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "subject_id": self.subject_id,
            "subject_name": self.subject_name,
            "subject_code": self.subject_code,
            "teacher_id": self.teacher_id,
            "teacher_name": self.teacher_name,
            "academic_term": self.academic_term,
            "session_date": self.session_date,
            "session_title": self.session_title,
            "notes": self.notes,
            "status": self.status,
            "total_students": self.total_students,
            "present_count": self.present_count,
            "absent_count": self.absent_count,
            "late_count": self.late_count,
            "excused_count": self.excused_count,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "subject_id": str(self.subject_id),
            "subject_name": self.subject_name,
            "subject_code": self.subject_code,
            "teacher_id": str(self.teacher_id),
            "teacher_name": self.teacher_name,
            "academic_term": self.academic_term,
            "session_date": self.session_date,
            "session_title": self.session_title,
            "notes": self.notes,
            "status": self.status,
            "total_students": self.total_students,
            "present_count": self.present_count,
            "absent_count": self.absent_count,
            "late_count": self.late_count,
            "excused_count": self.excused_count,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
            "attendance_source": "verified_institutional_register",
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["AttendanceSession"]:
        if not doc:
            return None
        return cls(
            _id=doc.get("_id"),
            subject_id=doc["subject_id"],
            subject_name=doc.get("subject_name", ""),
            subject_code=doc.get("subject_code", ""),
            teacher_id=doc["teacher_id"],
            teacher_name=doc.get("teacher_name", ""),
            academic_term=doc.get("academic_term", ""),
            session_date=doc.get("session_date", ""),
            session_title=doc.get("session_title", ""),
            notes=doc.get("notes"),
            status=doc.get("status", "recorded"),
            total_students=doc.get("total_students", 0),
            present_count=doc.get("present_count", 0),
            absent_count=doc.get("absent_count", 0),
            late_count=doc.get("late_count", 0),
            excused_count=doc.get("excused_count", 0),
            created_by=doc.get("created_by"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )


class AttendanceRecord:
    """Represents a single student's verified roll-call record for one session."""

    def __init__(
        self,
        session_id: ObjectId,
        student_id: ObjectId,
        subject_id: ObjectId,
        subject_name: str,
        teacher_id: ObjectId,
        academic_term: str,
        session_date: str,
        status: str,
        student_name: str = "",
        student_code: Optional[str] = None,
        remarks: Optional[str] = None,
        marked_by: Optional[ObjectId] = None,
        marked_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        _id: Optional[ObjectId] = None,
    ):
        self.id = _id or ObjectId()
        self.session_id = session_id
        self.student_id = student_id
        self.subject_id = subject_id
        self.subject_name = subject_name
        self.teacher_id = teacher_id
        self.academic_term = academic_term.strip()
        self.session_date = session_date.strip()
        self.status = status
        self.student_name = student_name
        self.student_code = student_code
        self.remarks = remarks
        self.marked_by = marked_by or teacher_id
        now = datetime.now(timezone.utc)
        self.marked_at = marked_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "session_id": self.session_id,
            "student_id": self.student_id,
            "subject_id": self.subject_id,
            "subject_name": self.subject_name,
            "teacher_id": self.teacher_id,
            "academic_term": self.academic_term,
            "session_date": self.session_date,
            "status": self.status,
            "student_name": self.student_name,
            "student_code": self.student_code,
            "remarks": self.remarks,
            "marked_by": self.marked_by,
            "marked_at": self.marked_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "session_id": str(self.session_id),
            "student_id": str(self.student_id),
            "student_name": self.student_name,
            "student_code": self.student_code,
            "subject_id": str(self.subject_id),
            "subject_name": self.subject_name,
            "teacher_id": str(self.teacher_id),
            "academic_term": self.academic_term,
            "session_date": self.session_date,
            "status": self.status,
            "remarks": self.remarks,
            "marked_by": str(self.marked_by) if self.marked_by else None,
            "marked_at": self.marked_at.isoformat() if isinstance(self.marked_at, datetime) else self.marked_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
            "attendance_source": "verified_institutional_register",
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["AttendanceRecord"]:
        if not doc:
            return None
        return cls(
            _id=doc.get("_id"),
            session_id=doc["session_id"],
            student_id=doc["student_id"],
            subject_id=doc["subject_id"],
            subject_name=doc.get("subject_name", ""),
            teacher_id=doc["teacher_id"],
            academic_term=doc.get("academic_term", ""),
            session_date=doc.get("session_date", ""),
            status=doc.get("status", "Present"),
            student_name=doc.get("student_name", ""),
            student_code=doc.get("student_code"),
            remarks=doc.get("remarks"),
            marked_by=doc.get("marked_by"),
            marked_at=doc.get("marked_at"),
            updated_at=doc.get("updated_at"),
        )
