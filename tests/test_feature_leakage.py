"""
Automated Data Integrity and Machine Learning Feature Leakage Prevention Tests
Suite: tests/test_feature_leakage.py
Verifies feature segregation, target isolation, proxy attendance bounds,
and student identity grouping.
"""

import os
import pytest
import pandas as pd
import numpy as np
from backend.data_engineering.leakage_guard import (
    validate_feature_matrix,
    assert_no_leakage,
    generate_student_group_ids,
    get_forbidden_features,
    get_regression_stratification_bins,
    safe_smape,
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
    BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES,
    MILESTONE_1_EXAM_FEATURES,
    MILESTONE_2_EXAM_FEATURES,
    TARGET_DERIVED_COLUMNS,
    METADATA_COLUMNS,
)


@pytest.fixture
def cleaned_df():
    """Loads the processed cleaned academic records dataset."""
    path = os.path.join("data", "processed", "cleaned_academic_records.csv")
    assert os.path.isfile(path), f"Processed dataset missing at: {path}"
    return pd.read_csv(path)


def test_leakage_guard_rejects_g3_and_derived_features():
    """Confirms that assert_no_leakage halts if G3 or derived targets are in the feature list."""
    # Clean features must pass
    assert_no_leakage(BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES, REGRESSION_TARGET)

    # Injected final exam marks must fail
    leaky_features_1 = BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES + ["final_exam_marks"]
    with pytest.raises(ValueError, match="CRITICAL FEATURE LEAKAGE DETECTED"):
        assert_no_leakage(leaky_features_1, REGRESSION_TARGET)

    # Injected raw G3 must fail
    leaky_features_2 = BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES + ["G3"]
    with pytest.raises(ValueError, match="CRITICAL FEATURE LEAKAGE DETECTED"):
        assert_no_leakage(leaky_features_2, REGRESSION_TARGET)

    # Injected academic_status must fail
    leaky_features_3 = BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES + ["academic_status"]
    with pytest.raises(ValueError, match="CRITICAL FEATURE LEAKAGE DETECTED"):
        assert_no_leakage(leaky_features_3, REGRESSION_TARGET)


def test_leakage_guard_rejects_status_in_classification():
    """Confirms classifier input matrices cannot contain target risk tiers or G3 marks."""
    # Clean features must pass
    assert_no_leakage(BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES, CLASSIFICATION_TARGET)

    # Injected academic status must fail
    with pytest.raises(ValueError, match="CRITICAL FEATURE LEAKAGE DETECTED"):
        assert_no_leakage(["school", "sex", "academic_status"], CLASSIFICATION_TARGET)

    # Injected final exam marks must fail
    with pytest.raises(ValueError, match="CRITICAL FEATURE LEAKAGE DETECTED"):
        assert_no_leakage(["school", "sex", "final_exam_marks"], CLASSIFICATION_TARGET)


def test_dual_enrolled_student_grouping_count(cleaned_df):
    """
    Confirms generate_student_group_ids identifies the 662 distinct demographic groups
    from the 1,044 enrollment records based on the 13 UCI quasi-identifiers.
    """
    groups = generate_student_group_ids(cleaned_df)
    assert len(groups) == 1044, "Group series length must match total rows"
    assert groups.nunique() == 662, f"Expected 662 unique student identity groups, found {groups.nunique()}"

    # Overlapping groups breakdown
    counts = groups.value_counts()
    single_record_groups = (counts == 1).sum()
    multi_record_groups = (counts > 1).sum()

    assert single_record_groups == 293
    assert multi_record_groups == 369
    assert single_record_groups + multi_record_groups == 662


def test_attendance_percentage_proxy_bounds_and_formula(cleaned_df):
    """
    Verifies that attendance_percentage is an estimated proxy bounded [0.0, 100.0]
    and monotonically non-increasing with respect to absences.
    """
    att = cleaned_df["attendance_percentage"]
    absences = cleaned_df["absences"]

    # Bounded [0.0, 100.0]
    assert (att >= 0.0).all() and (att <= 100.0).all()

    # Zero absences yields 100%
    zero_absence_mask = absences == 0
    assert (att[zero_absence_mask] == 100.0).all()

    # Absences >= 60 yields 0%
    heavy_absence_mask = absences >= 60
    if heavy_absence_mask.any():
        assert (att[heavy_absence_mask] == 0.0).all()

    # Negative correlation with absences
    corr = cleaned_df["attendance_percentage"].corr(cleaned_df["absences"])
    assert corr < -0.99, f"Expected near-perfect negative correlation, got {corr}"


