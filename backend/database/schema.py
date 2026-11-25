"""
EduPredict - Database Schema & Index Management
Defines collection schemas, validation rules, and indexes for MongoDB 6.x.
"""

import logging
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)


def _drop_legacy_index_if_present(collection, index_name: str, expected_keys: list[tuple[str, int]]) -> None:
    """Safely drop a legacy single-tenant unique index only if its key pattern lacks organization_id."""
    try:
        info = collection.index_information()
        if index_name in info:
            existing_keys = list(info[index_name].get("key", []))
            if existing_keys != expected_keys:
                collection.drop_index(index_name)
                logger.info("Migrated legacy index '%s' on '%s'.", index_name, collection.name)
    except PyMongoError as exc:
        logger.warning("Index migration check warning on '%s.%s': %s", collection.name, index_name, exc)


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
        users_idx = [
            db.users.create_index([("email", ASCENDING)], unique=True, name="idx_users_email_unique"),
            db.users.create_index([("organization_id", ASCENDING), ("role", ASCENDING)], name="idx_users_org_role"),
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
                [("organization_id", ASCENDING), ("student_id", ASCENDING), ("term", ASCENDING)],
                name="idx_records_org_student_term",
            ),
            db.academic_records.create_index([("created_at", DESCENDING)], name="idx_records_created_at"),
        ]
        created_indexes["academic_records"] = records_idx

        # 3. Predictions collection indexes
        preds_idx = [
            db.predictions.create_index([("student_id", ASCENDING)], name="idx_preds_student_id"),
            db.predictions.create_index(
                [("organization_id", ASCENDING), ("student_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_preds_org_student_created",
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

        # 7. Subjects collection indexes (Phase 9B compound tenant-scoped uniqueness)
        _drop_legacy_index_if_present(
            db.subjects,
            "idx_subjects_code_unique",
            [("organization_id", ASCENDING), ("code", ASCENDING)],
        )
        _drop_legacy_index_if_present(
            db.subjects,
            "idx_subjects_canonical_unique",
            [("organization_id", ASCENDING), ("canonical_key", ASCENDING)],
        )
        subjects_idx = [
            db.subjects.create_index(
                [("organization_id", ASCENDING), ("code", ASCENDING)],
                unique=True,
                name="idx_subjects_org_code_unique",
            ),
            db.subjects.create_index(
                [("organization_id", ASCENDING), ("canonical_key", ASCENDING)],
                unique=True,
                name="idx_subjects_org_canonical_unique",
            ),
            db.subjects.create_index([("organization_id", ASCENDING), ("is_active", ASCENDING)], name="idx_subjects_org_active"),
        ]
        created_indexes["subjects"] = subjects_idx

        # 8. Teacher-Subject Assignments collection indexes
        _drop_legacy_index_if_present(
            db.teacher_student_assignments,
            "idx_teacher_subj_term_unique",
            [("organization_id", ASCENDING), ("teacher_id", ASCENDING), ("subject_id", ASCENDING), ("academic_term", ASCENDING)],
        )
        _drop_legacy_index_if_present(
            db.teacher_subject_assignments,
            "idx_teacher_subj_term_unique",
            [("organization_id", ASCENDING), ("teacher_id", ASCENDING), ("subject_id", ASCENDING), ("academic_term", ASCENDING)],
        )
        teacher_subj_idx = [
            db.teacher_subject_assignments.create_index(
                [("organization_id", ASCENDING), ("teacher_id", ASCENDING), ("subject_id", ASCENDING), ("academic_term", ASCENDING)],
                unique=True,
                name="idx_org_teacher_subj_term_unique",
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
        _drop_legacy_index_if_present(
            db.student_subject_enrollments,
            "idx_student_subj_term_unique",
            [("organization_id", ASCENDING), ("student_id", ASCENDING), ("subject_id", ASCENDING), ("academic_term", ASCENDING)],
        )
        student_subj_idx = [
            db.student_subject_enrollments.create_index(
                [("organization_id", ASCENDING), ("student_id", ASCENDING), ("subject_id", ASCENDING), ("academic_term", ASCENDING)],
                unique=True,
                name="idx_org_student_subj_term_unique",
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
        dropout_idx = [
            db.dropout_records.create_index([("student_id", ASCENDING)], name="idx_dropout_student_id"),
            db.dropout_records.create_index([("risk_tier", ASCENDING)], name="idx_dropout_risk_tier"),
            db.dropout_records.create_index([("created_at", DESCENDING)], name="idx_dropout_created_at"),
            db.dropout_records.create_index(
                [("student_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_dropout_student_created",
            ),
            db.dropout_records.create_index(
                [("organization_id", ASCENDING), ("risk_tier", ASCENDING), ("created_at", DESCENDING)],
                name="idx_dropout_org_tier_created",
            ),
        ]
        created_indexes["dropout_records"] = dropout_idx

        dropout_hist_idx = [
            db.dropout_prediction_history.create_index(
                [("student_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_dropout_hist_student_created",
            ),
            db.dropout_prediction_history.create_index(
                [("organization_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_dropout_hist_org_created",
            ),
        ]
        created_indexes["dropout_prediction_history"] = dropout_hist_idx

        # 12. Course Demand Forecasts & Metadata indexes (Phase 8B)
        demand_idx = [
            db.demand_forecasts.create_index(
                [("organization_id", ASCENDING), ("forecast_period", ASCENDING), ("created_at", DESCENDING)],
                name="idx_demand_org_period_created",
            ),
            db.demand_forecasts.create_index(
                [("subject_id", ASCENDING), ("forecast_period", ASCENDING)],
                name="idx_demand_subject_period",
            ),
            db.demand_forecasts.create_index([("created_at", DESCENDING)], name="idx_demand_created_at"),
        ]
        created_indexes["demand_forecasts"] = demand_idx

        demand_meta_idx = [
            db.demand_model_metadata.create_index(
                [("organization_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_demand_meta_org_created",
            ),
        ]
        created_indexes["demand_model_metadata"] = demand_meta_idx

        # 13. Model Registry collection indexes (Phase 8C)
        registry_idx = [
            db.model_registry.create_index(
                [("model_type", ASCENDING), ("is_active", ASCENDING)],
                name="idx_registry_type_active",
            ),
            db.model_registry.create_index(
                [("organization_id", ASCENDING), ("created_at", DESCENDING)],
                name="idx_registry_org_created",
            ),
        ]
        created_indexes["model_registry"] = registry_idx

        # 14. Phase 9 Platform Control Store indexes
        inst_idx = [
            db.institutions.create_index([("slug", ASCENDING)], unique=True, name="idx_institutions_slug_unique"),
            db.institutions.create_index([("organization_id", ASCENDING)], unique=True, name="idx_institutions_org_unique"),
            db.institutions.create_index([("status", ASCENDING)], name="idx_institutions_status"),
        ]
        created_indexes["institutions"] = inst_idx

        subs_idx = [
            db.subscriptions.create_index([("organization_id", ASCENDING)], unique=True, name="idx_subs_org_unique"),
            db.subscriptions.create_index([("billing_status", ASCENDING)], name="idx_subs_status"),
            db.subscriptions.create_index([("stripe_customer_id", ASCENDING)], sparse=True, name="idx_subs_stripe_cust"),
        ]
        created_indexes["subscriptions"] = subs_idx

        billing_ev_idx = [
            db.processed_billing_events.create_index([("event_id", ASCENDING)], unique=True, name="idx_billing_event_id_unique"),
            db.processed_billing_events.create_index([("processed_at", DESCENDING)], name="idx_billing_processed_at"),
        ]
        created_indexes["processed_billing_events"] = billing_ev_idx

        global_audit_idx = [
            db.global_audit_logs.create_index([("timestamp", DESCENDING)], name="idx_global_audit_ts"),
            db.global_audit_logs.create_index([("action", ASCENDING)], name="idx_global_audit_action"),
            db.global_audit_logs.create_index([("target_institution", ASCENDING)], name="idx_global_audit_inst"),
        ]
        created_indexes["global_audit_logs"] = global_audit_idx

        logger.info("MongoDB 6.x indexes successfully initialized.")
        return created_indexes

    except PyMongoError as e:
        logger.error("Failed to initialize MongoDB indexes: %s", str(e))
        raise
