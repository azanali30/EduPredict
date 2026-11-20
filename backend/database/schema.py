"""
EduPredict - Database Schema & Index Management
Defines collection schemas, validation rules, and indexes for MongoDB 6.x.
"""

import logging
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)


def init_db_indexes(db: Database) -> dict[str, list[str]]:
    """
    Ensure all required indexes exist across MongoDB 6.x collections.
    Safe and idempotent (create_index does not re-create identical indexes).
    """
    if db is None:
        raise ValueError("Database instance cannot be None.")

    created_indexes = {}

    try:
        # 1. Users collection indexes
        users_idx = [
            db.users.create_index([("email", ASCENDING)], unique=True, name="idx_users_email_unique"),
            db.users.create_index([("role", ASCENDING)], name="idx_users_role"),
            db.users.create_index([("created_at", DESCENDING)], name="idx_users_created_at"),
            db.users.create_index([("student_id", ASCENDING)], unique=True, sparse=True, name="idx_users_student_id_unique"),
            db.users.create_index([("employee_id", ASCENDING)], unique=True, sparse=True, name="idx_users_employee_id_unique"),
        ]
        created_indexes["users"] = users_idx

        # 2. Academic Records collection indexes
        records_idx = [
            db.academic_records.create_index([("student_id", ASCENDING)], name="idx_records_student_id"),
            db.academic_records.create_index(
                [("student_id", ASCENDING), ("term", ASCENDING)],
                name="idx_records_student_term",
            ),
            db.academic_records.create_index([("created_at", DESCENDING)], name="idx_records_created_at"),
        ]
        created_indexes["academic_records"] = records_idx

        # 3. Predictions collection indexes
        preds_idx = [
            db.predictions.create_index([("student_id", ASCENDING)], name="idx_preds_student_id"),
            db.predictions.create_index(
                [("student_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_preds_student_created",
            ),
            db.predictions.create_index(
                [("subject", ASCENDING), ("milestone", ASCENDING)],
                name="idx_preds_subject_milestone",
            ),
            db.predictions.create_index([("predicted_status", ASCENDING)], name="idx_preds_predicted_status"),
            db.predictions.create_index([("risk_level", ASCENDING)], name="idx_preds_risk_level"),
            db.predictions.create_index([("created_at", DESCENDING)], name="idx_preds_created_at"),
            db.predictions.create_index(
                [("student_id", ASCENDING), ("subject_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_preds_student_subject_created",
                sparse=True,
            ),
            db.predictions.create_index(
                [("subject_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_preds_subject_created",
                sparse=True,
            ),
        ]
        created_indexes["predictions"] = preds_idx

        # 4. Teacher-Student Assignments collection indexes
        assign_idx = [
            db.teacher_student_assignments.create_index(
                [("teacher_id", ASCENDING), ("student_id", ASCENDING)],
                unique=True,
                name="idx_assignments_teacher_student_unique",
            ),
            db.teacher_student_assignments.create_index(
                [("teacher_id", ASCENDING)],
                name="idx_assignments_teacher_id",
            ),
            db.teacher_student_assignments.create_index(
                [("student_id", ASCENDING)],
                name="idx_assignments_student_id",
            ),
            db.teacher_student_assignments.create_index(
                [("status", ASCENDING)],
                name="idx_assignments_status",
            ),
        ]
        created_indexes["teacher_student_assignments"] = assign_idx

        # 5. System Logs collection indexes
        logs_idx = [
            db.system_logs.create_index([("timestamp", DESCENDING)], name="idx_logs_timestamp"),
            db.system_logs.create_index([("event_type", ASCENDING)], name="idx_logs_event_type"),
            db.system_logs.create_index([("user_id", ASCENDING)], name="idx_logs_user_id"),
        ]
        created_indexes["system_logs"] = logs_idx

        # 6. Analytical Academic Records (Big Data Staging & Lakehouse Integration)
        analytical_idx = [
            db.analytical_academic_records.create_index(
                [("student_code", ASCENDING), ("subject", ASCENDING), ("academic_year", ASCENDING)],
                unique=True,
                name="idx_analytical_student_subj_year_unique",
            ),
            db.analytical_academic_records.create_index([("academic_status", ASCENDING)], name="idx_analytical_status"),
            db.analytical_academic_records.create_index([("subject", ASCENDING)], name="idx_analytical_subject"),
            db.analytical_academic_records.create_index([("final_exam_marks", DESCENDING)], name="idx_analytical_final_marks"),
        ]
        created_indexes["analytical_academic_records"] = analytical_idx

        # 7. Subjects collection indexes (Phase 6A Subject Catalog)
        subjects_idx = [
            db.subjects.create_index([("code", ASCENDING)], unique=True, name="idx_subjects_code_unique"),
            db.subjects.create_index([("canonical_key", ASCENDING)], unique=True, name="idx_subjects_canonical_unique"),
            db.subjects.create_index([("is_active", ASCENDING)], name="idx_subjects_is_active"),
        ]
        created_indexes["subjects"] = subjects_idx

        # 8. Teacher-Subject Assignments collection indexes (Phase 6A)
        teacher_subj_idx = [
            db.teacher_subject_assignments.create_index(
                [("teacher_id", ASCENDING), ("subject_id", ASCENDING), ("academic_term", ASCENDING)],
                unique=True,
                name="idx_teacher_subj_term_unique",
            ),
            db.teacher_subject_assignments.create_index(
                [("teacher_id", ASCENDING), ("status", ASCENDING)],
                name="idx_teacher_subj_status",
            ),
            db.teacher_subject_assignments.create_index(
                [("subject_id", ASCENDING), ("status", ASCENDING)],
                name="idx_subj_teachers_status",
            ),
        ]
        created_indexes["teacher_subject_assignments"] = teacher_subj_idx

        # 9. Student-Subject Enrollments collection indexes (Phase 6A)
        student_subj_idx = [
            db.student_subject_enrollments.create_index(
                [("student_id", ASCENDING), ("subject_id", ASCENDING), ("academic_term", ASCENDING)],
                unique=True,
                name="idx_student_subj_term_unique",
            ),
            db.student_subject_enrollments.create_index(
                [("student_id", ASCENDING), ("status", ASCENDING)],
                name="idx_student_subj_status",
            ),
            db.student_subject_enrollments.create_index(
                [("subject_id", ASCENDING), ("status", ASCENDING)],
                name="idx_subj_students_status",
            ),
        ]
        created_indexes["student_subject_enrollments"] = student_subj_idx

        logger.info("MongoDB 6.x indexes successfully initialized.")
        return created_indexes

    except PyMongoError as e:
        logger.error("Failed to initialize MongoDB indexes: %s", str(e))
        raise
