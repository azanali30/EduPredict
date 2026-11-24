"""
EduPredict - Student Dropout Preprocessing & Feature Pipeline
Module: backend.ml.dropout_pipeline
Purpose: Reproducible data loading, preprocessing, leakage guard,
and feature transformations for the Student Dropout Early Warning System.
Dataset: UCI 'Predict Students' Dropout and Academic Success' (Valentim Real et al., 2021).
License: Creative Commons Attribution 4.0 International (CC BY 4.0).
"""

import os
import logging
from typing import Tuple, List, Optional, Dict, Any
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)

# Canonical paths
DEFAULT_RAW_DATASET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "raw",
    "dropout",
    "data.csv",
)
DEFAULT_CLEANED_DATASET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "processed",
    "dropout_cleaned.csv",
)

# Feature categorizations
NOMINAL_CATEGORICAL_FEATURES = [
    "Marital status",
    "Application mode",
    "Application order",
    "Course",
    "Previous qualification",
    "Nacionality",
    "Mother's qualification",
    "Father's qualification",
    "Mother's occupation",
    "Father's occupation",
]

BINARY_FEATURES = [
    "Daytime/evening attendance",
    "Displaced",
    "Educational special needs",
    "Debtor",
    "Tuition fees up to date",
    "Gender",
    "Scholarship holder",
    "International",
]

NUMERICAL_FEATURES = [
    "Previous qualification (grade)",
    "Admission grade",
    "Age at enrollment",
    "Curricular units 1st sem (credited)",
    "Curricular units 1st sem (enrolled)",
    "Curricular units 1st sem (evaluations)",
    "Curricular units 1st sem (approved)",
    "Curricular units 1st sem (grade)",
    "Curricular units 1st sem (without evaluations)",
    "Curricular units 2nd sem (credited)",
    "Curricular units 2nd sem (enrolled)",
    "Curricular units 2nd sem (evaluations)",
    "Curricular units 2nd sem (approved)",
    "Curricular units 2nd sem (grade)",
    "Curricular units 2nd sem (without evaluations)",
    "Unemployment rate",
    "Inflation rate",
    "GDP",
]

ALL_FEATURE_COLUMNS = (
    NOMINAL_CATEGORICAL_FEATURES + BINARY_FEATURES + NUMERICAL_FEATURES
)

TARGET_COLUMN = "Target"
FORBIDDEN_LEAKAGE_COLUMNS = {
    "target",
    "target_class",
    "is_dropout",
    "dropout_status",
    "outcome",
    "graduation_date",
    "dropout_date",
}


def sanitize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize and trim whitespace/tabs from dataset column headers."""
    df = df.copy()
    df.columns = df.columns.str.strip().str.replace("\t", "")
    return df


def assert_no_dropout_leakage(feature_names: List[str]) -> None:
    """
    Strict Leakage Guard:
    Verifies that the target variable or any future outcome/target-derived column
    is never present in the input feature matrix.
    Raises ValueError on violation.
    """
    normalized = [f.strip().lower() for f in feature_names]
    for forbidden in FORBIDDEN_LEAKAGE_COLUMNS:
        if forbidden in normalized:
            raise ValueError(
                f"TARGET LEAKAGE DETECTED: Column '{forbidden}' is forbidden in model features."
            )


def load_dropout_data(
    filepath: Optional[str] = None,
    binary_target: bool = True,
    exclude_enrolled: bool = False,
) -> Tuple[pd.DataFrame, pd.Series, Dict[str, Any]]:
    """
    Load, sanitize, and validate the UCI student dropout dataset.

    :param filepath: Path to raw CSV file. Defaults to DEFAULT_RAW_DATASET_PATH.
    :param binary_target: If True, returns binary target (1 = Dropout, 0 = Non-Dropout).
                          If False, returns multi-class string labels ('Dropout', 'Enrolled', 'Graduate').
    :param exclude_enrolled: If True and binary_target is True, filters to Dropout vs Graduate cohort only.
    :return: (X, y, metadata_dict)
    """
    path = filepath or DEFAULT_RAW_DATASET_PATH
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dropout dataset not found at {path}")

    # Detect separator (; for UCI default, , for standard CSV)
    with open(path, "r", encoding="utf-8") as f:
        first_line = f.readline()
    sep = ";" if ";" in first_line else ","

    df = pd.read_csv(path, sep=sep)
    df = sanitize_column_names(df)

    if TARGET_COLUMN not in df.columns:
        raise ValueError(f"Required target column '{TARGET_COLUMN}' not found in dataset.")

    initial_count = len(df)
    target_dist_raw = df[TARGET_COLUMN].value_counts().to_dict()

    if exclude_enrolled:
        df = df[df[TARGET_COLUMN].isin(["Dropout", "Graduate"])].copy()

    # Verify no missing values in target
    df = df.dropna(subset=[TARGET_COLUMN]).copy()

    # Extract target
    if binary_target:
        # Positive class: Dropout = 1; Negative class: Non-dropout (Graduate/Enrolled) = 0
        y = (df[TARGET_COLUMN] == "Dropout").astype(int)
    else:
        y = df[TARGET_COLUMN].copy()

    # Feature matrix
    feature_cols = [c for c in ALL_FEATURE_COLUMNS if c in df.columns]
    assert_no_dropout_leakage(feature_cols)
    X = df[feature_cols].copy()

    metadata = {
        "dataset_source": "UCI Machine Learning Repository ID 697 (Valentim Real et al., 2021)",
        "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        "initial_samples": initial_count,
        "loaded_samples": len(df),
        "target_distribution_raw": target_dist_raw,
        "target_formulation": "Binary: 1=Dropout, 0=Non-Dropout" if binary_target else "Multiclass",
        "exclude_enrolled": exclude_enrolled,
        "feature_count": len(feature_cols),
        "features": feature_cols,
    }

    return X, y, metadata


def build_dropout_preprocessor() -> ColumnTransformer:
    """
    Construct a scikit-learn ColumnTransformer preprocessor:
    - Numerical: median imputation + standard scaling
    - Categorical: most frequent imputation + one-hot encoding (ignore unknown)
    - Binary: most frequent imputation + passthrough (or standard scaling)
    """
    numerical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
            ),
        ]
    )

    binary_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numerical_transformer, NUMERICAL_FEATURES),
            ("cat", categorical_transformer, NOMINAL_CATEGORICAL_FEATURES),
            ("bin", binary_transformer, BINARY_FEATURES),
        ],
        remainder="drop",
    )

    return preprocessor


def create_train_test_split(
    X: pd.DataFrame,
    y: pd.Series,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """
    Perform a reproducible, stratified train/test split.
    Guarantees equal class proportions across training and evaluation sets.
    """
    return train_test_split(
        X,
        y,
        test_size=test_size,
        stratify=y,
        random_state=random_state,
    )
