"""
EduPredict - Prediction Service
Module: backend.services.prediction_service
Orchestrates validation, ML model inference, RBAC enforcement, and MongoDB persistence.
"""

import logging
from typing import Dict, Any, Tuple, Optional, List
from bson import ObjectId
import numpy as np
import pandas as pd
from pymongo import DESCENDING
from pymongo.database import Database

from backend.models.prediction_model import PredictionRecord
from backend.models.user_model import User
from backend.ml.model_loader import predict_student
from backend.data_engineering.leakage_guard import (
    assert_no_leakage,
    get_milestone_features,
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
)
from backend.utils.decorators import can_access_student_data
from backend.utils.security import to_object_id

logger = logging.getLogger(__name__)

# Canonical subjects
VALID_SUBJECTS = {
    "math": "Mathematics",
    "mathematics": "Mathematics",
    "port": "Portuguese Language",
    "portuguese": "Portuguese Language",
    "portuguese language": "Portuguese Language",
}

# Categorical and ordinal validation boundaries
VALID_CATEGORICAL_VALUES = {
    "school": {"GP", "MS"},
    "sex": {"F", "M"},
    "address": {"U", "R"},
    "famsize": {"LE3", "GT3"},
    "Pstatus": {"T", "A"},
    "Mjob": {"teacher", "health", "services", "at_home", "other"},
    "Fjob": {"teacher", "health", "services", "at_home", "other"},
    "reason": {"home", "reputation", "course", "other"},
    "guardian": {"mother", "father", "other"},
    "schoolsup": {"yes", "no"},
    "famsup": {"yes", "no"},
    "paid": {"yes", "no"},
    "activities": {"yes", "no"},
    "nursery": {"yes", "no"},
    "higher": {"yes", "no"},
    "internet": {"yes", "no"},
    "romantic": {"yes", "no"},
}

NUMERIC_RANGES = {
    "age": (15, 22),
    "study_hours_per_week": (0.0, 60.0),
    "failures": (0, 4),
    "famrel": (1, 5),
    "freetime": (1, 5),
    "goout": (1, 5),
    "Dalc": (1, 5),
    "Walc": (1, 5),
    "health": (1, 5),
    "absences": (0, 93),
    "attendance_percentage": (0.0, 100.0),
    "assignment_completion_rate": (0.0, 100.0),
    "previous_exam_marks": (0.0, 100.0),
    "quiz_scores": (0.0, 100.0),
    "Medu": (0, 4),
    "Fedu": (0, 4),
    "traveltime": (1, 4),
    "studytime": (1, 4),
}

# Explicit labels for synthetic and estimated features
ESTIMATED_FEATURE_LABELS = {
    "assignment_completion_rate": "Estimated Study Discipline Index (Derived Heuristic)",
    "attendance_percentage": "Estimated Attendance Proxy (60-Session Baseline)",
    "study_hours_per_week": "Estimated Weekly Study Hours (Midpoint Approximation)",
}


