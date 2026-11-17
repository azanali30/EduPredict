"""
EduPredict Machine Learning Training & Evaluation Engine
Module: backend.ml.train_models
Performs subject-specific, milestone-staged training, 5-fold cross-validation,
champion model selection, holdout test evaluation, and model serialization.
"""

import os
import json
import logging
import datetime
from typing import Dict, Any, List, Tuple
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split, KFold, StratifiedKFold
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
    f1_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    confusion_matrix,
    classification_report,
)
from backend.data_engineering.leakage_guard import (
    get_milestone_features,
    safe_smape,
    assert_no_leakage,
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
)
from backend.ml.pipeline_builder import (
    get_regression_models,
    get_classification_models,
    build_pipeline,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("backend.ml.train_models")

DATASET_PATH = os.path.join("data", "processed", "cleaned_academic_records.csv")
MODELS_DIR = os.path.join("ml_models", "saved_models")
REPORTS_DIR = os.path.join("ml_models", "reports")
RISK_CATEGORIES = ["High Risk", "Moderate Risk", "Low Risk / On Track"]


def evaluate_regression_fold(
    pipeline,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
) -> Dict[str, float]:
    """Fits regression pipeline on training fold and computes metrics on validation fold."""
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_val)

    mae = float(mean_absolute_error(y_val, y_pred))
    rmse = float(root_mean_squared_error(y_val, y_pred))
    r2 = float(r2_score(y_val, y_pred))
    smape_val = float(safe_smape(y_val.to_numpy(), y_pred))

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "smape": round(smape_val, 4),
    }


def evaluate_classification_fold(
    pipeline,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
) -> Dict[str, float]:
    """Fits classification pipeline on training fold and computes metrics on validation fold."""
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_val)

    macro_f1 = float(f1_score(y_val, y_pred, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_val, y_pred, average="weighted", zero_division=0))
    balanced_acc = float(balanced_accuracy_score(y_val, y_pred))
    precision_macro = float(precision_score(y_val, y_pred, average="macro", zero_division=0))
    recall_macro = float(recall_score(y_val, y_pred, average="macro", zero_division=0))

    return {
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "balanced_accuracy": round(balanced_acc, 4),
        "precision": round(precision_macro, 4),
        "recall": round(recall_macro, 4),
    }


def cross_validate_regression(
    candidate_models: Dict[str, Any],
    feature_cols: List[str],
    X_train: pd.DataFrame,
    y_train: pd.Series,
    random_state: int = 42,
) -> Dict[str, Any]:
    """Performs 5-fold cross validation across candidate regression models."""
    kf = KFold(n_splits=5, shuffle=True, random_state=random_state)
    cv_summary: Dict[str, Any] = {}

    for model_name, (model_family, estimator) in candidate_models.items():
        fold_metrics: List[Dict[str, float]] = []

        for fold_idx, (train_idx, val_idx) in enumerate(kf.split(X_train, y_train)):
            X_tr, y_tr = X_train.iloc[train_idx], y_train.iloc[train_idx]
            X_v, y_v = X_train.iloc[val_idx], y_train.iloc[val_idx]

            pipe = build_pipeline(feature_cols, estimator, model_family, target=REGRESSION_TARGET)
            metrics = evaluate_regression_fold(pipe, X_tr, y_tr, X_v, y_v)
            fold_metrics.append(metrics)

        # Aggregate across folds
        mean_mae = float(np.mean([m["mae"] for m in fold_metrics]))
        std_mae = float(np.std([m["mae"] for m in fold_metrics]))
        mean_rmse = float(np.mean([m["rmse"] for m in fold_metrics]))
        std_rmse = float(np.std([m["rmse"] for m in fold_metrics]))
        mean_r2 = float(np.mean([m["r2"] for m in fold_metrics]))
        std_r2 = float(np.std([m["r2"] for m in fold_metrics]))
        mean_smape = float(np.mean([m["smape"] for m in fold_metrics]))
        std_smape = float(np.std([m["smape"] for m in fold_metrics]))

        cv_summary[model_name] = {
            "model_family": model_family,
            "mean_mae": round(mean_mae, 4),
            "std_mae": round(std_mae, 4),
            "mean_rmse": round(mean_rmse, 4),
            "std_rmse": round(std_rmse, 4),
            "mean_r2": round(mean_r2, 4),
            "std_r2": round(std_r2, 4),
            "mean_smape": round(mean_smape, 4),
            "std_smape": round(std_smape, 4),
            "folds": fold_metrics,
        }

    return cv_summary


