"""
EduPredict - Teacher-Student Assignment Service
Manages linkages between instructors and students in MongoDB.
"""

import logging
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from backend.models.assignment_model import TeacherStudentAssignment
from backend.models.user_model import User
from backend.utils.security import to_object_id
from backend.services.system_log_service import log_event

logger = logging.getLogger(__name__)


class AssignmentService:
    """Manages teacher-to-student assignments and authorization lookups."""

    @staticmethod
    def assign_teacher_to_student(
        db: Database,
        teacher_id,
        student_id,
        admin_id,
    ) -> tuple[dict | None, str | None]:
        """
        Assign an active student to an active teacher.
        Validates roles: teacher must have role='teacher', student must have role='student'.
        """
        if db is None:
            return None, "Database unavailable."

        t_oid = to_object_id(teacher_id)
        s_oid = to_object_id(student_id)
        a_oid = to_object_id(admin_id)

        if not t_oid or not s_oid:
            return None, "Invalid teacher or student ID format."

        # Validate teacher role
        teacher_doc = db.users.find_one({"_id": t_oid})
        if not teacher_doc or teacher_doc.get("role") != "teacher":
            return None, "Target teacher either does not exist or does not hold the 'teacher' role."

        # Validate student role
        student_doc = db.users.find_one({"_id": s_oid})
        if not student_doc or student_doc.get("role") != "student":
            return None, "Target student either does not exist or does not hold the 'student' role."

        assignment = TeacherStudentAssignment(
            teacher_id=t_oid,
            student_id=s_oid,
            assigned_by=a_oid,
            status="active",
        )

        try:
            db.teacher_student_assignments.update_one(
                {"teacher_id": t_oid, "student_id": s_oid},
                {"$set": assignment.to_doc()},
                upsert=True,
            )
            log_event(
                db,
                "ASSIGNMENT_CREATED",
                {"teacher_id": str(t_oid), "student_id": str(s_oid)},
                actor_id=a_oid,
            )
            return assignment.to_dict(), None
        except DuplicateKeyError:
            return assignment.to_dict(), None
        except Exception as e:
            logger.error("Failed to assign teacher: %s", str(e))
            return None, f"Failed to create assignment: {str(e)}"

    @staticmethod
    def get_students_for_teacher(db: Database, teacher_id) -> list[dict]:
        """Retrieve list of students assigned to a specific teacher."""
        if db is None:
            return []
        t_oid = to_object_id(teacher_id)
        if not t_oid:
            return []

        cursor = db.teacher_student_assignments.find({
            "teacher_id": t_oid,
            "status": "active",
        })
        student_ids = [doc["student_id"] for doc in cursor if "student_id" in doc]
        if not student_ids:
            return []

        student_docs = db.users.find({"_id": {"$in": student_ids}, "role": "student"})
        return [User.from_doc(doc).to_dict() for doc in student_docs if doc]

    @staticmethod
    def is_student_assigned_to_teacher(db: Database, teacher_id, student_id) -> bool:
        """Check if student is actively assigned to teacher."""
        if db is None:
            return False
        t_oid = to_object_id(teacher_id)
        s_oid = to_object_id(student_id)
        if not t_oid or not s_oid:
            return False

        doc = db.teacher_student_assignments.find_one({
            "teacher_id": t_oid,
            "student_id": s_oid,
            "status": "active",
        })
        return doc is not None
