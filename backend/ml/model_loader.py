"""
EduPredict Machine Learning Model Loader
Module: backend.ml.model_loader
Loads serialized champion pipelines and validates inference inputs.
"""

import os
import json
from typing import Dict, Any, Tuple, Optional
import joblib
import pandas as pd
from backend.data_engineering.leakage_guard import (
    assert_no_leakage,
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
)

MODELS_DIR = os.path.join("ml_models", "saved_models")
REPORTS_DIR = os.path.join("ml_models", "reports")


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
    Raises FileNotFoundError if the model has not been trained yet.
    """
    model_path, meta_path = get_model_path(subject, milestone, task)

    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"Model artifact not found at '{model_path}'. Run training first.")
    if not os.path.isfile(meta_path):
        raise FileNotFoundError(f"Metadata file not found at '{meta_path}'.")

    pipeline = joblib.load(model_path)
    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

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
