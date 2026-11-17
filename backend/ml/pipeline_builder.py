"""
EduPredict Machine Learning Preprocessing & Pipeline Builder
Module: backend.ml.pipeline_builder
Constructs Scikit-learn ColumnTransformers and Pipelines with strict leakage guards.
"""

from typing import List, Dict, Any, Tuple
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.dummy import DummyRegressor, DummyClassifier
from sklearn.linear_model import LinearRegression, Ridge, LogisticRegression
from sklearn.ensemble import (
    RandomForestRegressor,
    RandomForestClassifier,
    HistGradientBoostingRegressor,
    HistGradientBoostingClassifier,
)
from backend.data_engineering.leakage_guard import (
    assert_no_leakage,
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
)

# Standard categorical survey attributes
CATEGORICAL_FEATURES: List[str] = [
    "school",
    "sex",
    "address",
    "famsize",
    "Pstatus",
    "Mjob",
    "Fjob",
    "reason",
    "guardian",
    "schoolsup",
    "famsup",
    "paid",
    "activities",
    "nursery",
    "higher",
    "internet",
    "romantic",
]


def partition_features(feature_cols: List[str]) -> Tuple[List[str], List[str]]:
    """Splits a list of feature column names into categorical and numerical subsets."""
    cat_cols = [c for c in feature_cols if c in CATEGORICAL_FEATURES]
    num_cols = [c for c in feature_cols if c not in CATEGORICAL_FEATURES]
    return cat_cols, num_cols


def build_preprocessor(feature_cols: List[str], model_family: str = "linear") -> ColumnTransformer:
    """
    Constructs a ColumnTransformer fitted specifically for the chosen model family:
    - 'linear': OneHotEncoder for categoricals, StandardScaler for numericals.
    - 'tree': OneHotEncoder for categoricals, unscaled numericals (identity passthrough with median imputer).
    - 'hist_gradient_boosting': OrdinalEncoder for categoricals, median imputer for numericals.
    """
    cat_cols, num_cols = partition_features(feature_cols)

    if model_family == "linear":
        cat_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ])
        num_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ])
    elif model_family == "tree":
        cat_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ])
        num_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
        ])
    elif model_family == "hist_gradient_boosting":
        cat_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
        ])
        num_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
        ])
    else:
        raise ValueError(f"Unsupported model family: '{model_family}'. Choose 'linear', 'tree', or 'hist_gradient_boosting'.")

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", cat_pipe, cat_cols),
            ("num", num_pipe, num_cols),
        ],
        remainder="drop",
    )
    return preprocessor


def get_regression_models(random_state: int = 42) -> Dict[str, Any]:
    """Returns candidate regression estimators."""
    return {
        "DummyRegressor (Mean Baseline)": (
            "baseline",
            DummyRegressor(strategy="mean"),
        ),
        "Linear Regression": (
            "linear",
            LinearRegression(),
        ),
        "Ridge Regression": (
            "linear",
            Ridge(alpha=1.0, random_state=random_state),
        ),
        "Random Forest Regressor": (
            "tree",
            RandomForestRegressor(
                n_estimators=100,
                max_depth=8,
                min_samples_leaf=2,
                random_state=random_state,
                n_jobs=1,
            ),
        ),
        "HistGradientBoosting Regressor": (
            "hist_gradient_boosting",
            HistGradientBoostingRegressor(
                max_iter=100,
                max_depth=6,
                min_samples_leaf=10,
                random_state=random_state,
            ),
        ),
    }


def get_classification_models(random_state: int = 42) -> Dict[str, Any]:
    """Returns candidate classification estimators."""
    return {
        "DummyClassifier (Prior Baseline)": (
            "baseline",
            DummyClassifier(strategy="prior"),
        ),
        "Logistic Regression": (
            "linear",
            LogisticRegression(
                max_iter=1000,
                C=1.0,
                random_state=random_state,
            ),
        ),
        "Random Forest Classifier": (
            "tree",
            RandomForestClassifier(
                n_estimators=100,
                max_depth=8,
                min_samples_leaf=2,
                class_weight="balanced",
                random_state=random_state,
                n_jobs=1,
            ),
        ),
        "HistGradientBoosting Classifier": (
            "hist_gradient_boosting",
            HistGradientBoostingClassifier(
                max_iter=100,
                max_depth=6,
                min_samples_leaf=10,
                class_weight="balanced",
                random_state=random_state,
            ),
        ),
    }


def build_pipeline(
    feature_cols: List[str],
    estimator: Any,
    model_family: str,
    target: str = REGRESSION_TARGET,
) -> Pipeline:
    """
    Constructs a complete Scikit-learn Pipeline encapsulating preprocessing and model.
    Enforces strict leakage assertions before constructing.
    """
    assert_no_leakage(feature_cols, target)

    if model_family == "baseline":
        # Baselines (DummyRegressor/Classifier) do not require feature transformation
        return Pipeline([("estimator", estimator)])

    preprocessor = build_preprocessor(feature_cols, model_family=model_family)
    return Pipeline([
        ("preprocessor", preprocessor),
        ("estimator", estimator),
    ])