def test_study_hours_mapping_and_preservation(cleaned_df):
    """
    Confirms study_hours_per_week matches midpoint definitions
    while original categorical studytime (1-4) is preserved.
    """
    assert "studytime" in cleaned_df.columns
    assert set(cleaned_df["studytime"].unique()) == {1, 2, 3, 4}

    # Verify midpoint values
    map_expected = {1: 1.5, 2: 3.5, 3: 7.5, 4: 12.0}
    for code, hours in map_expected.items():
        subset = cleaned_df[cleaned_df["studytime"] == code]
        assert (subset["study_hours_per_week"] == hours).all()


def test_normalized_features_leakage_isolation():
    """Audits data/processed/academic_features_normalized.csv for target and predictor availability."""
    norm_path = os.path.join("data", "processed", "academic_features_normalized.csv")
    assert os.path.isfile(norm_path)
    df_norm = pd.read_csv(norm_path)

    # Verify targets are present in dataset
    assert "final_exam_marks" in df_norm.columns
    assert "academic_status" in df_norm.columns

    # Verify predictors without targets pass leakage audit
    predictor_cols = [
        col for col in df_norm.columns
        if col not in TARGET_DERIVED_COLUMNS and col not in METADATA_COLUMNS
    ]
    is_valid, violations = validate_feature_matrix(predictor_cols, REGRESSION_TARGET)
    assert is_valid is True
    assert violations == []


def test_milestone_feature_partitions():
    """Verifies Milestone 0 features do not contain intermediate exam marks (G1, G2)."""
    # Milestone 0 (Early Warning / Pre-exam)
    m0_features = BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES
    for exam_feat in MILESTONE_1_EXAM_FEATURES + MILESTONE_2_EXAM_FEATURES:
        assert exam_feat not in m0_features, f"Intermediate exam feature '{exam_feat}' leaked into Milestone 0"

    # Milestone 1 contains G1/previous_exam_marks but NOT G2 or G3
    m1_features = m0_features + MILESTONE_1_EXAM_FEATURES
    assert "G1" in m1_features
    assert "G2" not in m1_features
    assert "G3" not in m1_features

    # Milestone 2 contains G1 and G2 but NOT G3
    m2_features = m1_features + MILESTONE_2_EXAM_FEATURES
    assert "G1" in m2_features
    assert "G2" in m2_features
    assert "G3" not in m2_features


def test_dataset_identity_consistency(cleaned_df):
    """Validates that student_code prefixes are cleanly partitioned by subject."""
    math_df = cleaned_df[cleaned_df["subject"] == "Mathematics"]
    por_df = cleaned_df[cleaned_df["subject"] == "Portuguese Language"]

    assert (math_df["student_code"].str.startswith("STU-MAT-")).all()
    assert (por_df["student_code"].str.startswith("STU-POR-")).all()
    assert len(math_df) == 395
    assert len(por_df) == 649



def test_regression_stratification_binning(cleaned_df):
    """
    Verifies that get_regression_stratification_bins produces valid categorical
    bins suitable for stratified train/test split on continuous targets.
    """
    y = cleaned_df["final_exam_marks"]

    # Test performance_tier strategy
    bins_tier = get_regression_stratification_bins(y, strategy="performance_tier")
    assert len(bins_tier) == len(y)
    assert set(bins_tier.unique()) == {
        "High Risk (<50)",
        "Moderate Risk (50-69.9)",
        "Low Risk (>=70)"
    }
    # Verify counts match risk distribution (230, 520, 294)
    counts = bins_tier.value_counts()
    assert counts["High Risk (<50)"] == 230
    assert counts["Moderate Risk (50-69.9)"] == 520
    assert counts["Low Risk (>=70)"] == 294

    # Test quantile strategy
    bins_q = get_regression_stratification_bins(y, strategy="quantile", n_bins=5)
    assert len(bins_q) == len(y)
    assert bins_q.nunique() >= 4  # Quantiles discretize into 4-5 bins cleanly


def test_safe_smape_zero_handling():
    """
    Verifies that safe_smape safely computes percentage error even when
    actual values are zero (which occurs 53 times in the dataset).
    """
    # Sample with y_true = 0
    y_true = np.array([0.0, 10.0, 15.0, 0.0, 20.0])
    y_pred = np.array([2.0, 11.0, 14.0, 0.0, 18.0])

    val = safe_smape(y_true, y_pred)
    assert not np.isnan(val)
    assert not np.isinf(val)
    assert 0.0 <= val <= 200.0

    # Perfect prediction must yield 0%
    assert safe_smape(y_true, y_true) < 1e-4
