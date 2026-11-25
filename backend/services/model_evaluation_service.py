"""
EduPredict - Model Evaluation, Comparison & Registry Service (Phase 8C)
Module: backend.services.model_evaluation_service
Purpose: Provides comprehensive model evaluation metrics, ROC/PR curves,
calibration reliability diagrams, feature contribution weights (correlation-only),
fair time-series forecast evaluation (MAE, RMSE, MAPE, sMAPE, Bias),
and versioned Model Registry management in MongoDB 6.x.
"""

import os
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from sklearn.metrics import roc_curve, precision_recall_curve
from sklearn.calibration import calibration_curve

from backend.models.model_registry_model import ModelRegistryEntry
from backend.models.user_model import User
from backend.ml.dropout_pipeline import (
    load_dropout_data,
    create_train_test_split,
    DEFAULT_RAW_DATASET_PATH,
)
from backend.ml.demand_forecaster import (
    forecast_subject_demand,
    compute_regression_metrics,
)
from backend.services.dropout_service import (
    load_cached_dropout_model,
    load_cached_dropout_metadata,
)
from backend.services.demand_forecast_service import DemandForecastService
from backend.services.system_log_service import log_event
from backend.utils.security import to_object_id

logger = logging.getLogger(__name__)

REPORTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "ml_models",
    "reports",
)
DROPOUT_EVAL_REPORT_PATH = os.path.join(REPORTS_DIR, "dropout_model_evaluation.json")

_CACHED_DROPOUT_CURVES: Optional[Dict[str, Any]] = None
_CACHED_DATASET_FINGERPRINT: Optional[str] = None


def _get_dataset_fingerprint() -> str:
    """Compute short SHA-256 fingerprint of the UCI dropout benchmark CSV."""
    global _CACHED_DATASET_FINGERPRINT
    if _CACHED_DATASET_FINGERPRINT:
        return _CACHED_DATASET_FINGERPRINT
    if not os.path.exists(DEFAULT_RAW_DATASET_PATH):
        return "unavailable"
    try:
        h = hashlib.sha256()
        with open(DEFAULT_RAW_DATASET_PATH, "rb") as f:
            h.update(f.read(65536))
        _CACHED_DATASET_FINGERPRINT = f"sha256:{h.hexdigest()[:16]}"
        return _CACHED_DATASET_FINGERPRINT
    except OSError:
        return "unavailable"


