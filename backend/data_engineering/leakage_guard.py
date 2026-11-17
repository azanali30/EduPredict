"""
EduPredict – Machine Learning Feature Leakage Prevention & Audit Guard
Module: backend.data_engineering.leakage_guard
Purpose: Strictly partitions model inputs and outputs, prevents G3 target leakage,
and provides group-aware train/test separation logic for Phase 5.
"""

from typing import List, Set, Dict, Any, Tuple
import pandas as pd
import numpy as np

# ==============================================================================
# 1. Target & Leakage Definitions
# ==============================================================================

REGRESSION_TARGET: str = "final_exam_marks"
REGRESSION_TARGET_RAW: str = "G3"
CLASSIFICATION_TARGET: str = "academic_status"

# Features derived directly or indirectly from final milestone outcome (G3)
TARGET_DERIVED_COLUMNS: Set[str] = {
    "G3",
    "final_exam_marks",
    "academic_status",
    "pass_status",
    "final_percentage",
}

# Identifier and administrative columns that must not be used as predictive features
METADATA_COLUMNS: Set[str] = {
    "student_code",
    "academic_year",
    "term",
}

# The 13 quasi-identifier attributes used in Cortez & Silva (2008) student-merge.R
MERGE_QUASI_IDENTIFIERS: List[str] = [
    "school",
    "sex",
    "age",
    "address",
    "famsize",
    "Pstatus",
    "Medu",
    "Fedu",
    "Mjob",
    "Fjob",
    "reason",
    "nursery",
    "internet",
]

# Demographic, family, and behavioral attributes available at term registration (Milestone 0)
BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES: List[str] = [
    "school",
    "sex",
    "age",
    "address",
    "famsize",
    "Pstatus",
    "Medu",
    "Fedu",
    "Mjob",
    "Fjob",
    "reason",
    "guardian",
    "traveltime",
    "studytime",
    "study_hours_per_week",
    "failures",
    "schoolsup",
    "famsup",
    "paid",
    "activities",
    "nursery",
    "higher",
    "internet",
    "romantic",
    "famrel",
    "freetime",
    "goout",
    "Dalc",
    "Walc",
    "health",
    "absences",
    "attendance_percentage",
    "assignment_completion_rate",
]

# Milestone 1 intermediate exam marks
MILESTONE_1_EXAM_FEATURES: List[str] = [
    "G1",
    "previous_exam_marks",
]

# Milestone 2 intermediate exam marks
MILESTONE_2_EXAM_FEATURES: List[str] = [
    "G2",
    "quiz_scores",
]

# Standardized feature definitions per milestone (excluding redundant raw G1/G2)
MILESTONE_0_FEATURES: List[str] = list(BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES)
MILESTONE_1_FEATURES: List[str] = BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES + ["previous_exam_marks"]
MILESTONE_2_FEATURES: List[str] = BASE_DEMOGRAPHIC_BEHAVIORAL_FEATURES + ["previous_exam_marks", "quiz_scores"]


def get_milestone_features(milestone: int) -> List[str]:
    """
    Returns the audited, standardized feature list for a given academic prediction milestone:
    - Milestone 0: Demographics, study habits, attendance proxy, prior failures (zero exam marks).
    - Milestone 1: Milestone 0 features + Period 1 examination marks (previous_exam_marks).
    - Milestone 2: Milestone 1 features + Period 2 continuous quiz scores (quiz_scores).
    """
    if milestone == 0:
        feats = list(MILESTONE_0_FEATURES)
    elif milestone == 1:
        feats = list(MILESTONE_1_FEATURES)
    elif milestone == 2:
        feats = list(MILESTONE_2_FEATURES)
    else:
        raise ValueError(f"Invalid milestone {milestone}. Expected 0, 1, or 2.")

    # Guard check against target leakage
    assert_no_leakage(feats, REGRESSION_TARGET)
    assert_no_leakage(feats, CLASSIFICATION_TARGET)
    return feats


# ==============================================================================
# 2. Leakage Guard Validator
# ==============================================================================

def get_forbidden_features(target: str) -> Set[str]:
    """
    Returns the set of forbidden input features for a given predictive target.
    Prevents any target-derived or metadata field from entering model training.
    """
    forbidden = set(METADATA_COLUMNS) | set(TARGET_DERIVED_COLUMNS)
    return forbidden


def validate_feature_matrix(feature_columns: List[str], target: str) -> Tuple[bool, List[str]]:
    """
    Strictly audits a feature list against target leakage.
    Returns (is_valid, list_of_violations).
    """
    forbidden = get_forbidden_features(target)
    violations = [col for col in feature_columns if col in forbidden]
    is_valid = len(violations) == 0
    return is_valid, violations


def assert_no_leakage(feature_columns: List[str], target: str) -> None:
    """
    Raises a ValueError if any forbidden or target-derived feature is present.
    """
    is_valid, violations = validate_feature_matrix(feature_columns, target)
    if not is_valid:
        raise ValueError(
            f"CRITICAL FEATURE LEAKAGE DETECTED for target '{target}'! "
            f"The following forbidden features were found in the input matrix: {violations}"
        )