class PredictionService:
    """Service layer managing academic performance prediction and audit history."""

    @staticmethod
    def normalize_subject(subject_input: str) -> Optional[str]:
        """Normalize subject name to canonical representation."""
        if not subject_input or not isinstance(subject_input, str):
            return None
        cleaned = subject_input.strip().lower()
        return VALID_SUBJECTS.get(cleaned)

    @classmethod
    def validate_prediction_inputs(
        cls,
        subject: str,
        milestone: int,
        features: Dict[str, Any],
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Validates subject, milestone, required features, data types, numeric ranges,
        and enforces leakage prevention rules.
        """
        # 1. Subject validation
        canonical_subject = cls.normalize_subject(subject)
        if not canonical_subject:
            return False, f"Invalid subject '{subject}'. Allowed subjects: 'Mathematics', 'Portuguese Language'.", None

        # 2. Milestone validation
        if milestone not in (0, 1, 2):
            return False, f"Invalid milestone '{milestone}'. Allowed milestones: 0 (Early Warning), 1 (Mid-Term), 2 (Pre-Final).", None

        # 3. Features dictionary presence
        if not isinstance(features, dict) or not features:
            return False, "Prediction features must be provided as a non-empty dictionary.", None

        # 4. Prohibited Leakage Fields Check
        prohibited_leakage = [
            "G3",
            "g3",
            "final_exam_marks",
            "academic_status",
            "pass_status",
            "student_code",
            "student_group_id",
            "_id",
        ]
        detected_leakage = [f for f in prohibited_leakage if f in features]
        if detected_leakage:
            return False, f"CRITICAL LEAKAGE DETECTED: Prohibited target/identifier fields {detected_leakage} must not enter features.", None

        # 5. Milestone Temporal Leakage Restrictions
        if milestone == 0:
            temporal_leakage = [f for f in ["G1", "g1", "G2", "g2", "previous_exam_marks", "quiz_scores"] if f in features]
            if temporal_leakage:
                return False, f"TEMPORAL LEAKAGE: Milestone 0 (Early Warning) strictly prohibits examination marks: {temporal_leakage}.", None
        elif milestone == 1:
            temporal_leakage = [f for f in ["G2", "g2", "quiz_scores"] if f in features]
            if temporal_leakage:
                return False, f"TEMPORAL LEAKAGE: Milestone 1 (Mid-Term) strictly prohibits second examination marks: {temporal_leakage}.", None

        # 6. Required Features Check for Milestone
        expected_features = get_milestone_features(milestone)
        missing_features = [f for f in expected_features if f not in features]
        if missing_features:
            return False, f"Missing required features for Milestone {milestone}: {missing_features}.", None

        # 7. Type, Range, and Domain Validation
        sanitized_features: Dict[str, Any] = {}
        for feat in expected_features:
            val = features[feat]
            if val is None or (isinstance(val, str) and not val.strip()):
                return False, f"Feature '{feat}' cannot be null or empty.", None

            # Categorical checks
            if feat in VALID_CATEGORICAL_VALUES:
                val_str = str(val).strip()
                if val_str not in VALID_CATEGORICAL_VALUES[feat]:
                    allowed = sorted(list(VALID_CATEGORICAL_VALUES[feat]))
                    return False, f"Invalid value '{val}' for categorical feature '{feat}'. Allowed: {allowed}.", None
                sanitized_features[feat] = val_str

            # Numeric and ordinal range checks
            elif feat in NUMERIC_RANGES:
                min_v, max_v = NUMERIC_RANGES[feat]
                try:
                    num_val = float(val)
                except (ValueError, TypeError):
                    return False, f"Feature '{feat}' must be numeric, got '{val}'.", None

                if num_val < min_v or num_val > max_v:
                    return False, f"Feature '{feat}' value {num_val} is out of permitted range [{min_v}, {max_v}].", None

                # Cast integer-typed ordinals
                if feat in ("age", "failures", "famrel", "freetime", "goout", "Dalc", "Walc", "health", "absences", "Medu", "Fedu", "traveltime", "studytime"):
                    sanitized_features[feat] = int(num_val)
                else:
                    sanitized_features[feat] = float(num_val)
            else:
                sanitized_features[feat] = val

        # 8. Assert zero leakage programmatically
        try:
            assert_no_leakage(list(sanitized_features.keys()), REGRESSION_TARGET)
            assert_no_leakage(list(sanitized_features.keys()), CLASSIFICATION_TARGET)
        except ValueError as err:
            return False, str(err), None

        return True, None, sanitized_features

    @classmethod
    def create_prediction(
        cls,
        db: Database,
        student_id: ObjectId | str,
        actor_user: User,
        subject: str,
        milestone: int,
        features: Dict[str, Any],
    ) -> Tuple[Optional[PredictionRecord], Optional[str], int]:
        """
        Executes prediction, performs authorization, validates inputs, runs ML pipelines,
        and records the prediction document in MongoDB.
        """
        target_student_oid = to_object_id(student_id)
        if not target_student_oid:
            return None, "Invalid student ID format.", 400

        # Verify student exists and has 'student' role
        student_doc = db.users.find_one({"_id": target_student_oid})
        if not student_doc or student_doc.get("role") != "student":
            return None, "Target student does not exist.", 404

        # Enforce server-side authorization
        if not can_access_student_data(actor_user, target_student_oid, db):
            return None, "You are not authorized to generate predictions for this student.", 403

        # Validate inputs and leakage
        valid, err_msg, sanitized_features = cls.validate_prediction_inputs(subject, milestone, features)
        if not valid or sanitized_features is None:
            return None, err_msg or "Invalid input features.", 400

        canonical_subject = cls.normalize_subject(subject)

        # Convert sanitized features to 1-row DataFrame for inference
        df_input = pd.DataFrame([sanitized_features])

        # Execute ML prediction
        try:
            pred_res = predict_student(canonical_subject, milestone, df_input)
        except Exception as e:
            logger.error("Prediction inference error for %s M%d: %s", canonical_subject, milestone, str(e))
            return None, f"Prediction error: {str(e)}", 500

        # Create labeled feature summary with explicit provenance
        features_summary = {}
        for feat, val in sanitized_features.items():
            features_summary[feat] = {
                "value": val,
                "label": ESTIMATED_FEATURE_LABELS.get(feat, feat),
                "is_estimated_proxy": feat in ESTIMATED_FEATURE_LABELS,
            }

        # Build Domain Record
        prediction_record = PredictionRecord(
            student_id=target_student_oid,
            created_by=actor_user.id,
            subject=canonical_subject,
            milestone=milestone,
            predicted_marks=pred_res["predicted_marks"],
            predicted_status=pred_res["predicted_status"],
            confidence_scores=pred_res["confidence_scores"],
            top_confidence=pred_res["top_confidence"],
            confidence_type=pred_res["confidence_type"],
            uncertainty_warning=pred_res["uncertainty_warning"],
            uncertainty_message=pred_res["uncertainty_message"],
            early_warning_advisory=pred_res["early_warning_advisory"],
            features_summary=features_summary,
            regressor_model=pred_res["regressor_model"],
            classifier_model=pred_res["classifier_model"],
        )

        # Persist to MongoDB
        try:
            db.predictions.insert_one(prediction_record.to_doc())
        except Exception as e:
            logger.error("Failed to persist prediction: %s", str(e))
            return None, "Database error saving prediction record.", 500

        return prediction_record, None, 201

    @classmethod
    def get_prediction_by_id(
        cls,
        db: Database,
        prediction_id: ObjectId | str,
        actor_user: User,
    ) -> Tuple[Optional[PredictionRecord], Optional[str], int]:
        """Fetch a single prediction by ID with role-based access validation."""
        pred_oid = to_object_id(prediction_id)
        if not pred_oid:
            return None, "Invalid prediction ID format.", 400

        doc = db.predictions.find_one({"_id": pred_oid})
        if not doc:
            return None, "Prediction record not found.", 404

        # Enforce authorization against the target student ID
        student_oid = doc.get("student_id")
        if not can_access_student_data(actor_user, student_oid, db):
            return None, "You are not authorized to view this prediction record.", 403

        record = PredictionRecord.from_doc(doc)
        return record, None, 200

    @classmethod
    def list_predictions(
        cls,
        db: Database,
        actor_user: User,
        student_id: Optional[ObjectId | str] = None,
        subject: Optional[str] = None,
        milestone: Optional[int] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int, Optional[str], int]:
        """
        List prediction history with RBAC filtering:
        - Students: Strictly view only their own predictions.
        - Teachers: View predictions only for students assigned to them.
        - Admins: View predictions across students.
        """
        query: Dict[str, Any] = {}

        actor_role = getattr(actor_user, "role", "")

        # 1. Enforce Role Scoping
        if actor_role == "student":
            query["student_id"] = actor_user.id
        elif actor_role == "teacher":
            if student_id:
                target_oid = to_object_id(student_id)
                if not target_oid:
                    return [], 0, "Invalid student ID format.", 400
                if not can_access_student_data(actor_user, target_oid, db):
                    return [], 0, "You are not authorized to access this student's predictions.", 403
                query["student_id"] = target_oid
            else:
                # Query all assigned students
                assignments = db.teacher_student_assignments.find({
                    "teacher_id": actor_user.id,
                    "status": "active",
                })
                assigned_student_ids = [a["student_id"] for a in assignments]
                query["student_id"] = {"$in": assigned_student_ids}
        elif actor_role == "admin":
            if student_id:
                target_oid = to_object_id(student_id)
                if not target_oid:
                    return [], 0, "Invalid student ID format.", 400
                query["student_id"] = target_oid
        else:
            return [], 0, "Access denied.", 403

        # 2. Optional Filters
        if subject:
            canonical_subj = cls.normalize_subject(subject)
            if canonical_subj:
                query["subject"] = canonical_subj

        if milestone is not None:
            try:
                m_int = int(milestone)
                if m_int in (0, 1, 2):
                    query["milestone"] = m_int
            except (ValueError, TypeError):
                pass

        total_count = db.predictions.count_documents(query)
        cursor = db.predictions.find(query).sort("created_at", DESCENDING).skip(max(0, skip)).limit(min(100, max(1, limit)))

        records = [PredictionRecord.from_doc(doc).to_dict() for doc in cursor if doc]
        return records, total_count, None, 200

    @classmethod
    def get_options_metadata(cls) -> Dict[str, Any]:
        """Provides metadata for available prediction subjects, milestones, and required features."""
        return {
            "supported_subjects": [
                {
                    "id": "mathematics",
                    "name": "Mathematics",
                    "observation_count": 395,
                    "target_scale": "0 - 100",
                },
                {
                    "id": "portuguese",
                    "name": "Portuguese Language",
                    "observation_count": 649,
                    "target_scale": "0 - 100",
                },
            ],
            "milestones": [
                {
                    "milestone": 0,
                    "name": "Milestone 0: Early Warning",
                    "description": "Exploratory behavioral screening prior to any examination results.",
                    "feature_count": 33,
                    "features": get_milestone_features(0),
                    "prohibited_features": ["previous_exam_marks", "quiz_scores", "final_exam_marks", "academic_status", "G1", "G2", "G3"],
                    "advisory": "Subject to high false-negative rate (>60%) on failing students due to absence of examination marks.",
                },
                {
                    "milestone": 1,
                    "name": "Milestone 1: Mid-Term",
                    "description": "Evaluation incorporating Milestone 0 features and Period 1 Exam marks.",
                    "feature_count": 34,
                    "features": get_milestone_features(1),
                    "prohibited_features": ["quiz_scores", "final_exam_marks", "academic_status", "G2", "G3"],
                },
                {
                    "milestone": 2,
                    "name": "Milestone 2: Pre-Final",
                    "description": "Near-final evaluation incorporating Milestone 1 features and Period 2 Quiz scores.",
                    "feature_count": 35,
                    "features": get_milestone_features(2),
                    "prohibited_features": ["final_exam_marks", "academic_status", "G3"],
                },
            ],
            "estimated_feature_labels": ESTIMATED_FEATURE_LABELS,
            "target_definitions": {
                "regression": {
                    "variable": "final_exam_marks",
                    "scale": "0.0 - 100.0",
                },
                "classification": {
                    "variable": "academic_status",
                    "classes": [
                        {"name": "High Risk", "range": "0 - 49 marks (Failing)"},
                        {"name": "Moderate Risk", "range": "50 - 69 marks (Satisfactory)"},
                        {"name": "Low Risk / On Track", "range": "70 - 100 marks (Good / Excellent)"},
                    ],
                },
            },
        }
