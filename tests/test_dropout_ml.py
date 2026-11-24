"""
EduPredict - Student Dropout Machine Learning & Preprocessing Unit Tests (Phase 8A)
Module: tests.test_dropout_ml
Purpose: Verify dataset loading, leakage guard, reproducible preprocessing,
model calibration, inference boundaries, and metadata completeness.
"""

import os
import json
import pytest
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from backend.ml.dropout_pipeline import (
    load_dropout_data,
    build_dropout_preprocessor,
    create_train_test_split,
    assert_no_dropout_leakage,
    ALL_FEATURE_COLUMNS,
    TARGET_COLUMN,
    DEFAULT_RAW_DATASET_PATH,
)
from backend.services.dropout_service import (
    DropoutService,
    load_cached_dropout_model,
    load_cached_dropout_metadata,
)


def test_dataset_loading_and_attributes():
    """Verify UCI dataset loads cleanly with expected shape, columns, and target distribution."""
    assert os.path.exists(DEFAULT_RAW_DATASET_PATH), f"Dataset file missing at {DEFAULT_RAW_DATASET_PATH}"
    X, y, meta = load_dropout_data(binary_target=True, exclude_enrolled=False)

    assert len(X) == 4424, f"Expected 4424 rows, got {len(X)}"
    assert len(y) == 4424
    assert meta["loaded_samples"] == 4424
    assert meta["target_distribution_raw"] == {"Graduate": 2209, "Dropout": 1421, "Enrolled": 794}
    assert meta["target_formulation"] == "Binary: 1=Dropout, 0=Non-Dropout"

    # Positive class count: Dropout = 1421
    assert int(y.sum()) == 1421
    # Check all feature columns are present
    assert len(meta["features"]) == len(ALL_FEATURE_COLUMNS)
    assert TARGET_COLUMN not in X.columns


def test_leakage_guard_rejects_forbidden_columns():
    """Leakage guard must strictly raise ValueError if target or target-derived columns are present."""
    forbidden_samples = [
        ["Target"],
        ["is_dropout"],
        ["target_class"],
        ["dropout_status"],
        ["outcome"],
        ["graduation_date"],
    ]
    for sample in forbidden_samples:
        with pytest.raises(ValueError, match="TARGET LEAKAGE DETECTED"):
            assert_no_dropout_leakage(["Admission grade", "Age at enrollment"] + sample)

    # Clean features should pass without error
    assert_no_dropout_leakage(["Admission grade", "Age at enrollment", "Curricular units 1st sem (grade)"])


def test_preprocessing_pipeline_handles_missing_and_encodes():
    """Verify ColumnTransformer imputes missing values and encodes nominal categories."""
    X, y, _ = load_dropout_data(binary_target=True)
    X_train, X_test, y_train, y_test = create_train_test_split(X, y, test_size=0.2, random_state=42)

    preprocessor = build_dropout_preprocessor()
    X_train_trans = preprocessor.fit_transform(X_train)
    assert X_train_trans.shape[0] == len(X_train)
    # Output should have all one-hot encoded categories + scaled numerics
    assert X_train_trans.shape[1] > len(ALL_FEATURE_COLUMNS)

    # Inject missing values into test set to verify imputation
    X_test_missing = X_test.copy()
    X_test_missing.iloc[0, 0] = np.nan
    X_test_missing.iloc[1, 10] = np.nan
    X_test_trans = preprocessor.transform(X_test_missing)
    assert not np.isnan(X_test_trans).any(), "Preprocessor output must have zero NaNs after imputation."


def test_stratified_split_preserves_class_proportions():
    """Stratified split must maintain identical positive class ratio in train and test sets."""
    X, y, _ = load_dropout_data(binary_target=True)
    X_train, X_test, y_train, y_test = create_train_test_split(X, y, test_size=0.2, random_state=42)

    overall_ratio = y.mean()
    train_ratio = y_train.mean()
    test_ratio = y_test.mean()

    assert abs(train_ratio - overall_ratio) < 0.005
    assert abs(test_ratio - overall_ratio) < 0.005


def test_calibrated_model_artifacts_and_inference():
    """Verify saved champion model loads, produces calibrated probabilities, and classifies risk tiers."""
    model = load_cached_dropout_model()
    assert model is not None, "Champion dropout model must be loadable."
    assert isinstance(model, Pipeline)

    metadata = load_cached_dropout_metadata()
    assert metadata is not None, "Model metadata must be available."
    assert "test_metrics" in metadata
    assert metadata["test_metrics"]["roc_auc"] >= 0.85, "Model ROC-AUC must exceed 0.85 threshold."
    assert metadata["test_metrics"]["pr_auc"] >= 0.80

    # Test inference on synthetic benign student
    benign_features = {
        "Tuition fees up to date": 1,
        "Curricular units 1st sem (approved)": 6,
        "Curricular units 1st sem (grade)": 15.0,
        "Curricular units 2nd sem (approved)": 6,
        "Curricular units 2nd sem (grade)": 15.0,
        "Admission grade": 150.0,
        "Debtor": 0,
        "Scholarship holder": 1,
    }
    benign_eval, err = DropoutService.evaluate_student_features(benign_features)
    assert err is None
    assert benign_eval is not None
    assert 0.0 <= benign_eval["risk_probability"] <= 1.0
    assert benign_eval["risk_tier"] == "Low"
    assert benign_eval["requires_human_review"] is True
    assert len(benign_eval["recommendations"]) > 0

    # Test inference on high-risk profile
    high_risk_features = {
        "Tuition fees up to date": 0,
        "Curricular units 1st sem (approved)": 0,
        "Curricular units 1st sem (grade)": 0.0,
        "Curricular units 2nd sem (approved)": 0,
        "Curricular units 2nd sem (grade)": 0.0,
        "Admission grade": 95.0,
        "Debtor": 1,
        "Scholarship holder": 0,
    }
    high_eval, err = DropoutService.evaluate_student_features(high_risk_features)
    assert err is None
    assert high_eval is not None
    assert high_eval["risk_probability"] >= 0.60
    assert high_eval["risk_tier"] == "High"
    assert any("advisor" in r.lower() or "counseling" in r.lower() for r in high_eval["recommendations"])


def test_academic_record_heuristic_mapping():
    """Verify EduPredict academic records map cleanly to UCI feature space."""
    record = {
        "attendance_percentage": 92.0,
        "study_hours_per_week": 18.0,
        "assignment_completion_rate": 85.0,
        "previous_exam_marks": 78.0,
        "quiz_average": 72.0,
    }
    features = DropoutService.map_academic_record_to_features(record)
    assert len(features) == len(ALL_FEATURE_COLUMNS)
    assert features["Admission grade"] == 156.0
    assert features["Curricular units 1st sem (approved)"] >= 5
    assert features["Tuition fees up to date"] == 1
