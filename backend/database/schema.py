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
                [("academic_record_id", ASCENDING)],
                name="idx_preds_academic_record_id",
            ),
            db.predictions.create_index([("risk_level", ASCENDING)], name="idx_preds_risk_level"),
            db.predictions.create_index([("created_at", DESCENDING)], name="idx_preds_created_at"),
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

        logger.info("MongoDB 6.x indexes successfully initialized.")
        return created_indexes

    except PyMongoError as e:
        logger.error("Failed to initialize MongoDB indexes: %s", str(e))
        raise
