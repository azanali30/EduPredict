"""
EduPredict - Machine Learning Anomaly Detection Engine (Phase 7C)
Module: backend.ml.anomaly_detector
Purpose: Trains, evaluates, and serializes unsupervised anomaly detection models
using Isolation Forest for Mathematics and Portuguese cohorts.
Strictly excludes all target leakage, post-outcome labels, and synthetic proxies.
"""

import os
import time
import logging
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, RobustScaler
from sklearn.impute import SimpleImputer

logger = logging.getLogger("edupredict.ml.anomaly")

MODEL_VERSION = "IsolationForest_v1.0.0"
DEFAULT_CONTAMINATION = 0.05
RANDOM_STATE = 42

# Base directories
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROCESSED_DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "cleaned_academic_records.csv")
ANOMALY_MODEL_DIR = os.path.join(BASE_DIR, "ml_models", "anomaly_models")

# ==============================================================================
# 1. Feature Specifications & Leakage Guard Definitions
# ==============================================================================

# 17 Approved Categorical Attributes
APPROVED_CATEGORICAL_FEATURES: List[str] = [
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

# 13 Approved Numerical / Ordinal Attributes
APPROVED_NUMERICAL_FEATURES: List[str] = [
    "age",
    "Medu",
    "Fedu",
    "traveltime",
    "studytime",
    "failures",
    "famrel",
    "freetime",
    "goout",
    "Dalc",
    "Walc",
    "health",
    "absences",
]

# 30 Total Baseline Features (Milestone 0)
APPROVED_BASELINE_FEATURES: List[str] = APPROVED_CATEGORICAL_FEATURES + APPROVED_NUMERICAL_FEATURES

# Strict Exclusion Set: Target Leakage, Final Outcome, & Synthetic Proxies
STRICTLY_EXCLUDED_FEATURES: set[str] = {
    # Terminal Examination & Classification Targets (Direct Leakage)
    "G3",
    "final_exam_marks",
    "academic_status",
    "pass_status",
    "final_percentage",
    # Intermediate marks (excluded from Milestone 0 baseline)
    "G1",
    "G2",
    "previous_exam_marks",
    "quiz_scores",
    # Synthetic, collinear, or derived proxy fields
    "assignment_completion_rate",
    "attendance_percentage",
    "study_hours_per_week",
    "absences_cleaned",
    # Administrative identifiers and metadata
    "student_code",
    "academic_year",
    "term",
    "subject",
}


# ==============================================================================
# 2. Anomaly Model Bundle Class
# ==============================================================================

class AnomalyModelBundle:
    """
    Self-contained anomaly detection model bundle combining:
    - Preprocessing transformer (Imputation, OneHot, RobustScaler)
    - Isolation Forest estimator
    - Cohort distribution baselines for Z-score deviation explanations
    - Empirical decision score percentiles
    """

    def __init__(
        self,
        subject: str,
        pipeline: Pipeline,
        numerical_stats: Dict[str, Dict[str, float]],
        categorical_stats: Dict[str, Dict[str, float]],
        score_percentiles: Dict[float, float],
        sample_count: int,
        contamination: float = DEFAULT_CONTAMINATION,
        model_version: str = MODEL_VERSION,
    ):
        self.subject = subject
        self.pipeline = pipeline
        self.numerical_stats = numerical_stats
        self.categorical_stats = categorical_stats
        self.score_percentiles = score_percentiles
        self.sample_count = sample_count
        self.contamination = contamination
        self.model_version = model_version
        self.trained_at = datetime.now(timezone.utc).isoformat()

    def __getstate__(self) -> Dict[str, Any]:
        """Exclude transient compiled inference cache when serializing with joblib."""
        state = self.__dict__.copy()
        state.pop("_fast_scorer_cache", None)
        return state

    def _get_fast_single_scorer(self):
        """
        Build and cache an exact fast single-record decision_function evaluator.
        Avoids per-call DataFrame slicing and joblib.Parallel dispatch overhead
        while remaining numerically equivalent to self.pipeline.decision_function(df).
        Returns None cleanly so callers fall back if a non-standard pipeline is attached.
        """
        cached = getattr(self, "_fast_scorer_cache", None)
        if cached is not None and cached[0] == id(self.pipeline):
            return cached[1]

        try:
            from sklearn.ensemble._iforest import _average_path_length

            steps = getattr(self.pipeline, "named_steps", None)
            if not steps or "preprocessor" not in steps or "model" not in steps:
                return None

            pre = steps["preprocessor"]
            est = steps["model"]
            if not isinstance(pre, ColumnTransformer) or not isinstance(est, IsolationForest):
                return None

            transformers_spec = [(name, list(cols)) for name, _, cols in pre.transformers_]
            if transformers_spec != [
                ("num", APPROVED_NUMERICAL_FEATURES),
                ("cat", APPROVED_CATEGORICAL_FEATURES),
            ]:
                return None

            num_pipe = pre.named_transformers_["num"]
            cat_pipe = pre.named_transformers_["cat"]
            num_imp = num_pipe.named_steps["imputer"]
            scaler = num_pipe.named_steps["scaler"]
            cat_imp = cat_pipe.named_steps["imputer"]
            ohe = cat_pipe.named_steps["ohe"]

            if (
                getattr(num_imp, "strategy", None) != "median"
                or getattr(cat_imp, "strategy", None) != "most_frequent"
                or getattr(ohe, "handle_unknown", None) != "ignore"
                or getattr(ohe, "sparse_output", True)
                or getattr(ohe, "drop_idx_", None) is not None
            ):
                return None

            medians = np.asarray(num_imp.statistics_, dtype=np.float64)
            center = np.asarray(scaler.center_, dtype=np.float64) if scaler.with_centering else np.zeros_like(medians)
            scale = np.asarray(scaler.scale_, dtype=np.float64) if scaler.with_scaling else np.ones_like(medians)

            n_num = len(APPROVED_NUMERICAL_FEATURES)
            cat_maps: List[Dict[str, int]] = []
            offset = n_num
            for cats in ohe.categories_:
                cat_maps.append({str(c): offset + i for i, c in enumerate(cats)})
                offset += len(cats)
            n_total = offset

            if n_total != int(est.n_features_in_):
                return None

            subsample = est._max_features != est.n_features_in_
            denom = float(len(est.estimators_)) * float(_average_path_length([est._max_samples])[0])
            if_offset = float(est.offset_)
            trees = [
                (t.tree_, f if subsample else None, dpl, apl)
                for t, f, dpl, apl in zip(
                    est.estimators_,
                    est.estimators_features_,
                    est._decision_path_lengths,
                    est._average_path_length_per_tree,
                )
            ]

            def _score_row(row: Dict[str, Any]) -> float:
                vec = np.zeros((1, n_total), dtype=np.float64)
                for j, feat in enumerate(APPROVED_NUMERICAL_FEATURES):
                    fv = row[feat]
                    if np.isnan(fv):
                        fv = medians[j]
                    vec[0, j] = (fv - center[j]) / scale[j]
                for feat, cmap in zip(APPROVED_CATEGORICAL_FEATURES, cat_maps):
                    idx = cmap.get(row[feat])
                    if idx is not None:
                        vec[0, idx] = 1.0
                X32 = vec.astype(np.float32)
                depth = 0.0
                for tree_, feats, dpl, apl in trees:
                    X_in = X32 if feats is None else X32[:, feats]
                    leaf = tree_.apply(X_in)[0]
                    depth += float(dpl[leaf]) + float(apl[leaf]) - 1.0
                score_val = -(2.0 ** (-(depth / denom)) if denom != 0 else 1.0) - if_offset
                return float(score_val)

            self._fast_scorer_cache = (id(self.pipeline), _score_row)
            return _score_row
        except Exception:
            return None

    def score_single_record(self, raw_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate an individual record for anomaly detection.
        Validates features, verifies target leakage exclusion, and computes
        scores, cohort percentile rank, severity, and supporting statistical deviations.
        """
        # 1. Target Leakage Verification
        for forbidden in STRICTLY_EXCLUDED_FEATURES:
            if forbidden in raw_input:
                raise ValueError(
                    f"Target leakage violation: feature '{forbidden}' is strictly excluded "
                    f"from unsupervised anomaly detection."
                )

        # 2. Extract and format input features
        row = {}
        for feat in APPROVED_BASELINE_FEATURES:
            val = raw_input.get(feat)
            if feat in APPROVED_NUMERICAL_FEATURES:
                try:
                    row[feat] = float(val) if val is not None else np.nan
                except (ValueError, TypeError):
                    row[feat] = np.nan
            else:
                row[feat] = str(val) if val is not None else "missing"

        # 3. Model Inference
        # decision_function: lower (negative) values denote higher anomaly severity (< 0 is outlier)
        fast_scorer = self._get_fast_single_scorer()
        if fast_scorer is not None:
            raw_decision_score = fast_scorer(row)
        else:
            df_input = pd.DataFrame([row], columns=APPROVED_BASELINE_FEATURES)
            raw_decision_score = float(self.pipeline.decision_function(df_input)[0])
        is_anomaly_flag = bool(raw_decision_score < 0.0)

        # 4. Empirical Cohort Percentile Calculation
        # Map decision score against training percentiles (higher percentile = more anomalous)
        # Sort percentiles in ascending order of score (most negative score = 100th percentile)
        sorted_p = sorted(self.score_percentiles.items(), key=lambda x: x[1])
        # Find where raw_decision_score falls
        percentile = 0.0
        if raw_decision_score <= sorted_p[0][1]:
            percentile = 99.9
        elif raw_decision_score >= sorted_p[-1][1]:
            percentile = 1.0
        else:
            # Linear interpolation between adjacent percentile thresholds
            for i in range(len(sorted_p) - 1):
                p_curr, val_curr = sorted_p[i]
                p_next, val_next = sorted_p[i + 1]
                if val_curr <= raw_decision_score <= val_next:
                    ratio = (raw_decision_score - val_curr) / (val_next - val_curr + 1e-9)
                    # Invert because lower score = higher anomaly percentile
                    percentile = (100.0 - p_curr) - ratio * ((100.0 - p_curr) - (100.0 - p_next))
                    break

        percentile = float(np.clip(percentile, 0.0, 99.9))

        # 5. Operational Normalized Score [0.0, 1.0]
        # 0.0 = completely typical/median; 1.0 = most extreme outlier
        min_score = sorted_p[0][1]
        max_score = sorted_p[-1][1]
        if max_score > min_score:
            normalized_score = float(np.clip(1.0 - ((raw_decision_score - min_score) / (max_score - min_score)), 0.0, 1.0))
        else:
            normalized_score = 0.5

        # 6. Operational Severity Tiers
        if percentile >= 97.5:
            severity = "High Anomaly"
        elif percentile >= 90.0:
            severity = "Moderate Anomaly"
        else:
            severity = "Low / Typical"

        # 7. Supporting Statistical Deviations (Z-scores for continuous, rarity for categoricals)
        supporting_deviations = self._compute_supporting_deviations(row)

        return {
            "subject": self.subject,
            "model_version": self.model_version,
            "raw_decision_score": round(raw_decision_score, 4),
            "normalized_anomaly_score": round(normalized_score, 3),
            "cohort_percentile": round(percentile, 1),
            "anomaly_severity": severity,
            "is_anomaly": is_anomaly_flag,
            "supporting_deviations": supporting_deviations,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _compute_supporting_deviations(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Compute lightweight statistical context (|Z| >= 2.0 or category frequency < 5%).
        Explicitly labeled as 'Supporting Statistical Deviation', NOT causal proof.
        """
        deviations = []

        # Numerical Z-Score Deviations
        for feat in APPROVED_NUMERICAL_FEATURES:
            val = row.get(feat)
            if val is not None and not np.isnan(val) and feat in self.numerical_stats:
                stat = self.numerical_stats[feat]
                mean = stat["mean"]
                std = stat["std"]
                if std > 0:
                    z = (val - mean) / std
                    if abs(z) >= 2.0:
                        direction = "Above Cohort Mean" if z > 0 else "Below Cohort Mean"
                        deviations.append({
                            "feature": feat,
                            "student_value": round(float(val), 2),
                            "cohort_mean": round(float(mean), 2),
                            "cohort_std": round(float(std), 2),
                            "z_score": round(float(z), 2),
                            "direction": direction,
                            "deviation_type": "Numerical Z-Score (>= 2.0)",
                            "disclaimer": "Supporting Statistical Deviation only. Does not denote causality.",
                        })

        # Categorical Rarity Deviations (< 5% prevalence in cohort)
        for feat in APPROVED_CATEGORICAL_FEATURES:
            val = str(row.get(feat, ""))
            if val and feat in self.categorical_stats:
                freq = self.categorical_stats[feat].get(val, 0.0)
                if freq < 0.05 and freq > 0.0:
                    deviations.append({
                        "feature": feat,
                        "student_value": val,
                        "cohort_frequency_pct": round(float(freq * 100.0), 1),
                        "deviation_type": "Rare Categorical Attribute (< 5%)",
                        "disclaimer": "Supporting Statistical Deviation only. Does not denote causality.",
                    })

        # Sort numerical deviations by absolute Z-score descending
        deviations.sort(key=lambda d: abs(d.get("z_score", 0)), reverse=True)
        return deviations[:5]  # Top 5 most notable deviations


# ==============================================================================
# 3. Model Training & Pipeline Factory
# ==============================================================================

def build_anomaly_pipeline(contamination: float = DEFAULT_CONTAMINATION) -> Pipeline:
    """Build Scikit-learn Pipeline with Imputer, RobustScaler, OneHotEncoder, and IsolationForest."""
    num_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", RobustScaler()),
    ])

    cat_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_transformer, APPROVED_NUMERICAL_FEATURES),
            ("cat", cat_transformer, APPROVED_CATEGORICAL_FEATURES),
        ]
    )

    isolation_forest = IsolationForest(
        n_estimators=100,
        max_samples=256,
        contamination=contamination,
        random_state=RANDOM_STATE,
        n_jobs=1,  # Strict single-thread execution for i5-3360M CPU safety
    )

    return Pipeline([
        ("preprocessor", preprocessor),
        ("model", isolation_forest),
    ])


