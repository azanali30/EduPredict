"""
EduPredict - Database Schema & Index Management
Defines collection schemas, validation rules, and indexes for MongoDB 6.x.
"""

import logging
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)


def _drop_index_if_present(collection, index_name: str) -> None:
    """Safely drop an obsolete index if present."""
    try:
        info = collection.index_information()
        if index_name in info:
            collection.drop_index(index_name)
            logger.info("Dropped obsolete index '%s' on '%s'.", index_name, collection.name)
    except PyMongoError as exc:
        logger.warning("Index cleanup warning on '%s.%s': %s", collection.name, index_name, exc)


def init_db_indexes(db: Database) -> dict[str, list[str]]:
    """
    Ensure all required indexes exist across MongoDB 6.x collections.
    Safe and idempotent (create_index does not re-create identical indexes).
    """
    if db is None:
        raise ValueError("Database instance cannot be None.")

    created_indexes = {}

    try:
        # 1. Users collection indexes (email remains globally unique for login)
        _drop_index_if_present(db.users, "idx_users_org_role")
        users_idx = [
            db.users.create_index([("email", ASCENDING)], unique=True, name="idx_users_email_unique"),
            db.users.create_index([("role", ASCENDING)], name="idx_users_role"),
            db.users.create_index([("created_at", DESCENDING)], name="idx_users_created_at"),
            db.users.create_index([("student_id", ASCENDING)], unique=True, sparse=True, name="idx_users_student_id_unique"),
            db.users.create_index([("employee_id", ASCENDING)], unique=True, sparse=True, name="idx_users_employee_id_unique"),
        ]
        created_indexes["users"] = users_idx

        # 2. Academic Records collection indexes
        _drop_index_if_present(db.academic_records, "idx_records_org_student_term")
        # Check for legacy duplicate (student_id, subject, term) rows before enforcing partial unique index
        dup_check = list(
            db.academic_records.aggregate([
                {"$match": {"student_id": {"$type": "objectId"}, "subject": {"$type": "string"}, "term": {"$type": "string"}}},
                {"$group": {"_id": {"student_id": "$student_id", "subject": "$subject", "term": "$term"}, "cnt": {"$sum": 1}}},
                {"$match": {"cnt": {"$gt": 1}}},
                {"$limit": 1},
            ])
        )
        if dup_check:
            raise ValueError(
                "Duplicate (student_id, subject, term) documents detected in 'academic_records'. "
                "Resolve duplicates manually before creating unique index 'idx_records_student_subject_term_unique'."
            )
        records_idx = [
            db.academic_records.create_index([("student_id", ASCENDING)], name="idx_records_student_id"),
            db.academic_records.create_index([("student_id", ASCENDING), ("term", ASCENDING)], name="idx_records_student_term"),
            db.academic_records.create_index(
                [("student_id", ASCENDING), ("subject", ASCENDING), ("term", ASCENDING)],
                unique=True,
                partialFilterExpression={
                    "student_id": {"$type": "objectId"},
                    "subject": {"$type": "string"},
                    "term": {"$type": "string"},
                },
                name="idx_records_student_subject_term_unique",
            ),
            db.academic_records.create_index([("created_at", DESCENDING)], name="idx_records_created_at"),
        ]
        created_indexes["academic_records"] = records_idx

        # 3. Predictions collection indexes
        _drop_index_if_present(db.predictions, "idx_preds_org_student_created")
        preds_idx = [
            db.predictions.create_index([("student_id", ASCENDING)], name="idx_preds_student_id"),
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

        # 7. Subjects collection indexes (single-institution uniqueness)
        _drop_index_if_present(db.subjects, "idx_subjects_org_code_unique")
        _drop_index_if_present(db.subjects, "idx_subjects_org_canonical_unique")
        _drop_index_if_present(db.subjects, "idx_subjects_org_active")
        subjects_idx = [
            db.subjects.create_index([("code", ASCENDING)], unique=True, name="idx_subjects_code_unique"),
            db.subjects.create_index([("canonical_key", ASCENDING)], unique=True, name="idx_subjects_canonical_unique"),
            db.subjects.create_index([("is_active", ASCENDING)], name="idx_subjects_is_active"),
        ]
        created_indexes["subjects"] = subjects_idx

        # 8. Teacher-Subject Assignments collection indexes
        _drop_index_if_present(db.teacher_subject_assignments, "idx_org_teacher_subj_term_unique")
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

        # 9. Student-Subject Enrollments collection indexes
        _drop_index_if_present(db.student_subject_enrollments, "idx_org_student_subj_term_unique")
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

        # 10. Anomaly Records collection indexes (Phase 7C)
        anomaly_idx = [
            db.anomaly_records.create_index(
                [("source_record_id", ASCENDING), ("subject", ASCENDING), ("model_version", ASCENDING)],
                unique=True,
                name="idx_anomaly_source_subj_version_unique",
            ),
            db.anomaly_records.create_index(
                [("subject", ASCENDING), ("anomaly_severity", ASCENDING), ("review_status", ASCENDING)],
                name="idx_anomaly_subject_severity_status",
            ),
            db.anomaly_records.create_index([("student_id", ASCENDING)], name="idx_anomaly_student_id", sparse=True),
            db.anomaly_records.create_index([("detected_at", DESCENDING)], name="idx_anomaly_detected_at"),
            db.anomaly_records.create_index([("review_status", ASCENDING)], name="idx_anomaly_review_status"),
        ]
        created_indexes["anomaly_records"] = anomaly_idx

        # 11. Dropout Records collection indexes (Phase 8A & 8D)
        _drop_index_if_present(db.dropout_records, "idx_dropout_org_tier_created")
        dropout_idx = [
            db.dropout_records.create_index([("student_id", ASCENDING)], name="idx_dropout_student_id"),
            db.dropout_records.create_index([("risk_tier", ASCENDING)], name="idx_dropout_risk_tier"),
            db.dropout_records.create_index([("created_at", DESCENDING)], name="idx_dropout_created_at"),
            db.dropout_records.create_index(
                [("student_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_dropout_student_created",
            ),
        ]
        created_indexes["dropout_records"] = dropout_idx

        _drop_index_if_present(db.dropout_prediction_history, "idx_dropout_hist_org_created")
        dropout_hist_idx = [
            db.dropout_prediction_history.create_index(
                [("student_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_dropout_hist_student_created",
            ),
        ]
        created_indexes["dropout_prediction_history"] = dropout_hist_idx

        # 12. Course Demand Forecasts & Metadata indexes (Phase 8B)
        _drop_index_if_present(db.demand_forecasts, "idx_demand_org_period_created")
        demand_idx = [
            db.demand_forecasts.create_index(
                [("forecast_period", ASCENDING), ("created_at", DESCENDING)],
                name="idx_demand_period_created",
            ),
            db.demand_forecasts.create_index(
                [("subject_id", ASCENDING), ("forecast_period", ASCENDING)],
                name="idx_demand_subject_period",
            ),
            db.demand_forecasts.create_index([("created_at", DESCENDING)], name="idx_demand_created_at"),
        ]
        created_indexes["demand_forecasts"] = demand_idx

        _drop_index_if_present(db.demand_model_metadata, "idx_demand_meta_org_created")
        demand_meta_idx = [
            db.demand_model_metadata.create_index(
                [("created_at", DESCENDING)],
                name="idx_demand_meta_created",
            ),
        ]
        created_indexes["demand_model_metadata"] = demand_meta_idx

        # 13. Model Registry collection indexes (Phase 8C)
        _drop_index_if_present(db.model_registry, "idx_registry_org_created")
        registry_idx = [
            db.model_registry.create_index(
                [("model_type", ASCENDING), ("is_active", ASCENDING)],
                name="idx_registry_type_active",
            ),
            db.model_registry.create_index(
                [("created_at", DESCENDING)],
                name="idx_registry_created",
            ),
        ]
        created_indexes["model_registry"] = registry_idx

        # 14. Real-Time Stream Events collection indexes (Phase 10)
        stream_idx = [
            db.stream_events.create_index([("event_id", ASCENDING)], unique=True, name="idx_stream_event_id_unique"),
            db.stream_events.create_index(
                [("student_id", ASCENDING), ("subject", ASCENDING), ("event_timestamp", DESCENDING)],
                name="idx_stream_student_subj_ts",
            ),
            db.stream_events.create_index([("status", ASCENDING), ("received_at", DESCENDING)], name="idx_stream_status_received"),
            db.stream_events.create_index([("is_backfill", ASCENDING), ("status", ASCENDING)], name="idx_stream_backfill_status"),
        ]
        created_indexes["stream_events"] = stream_idx

        # 15. Notifications collection indexes (Phase 12A / 12B)
        notif_idx = [
            db.notifications.create_index(
                [("recipient_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_notif_recipient_created",
            ),
            db.notifications.create_index(
                [("recipient_id", ASCENDING), ("is_read", ASCENDING), ("created_at", DESCENDING)],
                name="idx_notif_recipient_read_created",
            ),
            db.notifications.create_index(
                [("recipient_id", ASCENDING), ("category", ASCENDING), ("severity", ASCENDING), ("created_at", DESCENDING)],
                name="idx_notif_recipient_filters",
            ),
            db.notifications.create_index(
                [("recipient_id", ASCENDING), ("dedup_key", ASCENDING)],
                unique=True,
                partialFilterExpression={"dedup_key": {"$type": "string"}},
                name="idx_notif_recipient_dedup_unique",
            ),
        ]
        created_indexes["notifications"] = notif_idx

        # 16. Feedback & Support Tickets collection indexes (Phase 12C)
        feedback_idx = [
            db.feedback_tickets.create_index(
                [("sender_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_feedback_sender_created",
            ),
            db.feedback_tickets.create_index(
                [("status", ASCENDING), ("created_at", DESCENDING)],
                name="idx_feedback_status_created",
            ),
            db.feedback_tickets.create_index(
                [("subject_id", ASCENDING), ("category", ASCENDING), ("created_at", DESCENDING)],
                name="idx_feedback_subject_category_created",
            ),
            db.feedback_tickets.create_index(
                [("sender_role", ASCENDING), ("created_at", DESCENDING)],
                name="idx_feedback_role_created",
            ),
        ]
        created_indexes["feedback_tickets"] = feedback_idx

        logger.info("MongoDB 6.x indexes successfully initialized.")
        return created_indexes

    except PyMongoError as e:
        logger.error("Failed to initialize MongoDB indexes: %s", str(e))
        raise