def cross_validate_classification(
    candidate_models: Dict[str, Any],
    feature_cols: List[str],
    X_train: pd.DataFrame,
    y_train: pd.Series,
    random_state: int = 42,
) -> Dict[str, Any]:
    """Performs 5-fold stratified cross validation across candidate classification models."""
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_state)
    cv_summary: Dict[str, Any] = {}

    for model_name, (model_family, estimator) in candidate_models.items():
        fold_metrics: List[Dict[str, float]] = []

        for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X_train, y_train)):
            X_tr, y_tr = X_train.iloc[train_idx], y_train.iloc[train_idx]
            X_v, y_v = X_train.iloc[val_idx], y_train.iloc[val_idx]

            pipe = build_pipeline(feature_cols, estimator, model_family, target=CLASSIFICATION_TARGET)
            metrics = evaluate_classification_fold(pipe, X_tr, y_tr, X_v, y_v)
            fold_metrics.append(metrics)

        # Aggregate across folds
        mean_f1 = float(np.mean([m["macro_f1"] for m in fold_metrics]))
        std_f1 = float(np.std([m["macro_f1"] for m in fold_metrics]))
        mean_wf1 = float(np.mean([m["weighted_f1"] for m in fold_metrics]))
        std_wf1 = float(np.std([m["weighted_f1"] for m in fold_metrics]))
        mean_acc = float(np.mean([m["balanced_accuracy"] for m in fold_metrics]))
        std_acc = float(np.std([m["balanced_accuracy"] for m in fold_metrics]))
        mean_prec = float(np.mean([m["precision"] for m in fold_metrics]))
        mean_rec = float(np.mean([m["recall"] for m in fold_metrics]))

        cv_summary[model_name] = {
            "model_family": model_family,
            "mean_macro_f1": round(mean_f1, 4),
            "std_macro_f1": round(std_f1, 4),
            "mean_weighted_f1": round(mean_wf1, 4),
            "std_weighted_f1": round(std_wf1, 4),
            "mean_balanced_accuracy": round(mean_acc, 4),
            "std_balanced_accuracy": round(std_acc, 4),
            "mean_precision": round(mean_prec, 4),
            "mean_recall": round(mean_rec, 4),
            "folds": fold_metrics,
        }

    return cv_summary