# ==============================================================================
# 3. Student Identity Grouping (Estimated Demographic Profile Equivalence)
# ==============================================================================

def generate_student_group_ids(df: pd.DataFrame) -> pd.Series:
    """
    Generates deterministic demographic profile group IDs based on the 13 quasi-identifiers
    identified in Cortez & Silva (2008) and student-merge.R.

    IMPORTANT ARCHITECTURAL & METHODOLOGICAL NOTES:
    1. Quasi-Identifier Collision:
       The 13 attributes (school, sex, age, address, famsize, Pstatus, Medu, Fedu, Mjob,
       Fjob, reason, nursery, internet) partition the 1,044 enrollment records into 662
       unique demographic profile groups.
    2. NOT a Verified Physical Student Count:
       662 represents the count of distinct demographic equivalence classes, NOT a verified
       count of individual physical human students. Due to cohort demographic collisions,
       distinct physical students within the same subject can share identical vectors
       (e.g., 8 duplicate key rows across 4 unique combinations in Math, and 23 duplicate
       key rows across 11 unique combinations in Portuguese).
    3. Cross-Subject Merging Mechanics:
       When inner-merging Math and Portuguese on these 13 keys, multi-match combinations
       expand into 382 merge rows (360 1-to-1 matches, 10 matches from 5 3-record groups,
       and 12 matches from 4 4-record groups: 360 + 10 + 12 = 382).
    4. Grouping Utility for Machine Learning:
       Assigning group IDs based on these 13 keys guarantees that all records sharing the
       same demographic profile remain strictly on one side of a train/test boundary
       (e.g., via GroupShuffleSplit or GroupKFold) when evaluating pooled multi-subject models.
    5. Primary Recommended Architecture:
       To completely avoid cross-subject identity collision and demographic entanglement,
       Mathematics (N=395) and Portuguese (N=649) subject-specific models are recommended
       as the primary production architecture.
    """
    missing_cols = [col for col in MERGE_QUASI_IDENTIFIERS if col not in df.columns]
    if missing_cols:
        raise ValueError(f"DataFrame is missing required quasi-identifier columns: {missing_cols}")

    # Build composite string representation of demographic traits
    composite_key = df[MERGE_QUASI_IDENTIFIERS].astype(str).agg("_".join, axis=1)

    # Map unique demographic combinations to stable integer group IDs
    unique_keys = {key: idx + 1 for idx, key in enumerate(composite_key.unique())}
    group_series = composite_key.map(unique_keys)

    return group_series


# ==============================================================================
# 4. Regression Stratification & Safe Metrics Helpers (Phase 5 Readiness)
# ==============================================================================

def get_regression_stratification_bins(
    y: pd.Series,
    strategy: str = "performance_tier",
    n_bins: int = 5
) -> pd.Series:
    """
    Continuous targets (e.g., G3 or final_exam_marks) cannot be directly passed to
    StratifiedKFold or stratified train_test_split.

    This helper provides documented discrete bins to serve as a valid stratification proxy:
    - 'performance_tier': Bins into High Risk (<50%), Moderate Risk (50-69.9%), and Low Risk (>=70%).
    - 'quantile': Discretizes continuous target into n_bins equal-frequency quantile buckets.
    """
    if strategy == "performance_tier":
        # Aligned with EduPredict 3-tier risk definition
        bins = [-np.inf, 49.99, 69.99, np.inf]
        labels = ["High Risk (<50)", "Moderate Risk (50-69.9)", "Low Risk (>=70)"]
        return pd.cut(y, bins=bins, labels=labels)
    elif strategy == "quantile":
        # Quantile binning for balanced continuous distribution sampling
        return pd.qcut(y, q=n_bins, labels=False, duplicates="drop")
    else:
        raise ValueError(f"Unknown stratification strategy: {strategy}. Choose 'performance_tier' or 'quantile'.")


def safe_smape(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1e-8) -> float:
    """
    Computes Symmetric Mean Absolute Percentage Error (sMAPE).

    MATHEMATICAL JUSTIFICATION & DATA REALITY:
    The dataset contains 53 student records with G3 = 0 (38 in Math, 15 in Portuguese).
    Standard MAPE (Mean Absolute Percentage Error) has y_true in the denominator:
        MAPE = (100 / n) * sum(|(y_i - y_hat_i) / y_i|)
    When y_true = 0, standard MAPE produces division by zero (infinity) or extreme volatility.

    sMAPE uses the average of actual and predicted absolute values in the denominator:
        sMAPE = (100 / n) * sum(2 * |y_i - y_hat_i| / (|y_i| + |y_hat_i| + eps))
    bounded in [0%, 200%], providing a stable, mathematically safe percentage error.
    """
    y_t = np.asarray(y_true, dtype=float)
    y_p = np.asarray(y_pred, dtype=float)
    denominator = np.abs(y_t) + np.abs(y_p) + eps
    return float(np.mean(2.0 * np.abs(y_t - y_p) / denominator) * 100.0)