def _compute_dropout_curves_and_importance() -> Dict[str, Any]:
    """
    Compute ROC curve, Precision-Recall curve, Calibration Reliability Diagram,
    Expected Calibration Error (ECE), and top Logistic Regression feature weights
    on the deterministic UCI holdout test split (885 records). Cached in memory.
    """
    global _CACHED_DROPOUT_CURVES
    if _CACHED_DROPOUT_CURVES is not None:
        return _CACHED_DROPOUT_CURVES

    model = load_cached_dropout_model()
    if model is None or not os.path.exists(DEFAULT_RAW_DATASET_PATH):
        return {
            "roc_curve": [],
            "pr_curve": [],
            "calibration_curve": [],
            "ece": None,
            "feature_contributions": [],
        }

    try:
        X, y, _ = load_dropout_data(binary_target=True, exclude_enrolled=False)
        _, X_test, _, y_test = create_train_test_split(X, y, test_size=0.2, random_state=42)
        y_prob = model.predict_proba(X_test)[:, 1]

        # 1. ROC curve (downsampled to <= 20 evenly spaced points for clean charting)
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        roc_idx = np.linspace(0, len(fpr) - 1, min(20, len(fpr)), dtype=int)
        roc_points = [
            {"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4)}
            for i in roc_idx
        ]

        # 2. PR curve (downsampled to <= 20 points)
        prec, rec, _ = precision_recall_curve(y_test, y_prob)
        pr_idx = np.linspace(0, len(prec) - 1, min(20, len(prec)), dtype=int)
        pr_points = [
            {"recall": round(float(rec[i]), 4), "precision": round(float(prec[i]), 4)}
            for i in pr_idx
        ]

        # 3. Calibration reliability diagram (8 bins) & ECE
        prob_true, prob_pred = calibration_curve(y_test, y_prob, n_bins=8, strategy="uniform")
        cal_bins = [
            {
                "mean_predicted": round(float(mp), 4),
                "fraction_positive": round(float(fp), 4),
            }
            for mp, fp in zip(prob_pred, prob_true)
        ]
        # Compute ECE across 8 uniform bins
        bins = np.linspace(0.0, 1.0, 9)
        ece = 0.0
        n_total = len(y_test)
        y_arr = np.array(y_test)
        for b in range(8):
            mask = (y_prob >= bins[b]) & (y_prob < bins[b + 1] if b < 7 else y_prob <= bins[b + 1])
            if np.any(mask):
                bin_acc = float(np.mean(y_arr[mask]))
                bin_conf = float(np.mean(y_prob[mask]))
                ece += (np.sum(mask) / n_total) * abs(bin_acc - bin_conf)

        # 4. Feature contributions (average linear coefficients across calibrated folds)
        feature_contributions = []
        try:
            prep = model.named_steps["preprocessor"]
            cal_clf = model.named_steps["classifier"]
            feat_names = list(prep.get_feature_names_out())
            coefs = np.mean([cc.estimator.coef_[0] for cc in cal_clf.calibrated_classifiers_], axis=0)
            top_indices = np.argsort(np.abs(coefs))[::-1][:10]
            for idx in top_indices:
                raw_name = feat_names[idx].replace("num__", "").replace("cat__", "").replace("bin__", "")
                feature_contributions.append({
                    "feature": raw_name,
                    "weight": round(float(coefs[idx]), 4),
                    "abs_weight": round(float(abs(coefs[idx])), 4),
                    "direction": "Increases Risk Score" if coefs[idx] > 0 else "Decreases Risk Score",
                })
        except Exception as fe:
            logger.warning("Could not extract feature contributions: %s", fe)

        _CACHED_DROPOUT_CURVES = {
            "roc_curve": roc_points,
            "pr_curve": pr_points,
            "calibration_curve": cal_bins,
            "ece": round(float(ece), 4),
            "feature_contributions": feature_contributions,
        }
        return _CACHED_DROPOUT_CURVES
    except Exception as e:
        logger.error("Failed computing dropout curves: %s", e)
        return {
            "roc_curve": [],
            "pr_curve": [],
            "calibration_curve": [],
            "ece": None,
            "feature_contributions": [],
        }


def _enrich_classification_metrics(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure accuracy is computed alongside precision, recall, F1, ROC-AUC, PR-AUC, Brier."""
    tn = metrics.get("true_negatives", 0)
    tp = metrics.get("true_positives", 0)
    fn = metrics.get("false_negatives", 0)
    fp = metrics.get("false_positives", 0)
    total = tn + tp + fn + fp
    accuracy = round((tp + tn) / total, 4) if total > 0 else None
    return {
        **metrics,
        "accuracy": accuracy,
    }


def _compute_smape_and_bias(y_true: List[float], y_pred: List[float]) -> Tuple[Optional[float], Optional[float]]:
    """Compute sMAPE (%) and Forecast Bias (mean(y_pred - y_true))."""
    if not y_true or len(y_true) != len(y_pred):
        return None, None
    yt = np.array(y_true, dtype=float)
    yp = np.array(y_pred, dtype=float)
    bias = round(float(np.mean(yp - yt)), 3)
    denom = np.abs(yt) + np.abs(yp)
    nonzero = denom > 0
    if not np.any(nonzero):
        return None, bias
    smape = round(float(np.mean(2.0 * np.abs(yp[nonzero] - yt[nonzero]) / denom[nonzero]) * 100.0), 2)
    return smape, bias


class ModelEvaluationService:
    """Service orchestrating Phase 8C model evaluation, comparison, and versioned Model Registry."""

    @classmethod
    def get_dropout_evaluation_report(cls) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Return comprehensive classification evaluation & comparison for Phase 8A Dropout models
        on the UCI holdout benchmark cohort.
        """
        if not os.path.exists(DROPOUT_EVAL_REPORT_PATH):
            return None, "Dropout evaluation report artifact not found.", 404

        try:
            with open(DROPOUT_EVAL_REPORT_PATH, "r", encoding="utf-8") as f:
                raw_report = json.load(f)
        except Exception as e:
            logger.error("Failed reading dropout evaluation report: %s", e)
            return None, "Failed to load dropout evaluation report.", 500

        meta = load_cached_dropout_metadata() or {}
        candidates = raw_report.get("candidate_comparisons", {})

        comparison_rows = []
        for name, cdata in candidates.items():
            tm = _enrich_classification_metrics(cdata.get("test_metrics", {}))
            comparison_rows.append({
                "model_name": name,
                "is_champion": name == raw_report.get("champion_model"),
                "cv_mean_roc_auc": cdata.get("cv_mean_roc_auc"),
                "cv_std_roc_auc": cdata.get("cv_std_roc_auc"),
                "cv_mean_f1": cdata.get("cv_mean_f1"),
                "test_accuracy": tm.get("accuracy"),
                "test_precision": tm.get("precision"),
                "test_recall": tm.get("recall"),
                "test_f1": tm.get("f1"),
                "test_roc_auc": tm.get("roc_auc"),
                "test_pr_auc": tm.get("pr_auc"),
                "test_brier_score": tm.get("brier_score"),
                "confusion_matrix": tm.get("confusion_matrix"),
                "true_positives": tm.get("true_positives"),
                "true_negatives": tm.get("true_negatives"),
                "false_positives": tm.get("false_positives"),
                "false_negatives": tm.get("false_negatives"),
            })

        cal_metrics = _enrich_classification_metrics(raw_report.get("calibrated_champion_performance", {}))
        curves = _compute_dropout_curves_and_importance()

        return {
            "domain": "dropout_classification",
            "title": raw_report.get("title"),
            "champion_model": raw_report.get("champion_model"),
            "champion_model_version": raw_report.get("champion_model_version"),
            "validation_status": "benchmark_validated",
            "local_institutional_validation": False,
            "benchmark_disclosure": (
                "Experimental Early-Warning Benchmark — Not Yet Validated on Local Institutional Outcomes. "
                "Metrics reflect 80/20 stratified holdout (885 records) and 5-fold CV on the UCI Portuguese "
                "higher-education dataset (ID 697). Accuracy alone is never used to select the champion model."
            ),
            "explainability_disclaimer": (
                "Feature weights represent statistical correlation in the UCI training cohort and do not "
                "establish causation for why an individual student may drop out."
            ),
            "dataset": raw_report.get("dataset", {}),
            "dataset_fingerprint": _get_dataset_fingerprint(),
            "calibrated_champion_metrics": cal_metrics,
            "candidate_comparison": comparison_rows,
            "roc_curve": curves["roc_curve"],
            "pr_curve": curves["pr_curve"],
            "calibration_curve": curves["calibration_curve"],
            "expected_calibration_error": curves["ece"],
            "feature_contributions": curves["feature_contributions"],
            "risk_tradeoffs": raw_report.get("risk_tradeoffs", {}),
            "risk_thresholds": meta.get("risk_thresholds", {}),
        }, None, 200

    @classmethod
    def get_demand_evaluation_report(
        cls,
        db: Database,
        actor_user: User,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Evaluate Course Demand Forecasting models (NaiveLastValue, MovingAverage2, RidgeLagForecaster)
        on the authenticated organization's genuine historical enrollment records using Phase 8B's
        common-origin walk-forward validation. Reports 'Insufficient Data' when < 4 terms exist.
        """
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = DemandForecastService._require_valid_org_id(actor_user)
        if org_err:
            return None, org_err, org_code

        subjects, err, code = DemandForecastService._get_authorized_subjects(db, actor_user, org_id=org_id)
        if err:
            return None, err, code

        org_student_ids = DemandForecastService._get_org_student_ids(db, org_id)
        subject_oids = [s["_id"] for s in subjects]
        histories_map = DemandForecastService._extract_batch_subject_histories(db, subject_oids, org_student_ids)

        evaluated_subjects = []
        model_agg: Dict[str, Dict[str, List[float]]] = {
            "NaiveLastValue": {"mae": [], "rmse": [], "mape": [], "splits": []},
            "MovingAverage2": {"mae": [], "rmse": [], "mape": [], "splits": []},
            "RidgeLagForecaster": {"mae": [], "rmse": [], "mape": [], "splits": []},
        }
        actual_vs_predicted = []

        for subj in subjects:
            s_oid = subj["_id"]
            history = histories_map.get(s_oid, [])
            fc = forecast_subject_demand(history, periods_ahead=1, capacity=subj.get("capacity"))

            # Compute sMAPE & Bias on historical one-step-ahead if >= 3 terms
            counts = [float(r["total_count"]) for r in history]
            smape_val, bias_val = None, None
            if len(counts) >= 3:
                yt = counts[2:]
                yp = [(counts[i - 1] + counts[i - 2]) / 2.0 for i in range(2, len(counts))]
                smape_val, bias_val = _compute_smape_and_bias(yt, yp)

            for m_name, m_metrics in fc.get("baseline_comparison", {}).items():
                if m_name in model_agg and m_metrics.get("mae") is not None:
                    model_agg[m_name]["mae"].append(float(m_metrics["mae"]))
                    model_agg[m_name]["rmse"].append(float(m_metrics["rmse"]))
                    if m_metrics.get("mape") is not None:
                        model_agg[m_name]["mape"].append(float(m_metrics["mape"]))
                    model_agg[m_name]["splits"].append(int(m_metrics.get("validation_splits", 0)))

            evaluated_subjects.append({
                "subject_id": str(s_oid),
                "subject_code": subj.get("code", ""),
                "subject_name": subj.get("name", ""),
                "terms_observed": len(history),
                "latest_actual": fc["latest_actual_enrollment"],
                "predicted_enrollment": fc["predicted_enrollment"],
                "model_used": fc["model_used"],
                "validation_status": fc["validation_status"],
                "data_sufficiency": fc["data_sufficiency"],
                "mae": fc["evaluation_metrics"].get("mae"),
                "rmse": fc["evaluation_metrics"].get("rmse"),
                "mape": fc["evaluation_metrics"].get("mape"),
                "smape": smape_val,
                "forecast_bias": bias_val,
                "validation_splits": fc["common_validation_window"].get("split_count", 0),
                "excluded_models": fc.get("excluded_models", {}),
            })

            if fc["latest_actual_enrollment"] is not None:
                actual_vs_predicted.append({
                    "subject": subj.get("code") or subj.get("name", ""),
                    "actual": fc["latest_actual_enrollment"],
                    "predicted": fc["predicted_enrollment"],
                    "mae": fc["evaluation_metrics"].get("mae"),
                })

        comparison_rows = []
        for m_name, vals in model_agg.items():
            if vals["mae"]:
                comparison_rows.append({
                    "model_name": m_name,
                    "subjects_evaluated": len(vals["mae"]),
                    "total_validation_splits": sum(vals["splits"]),
                    "mean_mae": round(float(np.mean(vals["mae"])), 3),
                    "mean_rmse": round(float(np.mean(vals["rmse"])), 3),
                    "mean_mape": round(float(np.mean(vals["mape"])), 2) if vals["mape"] else None,
                    "status": "evaluated",
                })
            else:
                comparison_rows.append({
                    "model_name": m_name,
                    "subjects_evaluated": 0,
                    "total_validation_splits": 0,
                    "mean_mae": None,
                    "mean_rmse": None,
                    "mean_mape": None,
                    "status": "Insufficient Data",
                })

        has_walk_forward = any(r["subjects_evaluated"] > 0 for r in comparison_rows)
        overall_status = "walk_forward_evaluated" if has_walk_forward else "Insufficient Data"

        return {
            "domain": "course_demand_forecasting",
            "organization_id": org_id,
            "overall_status": overall_status,
            "validation_methodology": (
                "Common-origin expanding-window walk-forward validation. RidgeLagForecaster requires >= 7 "
                "historical terms (>= 3 common splits) before comparison against NaiveLastValue and MovingAverage2."
            ),
            "model_comparison": comparison_rows,
            "subject_evaluations": evaluated_subjects,
            "actual_vs_predicted": actual_vs_predicted,
            "insufficient_data_notice": (
                None if has_walk_forward else
                "Insufficient Data: At least 3–4 historical enrollment terms per subject are required "
                "for walk-forward error evaluation. No synthetic history has been manufactured."
            ),
        }, None, 200

    @classmethod
    def ensure_default_registry_entries(
        cls,
        db: Database,
        org_id: Optional[str] = None,
    ) -> None:
        """Idempotently seed baseline Phase 8A and Phase 8B Model Registry entries if absent."""
        if db is None:
            return

        fingerprint = _get_dataset_fingerprint()
        meta = load_cached_dropout_metadata() or {}
        eval_report = {}
        if os.path.exists(DROPOUT_EVAL_REPORT_PATH):
            try:
                with open(DROPOUT_EVAL_REPORT_PATH, "r", encoding="utf-8") as f:
                    eval_report = json.load(f)
            except Exception:
                pass

        candidates = eval_report.get("candidate_comparisons", {})

        # Global benchmark models for Dropout Classification (shared across orgs)
        dropout_specs = [
            {
                "model_name": "Student Dropout Early Warning Predictor",
                "model_version": "Dropout_LogisticRegression_v1.0.0",
                "algorithm": "LogisticRegression + CalibratedClassifierCV(sigmoid)",
                "metrics": _enrich_classification_metrics(
                    eval_report.get("calibrated_champion_performance", meta.get("test_metrics", {}))
                ),
                "is_active": True,
                "deployment_status": "active",
                "approval_notes": "Selected on highest 5-fold CV ROC-AUC (0.9199) and calibrated Brier score (0.0851).",
            },
            {
                "model_name": "Student Dropout Random Forest Candidate",
                "model_version": "Dropout_RandomForest_v1.0.0",
                "algorithm": "RandomForestClassifier(n_estimators=100, max_depth=10)",
                "metrics": _enrich_classification_metrics(candidates.get("RandomForest", {}).get("test_metrics", {})),
                "is_active": False,
                "deployment_status": "inactive",
                "approval_notes": "Benchmark candidate retained for comparison.",
            },
            {
                "model_name": "Student Dropout HistGradientBoosting Candidate",
                "model_version": "Dropout_HistGradientBoosting_v1.0.0",
                "algorithm": "HistGradientBoostingClassifier(max_iter=100)",
                "metrics": _enrich_classification_metrics(candidates.get("HistGradientBoosting", {}).get("test_metrics", {})),
                "is_active": False,
                "deployment_status": "inactive",
                "approval_notes": "Benchmark candidate retained for comparison.",
            },
        ]

        for spec in dropout_specs:
            existing = db.model_registry.find_one({
                "model_type": "dropout_classification",
                "model_version": spec["model_version"],
                "organization_id": None,
            })
            if not existing:
                entry = ModelRegistryEntry(
                    model_name=spec["model_name"],
                    model_type="dropout_classification",
                    model_version=spec["model_version"],
                    algorithm=spec["algorithm"],
                    training_dataset_ref="UCI Machine Learning Repository ID 697 (data/raw/dropout/data.csv)",
                    dataset_fingerprint=fingerprint,
                    training_params={"random_state": 42, "stratified_split": "80/20", "cv_folds": 5},
                    evaluation_metrics=spec["metrics"],
                    validation_methodology="80/20 Stratified Holdout + 5-Fold Stratified CV (UCI Benchmark)",
                    model_status="benchmark_validated",
                    deployment_status=spec["deployment_status"],
                    is_active=spec["is_active"],
                    organization_id=None,
                    approval_notes=spec["approval_notes"],
                    training_timestamp=meta.get("training_timestamp"),
                    evaluation_timestamp=eval_report.get("generated_at"),
                )
                doc = entry.to_doc()
                doc["organization_id"] = None
                db.model_registry.insert_one(doc)

        # Org-scoped Course Demand Forecaster entry
        if org_id:
            existing_demand = db.model_registry.find_one({
                "model_type": "course_demand_forecasting",
                "model_version": "Demand_WalkForward_v1.0.0",
                "organization_id": org_id,
            })
            if not existing_demand:
                entry = ModelRegistryEntry(
                    model_name="Course Demand Walk-Forward Forecaster",
                    model_type="course_demand_forecasting",
                    model_version="Demand_WalkForward_v1.0.0",
                    algorithm="Common-Origin Walk-Forward (NaiveLastValue / MovingAverage2 / RidgeLag)",
                    training_dataset_ref=f"MongoDB student_subject_enrollments (org: {org_id})",
                    dataset_fingerprint="live-institutional-enrollments",
                    training_params={"min_ridge_terms": 7, "min_splits": 3, "ridge_alpha": 1.0},
                    evaluation_metrics={"methodology": "Walk-forward MAE, RMSE, MAPE, sMAPE, Bias"},
                    validation_methodology="Common-origin expanding-window walk-forward validation",
                    model_status="walk_forward_evaluated",
                    deployment_status="active",
                    is_active=True,
                    organization_id=org_id,
                    approval_notes="Default organization-scoped forecasting engine.",
                )
                db.model_registry.insert_one(entry.to_doc())

    @classmethod
    def list_registry_models(
        cls,
        db: Database,
        actor_user: User,
        model_type: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """List model registry entries visible to actor_user's organization."""
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = DemandForecastService._require_valid_org_id(actor_user)
        if org_err:
            return None, org_err, org_code

        cls.ensure_default_registry_entries(db, org_id=org_id)

        query: Dict[str, Any] = {
            "$or": [{"organization_id": org_id}, {"organization_id": None}, {"organization_id": {"$exists": False}}]
        }
        if model_type and model_type.strip():
            query["model_type"] = model_type.strip()

        cursor = db.model_registry.find(query).sort("created_at", DESCENDING)
        models = [ModelRegistryEntry.from_doc(d).to_dict() for d in cursor]
        return {"models": models, "total": len(models), "organization_id": org_id}, None, 200

    @classmethod
    def activate_model(
        cls,
        db: Database,
        admin_user: User,
        registry_id: str,
        approval_notes: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Activate a registered model version after verifying evaluation completeness
        and explicit administrative approval notes. Admin only.
        """
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = DemandForecastService._require_valid_org_id(admin_user)
        if org_err:
            return None, org_err, org_code

        entry_oid = to_object_id(registry_id)
        if not entry_oid:
            return None, "Invalid registry_id format.", 400

        doc = db.model_registry.find_one({"_id": entry_oid})
        if not doc:
            return None, "Model registry entry not found.", 404

        doc_org = doc.get("organization_id")
        if doc_org is None or str(doc_org) != org_id:
            return (
                None,
                "Access denied. Organization administrators cannot mutate global or cross-organization model registry entries.",
                403,
            )

        if doc.get("model_status") == "insufficient_data" or not doc.get("evaluation_metrics"):
            return None, "Cannot activate model: evaluation metrics are incomplete or data is insufficient.", 422

        clean_notes = (approval_notes or "").strip()
        if not clean_notes:
            return None, "Explicit 'approval_notes' are required to activate a model version.", 400

        # Deactivate other models of the same type within the same scope
        scope_filter: Dict[str, Any] = {"model_type": doc["model_type"]}
        if doc_org is not None:
            scope_filter["organization_id"] = doc_org
        else:
            scope_filter["organization_id"] = None

        now = datetime.now(timezone.utc)
        db.model_registry.update_many(
            {**scope_filter, "_id": {"$ne": entry_oid}, "is_active": True},
            {"$set": {"is_active": False, "deployment_status": "inactive", "updated_at": now}},
        )
        db.model_registry.update_one(
            {"_id": entry_oid},
            {
                "$set": {
                    "is_active": True,
                    "deployment_status": "active",
                    "approval_notes": clean_notes,
                    "updated_at": now,
                }
            },
        )
        updated = db.model_registry.find_one({"_id": entry_oid})

        log_event(
            db=db,
            event_type="MODEL_REGISTRY_ACTIVATED",
            details={
                "registry_id": str(entry_oid),
                "model_version": doc.get("model_version"),
                "model_type": doc.get("model_type"),
                "approval_notes": clean_notes,
                "organization_id": org_id,
            },
            user_id=admin_user.id,
            actor_id=admin_user.id,
        )

        return {"model": ModelRegistryEntry.from_doc(updated).to_dict()}, None, 200

    @classmethod
    def deactivate_model(
        cls,
        db: Database,
        admin_user: User,
        registry_id: str,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Deactivate a registered model version. Admin only."""
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = DemandForecastService._require_valid_org_id(admin_user)
        if org_err:
            return None, org_err, org_code

        entry_oid = to_object_id(registry_id)
        if not entry_oid:
            return None, "Invalid registry_id format.", 400

        doc = db.model_registry.find_one({"_id": entry_oid})
        if not doc:
            return None, "Model registry entry not found.", 404

        doc_org = doc.get("organization_id")
        if doc_org is None or str(doc_org) != org_id:
            return (
                None,
                "Access denied. Organization administrators cannot mutate global or cross-organization model registry entries.",
                403,
            )

        now = datetime.now(timezone.utc)
        db.model_registry.update_one(
            {"_id": entry_oid},
            {"$set": {"is_active": False, "deployment_status": "inactive", "updated_at": now}},
        )
        updated = db.model_registry.find_one({"_id": entry_oid})

        log_event(
            db=db,
            event_type="MODEL_REGISTRY_DEACTIVATED",
            details={
                "registry_id": str(entry_oid),
                "model_version": doc.get("model_version"),
                "organization_id": org_id,
            },
            user_id=admin_user.id,
            actor_id=admin_user.id,
        )

        return {"model": ModelRegistryEntry.from_doc(updated).to_dict()}, None, 200