def train_and_evaluate_all() -> Dict[str, Any]:
    """
    Executes the full subject-specific, milestone-staged training and evaluation suite.
    Saves serialized pipelines, manifests, and evaluation reports.
    """
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Cleaned academic dataset not found at '{DATASET_PATH}'.")

    df_full = pd.read_csv(DATASET_PATH)
    logger.info(f"Loaded full dataset: {df_full.shape} observations.")

    subjects = [
        ("math", "Mathematics", 395),
        ("portuguese", "Portuguese Language", 649),
    ]

    all_cv_results: Dict[str, Any] = {}
    all_holdout_results: Dict[str, Any] = {}
    all_confusion_matrices: Dict[str, Any] = {}
    champion_manifest: Dict[str, Any] = {}

    for sub_key, sub_name, expected_count in subjects:
        df_sub = df_full[df_full["subject"] == sub_name].copy()
        assert len(df_sub) == expected_count, f"Subject count mismatch: {len(df_sub)} vs {expected_count}"
        logger.info(f"=== Initiating Machine Learning Experiments for {sub_name} ({len(df_sub)} records) ===")

        # 80/20 Stratified Train/Test Split
        # y_class is used for stratification since performance_tier and academic_status align perfectly
        y_class_full = df_sub[CLASSIFICATION_TARGET]
        train_df, test_df = train_test_split(
            df_sub,
            test_size=0.2,
            random_state=42,
            stratify=y_class_full,
        )

        logger.info(f"[{sub_name}] Split completed: {len(train_df)} training rows (80%), {len(test_df)} test rows (20%).")
        logger.info(f"[{sub_name}] Holdout test set strictly isolated from cross-validation and hyperparameter tuning.")

        all_cv_results[sub_key] = {}
        all_holdout_results[sub_key] = {}
        all_confusion_matrices[sub_key] = {}

        for milestone in [0, 1, 2]:
            milestone_tag = f"milestone_{milestone}"
            features = get_milestone_features(milestone)
            logger.info(f"[{sub_name} | M{milestone}] Feature count: {len(features)}. Running cross-validation...")

            # Feature matrices
            X_tr = train_df[features]
            y_tr_reg = train_df[REGRESSION_TARGET]
            y_tr_cls = train_df[CLASSIFICATION_TARGET]

            X_te = test_df[features]
            y_te_reg = test_df[REGRESSION_TARGET]
            y_te_cls = test_df[CLASSIFICATION_TARGET]

            # 1. Regression Candidate Evaluation (5-Fold CV on training data)
            reg_candidates = get_regression_models(random_state=42)
            cv_reg = cross_validate_regression(reg_candidates, features, X_tr, y_tr_reg, random_state=42)

            # Select Champion Regressor (lowest mean CV MAE)
            non_baseline_reg = {k: v for k, v in cv_reg.items() if "Dummy" not in k}
            champion_reg_name = min(non_baseline_reg.keys(), key=lambda k: non_baseline_reg[k]["mean_mae"])
            champion_reg_info = reg_candidates[champion_reg_name]

            # 2. Classification Candidate Evaluation (5-Fold Stratified CV on training data)
            cls_candidates = get_classification_models(random_state=42)
            cv_cls = cross_validate_classification(cls_candidates, features, X_tr, y_tr_cls, random_state=42)

            # Select Champion Classifier (highest mean CV Macro F1)
            non_baseline_cls = {k: v for k, v in cv_cls.items() if "Dummy" not in k}
            champion_cls_name = max(non_baseline_cls.keys(), key=lambda k: non_baseline_cls[k]["mean_macro_f1"])
            champion_cls_info = cls_candidates[champion_cls_name]

            all_cv_results[sub_key][milestone_tag] = {
                "milestone": milestone,
                "feature_count": len(features),
                "features": features,
                "regression": cv_reg,
                "classification": cv_cls,
                "champion_regressor": champion_reg_name,
                "champion_classifier": champion_cls_name,
            }

            logger.info(f"[{sub_name} | M{milestone}] Champion Regressor: {champion_reg_name} (CV MAE: {cv_reg[champion_reg_name]['mean_mae']})")
            logger.info(f"[{sub_name} | M{milestone}] Champion Classifier: {champion_cls_name} (CV Macro F1: {cv_cls[champion_cls_name]['mean_macro_f1']})")

            # 3. Fit Champion Pipelines on Full 80% Training Data & Evaluate on 20% Holdout Test Data
            # Regression Champion
            reg_pipe = build_pipeline(features, champion_reg_info[1], champion_reg_info[0], target=REGRESSION_TARGET)
            reg_pipe.fit(X_tr, y_tr_reg)
            y_pred_te_reg = reg_pipe.predict(X_te)

            te_mae = float(round(mean_absolute_error(y_te_reg, y_pred_te_reg), 4))
            te_rmse = float(round(root_mean_squared_error(y_te_reg, y_pred_te_reg), 4))
            te_r2 = float(round(r2_score(y_te_reg, y_pred_te_reg), 4))
            te_smape = float(round(safe_smape(y_te_reg.to_numpy(), y_pred_te_reg), 4))

            # Regression Baseline on Holdout
            dummy_reg = build_pipeline(features, reg_candidates["DummyRegressor (Mean Baseline)"][1], "baseline", target=REGRESSION_TARGET)
            dummy_reg.fit(X_tr, y_tr_reg)
            y_pred_dummy_reg = dummy_reg.predict(X_te)
            base_te_mae = float(round(mean_absolute_error(y_te_reg, y_pred_dummy_reg), 4))
            base_te_rmse = float(round(root_mean_squared_error(y_te_reg, y_pred_dummy_reg), 4))
            base_te_r2 = float(round(r2_score(y_te_reg, y_pred_dummy_reg), 4))
            base_te_smape = float(round(safe_smape(y_te_reg.to_numpy(), y_pred_dummy_reg), 4))

            # Classification Champion
            cls_pipe = build_pipeline(features, champion_cls_info[1], champion_cls_info[0], target=CLASSIFICATION_TARGET)
            cls_pipe.fit(X_tr, y_tr_cls)
            y_pred_te_cls = cls_pipe.predict(X_te)

            te_macro_f1 = float(round(f1_score(y_te_cls, y_pred_te_cls, average="macro", zero_division=0), 4))
            te_weighted_f1 = float(round(f1_score(y_te_cls, y_pred_te_cls, average="weighted", zero_division=0), 4))
            te_bal_acc = float(round(balanced_accuracy_score(y_te_cls, y_pred_te_cls), 4))
            te_precision = float(round(precision_score(y_te_cls, y_pred_te_cls, average="macro", zero_division=0), 4))
            te_recall = float(round(recall_score(y_te_cls, y_pred_te_cls, average="macro", zero_division=0), 4))
            te_cm = confusion_matrix(y_te_cls, y_pred_te_cls, labels=RISK_CATEGORIES).tolist()

            # Classification Baseline on Holdout
            dummy_cls = build_pipeline(features, cls_candidates["DummyClassifier (Prior Baseline)"][1], "baseline", target=CLASSIFICATION_TARGET)
            dummy_cls.fit(X_tr, y_tr_cls)
            y_pred_dummy_cls = dummy_cls.predict(X_te)
            base_te_macro_f1 = float(round(f1_score(y_te_cls, y_pred_dummy_cls, average="macro", zero_division=0), 4))
            base_te_weighted_f1 = float(round(f1_score(y_te_cls, y_pred_dummy_cls, average="weighted", zero_division=0), 4))
            base_te_bal_acc = float(round(balanced_accuracy_score(y_te_cls, y_pred_dummy_cls), 4))

            all_holdout_results[sub_key][milestone_tag] = {
                "regression": {
                    "champion_model": champion_reg_name,
                    "holdout_mae": te_mae,
                    "holdout_rmse": te_rmse,
                    "holdout_r2": te_r2,
                    "holdout_smape": te_smape,
                    "baseline_mae": base_te_mae,
                    "baseline_rmse": base_te_rmse,
                    "baseline_r2": base_te_r2,
                    "baseline_smape": base_te_smape,
                    "mae_reduction_pct": round(((base_te_mae - te_mae) / base_te_mae) * 100.0, 2),
                },
                "classification": {
                    "champion_model": champion_cls_name,
                    "holdout_macro_f1": te_macro_f1,
                    "holdout_weighted_f1": te_weighted_f1,
                    "holdout_balanced_accuracy": te_bal_acc,
                    "holdout_precision": te_precision,
                    "holdout_recall": te_recall,
                    "baseline_macro_f1": base_te_macro_f1,
                    "baseline_weighted_f1": base_te_weighted_f1,
                    "baseline_balanced_accuracy": base_te_bal_acc,
                    "f1_improvement_pct": round(((te_macro_f1 - base_te_macro_f1) / max(base_te_macro_f1, 1e-4)) * 100.0, 2),
                },
            }

            all_confusion_matrices[sub_key][milestone_tag] = {
                "labels": RISK_CATEGORIES,
                "matrix": te_cm,
            }

            # 4. Serialize Champion Pipelines to Disk
            reg_filename = f"{sub_key}_milestone_{milestone}_regressor.joblib"
            cls_filename = f"{sub_key}_milestone_{milestone}_classifier.joblib"

            reg_path = os.path.join(MODELS_DIR, reg_filename)
            cls_path = os.path.join(MODELS_DIR, cls_filename)

            joblib.dump(reg_pipe, reg_path)
            joblib.dump(cls_pipe, cls_path)

            # Metadata files
            reg_meta = {
                "subject": sub_name,
                "milestone": milestone,
                "task": "regression",
                "model_name": champion_reg_name,
                "model_family": champion_reg_info[0],
                "artifact_file": reg_filename,
                "target_variable": REGRESSION_TARGET,
                "feature_count": len(features),
                "features": features,
                "training_samples": len(X_tr),
                "test_samples": len(X_te),
                "cross_validation_metrics": cv_reg[champion_reg_name],
                "holdout_metrics": all_holdout_results[sub_key][milestone_tag]["regression"],
                "created_at": datetime.datetime.now().isoformat(),
            }
            with open(os.path.join(MODELS_DIR, f"{sub_key}_milestone_{milestone}_regressor_meta.json"), "w", encoding="utf-8") as f:
                json.dump(reg_meta, f, indent=2)

            cls_meta = {
                "subject": sub_name,
                "milestone": milestone,
                "task": "classification",
                "model_name": champion_cls_name,
                "model_family": champion_cls_info[0],
                "artifact_file": cls_filename,
                "target_variable": CLASSIFICATION_TARGET,
                "target_classes": RISK_CATEGORIES,
                "feature_count": len(features),
                "features": features,
                "training_samples": len(X_tr),
                "test_samples": len(X_te),
                "cross_validation_metrics": cv_cls[champion_cls_name],
                "holdout_metrics": all_holdout_results[sub_key][milestone_tag]["classification"],
                "confusion_matrix": te_cm,
                "created_at": datetime.datetime.now().isoformat(),
            }
            with open(os.path.join(MODELS_DIR, f"{sub_key}_milestone_{milestone}_classifier_meta.json"), "w", encoding="utf-8") as f:
                json.dump(cls_meta, f, indent=2)

            champion_manifest[f"{sub_key}_m{milestone}_reg"] = reg_meta
            champion_manifest[f"{sub_key}_m{milestone}_cls"] = cls_meta

    # 5. Export Master Reports
    with open(os.path.join(REPORTS_DIR, "cross_validation_results.json"), "w", encoding="utf-8") as f:
        json.dump(all_cv_results, f, indent=2)

    with open(os.path.join(REPORTS_DIR, "holdout_evaluation_results.json"), "w", encoding="utf-8") as f:
        json.dump(all_holdout_results, f, indent=2)

    with open(os.path.join(REPORTS_DIR, "confusion_matrices.json"), "w", encoding="utf-8") as f:
        json.dump(all_confusion_matrices, f, indent=2)

    with open(os.path.join(REPORTS_DIR, "champion_models_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(champion_manifest, f, indent=2)

    logger.info("=== All Machine Learning Training and Evaluation Finished Successfully ===")
    logger.info(f"Serialized models saved to '{MODELS_DIR}'.")
    logger.info(f"Evaluation reports saved to '{REPORTS_DIR}'.")

    return {
        "cross_validation": all_cv_results,
        "holdout": all_holdout_results,
        "confusion_matrices": all_confusion_matrices,
        "manifest": champion_manifest,
    }


if __name__ == "__main__":
    train_and_evaluate_all()