def train_subject_anomaly_model(
    df: pd.DataFrame,
    subject: str,
    contamination: float = DEFAULT_CONTAMINATION,
) -> Tuple[AnomalyModelBundle, Dict[str, Any]]:
    """
    Train an isolated anomaly detection model for a specific academic subject.
    Computes distribution statistics and empirical percentile ranks.
    """
    subj_df = df[df["subject"] == subject].copy()
    if len(subj_df) == 0:
        raise ValueError(f"No records found for subject: {subject}")

    start_time = time.perf_counter()

    # Verify absence of target leakage in training slice
    X = subj_df[APPROVED_BASELINE_FEATURES].copy()

    # Pre-compute distribution statistics for explainability
    numerical_stats = {}
    for col in APPROVED_NUMERICAL_FEATURES:
        numerical_stats[col] = {
            "mean": float(X[col].mean()),
            "std": float(X[col].std(ddof=1)),
            "median": float(X[col].median()),
            "q25": float(X[col].quantile(0.25)),
            "q75": float(X[col].quantile(0.75)),
        }

    categorical_stats = {}
    for col in APPROVED_CATEGORICAL_FEATURES:
        counts = X[col].value_counts(normalize=True).to_dict()
        categorical_stats[col] = {str(k): float(v) for k, v in counts.items()}

    # Train Isolation Forest pipeline
    pipeline = build_anomaly_pipeline(contamination=contamination)
    pipeline.fit(X)

    train_duration_sec = time.perf_counter() - start_time

    # Compute empirical decision score percentiles
    scores = pipeline.decision_function(X)
    percentiles = [0, 1, 2.5, 5, 10, 25, 50, 75, 90, 95, 97.5, 99, 100]
    percentile_dict = {p: float(np.percentile(scores, p)) for p in percentiles}

    bundle = AnomalyModelBundle(
        subject=subject,
        pipeline=pipeline,
        numerical_stats=numerical_stats,
        categorical_stats=categorical_stats,
        score_percentiles=percentile_dict,
        sample_count=len(X),
        contamination=contamination,
        model_version=MODEL_VERSION,
    )

    metrics = {
        "subject": subject,
        "sample_count": len(X),
        "train_duration_sec": round(train_duration_sec, 4),
        "mean_decision_score": round(float(np.mean(scores)), 4),
        "std_decision_score": round(float(np.std(scores)), 4),
        "min_decision_score": round(float(np.min(scores)), 4),
        "max_decision_score": round(float(np.max(scores)), 4),
        "contamination": contamination,
        "anomalies_detected_count": int(np.sum(pipeline.predict(X) == -1)),
    }

    return bundle, metrics


