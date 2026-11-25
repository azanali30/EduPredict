"""
EduPredict - Course Demand Forecasting Engine (Phase 8B)
Module: backend.ml.demand_forecaster
Purpose: Time-series preprocessing, chronological term parsing, lag feature engineering
with strict leakage prevention, fair common-origin walk-forward validation, baseline comparison,
heuristic uncertainty estimation, and capacity-based demand classification.
"""

import re
import math
import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)

# Minimum evidence thresholds
MIN_RIDGE_HISTORY_TERMS = 7       # Terms 0..3 train initial Ridge; terms 4..6 provide >= 3 common validation splits
MIN_RIDGE_VALIDATION_SPLITS = 3

# Strictly past-only feature names (no target leakage)
LAG_FEATURE_NAMES = [
    "lag_1",
    "lag_2",
    "rolling_mean_2",
    "momentum",
    "term_idx",
    "season",
    "completion_lag_1",
]


def parse_academic_term_sort_key(term_str: str) -> Tuple[int, int, str]:
    """
    Parse an academic term label into a chronological sort key (year, sub_term, raw).
    Supports formats like:
    - '2024-2025-T1', '2025-2026-T2', '2025-T3'
    - 'Fall 2024', 'Spring 2025', 'Summer 2025'
    - '2025-S1', '2025-Q2'
    """
    raw = (term_str or "").strip()
    if not raw:
        return (0, 0, "")

    year_match = re.search(r"(20\d{2}|19\d{2})", raw)
    year = int(year_match.group(1)) if year_match else 0

    lower = raw.lower()
    sub = 0
    term_num_match = re.search(r"[-_\s]?[tsq](\d+)", lower)
    if term_num_match:
        sub = int(term_num_match.group(1))
    elif "spring" in lower or "sem 1" in lower or "semester 1" in lower:
        sub = 1
    elif "summer" in lower:
        sub = 2
    elif "fall" in lower or "autumn" in lower or "sem 2" in lower or "semester 2" in lower:
        sub = 3
    elif "winter" in lower:
        sub = 4

    return (year, sub, raw)


def infer_next_term_label(last_term: Optional[str], steps_ahead: int = 1) -> str:
    """Infer a human-readable future academic term label from the latest observed term."""
    if not last_term or not isinstance(last_term, str) or not last_term.strip():
        return f"Forecast +{steps_ahead} Term"

    clean = last_term.strip()
    m = re.match(r"^(20\d{2})-(20\d{2})-T(\d+)$", clean, re.IGNORECASE)
    if m:
        y1, y2, t = int(m.group(1)), int(m.group(2)), int(m.group(3))
        total_t = (t - 1) + steps_ahead
        year_shift = total_t // 3
        next_t = (total_t % 3) + 1
        return f"{y1 + year_shift}-{y2 + year_shift}-T{next_t}"

    m2 = re.match(r"^(20\d{2})-T(\d+)$", clean, re.IGNORECASE)
    if m2:
        y1, t = int(m2.group(1)), int(m2.group(2))
        total_t = (t - 1) + steps_ahead
        year_shift = total_t // 3
        next_t = (total_t % 3) + 1
        return f"{y1 + year_shift}-T{next_t}"

    return f"{clean} (+{steps_ahead})"


def build_lag_features_at_index(
    counts: List[float],
    completion_rates: List[float],
    seasons: List[int],
    idx: int,
) -> List[float]:
    """
    Build strictly past-only features for time step `idx` (requires idx >= 2).
    Guarantees zero target leakage: never reads counts[idx] or counts[>idx].
    """
    if idx < 2:
        raise ValueError("idx must be >= 2 to compute 2-lag features without leakage.")
    lag_1 = float(counts[idx - 1])
    lag_2 = float(counts[idx - 2])
    rolling_mean_2 = (lag_1 + lag_2) / 2.0
    momentum = lag_1 - lag_2
    term_idx = float(idx)
    season = float(seasons[idx])
    comp_lag_1 = float(completion_rates[idx - 1]) if idx - 1 < len(completion_rates) else 0.0
    return [lag_1, lag_2, rolling_mean_2, momentum, term_idx, season, comp_lag_1]


