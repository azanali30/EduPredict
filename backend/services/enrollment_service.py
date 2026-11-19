"""
EduPredict - Student Subject Enrollment Service
Manages course registrations, term enrollments, and student-subject rosters in MongoDB.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from bson import ObjectId

from backend.models.student_subject_enrollment_model import StudentSubjectEnrollment
from backend.models.subject_model import Subject
from backend.models.user_model import User
from backend.utils.security import to_object_id
from backend.services.system_log_service import log_event

logger = logging.getLogger(__name__)


class EnrollmentService:
    """Provides student-subject enrollment management and query operations."""

    @classmethod
    def enroll_student(
        cls,
        db: Database,
        student_id: ObjectId | str,
        subject_id: ObjectId | str,
        academic_term: str,
        enrolled_by: Optional[ObjectId | str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Enroll a student into an academic subject for a given term.
        Validates roles, subject existence, and handles reactivation safely without duplicates.
        """
        if db is None:
            return None, "Database unavailable."

        s_oid = to_object_id(student_id)
        subj_oid = to_object_id(subject_id)
        e_oid = to_object_id(enrolled_by)

        if not s_oid:
            return None, "Invalid student ID format."
        if not subj_oid:
            return None, "Invalid subject ID format."

        clean_term = (academic_term or "").strip()
        if not clean_term:
            return None, "academic_term cannot be empty."

        # Validate student existence and role
        student_doc = db.users.find_one({"_id": s_oid})
        if not student_doc or student_doc.get("role") != "student":
            return None, "Target student does not exist or does not hold the 'student' role."

        # Validate subject existence and active status
        subject_doc = db.subjects.find_one({"_id": subj_oid})
        if not subject_doc or not subject_doc.get("is_active", True):
            return None, "Target subject does not exist or is inactive."

        # Check existing enrollment for (student_id, subject_id, academic_term)
        existing_doc = db.student_subject_enrollments.find_one({
            "student_id": s_oid,
            "subject_id": subj_oid,
            "academic_term": clean_term,
        })

        now = datetime.now(timezone.utc)

        if existing_doc:
            current_status = existing_doc.get("status", "active")
            if current_status == "active":
                # Already actively enrolled
                enrollment = StudentSubjectEnrollment.from_doc(existing_doc)
                return enrollment.to_dict() if enrollment else None, None

            # Reactivate dropped or completed enrollment
            db.student_subject_enrollments.update_one(
                {"_id": existing_doc["_id"]},
                {
                    "$set": {
                        "status": "active",
                        "enrolled_by": e_oid or existing_doc.get("enrolled_by"),
                        "updated_at": now,
                    }
                },
            )
            updated_doc = db.student_subject_enrollments.find_one({"_id": existing_doc["_id"]})
            log_event(
                db,
                "STUDENT_ENROLLMENT_REACTIVATED",
                {
                    "student_id": str(s_oid),
                    "subject_id": str(subj_oid),
                    "academic_term": clean_term,
                    "previous_status": current_status,
                },
                actor_id=e_oid,
            )
            enrollment = StudentSubjectEnrollment.from_doc(updated_doc)
            return enrollment.to_dict() if enrollment else None, None

        # Insert new enrollment document
        enrollment = StudentSubjectEnrollment(
            student_id=s_oid,
            subject_id=subj_oid,
            academic_term=clean_term,
            enrolled_by=e_oid,
            status="active",
            enrolled_at=now,
            updated_at=now,
        )

        try:
            db.student_subject_enrollments.insert_one(enrollment.to_doc())
            log_event(
                db,
                "STUDENT_ENROLLED_IN_SUBJECT",
                {
                    "student_id": str(s_oid),
                    "subject_id": str(subj_oid),
                    "academic_term": clean_term,
                },
                actor_id=e_oid,
            )
            return enrollment.to_dict(), None
        except DuplicateKeyError:
            # Race condition safe: retrieve the winning document
            winning_doc = db.student_subject_enrollments.find_one({
                "student_id": s_oid,
                "subject_id": subj_oid,
                "academic_term": clean_term,
            })
            model = StudentSubjectEnrollment.from_doc(winning_doc)
            return model.to_dict() if model else None, None
        except Exception as e:
            logger.error("Failed to enroll student: %s", str(e))
            return None, f"Failed to enroll student: {str(e)}"

    @classmethod
    def drop_student(
        cls,
        db: Database,
        student_id: ObjectId | str,
        subject_id: ObjectId | str,
        academic_term: str,
        actor_id: Optional[ObjectId | str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Mark an active student enrollment as 'dropped'.
        """
        if db is None:
            return None, "Database unavailable."

        s_oid = to_object_id(student_id)
        subj_oid = to_object_id(subject_id)
        clean_term = (academic_term or "").strip()

        if not s_oid or not subj_oid or not clean_term:
            return None, "Valid student_id, subject_id, and academic_term are required."

        existing_doc = db.student_subject_enrollments.find_one({
            "student_id": s_oid,
            "subject_id": subj_oid,
            "academic_term": clean_term,
        })
        if not existing_doc:
            return None, "Enrollment record not found for this student, subject, and term."

        now = datetime.now(timezone.utc)
        a_oid = to_object_id(actor_id)

        db.student_subject_enrollments.update_one(
            {"_id": existing_doc["_id"]},
            {
                "$set": {
                    "status": "dropped",
                    "updated_at": now,
                }
            },
        )
        updated_doc = db.student_subject_enrollments.find_one({"_id": existing_doc["_id"]})
        log_event(
            db,
            "STUDENT_DROPPED_FROM_SUBJECT",
            {
                "student_id": str(s_oid),
                "subject_id": str(subj_oid),
                "academic_term": clean_term,
            },
            actor_id=a_oid,
        )
        model = StudentSubjectEnrollment.from_doc(updated_doc)
        return model.to_dict() if model else None, None

    @classmethod
    def get_student_enrolled_subjects(
        cls,
        db: Database,
        student_id: ObjectId | str,
        academic_term: Optional[str] = None,
        active_only: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        List all academic subjects in which a student is enrolled.
        """
        if db is None:
            return []

        s_oid = to_object_id(student_id)
        if not s_oid:
            return []

        query: Dict[str, Any] = {"student_id": s_oid}
        if active_only:
            query["status"] = "active"
        if academic_term:
            query["academic_term"] = academic_term.strip()

        enrollment_cursor = db.student_subject_enrollments.find(query)
        enrollments = list(enrollment_cursor)
        if not enrollments:
            return []

        subject_ids = [e["subject_id"] for e in enrollments if "subject_id" in e]
        subject_docs = {
            doc["_id"]: doc
            for doc in db.subjects.find({"_id": {"$in": subject_ids}})
        }

        results = []
        for e in enrollments:
            s_doc = subject_docs.get(e["subject_id"])
            if s_doc:
                subj = Subject.from_doc(s_doc)
                if subj:
                    item = subj.to_dict()
                    item["academic_term"] = e.get("academic_term")
                    item["enrollment_status"] = e.get("status")
                    results.append(item)
        return results

    @classmethod
    def get_enrolled_students_for_subject(
        cls,
        db: Database,
        subject_id: ObjectId | str,
        academic_term: Optional[str] = None,
        active_only: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        List all students actively enrolled in a specific subject.
        """
        if db is None:
            return []

        subj_oid = to_object_id(subject_id)
        if not subj_oid:
            return []

        query: Dict[str, Any] = {"subject_id": subj_oid}
        if active_only:
            query["status"] = "active"
        if academic_term:
            query["academic_term"] = academic_term.strip()

        enrollment_cursor = db.student_subject_enrollments.find(query)
        enrollments = list(enrollment_cursor)
        if not enrollments:
            return []

        student_ids = [e["student_id"] for e in enrollments if "student_id" in e]
        student_docs = {
            doc["_id"]: doc
            for doc in db.users.find({"_id": {"$in": student_ids}, "role": "student"})
        }

        results = []
        for e in enrollments:
            u_doc = student_docs.get(e["student_id"])
            if u_doc:
                user = User.from_doc(u_doc)
                if user:
                    item = user.to_dict()
                    item["academic_term"] = e.get("academic_term")
                    item["enrollment_status"] = e.get("status")
                    results.append(item)
        return results