def train_and_serialize_all_models(
    data_path: str = PROCESSED_DATA_PATH,
    output_dir: str = ANOMALY_MODEL_DIR,
    contamination: float = DEFAULT_CONTAMINATION,
) -> Dict[str, Any]:
    """Train and serialize independent models for Mathematics and Portuguese Language."""
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Cleaned dataset not found at: {data_path}")

    os.makedirs(output_dir, exist_ok=True)
    df = pd.read_csv(data_path)

    summary = {
        "models": {},
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_version": MODEL_VERSION,
    }

    for subject, filename in [
        ("Mathematics", "math_anomaly_detector_m0.joblib"),
        ("Portuguese Language", "portuguese_anomaly_detector_m0.joblib"),
    ]:
        bundle, metrics = train_subject_anomaly_model(df, subject, contamination=contamination)
        save_path = os.path.join(output_dir, filename)
        joblib.dump(bundle, save_path, compress=3)
        summary["models"][subject] = {
            **metrics,
            "model_path": save_path,
            "artifact_size_kb": round(os.path.getsize(save_path) / 1024, 2),
        }
        logger.info(f"Serialized anomaly model for {subject} to {save_path}")

    return summary


# ==============================================================================
# 4. Experimental Comparison & Contamination Sensitivity Benchmarking
# ==============================================================================

