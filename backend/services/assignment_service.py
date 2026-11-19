"""
EduPredict - Teacher-Student Assignment Service
Manages linkages between instructors and students in MongoDB.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from backend.models.assignment_model import TeacherStudentAssignment
from backend.models.teacher_subject_assignment_model import TeacherSubjectAssignment
from backend.models.subject_model import Subject
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

    # =========================================================================
    # Phase 6A: Subject-Based Teacher Assignment Operations
    # =========================================================================

    @classmethod
    def assign_teacher_to_subject(
        cls,
        db: Database,
        teacher_id: ObjectId | str,
        subject_id: ObjectId | str,
        academic_term: str,
        admin_id: Optional[ObjectId | str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Assign an active instructor to an academic subject for a given term.
        Validates teacher role, subject existence, and handles reactivation safely without duplicates.
        """
        if db is None:
            return None, "Database unavailable."

        t_oid = to_object_id(teacher_id)
        s_oid = to_object_id(subject_id)
        a_oid = to_object_id(admin_id)

        if not t_oid:
            return None, "Invalid teacher ID format."
        if not s_oid:
            return None, "Invalid subject ID format."

        clean_term = (academic_term or "").strip()
        if not clean_term:
            return None, "academic_term cannot be empty."

        # Validate teacher role
        teacher_doc = db.users.find_one({"_id": t_oid})
        if not teacher_doc or teacher_doc.get("role") != "teacher":
            return None, "Target teacher does not exist or does not hold the 'teacher' role."

        # Validate subject existence and active status
        subject_doc = db.subjects.find_one({"_id": s_oid})
        if not subject_doc or not subject_doc.get("is_active", True):
            return None, "Target subject does not exist or is inactive."

        # Check existing assignment for (teacher_id, subject_id, academic_term)
        existing_doc = db.teacher_subject_assignments.find_one({
            "teacher_id": t_oid,
            "subject_id": s_oid,
            "academic_term": clean_term,
        })

        now = datetime.now(timezone.utc)

        if existing_doc:
            current_status = existing_doc.get("status", "active")
            if current_status == "active":
                assignment = TeacherSubjectAssignment.from_doc(existing_doc)
                return assignment.to_dict() if assignment else None, None

            # Reactivate inactive assignment
            db.teacher_subject_assignments.update_one(
                {"_id": existing_doc["_id"]},
                {
                    "$set": {
                        "status": "active",
                        "assigned_by": a_oid or existing_doc.get("assigned_by"),
                        "updated_at": now,
                    }
                },
            )
            updated_doc = db.teacher_subject_assignments.find_one({"_id": existing_doc["_id"]})
            log_event(
                db,
                "TEACHER_ASSIGNMENT_REACTIVATED",
                {
                    "teacher_id": str(t_oid),
                    "subject_id": str(s_oid),
                    "academic_term": clean_term,
                    "previous_status": current_status,
                },
                actor_id=a_oid,
            )
            assignment = TeacherSubjectAssignment.from_doc(updated_doc)
            return assignment.to_dict() if assignment else None, None

        # Insert new assignment document
        assignment = TeacherSubjectAssignment(
            teacher_id=t_oid,
            subject_id=s_oid,
            academic_term=clean_term,
            assigned_by=a_oid,
            status="active",
            assigned_at=now,
            updated_at=now,
        )

        try:
            db.teacher_subject_assignments.insert_one(assignment.to_doc())
            log_event(
                db,
                "TEACHER_ASSIGNED_TO_SUBJECT",
                {
                    "teacher_id": str(t_oid),
                    "subject_id": str(s_oid),
                    "academic_term": clean_term,
                },
                actor_id=a_oid,
            )
            return assignment.to_dict(), None
        except DuplicateKeyError:
            winning_doc = db.teacher_subject_assignments.find_one({
                "teacher_id": t_oid,
                "subject_id": s_oid,
                "academic_term": clean_term,
            })
            model = TeacherSubjectAssignment.from_doc(winning_doc)
            return model.to_dict() if model else None, None
        except Exception as e:
            logger.error("Failed to assign teacher to subject: %s", str(e))
            return None, f"Failed to assign teacher to subject: {str(e)}"

    @classmethod
    def get_subjects_for_teacher(
        cls,
        db: Database,
        teacher_id: ObjectId | str,
        academic_term: Optional[str] = None,
        active_only: bool = True,
    ) -> List[Dict[str, Any]]:
        """Retrieve list of subjects assigned to a specific instructor."""
        if db is None:
            return []
        t_oid = to_object_id(teacher_id)
        if not t_oid:
            return []

        query: Dict[str, Any] = {"teacher_id": t_oid}
        if active_only:
            query["status"] = "active"
        if academic_term:
            query["academic_term"] = academic_term.strip()

        cursor = db.teacher_subject_assignments.find(query)
        assignments = list(cursor)
        if not assignments:
            return []

        subject_ids = [doc["subject_id"] for doc in assignments if "subject_id" in doc]
        subject_docs = {
            doc["_id"]: doc
            for doc in db.subjects.find({"_id": {"$in": subject_ids}})
        }

        results = []
        for a in assignments:
            s_doc = subject_docs.get(a["subject_id"])
            if s_doc:
                subj = Subject.from_doc(s_doc)
                if subj:
                    item = subj.to_dict()
                    item["academic_term"] = a.get("academic_term")
                    item["assignment_status"] = a.get("status")
                    results.append(item)
        return results

    @classmethod
    def get_students_for_teacher_by_subject(
        cls,
        db: Database,
        teacher_id: ObjectId | str,
        subject_id: Optional[ObjectId | str] = None,
        academic_term: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve list of students enrolled in subjects taught by this teacher.
        If subject_id is specified, returns only students enrolled in that specific subject
        (provided the teacher is assigned to it).
        """
        if db is None:
            return []

        t_oid = to_object_id(teacher_id)
        if not t_oid:
            return []

        # Find teacher's assigned subjects
        query: Dict[str, Any] = {"teacher_id": t_oid, "status": "active"}
        if academic_term:
            query["academic_term"] = academic_term.strip()
        if subject_id:
            s_oid = to_object_id(subject_id)
            if not s_oid:
                return []
            query["subject_id"] = s_oid

        assignments = list(db.teacher_subject_assignments.find(query))
        if not assignments:
            return []

        # Build term-aligned enrollment query conditions
        term_conditions = []
        for a in assignments:
            s_id = a.get("subject_id")
            term = a.get("academic_term")
            if s_id:
                cond: Dict[str, Any] = {"subject_id": s_id, "status": "active"}
                if term:
                    cond["academic_term"] = term
                term_conditions.append(cond)

        if not term_conditions:
            return []

        if len(term_conditions) == 1:
            enroll_query = term_conditions[0]
        else:
            enroll_query = {"$or": term_conditions}

        if academic_term:
            enroll_query["academic_term"] = academic_term.strip()

        enrollments = list(db.student_subject_enrollments.find(enroll_query))
        if not enrollments:
            return []

        student_ids = list({e["student_id"] for e in enrollments if "student_id" in e})
        student_docs = list(db.users.find({"_id": {"$in": student_ids}, "role": "student"}))

        # Index subjects by ID
        teacher_subj_ids = [a["subject_id"] for a in assignments if "subject_id" in a]
        subj_map = {
            s["_id"]: s.get("name", "")
            for s in db.subjects.find({"_id": {"$in": teacher_subj_ids}})
        }

        # Map student_id to list of enrolled subjects under this teacher
        student_subj_map: Dict[str, List[str]] = {}
        for e in enrollments:
            sid_str = str(e["student_id"])
            subj_name = subj_map.get(e["subject_id"], "Unknown")
            if sid_str not in student_subj_map:
                student_subj_map[sid_str] = []
            if subj_name not in student_subj_map[sid_str]:
                student_subj_map[sid_str].append(subj_name)

        results = []
        for doc in student_docs:
            u = User.from_doc(doc)
            if u:
                u_dict = u.to_dict()
                u_dict["enrolled_subjects_under_teacher"] = student_subj_map.get(str(u.id), [])
                results.append(u_dict)
        return results
