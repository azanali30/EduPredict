"""
EduPredict - Student Dropout Service Layer (Phase 8A)
Module: backend.services.dropout_service
Purpose: Business logic for dropout risk assessment, probability calibration,
non-punitive recommendations, subject/term-scoped teacher access, organization isolation,
and privacy-preserving analytics.
"""

import os
import re
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

from backend.models.dropout_record_model import DropoutRecord
from backend.models.user_model import User
from backend.ml.dropout_pipeline import (
    ALL_FEATURE_COLUMNS,
    assert_no_dropout_leakage,
)
from backend.services.system_log_service import log_event
from backend.services.anomaly_service import apply_complementary_partition_suppression
from backend.utils.decorators import can_access_student_data, can_access_student_subject_data
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
    "Experimental Early-Warning Benchmark — Not Yet Validated on Local Institutional Outcomes. "
    "Early-warning estimate designed solely for proactive academic support; "
    "requires human review by authorized advisors before taking any intervention."
)

EDUCATIONAL_MAPPING_KEYS = {
    "previous_exam_marks",
    "assignment_completion_rate",
    "attendance_percentage",
    "quiz_average",
    "study_hours_per_week",
}

UCI_BENCHMARK_DISCLOSURE = (
    "Reported metrics (e.g., ROC-AUC 0.9317, PR-AUC 0.9024) are holdout benchmark results "
    "on the UCI Portuguese higher-education dataset, not validated EduPredict institutional performance."
)


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


def _extract_user_display_name(user_doc: Optional[Dict[str, Any]]) -> Optional[str]:
    """Safely extract display name from EduPredict user document."""
    if not user_doc:
        return None
    full_name = user_doc.get("full_name")
    if full_name and isinstance(full_name, str) and full_name.strip():
        return full_name.strip()
    first_last = f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip()
    if first_last:
        return first_last
    return user_doc.get("username") or user_doc.get("email")


def _check_teacher_student_access(
    db: Database,
    teacher_user: User,
    student_oid: ObjectId,
    subject: Optional[str] = None,
    academic_term: Optional[str] = None,
) -> bool:
    """
    Enforce Phase 6 subject, enrollment, and academic term authorization for teachers.
    """
    if subject:
        return can_access_student_subject_data(
            actor_user=teacher_user,
            student_id=student_oid,
            subject=subject,
            db=db,
            academic_term=academic_term,
            require_term=bool(academic_term),
        )

    if db is None:
        return False

    teacher_oid = to_object_id(teacher_user.id)
    if not teacher_oid:
        return False

    t_query: Dict[str, Any] = {"teacher_id": teacher_oid, "status": "active"}
    if academic_term and isinstance(academic_term, str) and academic_term.strip():
        t_query["academic_term"] = academic_term.strip()

    t_subjs = list(db.teacher_subject_assignments.find(t_query))
    if not t_subjs:
        return False

    term_conditions = []
    for a in t_subjs:
        s_id = a.get("subject_id")
        term = a.get("academic_term")
        if s_id and term:
            term_conditions.append({
                "student_id": student_oid,
                "subject_id": s_id,
                "academic_term": term,
                "status": "active",
            })

    if not term_conditions:
        return False

    enroll_q = term_conditions[0] if len(term_conditions) == 1 else {"$or": term_conditions}
    return db.student_subject_enrollments.find_one(enroll_q) is not None