def run_contamination_sensitivity_study(
    data_path: str = PROCESSED_DATA_PATH,
    contaminations: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """
    Evaluate candidate contamination rates across Mathematics and Portuguese datasets.
    Provides empirical comparison without manufacturing ground truth.
    """
    if contaminations is None:
        contaminations = [0.02, 0.04, 0.05, 0.08, 0.10]

    df = pd.read_csv(data_path)
    results = {}

    for subject in ["Mathematics", "Portuguese Language"]:
        subj_df = df[df["subject"] == subject][APPROVED_BASELINE_FEATURES]
        subject_results = []
        for c in contaminations:
            pipe = build_anomaly_pipeline(contamination=c)
            pipe.fit(subj_df)
            preds = pipe.predict(subj_df)
            scores = pipe.decision_function(subj_df)
            flagged = int(np.sum(preds == -1))
            subject_results.append({
                "contamination": c,
                "flagged_count": flagged,
                "flagged_pct": round(flagged / len(subj_df) * 100, 2),
                "min_score": round(float(np.min(scores)), 4),
                "max_score": round(float(np.max(scores)), 4),
                "threshold_score": round(float(np.percentile(scores, c * 100)), 4),
            })
        results[subject] = subject_results

    return results


def run_lof_comparison_study(data_path: str = PROCESSED_DATA_PATH) -> Dict[str, Any]:
    """
    Controlled comparison between Isolation Forest and Local Outlier Factor (LOF)
    on the exact same feature allowlist.
    Measures runtime latency, memory suitability, and agreement rate.
    """
    df = pd.read_csv(data_path)
    comparison = {}

    for subject in ["Mathematics", "Portuguese Language"]:
        subj_df = df[df["subject"] == subject][APPROVED_BASELINE_FEATURES].copy()

        # Shared preprocessor
        num_trans = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", RobustScaler())])
        cat_trans = Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False))])
        prep = ColumnTransformer([("num", num_trans, APPROVED_NUMERICAL_FEATURES), ("cat", cat_trans, APPROVED_CATEGORICAL_FEATURES)])
        X_trans = prep.fit_transform(subj_df)

        # 1. Isolation Forest
        t0_if = time.perf_counter()
        if_model = IsolationForest(n_estimators=100, max_samples=256, contamination=0.05, random_state=RANDOM_STATE, n_jobs=1)
        if_preds = if_model.fit_predict(X_trans)
        if_time = time.perf_counter() - t0_if
        if_flagged = np.where(if_preds == -1)[0]

        # 2. Local Outlier Factor
        t0_lof = time.perf_counter()
        lof_model = LocalOutlierFactor(n_neighbors=20, contamination=0.05, n_jobs=1)
        lof_preds = lof_model.fit_predict(X_trans)
        lof_time = time.perf_counter() - t0_lof
        lof_flagged = np.where(lof_preds == -1)[0]

        # Agreement
        overlap = len(set(if_flagged).intersection(set(lof_flagged)))
        total_unique_flagged = len(set(if_flagged).union(set(lof_flagged)))
        jaccard_agreement = round(overlap / total_unique_flagged, 3) if total_unique_flagged > 0 else 1.0

        comparison[subject] = {
            "sample_size": len(subj_df),
            "if_train_time_sec": round(if_time, 4),
            "lof_train_time_sec": round(lof_time, 4),
            "if_flagged_count": len(if_flagged),
            "lof_flagged_count": len(lof_flagged),
            "mutual_flags": overlap,
            "jaccard_agreement": jaccard_agreement,
            "findings": (
                f"Both models identified anomalous records with {jaccard_agreement * 100:.1f}% Jaccard overlap. "
                f"Isolation Forest operates with linear space/time complexity and provides clean novelty scoring "
                f"for real-time inference, whereas LOF requires storing all training coordinates for neighbor lookups."
            ),
        }

    return comparison
