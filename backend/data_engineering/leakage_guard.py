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
# 3. Student Identity Grouping (Preventing Dual-Enrollment Split Leakage)
# ==============================================================================

def generate_student_group_ids(df: pd.DataFrame) -> pd.Series:
    """
    Generates a deterministic student_group_id based on the 13 demographic quasi-identifiers
    from UCI student-merge.R.

    Guarantees that the 382 students enrolled in both Math and Portuguese share the same
    student_group_id, allowing GroupShuffleSplit or GroupKFold to prevent train/test identity leakage.
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