class DropoutService:
    """Service handling dropout risk scoring, persistence, and RBAC."""

    @staticmethod
    def map_academic_record_to_features(
        academic_record: Optional[Dict[str, Any]],
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Map genuinely observed EduPredict academic indicators to defensible UCI dropout features.
        Uncollected demographic, financial, and macroeconomic fields are left as None/NaN
        so they are never silently fabricated.
        """
        if not academic_record or not isinstance(academic_record, dict):
            return None, "Academic record is missing or invalid."

        raw_marks = academic_record.get("previous_exam_marks")
        raw_completion = academic_record.get("assignment_completion_rate")
        raw_attendance = academic_record.get("attendance_percentage")
        raw_quiz = academic_record.get("quiz_average")

        if raw_marks is None or raw_completion is None:
            return (
                None,
                "Insufficient academic indicators: 'previous_exam_marks' and "
                "'assignment_completion_rate' are required for dropout risk mapping.",
            )

        try:
            exam_marks = float(raw_marks)
            completion_rate = float(raw_completion)
            attendance = float(raw_attendance) if raw_attendance is not None else None
            quiz_avg = float(raw_quiz) if raw_quiz is not None else None
        except (ValueError, TypeError):
            return None, "Invalid numeric values in academic record indicators."

        # Start with unobserved (None/NaN) for all 36 UCI columns — never invent demographics/financials
        features: Dict[str, Any] = {col: np.nan for col in ALL_FEATURE_COLUMNS}

        # Defensible academic mappings (0-100 EduPredict scale -> 0-20 UCI grade scale, 6-unit term load)
        normalized_grade = min(20.0, max(0.0, exam_marks / 5.0))
        approved_ratio = min(1.0, max(0.0, completion_rate / 100.0))
        approved_units = int(round(6 * approved_ratio))

        features["Curricular units 1st sem (enrolled)"] = 6
        features["Curricular units 1st sem (approved)"] = approved_units
        features["Curricular units 1st sem (grade)"] = round(normalized_grade, 4)
        features["Curricular units 2nd sem (enrolled)"] = 6
        features["Curricular units 2nd sem (approved)"] = approved_units
        features["Curricular units 2nd sem (grade)"] = round(normalized_grade, 4)

        if quiz_avg is not None:
            features["Previous qualification (grade)"] = round(min(200.0, max(0.0, quiz_avg * 2.0)), 4)

        if attendance is not None:
            eval_count = 6 if attendance >= 50.0 else int(max(1, round(6 * min(1.0, max(0.0, attendance / 100.0)))))
            features["Curricular units 1st sem (evaluations)"] = eval_count
            features["Curricular units 2nd sem (evaluations)"] = eval_count

        return features, None

    @classmethod
    def evaluate_student_features(
        cls,
        features_input: Dict[str, Any],
        feature_source: str = "explicit_uci_features",
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Run inference using calibrated model, validate against leakage,
        preserve missing/unobserved values cleanly via pipeline imputation,
        and generate risk factors only from genuinely observed values.
        """
        if not features_input or not isinstance(features_input, dict):
            return None, "Insufficient feature data: no valid observed model features provided."

        # 1. Leakage guard
        try:
            assert_no_dropout_leakage(list(features_input.keys()))
        except ValueError as err:
            return None, str(err)

        # 2. Load model
        model = load_cached_dropout_model()
        if model is None:
            return None, "Dropout prediction model is currently unavailable."

        # 3. Align features — unobserved fields remain np.nan (never fabricated defaults)
        feature_dict: Dict[str, Any] = {col: np.nan for col in ALL_FEATURE_COLUMNS}
        observed_keys: List[str] = []

        for k, v in features_input.items():
            if k in feature_dict and v is not None and not (isinstance(v, float) and np.isnan(v)):
                try:
                    feature_dict[k] = float(v)
                    observed_keys.append(k)
                except (ValueError, TypeError):
                    return None, f"Invalid numeric value for feature '{k}'."

        if not observed_keys:
            return None, "Insufficient feature data: at least one valid model feature must be observed."

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

        # 6. Key risk and protective factors — strictly from genuinely observed (non-NaN) features
        key_risk_factors = []
        protective_factors = []

        def _obs(col_name: str) -> Optional[float]:
            val = feature_dict.get(col_name)
            if val is None or (isinstance(val, float) and np.isnan(val)):
                return None
            return float(val)

        cu1_app = _obs("Curricular units 1st sem (approved)")
        cu2_app = _obs("Curricular units 2nd sem (approved)")
        tuition = _obs("Tuition fees up to date")
        scholarship = _obs("Scholarship holder")
        debtor = _obs("Debtor")
        grade1 = _obs("Curricular units 1st sem (grade)")

        if cu1_app is not None or cu2_app is not None:
            c1 = int(cu1_app) if cu1_app is not None else 0
            c2 = int(cu2_app) if cu2_app is not None else 0
            if (cu1_app is not None and cu1_app < 4) or (cu2_app is not None and cu2_app < 4):
                key_risk_factors.append({
                    "factor": "Curricular Unit Completion Deficit",
                    "detail": f"Projected/observed completion of {c1} (1st sem) and {c2} (2nd sem) curricular units.",
                    "importance": "High",
                })
            else:
                protective_factors.append({
                    "factor": "Consistent Curricular Progress",
                    "detail": f"Projected/observed completion of {c1} (1st sem) and {c2} (2nd sem) curricular units.",
                })

        if tuition is not None:
            if tuition == 0:
                key_risk_factors.append({
                    "factor": "Tuition Payment Delay",
                    "detail": "Tuition fees are flagged as overdue, which correlates with enrollment interruption.",
                    "importance": "High",
                })
            else:
                protective_factors.append({
                    "factor": "Good Financial Standing",
                    "detail": "Tuition payments are recorded as up-to-date.",
                })

        if debtor is not None and debtor == 1:
            key_risk_factors.append({
                "factor": "Financial Debt Flag",
                "detail": "Student has an outstanding institutional balance requiring advisory check-in.",
                "importance": "Medium",
            })

        if scholarship is not None and scholarship == 1:
            protective_factors.append({
                "factor": "Active Scholarship",
                "detail": "Student holds an active academic scholarship supporting continuous enrollment.",
            })

        if grade1 is not None:
            if grade1 < 10.0:
                key_risk_factors.append({
                    "factor": "Early Academic Margin",
                    "detail": f"Mapped grade average ({grade1:.1f}/20) is below the 10.0 passing benchmark.",
                    "importance": "High",
                })
            elif grade1 >= 14.0:
                protective_factors.append({
                    "factor": "Strong Academic Standing",
                    "detail": f"Mapped grade average ({grade1:.1f}/20) exceeds cohort baseline.",
                })

        # 7. Supportive, Non-Punitive Recommendations
        recommendations = []
        if risk_tier == "High":
            recommendations.extend([
                "Schedule a 1-on-1 supportive counseling check-in with an Academic Success Advisor.",
                "Enroll in complimentary Peer Tutoring and study skill development workshops.",
                "Develop an individualized course completion plan with a department faculty mentor.",
            ])
            if tuition == 0 or debtor == 1:
                recommendations.append(
                    "Connect with Student Financial Support to explore tuition installment plans and emergency grants."
                )
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

        # Exact snapshot of values passed to inference (None for unobserved/imputed fields)
        exact_snapshot = {
            col: (None if (val is None or (isinstance(val, float) and np.isnan(val))) else round(float(val), 4))
            for col, val in feature_dict.items()
        }

        result = {
            "risk_probability": round(proba, 4),
            "risk_tier": risk_tier,
            "model_version": model_version,
            "key_risk_factors": key_risk_factors,
            "protective_factors": protective_factors,
            "recommendations": recommendations,
            "feature_source": feature_source,
            "observed_feature_count": len(observed_keys),
            "features_snapshot": exact_snapshot,
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
        features_input: Optional[Dict[str, Any]],
        actor_user: User,
        academic_term: Optional[str] = None,
        student_name: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Assess student dropout risk and persist to MongoDB dropout_records collection.
        Authorized for Admin (org-scoped) and Teacher (subject/enrollment/term/org-scoped).
        """
        student_oid = to_object_id(student_id)
        if not student_oid:
            return None, "Invalid student_id.", 400

        user_doc = db.users.find_one({"_id": student_oid}) if db is not None else None
        if db is not None and not user_doc:
            return None, "Student record not found.", 404

        # RBAC Check
        actor_role = getattr(actor_user, "role", "")
        if actor_role == "teacher":
            if not _check_teacher_student_access(db, actor_user, student_oid, subject=subject, academic_term=academic_term):
                return None, "Access denied. You are not authorized to evaluate this student for the specified subject/term.", 403
        elif not can_access_student_data(actor_user, student_oid, db):
            return None, "Access denied. You are not authorized to evaluate this student.", 403

        if not student_name and user_doc:
            student_name = _extract_user_display_name(user_doc)

        # Resolve features: explicit payload vs DB academic record
        resolved_features: Optional[Dict[str, Any]] = None
        feature_source = "explicit_uci_features"

        if features_input and isinstance(features_input, dict) and len(features_input) > 0:
            # Check leakage first before classifying payload type
            try:
                assert_no_dropout_leakage(list(features_input.keys()))
            except ValueError as err:
                return None, str(err), 400

            has_uci_keys = any(k in ALL_FEATURE_COLUMNS for k in features_input.keys())
            has_edupredict_keys = any(k in EDUCATIONAL_MAPPING_KEYS for k in features_input.keys())

            if has_edupredict_keys and not has_uci_keys:
                resolved_features, map_err = cls.map_academic_record_to_features(features_input)
                if map_err:
                    return None, map_err, 422
                feature_source = "academic_record_mapping"
            else:
                resolved_features = features_input
                feature_source = "explicit_uci_features"
        else:
            # Look up student's actual academic record in MongoDB
            if db is None:
                return None, "Database connection unavailable.", 500
            ac_query: Dict[str, Any] = {"student_id": student_oid}
            if academic_term and academic_term.strip():
                ac_query["term"] = academic_term.strip()
            ac_doc = db.academic_records.find_one(ac_query, sort=[("created_at", DESCENDING)])
            if not ac_doc:
                return (
                    None,
                    "Insufficient academic data: no academic record or valid features available for dropout assessment.",
                    422,
                )
            resolved_features, map_err = cls.map_academic_record_to_features(ac_doc)
            if map_err:
                return None, map_err, 422
            feature_source = "academic_record_mapping"
            if not academic_term:
                academic_term = ac_doc.get("term")

        eval_data, err = cls.evaluate_student_features(resolved_features, feature_source=feature_source)
        if err:
            status = 422 if "Insufficient" in err else 400
            return None, err, status

        org_id = (
            (user_doc.get("organization_id") if user_doc else None)
            or getattr(actor_user, "organization_id", None)
        )

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
            organization_id=org_id,
            feature_source=eval_data["feature_source"],
            observed_feature_count=eval_data["observed_feature_count"],
            requires_human_review=True,
            disclaimer=DEFAULT_DISCLAIMER,
            features_snapshot=eval_data["features_snapshot"],
        )

        if db is not None:
            try:
                db.dropout_records.update_one(
                    {"student_id": student_oid},
                    {"$set": record.to_doc()},
                    upsert=True,
                )
                history_doc = {**record.to_doc(), "_id": ObjectId()}
                db.dropout_prediction_history.insert_one(history_doc)
                log_event(
                    db=db,
                    event_type="DROPOUT_ASSESSMENT_RECORDED",
                    details={
                        "student_id": str(student_oid),
                        "risk_tier": record.risk_tier,
                        "risk_probability": round(record.risk_probability, 4),
                        "feature_source": record.feature_source,
                        "observed_feature_count": record.observed_feature_count,
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
        subject: Optional[str] = None,
        academic_term: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Retrieve dropout risk assessment for a specific student.
        - Student: only self
        - Teacher: assigned students only (matching active subject, enrollment, and term)
        - Admin: organization-scoped students
        - Analyst: 403 Forbidden
        """
        student_oid = to_object_id(student_id)
        if not student_oid:
            return None, "Invalid student_id.", 400

        if db is None:
            return None, "Database connection unavailable.", 500

        user_doc = db.users.find_one({"_id": student_oid})

        actor_role = getattr(actor_user, "role", "")
        if actor_role == "teacher":
            if not _check_teacher_student_access(db, actor_user, student_oid, subject=subject, academic_term=academic_term):
                return None, "Access denied. You are not authorized to view this student's dropout assessment.", 403
        elif not can_access_student_data(actor_user, student_oid, db):
            return None, "Access denied. You are not authorized to view this student's dropout assessment.", 403

        doc_query: Dict[str, Any] = {"student_id": student_oid}
        if academic_term and academic_term.strip():
            doc_query["academic_term"] = academic_term.strip()

        doc = db.dropout_records.find_one(doc_query)
        if doc:
            record = DropoutRecord.from_doc(doc)
            return record.to_dict(), None, 200

        # If not evaluated yet, evaluate on-the-fly ONLY if a genuine academic record exists
        ac_query: Dict[str, Any] = {"student_id": student_oid}
        if academic_term and academic_term.strip():
            ac_query["term"] = academic_term.strip()
        ac_doc = db.academic_records.find_one(ac_query, sort=[("created_at", DESCENDING)])
        if not ac_doc:
            return (
                None,
                "Dropout risk assessment is unavailable because no academic record exists for this student.",
                422,
            )

        features, map_err = cls.map_academic_record_to_features(ac_doc)
        if map_err:
            return None, map_err, 422

        eval_data, err = cls.evaluate_student_features(features, feature_source="academic_record_mapping")
        if err:
            return None, err, 500

        name = _extract_user_display_name(user_doc)
        org_id = user_doc.get("organization_id") if user_doc else getattr(actor_user, "organization_id", None)

        record = DropoutRecord(
            student_id=student_oid,
            student_name=name,
            risk_probability=eval_data["risk_probability"],
            risk_tier=eval_data["risk_tier"],
            model_version=eval_data["model_version"],
            key_risk_factors=eval_data["key_risk_factors"],
            protective_factors=eval_data["protective_factors"],
            recommendations=eval_data["recommendations"],
            academic_term=ac_doc.get("term", "Current Term"),
            organization_id=org_id,
            feature_source=eval_data["feature_source"],
            observed_feature_count=eval_data["observed_feature_count"],
            requires_human_review=True,
            disclaimer=DEFAULT_DISCLAIMER,
            features_snapshot=eval_data["features_snapshot"],
        )

        return record.to_dict(), None, 200

    @classmethod
    def get_teacher_roster_dropout(
        cls,
        db: Database,
        teacher_user: User,
        subject_id: Optional[str] = None,
        academic_term: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Retrieve dropout risk assessments for students actively enrolled
        in subjects AND exact academic terms assigned to this teacher.
        Strictly excludes students without valid assessments or academic records.
        """
        if db is None:
            return None, "Database unavailable.", 500

        teacher_oid = to_object_id(teacher_user.id)
        t_query: Dict[str, Any] = {"teacher_id": teacher_oid, "status": "active"}
        if subject_id:
            subj_oid = to_object_id(subject_id)
            if not subj_oid:
                return None, "Invalid subject_id.", 400
            t_query["subject_id"] = subj_oid
        if academic_term and academic_term.strip():
            t_query["academic_term"] = academic_term.strip()

        assignments = list(db.teacher_subject_assignments.find(t_query))
        if not assignments:
            return {"students": [], "total": 0, "page": page, "limit": limit}, None, 200

        # Require exact (subject_id, academic_term) match on active enrollments
        pair_conditions = []
        for a in assignments:
            s_id = a.get("subject_id")
            term = a.get("academic_term")
            if s_id and term:
                pair_conditions.append({
                    "subject_id": s_id,
                    "academic_term": term,
                    "status": "active",
                })

        if not pair_conditions:
            return {"students": [], "total": 0, "page": page, "limit": limit}, None, 200

        enroll_q = pair_conditions[0] if len(pair_conditions) == 1 else {"$or": pair_conditions}
        enrollments = list(db.student_subject_enrollments.find(enroll_q))

        candidate_student_ids = list({e["student_id"] for e in enrollments if e.get("student_id")})
        if not candidate_student_ids:
            return {"students": [], "total": 0, "page": page, "limit": limit}, None, 200

        student_ids = candidate_student_ids

        if not student_ids:
            return {"students": [], "total": 0, "page": page, "limit": limit}, None, 200

        skip = (page - 1) * limit
        rec_query: Dict[str, Any] = {"student_id": {"$in": student_ids}}
        if academic_term and academic_term.strip():
            rec_query["academic_term"] = academic_term.strip()

        cursor = db.dropout_records.find(rec_query).sort("created_at", DESCENDING).skip(skip).limit(limit)
        records = [DropoutRecord.from_doc(d).to_dict() for d in cursor]

        # For students without persisted dropout_record, evaluate ONLY if genuine academic_record exists
        assessed_ids = {to_object_id(r["student_id"]) for r in records}
        unassessed_ids = [sid for sid in student_ids if sid not in assessed_ids]

        if unassessed_ids and len(records) < limit:
            users_cursor = db.users.find({"_id": {"$in": unassessed_ids}})
            for u in users_cursor:
                if len(records) >= limit:
                    break
                uid = u["_id"]
                ac_query: Dict[str, Any] = {"student_id": uid}
                if academic_term and academic_term.strip():
                    ac_query["term"] = academic_term.strip()
                ac_doc = db.academic_records.find_one(ac_query, sort=[("created_at", DESCENDING)])
                if not ac_doc:
                    continue  # Never fabricate prediction when no academic record exists

                feats, map_err = cls.map_academic_record_to_features(ac_doc)
                if map_err or not feats:
                    continue

                eval_res, eval_err = cls.evaluate_student_features(feats, feature_source="academic_record_mapping")
                if eval_err or not eval_res:
                    continue

                name = _extract_user_display_name(u)
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
                    "academic_term": ac_doc.get("term", "Current Term"),
                    "feature_source": eval_res["feature_source"],
                    "observed_feature_count": eval_res["observed_feature_count"],
                    "features_snapshot": eval_res["features_snapshot"],
                    "requires_human_review": True,
                    "disclaimer": DEFAULT_DISCLAIMER,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })

        return {
            "students": records,
            "total": len(records),
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
        Institution-scoped dropout metrics and distributions for Admin role.
        Enforces organization isolation when organization_id is set on admin_user.
        """
        if db is None:
            return None, "Database unavailable.", 500

        base_filter: Dict[str, Any] = {}

        total_assessed = db.dropout_records.count_documents(base_filter)
        low_count = db.dropout_records.count_documents({**base_filter, "risk_tier": "Low"})
        mod_count = db.dropout_records.count_documents({**base_filter, "risk_tier": "Moderate"})
        high_count = db.dropout_records.count_documents({**base_filter, "risk_tier": "High"})

        recent_high = list(
            db.dropout_records.find({**base_filter, "risk_tier": "High"})
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
                "benchmark_dataset": "UCI Machine Learning Repository ID 697 (Portuguese Higher Education)",
                "benchmark_disclosure": UCI_BENCHMARK_DISCLOSURE,
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
        Guarantees zero PII exposure, complementary suppression, and organization scoping.
        """
        if db is None:
            return None, "Database unavailable.", 500

        base_filter: Dict[str, Any] = {}

        total_assessed = db.dropout_records.count_documents(base_filter)
        low_count = db.dropout_records.count_documents({**base_filter, "risk_tier": "Low"})
        mod_count = db.dropout_records.count_documents({**base_filter, "risk_tier": "Moderate"})
        high_count = db.dropout_records.count_documents({**base_filter, "risk_tier": "High"})

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
                "benchmark_dataset": "UCI Portuguese Higher Education (ID 697)",
                "benchmark_disclosure": UCI_BENCHMARK_DISCLOSURE,
                "roc_auc": metadata.get("test_metrics", {}).get("roc_auc"),
                "pr_auc": metadata.get("test_metrics", {}).get("pr_auc"),
                "brier_score": metadata.get("test_metrics", {}).get("brier_score"),
                "calibration": metadata.get("calibration", "CalibratedClassifierCV"),
            },
            "privacy_notice": f"Statistical Disclosure Control applied: cells with count < {threshold} are suppressed with complementary cell masking.",
        }, None, 200

    @classmethod
    def bulk_record_student_assessments(
        cls,
        db: Database,
        actor_user: User,
        student_ids: List[str],
        academic_term: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Evaluate and persist dropout risk assessments for multiple students (max 100).
        Enforces per-student organization isolation and RBAC via record_student_assessment.
        """
        if not isinstance(student_ids, list) or len(student_ids) == 0:
            return None, "'student_ids' must be a non-empty list of student IDs.", 400
        if len(student_ids) > 100:
            return None, "Bulk evaluation is limited to at most 100 students per request.", 400

        results: List[Dict[str, Any]] = []
        succeeded = 0
        failed = 0

        for sid in student_ids:
            sid_str = str(sid).strip() if sid is not None else ""
            if not sid_str:
                failed += 1
                results.append({"student_id": sid, "status": "error", "error": "Empty student_id", "status_code": 400})
                continue

            record_dict, err, status = cls.record_student_assessment(
                db=db,
                actor_user=actor_user,
                student_id=sid_str,
                features_input=None,
                academic_term=academic_term,
                subject=subject,
            )
            if err:
                failed += 1
                results.append({
                    "student_id": sid_str,
                    "status": "error",
                    "error": err,
                    "status_code": status,
                })
            else:
                succeeded += 1
                results.append({
                    "student_id": sid_str,
                    "status": "success",
                    "assessment": record_dict,
                })

        return {
            "total_requested": len(student_ids),
            "succeeded": succeeded,
            "failed": failed,
            "results": results,
        }, None, 200

    @classmethod
    def get_student_prediction_history(
        cls,
        db: Database,
        actor_user: User,
        student_id: str,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Retrieve paginated historical dropout assessments for an authorized student.
        Analyst is denied individual-level prediction history (403).
        """
        if db is None:
            return None, "Database unavailable.", 500

        actor_role = getattr(actor_user, "role", "")
        if actor_role == "analyst":
            return None, "Analysts cannot access individual student prediction history.", 403

        student_oid = to_object_id(student_id)
        if not student_oid:
            return None, "Invalid student ID format.", 400

        if actor_role == "teacher":
            if not _check_teacher_student_access(db, actor_user, student_oid):
                return None, "Access denied. Student is not in your assigned subjects.", 403
        elif not can_access_student_data(actor_user, student_oid, db):
            return None, "Access denied.", 403

        page = max(1, page)
        limit = max(1, min(limit, 100))
        skip = (page - 1) * limit

        query: Dict[str, Any] = {"student_id": student_oid}

        total = db.dropout_prediction_history.count_documents(query)
        cursor = (
            db.dropout_prediction_history.find(query)
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        history = [DropoutRecord.from_doc(doc).to_dict() for doc in cursor]

        if total == 0:
            latest_doc = db.dropout_records.find_one(query)
            if latest_doc:
                history = [DropoutRecord.from_doc(latest_doc).to_dict()]
                total = 1

        return {
            "student_id": str(student_oid),
            "history": history,
            "total": total,
            "page": page,
            "limit": limit,
        }, None, 200

    @classmethod
    def get_prediction_detail(
        cls,
        db: Database,
        actor_user: User,
        prediction_id: str,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Retrieve a single dropout prediction record with explanations and feature snapshot.
        Enforces strict RBAC and organization isolation.
        """
        if db is None:
            return None, "Database unavailable.", 500

        actor_role = getattr(actor_user, "role", "")
        if actor_role == "analyst":
            return None, "Analysts cannot access individual student prediction details.", 403

        pred_oid = to_object_id(prediction_id)
        if not pred_oid:
            return None, "Invalid prediction ID format.", 400

        doc = db.dropout_prediction_history.find_one({"_id": pred_oid})
        if not doc:
            doc = db.dropout_records.find_one({"_id": pred_oid})
        if not doc:
            return None, "Prediction record not found.", 404

        student_oid = doc.get("student_id")
        if not student_oid:
            return None, "Access denied.", 403

        if actor_role == "teacher":
            if not _check_teacher_student_access(db, actor_user, student_oid):
                return None, "Access denied. Student is not in your assigned subjects.", 403
        elif not can_access_student_data(actor_user, student_oid, db):
            return None, "Access denied.", 403

        return DropoutRecord.from_doc(doc).to_dict(), None, 200

    @classmethod
    def get_admin_prediction_records(
        cls,
        db: Database,
        admin_user: User,
        risk_tier: Optional[str] = None,
        academic_term: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Filterable, paginated dropout prediction records for Admin dashboard.
        """
        if db is None:
            return None, "Database unavailable.", 500

        query: Dict[str, Any] = {}

        if risk_tier and risk_tier.strip() in {"Low", "Moderate", "High"}:
            query["risk_tier"] = risk_tier.strip()
        if academic_term and academic_term.strip():
            query["academic_term"] = academic_term.strip()
        if search and search.strip():
            escaped_search = re.escape(search.strip())
            term_rx = {"$regex": escaped_search, "$options": "i"}
            query["$or"] = [
                {"student_name": term_rx},
                {"academic_term": term_rx},
                {"model_version": term_rx},
            ]

        page = max(1, page)
        limit = max(1, min(limit, 100))
        skip = (page - 1) * limit

        total = db.dropout_records.count_documents(query)
        cursor = (
            db.dropout_records.find(query)
            .sort("updated_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        records = [DropoutRecord.from_doc(doc).to_dict() for doc in cursor]

        return {
            "records": records,
            "total": total,
            "page": page,
            "limit": limit,
        }, None, 200

    @classmethod
    def get_analyst_trends(
        cls,
        db: Database,
        analyst_user: User,
        threshold: int = 5,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Organization-scoped, privacy-suppressed dropout risk trends grouped by academic_term.
        Applies Statistical Disclosure Control (N < 5 complementary suppression).
        """
        if db is None:
            return None, "Database unavailable.", 500

        base_filter: Dict[str, Any] = {}

        docs = list(db.dropout_records.find(base_filter))
        term_buckets: Dict[str, Dict[str, int]] = {}
        for doc in docs:
            term = doc.get("academic_term") or "Current Term"
            tier = doc.get("risk_tier") or "Low"
            if term not in term_buckets:
                term_buckets[term] = {"Low": 0, "Moderate": 0, "High": 0}
            if tier in term_buckets[term]:
                term_buckets[term][tier] += 1

        trends: List[Dict[str, Any]] = []
        for term in sorted(term_buckets.keys()):
            counts = term_buckets[term]
            term_total = sum(counts.values())
            suppressed_partition, suppressed_total = apply_complementary_partition_suppression(
                category_counts=counts,
                total_count=term_total,
                threshold=threshold,
            )
            trends.append({
                "academic_term": term,
                "total_assessed": suppressed_total,
                "risk_distribution": suppressed_partition,
            })

        return {
            "trends": trends,
            "privacy_notice": (
                f"Statistical Disclosure Control applied: cells with count < {threshold} "
                "are suppressed with complementary cell masking."
            ),
            "benchmark_disclosure": UCI_BENCHMARK_DISCLOSURE,
        }, None, 200
