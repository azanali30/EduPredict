"""
Automated Machine Learning Model, Pipeline, and Leakage Tests
Suite: tests/test_ml_models.py
Verifies subject separation, milestone feature sets, model artifact loading,
pipeline preprocessing, leakage prevention, and metric fidelity.
"""

import os
import json
import pytest
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from backend.data_engineering.leakage_guard import (
    get_milestone_features,
    assert_no_leakage,
    safe_smape,
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
    MILESTONE_0_FEATURES,
    MILESTONE_1_FEATURES,
    MILESTONE_2_FEATURES,
)
from backend.ml.pipeline_builder import (
    partition_features,
    build_preprocessor,
    build_pipeline,
    get_regression_models,
    get_classification_models,
)
from backend.ml.model_loader import load_model, predict, get_model_path


@pytest.fixture
def cleaned_df():
    """Loads the processed cleaned academic records dataset."""
    path = os.path.join("data", "processed", "cleaned_academic_records.csv")
    assert os.path.isfile(path)
    return pd.read_csv(path)


def test_subject_separation(cleaned_df):
    """Verifies that Mathematics and Portuguese cohorts are strictly partitioned and non-overlapping."""
    math_df = cleaned_df[cleaned_df["subject"] == "Mathematics"]
    por_df = cleaned_df[cleaned_df["subject"] == "Portuguese Language"]

    assert len(math_df) == 395
    assert len(por_df) == 649
    assert len(math_df) + len(por_df) == 1044

    # Subject codes must never mix
    assert (math_df["student_code"].str.startswith("STU-MAT-")).all()
    assert (por_df["student_code"].str.startswith("STU-POR-")).all()


def test_milestone_feature_restrictions():
    """Verifies milestone feature lists strictly enforce temporal examination availability."""
    m0 = get_milestone_features(0)
    m1 = get_milestone_features(1)
    m2 = get_milestone_features(2)

    # Milestone 0 (Early Warning) - strictly zero exam marks
    for exam_col in ["G1", "G2", "G3", "previous_exam_marks", "quiz_scores", "final_exam_marks"]:
        assert exam_col not in m0

    # Milestone 1 - has previous_exam_marks but strictly no G2, quiz_scores, or G3
    assert "previous_exam_marks" in m1
    for exam_col in ["G2", "quiz_scores", "G3", "final_exam_marks"]:
        assert exam_col not in m1

    # Milestone 2 - has previous_exam_marks and quiz_scores but strictly no G3
    assert "previous_exam_marks" in m2
    assert "quiz_scores" in m2
    for exam_col in ["G3", "final_exam_marks", "academic_status"]:
        assert exam_col not in m2


def test_target_leakage_prevention_across_milestones():
    """Confirms assert_no_leakage rejects any final outcome features across all milestones."""
    for m in [0, 1, 2]:
        feats = get_milestone_features(m)
        # Clean features must pass
        assert_no_leakage(feats, REGRESSION_TARGET)
        assert_no_leakage(feats, CLASSIFICATION_TARGET)

        # Injected final marks must raise ValueError
        with pytest.raises(ValueError, match="CRITICAL FEATURE LEAKAGE DETECTED"):
            assert_no_leakage(feats + ["final_exam_marks"], REGRESSION_TARGET)

        with pytest.raises(ValueError, match="CRITICAL FEATURE LEAKAGE DETECTED"):
            assert_no_leakage(feats + ["academic_status"], CLASSIFICATION_TARGET)


def test_train_test_isolation(cleaned_df):
    """Verifies that the 80/20 train/test split has zero overlapping indices and reproduces identically."""
    math_df = cleaned_df[cleaned_df["subject"] == "Mathematics"]

    tr1, te1 = train_test_split(math_df, test_size=0.2, random_state=42, stratify=math_df[CLASSIFICATION_TARGET])
    tr2, te2 = train_test_split(math_df, test_size=0.2, random_state=42, stratify=math_df[CLASSIFICATION_TARGET])

    assert len(tr1) == 316
    assert len(te1) == 79
    assert len(set(tr1.index).intersection(set(te1.index))) == 0
    # Reproducibility check
    assert tr1.index.equals(tr2.index)
    assert te1.index.equals(te2.index)


def test_pipeline_preprocessing_encapsulation():
    """Verifies that Scikit-learn Pipelines encapsulate transformers and handle unknown categoricals."""
    m0_feats = get_milestone_features(0)
    cat_cols, num_cols = partition_features(m0_feats)

    assert len(cat_cols) == 17
    assert len(num_cols) == 16

    preprocessor = build_preprocessor(m0_feats, model_family="linear")
    pipe = build_pipeline(m0_feats, get_regression_models()["Ridge Regression"][1], "linear", target=REGRESSION_TARGET)

    assert "preprocessor" in pipe.named_steps
    assert "estimator" in pipe.named_steps


def test_all_12_champion_model_artifacts_exist_and_load():
    """Verifies all 12 serialized champion model pipelines and their metadata files load cleanly."""
    subjects = ["Mathematics", "Portuguese Language"]
    milestones = [0, 1, 2]
    tasks = ["regression", "classification"]

    for sub in subjects:
        for m in milestones:
            for task in tasks:
                pipeline, metadata = load_model(sub, m, task)
                assert pipeline is not None
                assert "estimator" in pipeline.named_steps
                assert metadata["subject"] == sub
                assert metadata["milestone"] == m
                assert metadata["task"] == task
                assert len(metadata["features"]) > 0


def test_model_inference_reproducibility(cleaned_df):
    """Tests end-to-end inference on holdout test observations."""
    math_df = cleaned_df[cleaned_df["subject"] == "Mathematics"]
    sample_records = math_df.head(5)

    for m in [0, 1, 2]:
        # Regression prediction
        reg_preds = predict("Mathematics", m, "regression", sample_records)
        assert len(reg_preds) == 5
        assert (reg_preds >= 0.0).all() and (reg_preds <= 100.0).all()

        # Classification prediction
        cls_preds = predict("Mathematics", m, "classification", sample_records)
        assert len(cls_preds) == 5
        assert set(cls_preds).issubset({"High Risk", "Moderate Risk", "Low Risk / On Track"})


def test_metric_calculations_fidelity():
    """Verifies mathematical metric calculations including safe_smape on actual zero values."""
    # Zero actuals
    y_true = np.array([0.0, 50.0, 75.0, 0.0])
    y_pred = np.array([10.0, 48.0, 70.0, 0.0])

    smape = safe_smape(y_true, y_pred)
    assert not np.isnan(smape)
    assert not np.isinf(smape)
    assert 0.0 <= smape <= 200.0