def compute_regression_metrics(y_true: List[float], y_pred: List[float]) -> Dict[str, Any]:
    """
    Compute standard time-series forecast error metrics (MAE, RMSE, MAPE, Directional Accuracy).
    - If all actual values are zero, MAPE is undefined and returns None (never 0.0).
    - If mixed zeros exist, MAPE is computed strictly over non-zero actual values.
    """
    if not y_true or len(y_true) != len(y_pred):
        return {
            "mae": None,
            "rmse": None,
            "mape": None,
            "mape_note": "Insufficient validation pairs.",
            "directional_accuracy": None,
            "validation_splits": 0,
        }

    yt = np.array(y_true, dtype=float)
    yp = np.array(y_pred, dtype=float)
    errors = np.abs(yt - yp)
    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean((yt - yp) ** 2)))

    nonzero_mask = yt > 0
    if np.any(nonzero_mask):
        mape = round(
            float(np.mean(np.abs((yt[nonzero_mask] - yp[nonzero_mask]) / yt[nonzero_mask])) * 100.0),
            2,
        )
        if np.all(nonzero_mask):
            mape_note = "Computed across all validation splits."
        else:
            mape_note = "Computed over non-zero actual enrollment terms only; zero-actual terms excluded."
    else:
        mape = None
        mape_note = "Not applicable (all actual enrollment values in validation window are zero)."

    dir_acc = None
    if len(yt) >= 2:
        true_diff = np.diff(yt)
        pred_diff = np.diff(yp)
        matches = np.sum(np.sign(true_diff) == np.sign(pred_diff))
        dir_acc = round(float(matches / len(true_diff)) * 100.0, 2)

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "mape": mape,
        "mape_note": mape_note,
        "directional_accuracy": dir_acc,
        "validation_splits": len(y_true),
    }


def _classify_trend(growth_pct: float) -> str:
    """Classify enrollment growth or decline direction."""
    if growth_pct >= 5.0:
        return "Growth"
    if growth_pct <= -5.0:
        return "Decline"
    return "Stable"


def _classify_demand_tier(predicted: float, capacity: Optional[int]) -> str:
    """
    Classify course demand strictly using verified institutional capacity utilization.
    When capacity is missing, zero, or invalid, returns 'Unclassified' rather than
    inventing arbitrary fixed enrollment thresholds.
    """
    if capacity is not None:
        try:
            cap_val = int(capacity)
        except (ValueError, TypeError):
            return "Unclassified"
        if cap_val > 0:
            util = predicted / cap_val
            if util >= 0.85:
                return "High Demand"
            if util >= 0.45:
                return "Moderate Demand"
            return "Low Demand"
    return "Unclassified"


