"""
EduPredict - Student Dropout Service Layer (Phase 8A)
Module: backend.services.dropout_service
Purpose: Business logic for dropout risk assessment, probability calibration,
non-punitive recommendations, subject-scoped teacher access, and privacy-preserving analytics.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import joblib
import numpy as np
import pandas as pd
from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError

from backend.models.dropout_record_model import DropoutRecord, VALID_DROPOUT_RISK_TIERS
from backend.models.user_model import User
from backend.ml.dropout_pipeline import (
    ALL_FEATURE_COLUMNS,
    assert_no_dropout_leakage,
    NOMINAL_CATEGORICAL_FEATURES,
    BINARY_FEATURES,
    NUMERICAL_FEATURES,
)
from backend.services.system_log_service import log_event
from backend.services.anomaly_service import apply_complementary_partition_suppression
from backend.utils.decorators import can_access_student_data
from backend.utils.security import to_object_id

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "ml_models",
    "saved_models",
)
MODEL_ARTIFACT_PATH = os.path.join(MODELS_DIR, "dropout_model.joblib")
METADATA_ARTIFACT_PATH = os.path.join(MODELS_DIR, "dropout_metadata.json")

# In-memory cache
_CACHED_MODEL = None
_CACHED_METADATA = None

DEFAULT_DISCLAIMER = (
    "Early-warning estimate designed solely for proactive academic support. "
    "Requires human review by authorized advisors before taking any intervention."
)

DEFAULT_FEATURE_VALUES: Dict[str, Any] = {
    "Marital status": 1,
    "Application mode": 1,
    "Application order": 1,
    "Course": 171,
    "Daytime/evening attendance": 1,
    "Previous qualification": 1,
    "Previous qualification (grade)": 130.0,
    "Nacionality": 1,
    "Mother's qualification": 19,
    "Father's qualification": 19,
    "Mother's occupation": 5,
    "Father's occupation": 5,
    "Admission grade": 130.0,
    "Displaced": 0,
    "Educational special needs": 0,
    "Debtor": 0,
    "Tuition fees up to date": 1,
    "Gender": 0,
    "Scholarship holder": 0,
    "Age at enrollment": 20,
    "International": 0,
    "Curricular units 1st sem (credited)": 0,
    "Curricular units 1st sem (enrolled)": 6,
    "Curricular units 1st sem (evaluations)": 6,
    "Curricular units 1st sem (approved)": 5,
    "Curricular units 1st sem (grade)": 12.5,
    "Curricular units 1st sem (without evaluations)": 0,
    "Curricular units 2nd sem (credited)": 0,
    "Curricular units 2nd sem (enrolled)": 6,
    "Curricular units 2nd sem (evaluations)": 6,
    "Curricular units 2nd sem (approved)": 5,
    "Curricular units 2nd sem (grade)": 12.5,
    "Curricular units 2nd sem (without evaluations)": 0,
    "Unemployment rate": 11.0,
    "Inflation rate": 1.4,
    "GDP": 1.0,
}


def load_cached_dropout_model():
    """Load and cache calibrated dropout classification pipeline."""
    global _CACHED_MODEL
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL

    if not os.path.exists(MODEL_ARTIFACT_PATH):
        logger.error("Dropout model artifact not found at %s", MODEL_ARTIFACT_PATH)
        return None

    try:
        _CACHED_MODEL = joblib.load(MODEL_ARTIFACT_PATH)
        logger.info("Loaded calibrated dropout model artifact from %s", MODEL_ARTIFACT_PATH)
        return _CACHED_MODEL
    except Exception as e:
        logger.error("Failed to load dropout model artifact: %s", e)
        return None


def load_cached_dropout_metadata() -> Optional[Dict[str, Any]]:
    """Load and cache dropout model metadata."""
    global _CACHED_METADATA
    if _CACHED_METADATA is not None:
        return _CACHED_METADATA

    if not os.path.exists(METADATA_ARTIFACT_PATH):
        logger.error("Dropout metadata file not found at %s", METADATA_ARTIFACT_PATH)
        return None

    try:
        with open(METADATA_ARTIFACT_PATH, "r", encoding="utf-8") as f:
            _CACHED_METADATA = json.load(f)
        return _CACHED_METADATA
    except Exception as e:
        logger.error("Failed to load dropout metadata: %s", e)
        return None


class DropoutService:
    """Service handling dropout risk scoring, persistence, and RBAC."""

    @staticmethod
    def map_academic_record_to_features(academic_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map EduPredict student academic indicators to UCI dropout feature space with safe heuristics.
        """
        features = dict(DEFAULT_FEATURE_VALUES)

        attendance = academic_record.get("attendance_percentage", 80.0)
        study_hours = academic_record.get("study_hours_per_week", 15.0)
        completion_rate = academic_record.get("assignment_completion_rate", 75.0)
        exam_marks = academic_record.get("previous_exam_marks", 60.0)
        quiz_avg = academic_record.get("quiz_average", 60.0)

        # Map to admission grade and previous qualification (scaled 0-200)
        features["Admission grade"] = min(200.0, max(0.0, exam_marks * 2.0))
        features["Previous qualification (grade)"] = min(200.0, max(0.0, quiz_avg * 2.0))

        # Map academic performance to Curricular units 1st and 2nd sem (grades 0-20, approved units 0-6)
        normalized_grade = min(20.0, max(0.0, (exam_marks / 5.0)))
        approved_ratio = min(1.0, max(0.0, completion_rate / 100.0))
        approved_units = int(round(6 * approved_ratio))

        features["Curricular units 1st sem (approved)"] = approved_units
        features["Curricular units 1st sem (grade)"] = normalized_grade
        features["Curricular units 2nd sem (approved)"] = approved_units
        features["Curricular units 2nd sem (grade)"] = normalized_grade

        # Map attendance to evaluations ratio
        eval_count = 6 if attendance >= 50.0 else int(max(1, round(6 * (attendance / 100.0))))
        features["Curricular units 1st sem (evaluations)"] = eval_count
        features["Curricular units 2nd sem (evaluations)"] = eval_count

        return features

    @classmethod
    def evaluate_student_features(
        cls,
        features_input: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Run inference using calibrated model, validate against leakage,
        and generate risk factors and recommendations.
        """
        # 1. Leakage guard
        try:
            assert_no_dropout_leakage(list(features_input.keys()))
        except ValueError as err:
            return None, str(err)

        # 2. Load model
        model = load_cached_dropout_model()
        if model is None:
            return None, "Dropout prediction model is currently unavailable."

        # 3. Align features
        feature_dict = dict(DEFAULT_FEATURE_VALUES)
        for k, v in features_input.items():
            if k in feature_dict and v is not None:
                try:
                    feature_dict[k] = float(v) if isinstance(v, (int, float, str)) else v
                except (ValueError, TypeError):
                    pass

        df = pd.DataFrame([feature_dict])[ALL_FEATURE_COLUMNS]

        # 4. Predict calibrated probability
        try:
            proba = float(model.predict_proba(df)[0, 1])
        except Exception as e:
            logger.error("Dropout model inference failure: %s", e)
            return None, "Inference failure while calculating dropout risk."

        # 5. Risk Tiering
        if proba < 0.30:
            risk_tier = "Low"
        elif proba < 0.60:
            risk_tier = "Moderate"
        else:
            risk_tier = "High"

        # 6. Key risk and protective factors
        key_risk_factors = []
        protective_factors = []

        cu1_app = feature_dict.get("Curricular units 1st sem (approved)", 5)
        cu2_app = feature_dict.get("Curricular units 2nd sem (approved)", 5)
        tuition = feature_dict.get("Tuition fees up to date", 1)
        scholarship = feature_dict.get("Scholarship holder", 0)
        debtor = feature_dict.get("Debtor", 0)
        grade1 = feature_dict.get("Curricular units 1st sem (grade)", 12.0)

        if cu1_app < 4 or cu2_app < 4:
            key_risk_factors.append({
                "factor": "Curricular Unit Completion Deficit",
                "detail": f"Completed {cu1_app} units in 1st sem and {cu2_app} units in 2nd sem out of expected enrolled units.",
                "importance": "High",
            })
        else:
            protective_factors.append({
                "factor": "Consistent Curricular Progress",
                "detail": f"Completed {cu1_app} (1st sem) and {cu2_app} (2nd sem) curricular units on schedule.",
            })

        if tuition == 0:
            key_risk_factors.append({
                "factor": "Tuition Payment Delay",
                "detail": "Tuition fees are flagged as overdue, which strongly correlates with enrollment interruption.",
                "importance": "High",
            })
        else:
            protective_factors.append({
                "factor": "Good Financial Standing",
                "detail": "Tuition payments are fully up-to-date.",
            })

        if debtor == 1:
            key_risk_factors.append({
                "factor": "Financial Debt Flag",
                "detail": "Student has an outstanding institutional balance requiring advisory check-in.",
                "importance": "Medium",
            })

        if scholarship == 1:
            protective_factors.append({
                "factor": "Active Scholarship",
                "detail": "Student holds an active academic scholarship supporting continuous enrollment.",
            })

        if grade1 < 10.0:
            key_risk_factors.append({
                "factor": "Early Academic Margin",
                "detail": f"1st semester grade average ({grade1:.1f}/20) is below passing threshold.",
                "importance": "High",
            })
        elif grade1 >= 14.0:
            protective_factors.append({
                "factor": "Strong Academic Standing",
                "detail": f"1st semester grade average ({grade1:.1f}/20) exceeds cohort baseline.",
            })

        # 7. Supportive, Non-Punitive Recommendations
        recommendations = []
        if risk_tier == "High":
            recommendations.extend([
                "Schedule a 1-on-1 supportive counseling check-in with an Academic Success Advisor.",
                "Connect with Student Financial Support to explore tuition installment plans and emergency grants.",
                "Enroll in complimentary Peer Tutoring and study skill development workshops.",
                "Develop an individualized course completion plan with department faculty mentor.",
            ])
        elif risk_tier == "Moderate":
            recommendations.extend([
                "Attend midterm progress advisory hours to review core subject milestones.",
                "Participate in weekly collaborative student study groups for challenging units.",
                "Verify semester unit workload to ensure balanced academic pace.",
            ])
        else:
            recommendations.extend([
                "Maintain current positive academic study habits and curricular progression.",
                "Explore optional advanced coursework, honors electives, or student mentorship roles.",
            ])

        metadata = load_cached_dropout_metadata() or {}
        model_version = metadata.get("model_version", "Dropout_LogisticRegression_v1.0.0")

        result = {
            "risk_probability": round(proba, 4),
            "risk_tier": risk_tier,
            "model_version": model_version,
            "key_risk_factors": key_risk_factors,
            "protective_factors": protective_factors,
            "recommendations": recommendations,
            "requires_human_review": True,
            "disclaimer": DEFAULT_DISCLAIMER,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

        return result, None

    @classmethod
    def record_student_assessment(
        cls,
        db: Database,
        student_id: ObjectId | str,
        features_input: Dict[str, Any],
        actor_user: User,
        academic_term: Optional[str] = None,
        student_name: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Assess student dropout risk and persist to MongoDB dropout_records collection.
        Authorized for Admin and Teacher (for assigned students only).
        """
        student_oid = to_object_id(student_id)
        if not student_oid:
            return None, "Invalid student_id.", 400

        # RBAC Check
        if not can_access_student_data(actor_user, student_oid, db):
            return None, "Access denied. You are not authorized to evaluate this student.", 403

        # Lookup student name if not provided
        if not student_name and db is not None:
            user_doc = db.users.find_one({"_id": student_oid})
            if user_doc:
                student_name = f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip() or user_doc.get("username")

        eval_data, err = cls.evaluate_student_features(features_input)
        if err:
            return None, err, 400

        record = DropoutRecord(
            student_id=student_oid,
            student_name=student_name,
            risk_probability=eval_data["risk_probability"],
            risk_tier=eval_data["risk_tier"],
            model_version=eval_data["model_version"],
            key_risk_factors=eval_data["key_risk_factors"],
            protective_factors=eval_data["protective_factors"],
            recommendations=eval_data["recommendations"],
            academic_term=academic_term or "Current Term",
            requires_human_review=True,
            disclaimer=DEFAULT_DISCLAIMER,
            features_snapshot=features_input,
        )

        if db is not None:
            try:
                db.dropout_records.update_one(
                    {"student_id": student_oid},
                    {"$set": record.to_doc()},
                    upsert=True,
                )
                log_event(
                    db=db,
                    event_type="DROPOUT_ASSESSMENT_RECORDED",
                    details={
                        "student_id": str(student_oid),
                        "risk_tier": record.risk_tier,
                        "risk_probability": round(record.risk_probability, 4),
                        "actor_email": getattr(actor_user, "email", "system"),
                    },
                    user_id=student_oid,
                    actor_id=actor_user.id if actor_user else None,
                )
            except PyMongoError as pe:
                logger.error("Failed to save dropout record: %s", pe)
                return None, "Database error saving dropout assessment.", 500

        return record.to_dict(), None, 201

    @classmethod
    def get_student_assessment(
        cls,
        db: Database,
        actor_user: User,
        student_id: ObjectId | str,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Retrieve dropout risk assessment for a specific student.
        - Student: only self
        - Teacher: assigned students only
        - Admin: all students
        - Analyst: 403 Forbidden
        """
        student_oid = to_object_id(student_id)
        if not student_oid:
            return None, "Invalid student_id.", 400

        if not can_access_student_data(actor_user, student_oid, db):
            return None, "Access denied. You are not authorized to view this student's dropout assessment.", 403

        if db is None:
            return None, "Database connection unavailable.", 500

        doc = db.dropout_records.find_one({"student_id": student_oid})
        if doc:
            record = DropoutRecord.from_doc(doc)
            return record.to_dict(), None, 200

        # If not evaluated yet, generate on-the-fly using student's academic record if exists
        ac_doc = db.academic_records.find_one({"student_id": student_oid}, sort=[("created_at", DESCENDING)])
        features = cls.map_academic_record_to_features(ac_doc) if ac_doc else dict(DEFAULT_FEATURE_VALUES)

        eval_data, err = cls.evaluate_student_features(features)
        if err:
            return None, err, 500

        user_doc = db.users.find_one({"_id": student_oid})
        name = ""
        if user_doc:
            name = f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip() or user_doc.get("username")

        record = DropoutRecord(
            student_id=student_oid,
            student_name=name,
            risk_probability=eval_data["risk_probability"],
            risk_tier=eval_data["risk_tier"],
            model_version=eval_data["model_version"],
            key_risk_factors=eval_data["key_risk_factors"],
            protective_factors=eval_data["protective_factors"],
            recommendations=eval_data["recommendations"],
            academic_term=ac_doc.get("term", "Current Term") if ac_doc else "Current Term",
            requires_human_review=True,
            disclaimer=DEFAULT_DISCLAIMER,
        )

        return record.to_dict(), None, 200

    @classmethod
    def get_teacher_roster_dropout(
        cls,
        db: Database,
        teacher_user: User,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Retrieve dropout risk assessments for all students actively enrolled
        in subjects assigned to this teacher. Strictly scoped to assigned classes.
        """
        if db is None:
            return None, "Database unavailable.", 500

        teacher_oid = to_object_id(teacher_user.id)
        assignments = list(db.teacher_subject_assignments.find({"teacher_id": teacher_oid, "status": "active"}))
        if not assignments:
            return {"students": [], "total": 0, "page": page, "limit": limit}, None, 200

        # Collect subject IDs
        subject_ids = [a["subject_id"] for a in assignments if a.get("subject_id")]
        enrollments = list(db.student_subject_enrollments.find({
            "subject_id": {"$in": subject_ids},
            "status": "active",
        }))

        student_ids = list(set([e["student_id"] for e in enrollments if e.get("student_id")]))
        if not student_ids:
            return {"students": [], "total": 0, "page": page, "limit": limit}, None, 200

        # Query assessments
        skip = (page - 1) * limit
        total = db.dropout_records.count_documents({"student_id": {"$in": student_ids}})
        cursor = db.dropout_records.find({"student_id": {"$in": student_ids}}).sort("created_at", DESCENDING).skip(skip).limit(limit)

        records = [DropoutRecord.from_doc(d).to_dict() for d in cursor]

        # For students without explicit dropout_record, backfill lightweight default
        assessed_ids = set([to_object_id(r["student_id"]) for r in records])
        unassessed_ids = [sid for sid in student_ids if sid not in assessed_ids]

        if unassessed_ids and len(records) < limit:
            users_cursor = db.users.find({"_id": {"$in": unassessed_ids[:(limit - len(records))]}})
            for u in users_cursor:
                uid = u["_id"]
                ac_doc = db.academic_records.find_one({"student_id": uid}, sort=[("created_at", DESCENDING)])
                feats = cls.map_academic_record_to_features(ac_doc) if ac_doc else dict(DEFAULT_FEATURE_VALUES)
                eval_res, _ = cls.evaluate_student_features(feats)
                if eval_res:
                    name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("username")
                    records.append({
                        "id": str(ObjectId()),
                        "student_id": str(uid),
                        "student_name": name,
                        "risk_probability": eval_res["risk_probability"],
                        "risk_tier": eval_res["risk_tier"],
                        "model_version": eval_res["model_version"],
                        "key_risk_factors": eval_res["key_risk_factors"],
                        "protective_factors": eval_res["protective_factors"],
                        "recommendations": eval_res["recommendations"],
                        "academic_term": "Current Term",
                        "requires_human_review": True,
                        "disclaimer": DEFAULT_DISCLAIMER,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    })

        return {
            "students": records,
            "total": total or len(records),
            "page": page,
            "limit": limit,
        }, None, 200

    @classmethod
    def get_admin_overview(
        cls,
        db: Database,
        admin_user: User,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Institution-wide dropout metrics and distributions for Admin role.
        """
        if db is None:
            return None, "Database unavailable.", 500

        total_assessed = db.dropout_records.count_documents({})
        low_count = db.dropout_records.count_documents({"risk_tier": "Low"})
        mod_count = db.dropout_records.count_documents({"risk_tier": "Moderate"})
        high_count = db.dropout_records.count_documents({"risk_tier": "High"})

        # Recent high risk alerts
        recent_high = list(
            db.dropout_records.find({"risk_tier": "High"})
            .sort("created_at", DESCENDING)
            .limit(10)
        )
        recent_high_list = [DropoutRecord.from_doc(d).to_dict() for d in recent_high]

        metadata = load_cached_dropout_metadata() or {}

        return {
            "total_assessed": total_assessed,
            "risk_distribution": {
                "Low": low_count,
                "Moderate": mod_count,
                "High": high_count,
            },
            "recent_high_risk": recent_high_list,
            "model_metadata": {
                "model_version": metadata.get("model_version", "Dropout_LogisticRegression_v1.0.0"),
                "base_estimator": metadata.get("base_estimator", "LogisticRegression"),
                "calibration": metadata.get("calibration", "CalibratedClassifierCV"),
                "test_metrics": metadata.get("test_metrics", {}),
            },
        }, None, 200

    @classmethod
    def get_analyst_overview(
        cls,
        db: Database,
        analyst_user: User,
        threshold: int = 5,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Privacy-preserving aggregate dropout analytics with conservative N<5 cell suppression.
        Guarantees zero PII exposure and complementary suppression of small marginals.
        """
        if db is None:
            return None, "Database unavailable.", 500

        total_assessed = db.dropout_records.count_documents({})
        low_count = db.dropout_records.count_documents({"risk_tier": "Low"})
        mod_count = db.dropout_records.count_documents({"risk_tier": "Moderate"})
        high_count = db.dropout_records.count_documents({"risk_tier": "High"})

        raw_counts = {
            "Low": low_count,
            "Moderate": mod_count,
            "High": high_count,
        }

        suppressed_partition, suppressed_total = apply_complementary_partition_suppression(
            category_counts=raw_counts,
            total_count=total_assessed,
            threshold=threshold,
        )

        metadata = load_cached_dropout_metadata() or {}

        return {
            "total_assessed": suppressed_total,
            "risk_distribution": suppressed_partition,
            "model_summary": {
                "model_version": metadata.get("model_version", "Dropout_LogisticRegression_v1.0.0"),
                "roc_auc": metadata.get("test_metrics", {}).get("roc_auc"),
                "pr_auc": metadata.get("test_metrics", {}).get("pr_auc"),
                "brier_score": metadata.get("test_metrics", {}).get("brier_score"),
                "calibration": metadata.get("calibration", "CalibratedClassifierCV"),
            },
            "privacy_notice": f"Statistical Disclosure Control applied: cells with count < {threshold} are suppressed with complementary cell masking.",
        }, None, 200
