"""
EduPredict Machine Learning Model Loader
Module: backend.ml.model_loader
Loads serialized champion pipelines and validates inference inputs.
"""

import os
import json
from typing import Dict, Any, Tuple, Optional
import joblib
import numpy as np
import pandas as pd
from backend.data_engineering.leakage_guard import (
    assert_no_leakage,
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
    get_milestone_features,
)

MODELS_DIR = os.path.join("ml_models", "saved_models")
REPORTS_DIR = os.path.join("ml_models", "reports")

_MODEL_CACHE: Dict[str, Tuple[Any, Dict[str, Any]]] = {}


def clear_model_cache() -> None:
    """Clears in-memory model cache."""
    _MODEL_CACHE.clear()


def get_model_path(subject: str, milestone: int, task: str) -> Tuple[str, str]:
    """Returns the expected file paths for the model artifact and its metadata."""
    sub_key = subject.lower().replace(" ", "_")
    if "math" in sub_key:
        sub_prefix = "math"
    elif "port" in sub_key:
        sub_prefix = "portuguese"
    else:
        raise ValueError(f"Unknown subject '{subject}'. Expected 'Mathematics' or 'Portuguese Language'.")

    if task not in ["regression", "regressor", "classification", "classifier"]:
        raise ValueError(f"Unknown task '{task}'. Expected 'regression' or 'classification'.")

    task_suffix = "regressor" if "reg" in task else "classifier"

    model_file = f"{sub_prefix}_milestone_{milestone}_{task_suffix}.joblib"
    meta_file = f"{sub_prefix}_milestone_{milestone}_{task_suffix}_meta.json"

    model_path = os.path.join(MODELS_DIR, model_file)
    meta_path = os.path.join(MODELS_DIR, meta_file)

    return model_path, meta_path


def load_model(subject: str, milestone: int, task: str) -> Tuple[Any, Dict[str, Any]]:
    """
    Loads a serialized Scikit-learn Pipeline and its metadata.
    Uses in-memory caching to optimize request latency.
    Raises FileNotFoundError if the model has not been trained yet.
    """
    sub_canonical = "math" if "math" in subject.lower() else "portuguese"
    task_canonical = "regressor" if "reg" in task.lower() else "classifier"
    cache_key = f"{sub_canonical}_{milestone}_{task_canonical}"

    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    model_path, meta_path = get_model_path(subject, milestone, task)

    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"Model artifact not found at '{model_path}'. Run training first.")
    if not os.path.isfile(meta_path):
        raise FileNotFoundError(f"Metadata file not found at '{meta_path}'.")

    pipeline = joblib.load(model_path)
    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    _MODEL_CACHE[cache_key] = (pipeline, metadata)
    return pipeline, metadata


def predict(
    subject: str,
    milestone: int,
    task: str,
    df_features: pd.DataFrame,
) -> Any:
    """
    Executes prediction with the loaded champion model, strictly asserting
    no leakage in the input feature matrix.
    """
    pipeline, metadata = load_model(subject, milestone, task)
    expected_features = metadata["features"]
    target = REGRESSION_TARGET if "reg" in task else CLASSIFICATION_TARGET

    # Verify input contains all expected features
    missing = [f for f in expected_features if f not in df_features.columns]
    if missing:
        raise ValueError(f"Input features missing required columns for {subject} M{milestone}: {missing}")

    # Extract exact required features and assert zero leakage
    X = df_features[expected_features].copy()
    assert_no_leakage(X.columns.tolist(), target)

    return pipeline.predict(X)


def predict_student(
    subject: str,
    milestone: int,
    df_features: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Executes joint prediction (regression mark + classification risk tier + confidence)
    for a student input matrix across a specific subject and milestone.
    """
    expected_features = get_milestone_features(milestone)

    # 1. Verify input contains all expected milestone features
    missing = [f for f in expected_features if f not in df_features.columns]
    if missing:
        raise ValueError(f"Input features missing required columns for {subject} M{milestone}: {missing}")

    # 2. Extract exact required features in metadata order
    X = df_features[expected_features].copy()

    # 3. Assert zero target leakage
    assert_no_leakage(X.columns.tolist(), REGRESSION_TARGET)
    assert_no_leakage(X.columns.tolist(), CLASSIFICATION_TARGET)

    # 4. Load Regressor and predict continuous mark
    reg_pipe, reg_meta = load_model(subject, milestone, "regression")
    raw_mark = float(reg_pipe.predict(X)[0])
    predicted_marks = float(np.round(np.clip(raw_mark, 0.0, 100.0), 2))

    # 5. Load Classifier and predict risk status + probabilities
    cls_pipe, cls_meta = load_model(subject, milestone, "classification")
    predicted_status = str(cls_pipe.predict(X)[0])

    confidence_scores: Dict[str, float] = {}
    top_confidence = 1.0
    if hasattr(cls_pipe, "predict_proba"):
        probs = cls_pipe.predict_proba(X)[0]
        classes = getattr(cls_pipe, "classes_", ["High Risk", "Moderate Risk", "Low Risk / On Track"])
        for c, p in zip(classes, probs):
            confidence_scores[str(c)] = round(float(p), 4)
        top_confidence = round(float(max(probs)), 4)
    else:
        confidence_scores[predicted_status] = 1.0

    # 6. Flag uncertainty if top class confidence is low
    uncertainty_warning = top_confidence < 0.55
    uncertainty_message = None
    if uncertainty_warning:
        uncertainty_message = (
            f"Low confidence ({top_confidence * 100:.1f}%) detected for top predicted status '{predicted_status}'. "
            "Statistical separation between risk classes is narrow. We recommend awaiting verified examination "
            "results at Milestone 1 before taking remedial or intervention actions."
        )

    # 7. Milestone 0 Early Warning Advisory
    early_warning_advisory = None
    if milestone == 0:
        early_warning_advisory = {
            "title": "Early Warning Advisory (Milestone 0)",
            "notice": (
                "Academic examination marks (G1/G2) are not yet recorded for this student. "
                "Milestone 0 predictions reflect behavioral and demographic tendencies only. "
                "Empirical holdout validation demonstrates an estimated false-negative rate exceeding 60% "
                "for High Risk students at this stage. Milestone 0 should be treated as an exploratory indicator "
                "and must never serve as the sole justification for adverse academic or disciplinary decisions."
            ),
            "false_negative_rate_estimate_pct": 61.5 if "math" in subject.lower() else 75.0,
            "recommended_action": "Schedule exploratory academic counseling and record Period 1 examination marks for Milestone 1 evaluation.",
        }

    return {
        "subject": reg_meta["subject"],
        "milestone": milestone,
        "predicted_marks": predicted_marks,
        "predicted_status": predicted_status,
        "confidence_scores": confidence_scores,
        "top_confidence": top_confidence,
        "confidence_type": "Uncalibrated model confidence estimate based on tree ensemble leaf vote proportions",
        "uncertainty_warning": uncertainty_warning,
        "uncertainty_message": uncertainty_message,
        "early_warning_advisory": early_warning_advisory,
        "regressor_model": reg_meta["model_name"],
        "regressor_artifact": reg_meta["artifact_file"],
        "classifier_model": cls_meta["model_name"],
        "classifier_artifact": cls_meta["artifact_file"],
        "features_count": len(expected_features),
        "features_used": expected_features,
    }