def forecast_subject_demand(
    historical_series: List[Dict[str, Any]],
    periods_ahead: int = 1,
    capacity: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Forecast future course/subject enrollment from chronological historical records.

    Validation & Sufficiency Protocol:
    - 0 terms: insufficient_data (predicted = 0, Low heuristic confidence)
    - 1 term: insufficient (LastObservationBaseline, Low heuristic confidence)
    - 2-3 terms: baseline_only (MovingAverageBaseline, Low heuristic confidence)
    - 4-6 terms: experimental (NaiveLastValue vs MovingAverage2 on common origins t=2..n-1;
                 RidgeLagForecaster excluded until >= 7 terms provide >= 3 common splits)
    - >= 7 terms: walk_forward_evaluated (NaiveLastValue, MovingAverage2, and RidgeLagForecaster
                  all evaluated on identical common validation origins t=4..n-1)
    """
    periods_ahead = max(1, min(4, int(periods_ahead)))

    sorted_series = sorted(
        historical_series,
        key=lambda row: parse_academic_term_sort_key(row.get("academic_term", "")),
    )

    n = len(sorted_series)
    if n == 0:
        return {
            "forecast_period": infer_next_term_label(None, periods_ahead),
            "periods_ahead": periods_ahead,
            "latest_actual_enrollment": None,
            "predicted_enrollment": 0.0,
            "confidence_lower": None,
            "confidence_upper": None,
            "confidence_level": "Low (Heuristic)",
            "interval_type": "unavailable",
            "is_calibrated_confidence_interval": False,
            "growth_rate_pct": None,
            "trend_direction": "Insufficient Data",
            "demand_tier": "Insufficient Data",
            "utilization_pct": None,
            "model_used": "InsufficientDataFallback",
            "validation_status": "insufficient_data",
            "data_sufficiency": "insufficient",
            "evaluation_metrics": {"mae": None, "rmse": None, "mape": None, "validation_splits": 0},
            "common_validation_window": {"start_idx": None, "end_idx": None, "split_count": 0},
            "baseline_comparison": {},
            "excluded_models": {
                "MovingAverage2": "Requires >= 2 historical terms.",
                "RidgeLagForecaster": f"Requires >= {MIN_RIDGE_HISTORY_TERMS} historical terms.",
            },
            "multi_step_forecasts": [],
        }

    counts = [float(row.get("total_count", 0)) for row in sorted_series]
    comp_rates = [
        (float(row.get("completed_count", 0)) / float(row["total_count"]))
        if row.get("total_count", 0) > 0
        else 0.0
        for row in sorted_series
    ]
    seasons = [parse_academic_term_sort_key(row.get("academic_term", ""))[1] for row in sorted_series]
    last_term = sorted_series[-1].get("academic_term", "")
    latest_actual = int(counts[-1])
    valid_cap = capacity if (capacity is not None and isinstance(capacity, (int, float)) and int(capacity) > 0) else None

    # Case 1: Only 1 historical term -> single observation baseline
    if n == 1:
        pred = counts[0]
        target_label = infer_next_term_label(last_term, periods_ahead)
        util = round((pred / int(valid_cap)) * 100.0, 2) if valid_cap else None
        return {
            "forecast_period": target_label,
            "periods_ahead": periods_ahead,
            "latest_actual_enrollment": latest_actual,
            "predicted_enrollment": round(pred, 2),
            "confidence_lower": max(0.0, round(pred * 0.75, 2)),
            "confidence_upper": round(pred * 1.25, 2),
            "confidence_level": "Low (Heuristic)",
            "interval_type": "heuristic_percentage_band",
            "is_calibrated_confidence_interval": False,
            "growth_rate_pct": 0.0,
            "trend_direction": "Insufficient Data",
            "demand_tier": _classify_demand_tier(pred, valid_cap),
            "utilization_pct": util,
            "model_used": "LastObservationBaseline",
            "validation_status": "insufficient_data",
            "data_sufficiency": "insufficient",
            "evaluation_metrics": {"mae": None, "rmse": None, "mape": None, "validation_splits": 0},
            "common_validation_window": {"start_idx": None, "end_idx": None, "split_count": 0},
            "baseline_comparison": {"LastObservationBaseline": {"mae": None, "validation_splits": 0}},
            "excluded_models": {
                "MovingAverage2": "Requires >= 2 historical terms.",
                "RidgeLagForecaster": f"Requires >= {MIN_RIDGE_HISTORY_TERMS} historical terms.",
            },
            "multi_step_forecasts": [
                {"period": infer_next_term_label(last_term, step), "predicted_enrollment": round(pred, 2)}
                for step in range(1, periods_ahead + 1)
            ],
        }

    # Case 2: 2-3 historical terms -> baseline moving average only
    if n <= 3:
        val_metrics = {"mae": None, "rmse": None, "mape": None, "validation_splits": 0}
        common_win = {"start_idx": None, "end_idx": None, "split_count": 0}
        if n == 3:
            ma_pred_t2 = (counts[0] + counts[1]) / 2.0
            val_metrics = compute_regression_metrics([counts[2]], [ma_pred_t2])
            common_win = {"start_idx": 2, "end_idx": 2, "split_count": 1}

        sim_counts = list(counts)
        step_forecasts = []
        for step in range(1, periods_ahead + 1):
            next_val = max(0.0, (sim_counts[-1] + sim_counts[-2]) / 2.0)
            sim_counts.append(next_val)
            step_forecasts.append({
                "period": infer_next_term_label(last_term, step),
                "predicted_enrollment": round(next_val, 2),
            })

        final_pred = step_forecasts[-1]["predicted_enrollment"]
        margin = max(1.0, (val_metrics["mae"] * 1.5) if val_metrics["mae"] is not None else final_pred * 0.20)
        growth_pct = ((final_pred - latest_actual) / latest_actual * 100.0) if latest_actual > 0 else 0.0

        return {
            "forecast_period": step_forecasts[-1]["period"],
            "periods_ahead": periods_ahead,
            "latest_actual_enrollment": latest_actual,
            "predicted_enrollment": round(final_pred, 2),
            "confidence_lower": max(0.0, round(final_pred - margin, 2)),
            "confidence_upper": round(final_pred + margin, 2),
            "confidence_level": "Low (Heuristic)",
            "interval_type": "heuristic_residual_band",
            "is_calibrated_confidence_interval": False,
            "growth_rate_pct": round(growth_pct, 2),
            "trend_direction": _classify_trend(growth_pct),
            "demand_tier": _classify_demand_tier(final_pred, valid_cap),
            "utilization_pct": round((final_pred / int(valid_cap)) * 100.0, 2) if valid_cap else None,
            "model_used": "MovingAverageBaseline",
            "validation_status": "baseline",
            "data_sufficiency": "baseline_only",
            "evaluation_metrics": val_metrics,
            "common_validation_window": common_win,
            "baseline_comparison": {"MovingAverageBaseline": val_metrics},
            "excluded_models": {
                "RidgeLagForecaster": f"Excluded: requires >= {MIN_RIDGE_HISTORY_TERMS} historical terms ({MIN_RIDGE_VALIDATION_SPLITS} common splits); only {n} available."
            },
            "multi_step_forecasts": step_forecasts,
        }

    # Case 3: >= 4 historical terms -> Common-Origin Walk-Forward Comparison
    ridge_eligible = n >= MIN_RIDGE_HISTORY_TERMS
    common_start_t = 4 if ridge_eligible else 2

    naive_true, naive_preds = [], []
    ma_true, ma_preds = [], []
    ridge_true, ridge_preds = [], []

    for t in range(common_start_t, n):
        y_actual = counts[t]
        naive_true.append(y_actual)
        naive_preds.append(counts[t - 1])

        ma_true.append(y_actual)
        ma_preds.append((counts[t - 1] + counts[t - 2]) / 2.0)

        if ridge_eligible:
            X_train = [
                build_lag_features_at_index(counts, comp_rates, seasons, k)
                for k in range(2, t)
            ]
            y_train = [counts[k] for k in range(2, t)]
            X_val = [build_lag_features_at_index(counts, comp_rates, seasons, t)]

            pipe = Pipeline([
                ("scaler", StandardScaler()),
                ("ridge", Ridge(alpha=1.0, random_state=42)),
            ])
            pipe.fit(X_train, y_train)
            pred_val = max(0.0, float(pipe.predict(X_val)[0]))
            ridge_true.append(y_actual)
            ridge_preds.append(pred_val)

    naive_metrics = compute_regression_metrics(naive_true, naive_preds)
    ma_metrics = compute_regression_metrics(ma_true, ma_preds)

    comparison: Dict[str, Dict[str, Any]] = {
        "NaiveLastValue": naive_metrics,
        "MovingAverage2": ma_metrics,
    }
    excluded_models: Dict[str, str] = {}

    best_model = "MovingAverage2" if (ma_metrics["mae"] or 0.0) <= (naive_metrics["mae"] or 0.0) else "NaiveLastValue"
    best_metrics = comparison[best_model]
    best_preds_for_std = ma_preds if best_model == "MovingAverage2" else naive_preds
    best_true_for_std = ma_true if best_model == "MovingAverage2" else naive_true

    if ridge_eligible and len(ridge_true) >= MIN_RIDGE_VALIDATION_SPLITS:
        ridge_metrics = compute_regression_metrics(ridge_true, ridge_preds)
        comparison["RidgeLagForecaster"] = ridge_metrics
        if ridge_metrics["mae"] is not None and best_metrics["mae"] is not None:
            if ridge_metrics["mae"] <= best_metrics["mae"]:
                best_model = "RidgeLagForecaster"
                best_metrics = ridge_metrics
                best_preds_for_std = ridge_preds
                best_true_for_std = ridge_true
    else:
        excluded_models["RidgeLagForecaster"] = (
            f"Excluded: requires >= {MIN_RIDGE_HISTORY_TERMS} historical terms "
            f"(>= {MIN_RIDGE_VALIDATION_SPLITS} common walk-forward splits); only {n} terms available."
        )

    # Fit selected model on all available history and forecast `periods_ahead` recursively
    sim_counts = list(counts)
    sim_comp = list(comp_rates)
    sim_seasons = list(seasons)
    step_forecasts = []

    final_ridge_pipe = None
    if best_model == "RidgeLagForecaster":
        X_full = [
            build_lag_features_at_index(counts, comp_rates, seasons, k)
            for k in range(2, n)
        ]
        y_full = [counts[k] for k in range(2, n)]
        final_ridge_pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("ridge", Ridge(alpha=1.0, random_state=42)),
        ])
        final_ridge_pipe.fit(X_full, y_full)

    for step in range(1, periods_ahead + 1):
        next_label = infer_next_term_label(last_term, step)
        next_season = parse_academic_term_sort_key(next_label)[1]
        sim_seasons.append(next_season)
        sim_comp.append(sim_comp[-1] if sim_comp else 0.0)
        idx_next = len(sim_counts)

        if best_model == "RidgeLagForecaster" and final_ridge_pipe is not None:
            x_next = [build_lag_features_at_index(sim_counts, sim_comp, sim_seasons, idx_next)]
            next_val = max(0.0, float(final_ridge_pipe.predict(x_next)[0]))
        elif best_model == "MovingAverage2":
            next_val = max(0.0, (sim_counts[-1] + sim_counts[-2]) / 2.0)
        else:
            next_val = max(0.0, sim_counts[-1])

        sim_counts.append(next_val)
        step_forecasts.append({
            "period": next_label,
            "predicted_enrollment": round(next_val, 2),
        })

    final_pred = step_forecasts[-1]["predicted_enrollment"]

    # Heuristic residual uncertainty interval (explicitly not a calibrated CI)
    residuals = [yt - yp for yt, yp in zip(best_true_for_std, best_preds_for_std)]
    res_std = float(np.std(residuals)) if residuals else max(1.0, final_pred * 0.1)
    horizon_factor = math.sqrt(periods_ahead)
    margin = max(1.0, 1.28 * res_std * horizon_factor)

    growth_pct = ((final_pred - latest_actual) / latest_actual * 100.0) if latest_actual > 0 else 0.0
    split_count = n - common_start_t
    confidence_level = "Moderate (Heuristic)" if (ridge_eligible and split_count >= MIN_RIDGE_VALIDATION_SPLITS) else "Low (Heuristic)"
    validation_status = "walk_forward_evaluated" if (ridge_eligible and split_count >= MIN_RIDGE_VALIDATION_SPLITS) else "experimental"

    return {
        "forecast_period": step_forecasts[-1]["period"],
        "periods_ahead": periods_ahead,
        "latest_actual_enrollment": latest_actual,
        "predicted_enrollment": round(final_pred, 2),
        "confidence_lower": max(0.0, round(final_pred - margin, 2)),
        "confidence_upper": round(final_pred + margin, 2),
        "confidence_level": confidence_level,
        "interval_type": "heuristic_residual_band",
        "is_calibrated_confidence_interval": False,
        "growth_rate_pct": round(growth_pct, 2),
        "trend_direction": _classify_trend(growth_pct),
        "demand_tier": _classify_demand_tier(final_pred, valid_cap),
        "utilization_pct": round((final_pred / int(valid_cap)) * 100.0, 2) if valid_cap else None,
        "model_used": best_model,
        "validation_status": validation_status,
        "data_sufficiency": "sufficient",
        "evaluation_metrics": best_metrics,
        "common_validation_window": {
            "start_idx": common_start_t,
            "end_idx": n - 1,
            "split_count": split_count,
        },
        "baseline_comparison": comparison,
        "excluded_models": excluded_models,
        "multi_step_forecasts": step_forecasts,
    }
