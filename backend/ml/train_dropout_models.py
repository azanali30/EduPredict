"""
EduPredict - Student Dropout Model Training & Evaluation (Phase 8A)
Module: backend.ml.train_dropout_models
Purpose: Train, evaluate, calibrate, and compare multiple classification models
for student dropout prediction. Persists champion model and evaluation report.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    brier_score_loss,
    classification_report,
)
from sklearn.model_selection import StratifiedKFold, cross_validate

from backend.ml.dropout_pipeline import (
    load_dropout_data,
    build_dropout_preprocessor,
    create_train_test_split,
    ALL_FEATURE_COLUMNS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("train_dropout_models")

MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "ml_models",
    "saved_models",
)
REPORTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "ml_models",
    "reports",
)


def evaluate_model_performance(
    model: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> Dict[str, Any]:
    """Calculate comprehensive evaluation metrics on unseen holdout test set."""
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else None

    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, y_prob)) if y_prob is not None else None
    pr_auc = float(average_precision_score(y_test, y_prob)) if y_prob is not None else None
    brier = float(brier_score_loss(y_test, y_prob)) if y_prob is not None else None

    cm = confusion_matrix(y_test, y_pred).tolist()
    # cm: [[TN, FP], [FN, TP]]
    tn, fp, fn, tp = cm[0][0], cm[0][1], cm[1][0], cm[1][1]

    # Specificity and Fall-out
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    false_positive_rate = float(fp / (tn + fp)) if (tn + fp) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
        "pr_auc": round(pr_auc, 4) if pr_auc is not None else None,
        "brier_score": round(brier, 4) if brier is not None else None,
        "confusion_matrix": cm,
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
        "specificity": round(specificity, 4),
        "false_positive_rate": round(false_positive_rate, 4),
        "test_samples": int(len(y_test)),
    }


def train_and_compare_models(random_state: int = 42) -> Tuple[Dict[str, Any], Any]:
    """
    Train and compare candidate models:
    1. Baseline Logistic Regression (balanced)
    2. Random Forest (balanced)
    3. HistGradientBoosting (balanced)
    And calibrate probabilities using CalibratedClassifierCV.
    """
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    logger.info("Loading UCI Student Dropout Dataset...")
    X, y, data_meta = load_dropout_data(binary_target=True, exclude_enrolled=False)

    logger.info("Performing 80/20 Stratified Train/Test Split...")
    X_train, X_test, y_train, y_test = create_train_test_split(
        X, y, test_size=0.2, random_state=random_state
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_state)

    candidate_estimators = {
        "LogisticRegression": LogisticRegression(
            class_weight="balanced",
            C=1.0,
            max_iter=1000,
            random_state=random_state,
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=4,
            class_weight="balanced",
            random_state=random_state,
            n_jobs=2,
        ),
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_iter=100,
            class_weight="balanced",
            random_state=random_state,
        ),
    }

    comparison_results: Dict[str, Any] = {}
    fitted_pipelines: Dict[str, Any] = {}

    for name, clf in candidate_estimators.items():
        logger.info("Training candidate model: %s...", name)
        preprocessor = build_dropout_preprocessor()
        pipe = Pipeline(steps=[("preprocessor", preprocessor), ("classifier", clf)])

        # 5-fold cross validation on training set
        cv_scores = cross_validate(
            pipe,
            X_train,
            y_train,
            cv=cv,
            scoring=["roc_auc", "f1", "precision", "recall"],
            n_jobs=2,
        )

        pipe.fit(X_train, y_train)
        test_metrics = evaluate_model_performance(pipe, X_test, y_test)

        comparison_results[name] = {
            "cv_mean_roc_auc": round(float(np.mean(cv_scores["test_roc_auc"])), 4),
            "cv_std_roc_auc": round(float(np.std(cv_scores["test_roc_auc"])), 4),
            "cv_mean_f1": round(float(np.mean(cv_scores["test_f1"])), 4),
            "cv_mean_recall": round(float(np.mean(cv_scores["test_recall"])), 4),
            "cv_mean_precision": round(float(np.mean(cv_scores["test_precision"])), 4),
            "test_metrics": test_metrics,
        }
        fitted_pipelines[name] = pipe

    # Select champion model based on validation ROC-AUC & balanced Recall/F1
    best_name = max(comparison_results, key=lambda k: comparison_results[k]["cv_mean_roc_auc"])
    champion_pipe = fitted_pipelines[best_name]
    logger.info("Champion model selected: %s (CV ROC-AUC: %.4f)", best_name, comparison_results[best_name]["cv_mean_roc_auc"])

    # Probability calibration using CalibratedClassifierCV
    logger.info("Calibrating probability outputs for %s using CalibratedClassifierCV (method='sigmoid')...", best_name)
    calibrated_clf = CalibratedClassifierCV(
        estimator=candidate_estimators[best_name],
        method="sigmoid",
        cv=cv,
    )
    calibrated_pipeline = Pipeline(
        steps=[
            ("preprocessor", build_dropout_preprocessor()),
            ("classifier", calibrated_clf),
        ]
    )
    calibrated_pipeline.fit(X_train, y_train)

    calibrated_metrics = evaluate_model_performance(calibrated_pipeline, X_test, y_test)
    logger.info(
        "Calibrated Model Test ROC-AUC: %.4f, PR-AUC: %.4f, F1: %.4f, Recall: %.4f, Precision: %.4f, Brier: %.4f",
        calibrated_metrics["roc_auc"],
        calibrated_metrics["pr_auc"],
        calibrated_metrics["f1"],
        calibrated_metrics["recall"],
        calibrated_metrics["precision"],
        calibrated_metrics["brier_score"],
    )

    timestamp = datetime.now(timezone.utc).isoformat()
    model_version = f"Dropout_{best_name}_v1.0.0"

    # Save artifacts
    model_artifact_path = os.path.join(MODELS_DIR, "dropout_model.joblib")
    joblib.dump(calibrated_pipeline, model_artifact_path)
    logger.info("Saved calibrated model artifact to %s", model_artifact_path)

    metadata = {
        "model_name": "Student Dropout Early Warning Predictor",
        "model_version": model_version,
        "base_estimator": best_name,
        "calibration": "CalibratedClassifierCV(method='sigmoid')",
        "training_timestamp": timestamp,
        "dataset_metadata": data_meta,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "test_metrics": calibrated_metrics,
        "uncalibrated_test_metrics": comparison_results[best_name]["test_metrics"],
        "cv_performance": {
            "cv_mean_roc_auc": comparison_results[best_name]["cv_mean_roc_auc"],
            "cv_std_roc_auc": comparison_results[best_name]["cv_std_roc_auc"],
            "cv_mean_f1": comparison_results[best_name]["cv_mean_f1"],
            "cv_mean_recall": comparison_results[best_name]["cv_mean_recall"],
            "cv_mean_precision": comparison_results[best_name]["cv_mean_precision"],
        },
        "risk_thresholds": {
            "low_risk": "< 0.30",
            "moderate_risk": "0.30 - 0.59",
            "high_risk": ">= 0.60",
        },
        "features_used": ALL_FEATURE_COLUMNS,
    }

    metadata_path = os.path.join(MODELS_DIR, "dropout_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    logger.info("Saved model metadata to %s", metadata_path)

    # Save full evaluation comparison report
    full_report = {
        "title": "EduPredict Phase 8A - Student Dropout Model Comparison & Evaluation Report",
        "generated_at": timestamp,
        "champion_model": best_name,
        "champion_model_version": model_version,
        "dataset": data_meta,
        "candidate_comparisons": comparison_results,
        "calibrated_champion_performance": calibrated_metrics,
        "risk_tradeoffs": {
            "false_positives_implication": "False alarms may trigger benign advisory check-ins; supportive, non-punitive messaging ensures no stigma or penalty.",
            "false_negatives_implication": "Missed dropouts risk student departure without proactive academic assistance; balanced weights prioritize recall (~80%+).",
        },
    }

    report_path = os.path.join(REPORTS_DIR, "dropout_model_evaluation.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2)
    logger.info("Saved detailed evaluation report to %s", report_path)

    return full_report, calibrated_pipeline


if __name__ == "__main__":
    train_and_compare_models()
