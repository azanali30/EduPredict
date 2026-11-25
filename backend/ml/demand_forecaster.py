"""
EduPredict - Course Demand Forecasting Engine (Phase 8B)
Module: backend.ml.demand_forecaster
Purpose: Time-series preprocessing, chronological term parsing, lag feature engineering
with strict leakage prevention, walk-forward validation, baseline model comparison,
and uncertainty estimation for course/subject enrollment forecasting.
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

    # Extract first 4-digit year
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
    # Match YYYY-YYYY-T<N>
    m = re.match(r"^(20\d{2})-(20\d{2})-T(\d+)$", clean, re.IGNORECASE)
    if m:
        y1, y2, t = int(m.group(1)), int(m.group(2)), int(m.group(3))
        total_t = (t - 1) + steps_ahead
        year_shift = total_t // 3
        next_t = (total_t % 3) + 1
        return f"{y1 + year_shift}-{y2 + year_shift}-T{next_t}"

    # Match YYYY-T<N>
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
    """Compute standard time-series forecast error metrics (MAE, RMSE, MAPE, Directional Accuracy)."""
    if not y_true or len(y_true) != len(y_pred):
        return {"mae": None, "rmse": None, "mape": None, "directional_accuracy": None, "validation_splits": 0}

    yt = np.array(y_true, dtype=float)
    yp = np.array(y_pred, dtype=float)
    errors = np.abs(yt - yp)
    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean((yt - yp) ** 2)))

    nonzero_mask = yt > 0
    if np.any(nonzero_mask):
        mape = float(np.mean(np.abs((yt[nonzero_mask] - yp[nonzero_mask]) / yt[nonzero_mask])) * 100.0)
    else:
        mape = 0.0

    # Directional accuracy when >= 2 validation points
    dir_acc = None
    if len(yt) >= 2:
        true_diff = np.diff(yt)
        pred_diff = np.diff(yp)
        matches = np.sum(np.sign(true_diff) == np.sign(pred_diff))
        dir_acc = round(float(matches / len(true_diff)) * 100.0, 2)

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "mape": round(mape, 2),
        "directional_accuracy": dir_acc,
        "validation_splits": len(y_true),
    }


def forecast_subject_demand(
    historical_series: List[Dict[str, Any]],
    periods_ahead: int = 1,
    capacity: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Forecast future course/subject enrollment from chronological historical records.

    Handles data sufficiency honestly:
    - 0 terms: insufficient_data (predicted = 0, Low confidence)
    - 1 term: insufficient (LastObservationBaseline, Low confidence)
    - 2-3 terms: baseline_only (MovingAverageBaseline, Low confidence)
    - >= 4 terms: sufficient (Walk-forward validation comparing Naive, MovingAverage, and Ridge Regression)
    """
    periods_ahead = max(1, min(4, int(periods_ahead)))

    # Sort chronologically
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
            "confidence_level": "Low",
            "growth_rate_pct": None,
            "trend_direction": "Insufficient Data",
            "demand_tier": "Insufficient Data",
            "utilization_pct": None,
            "model_used": "InsufficientDataFallback",
            "validation_status": "insufficient_data",
            "data_sufficiency": "insufficient",
            "evaluation_metrics": {"mae": None, "rmse": None, "mape": None, "validation_splits": 0},
            "baseline_comparison": {},
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

    # Case 1: Only 1 historical term -> cannot estimate trend or ML
    if n == 1:
        pred = counts[0]
        target_label = infer_next_term_label(last_term, periods_ahead)
        util = round((pred / capacity) * 100.0, 2) if capacity and capacity > 0 else None
        return {
            "forecast_period": target_label,
            "periods_ahead": periods_ahead,
            "latest_actual_enrollment": latest_actual,
            "predicted_enrollment": round(pred, 2),
            "confidence_lower": max(0.0, round(pred * 0.75, 2)),
            "confidence_upper": round(pred * 1.25, 2),
            "confidence_level": "Low",
            "growth_rate_pct": 0.0,
            "trend_direction": "Insufficient Data",
            "demand_tier": _classify_demand_tier(pred, capacity),
            "utilization_pct": util,
            "model_used": "LastObservationBaseline",
            "validation_status": "baseline",
            "data_sufficiency": "insufficient",
            "evaluation_metrics": {"mae": None, "rmse": None, "mape": None, "validation_splits": 0},
            "baseline_comparison": {"LastObservationBaseline": {"mae": None, "note": "Single term available"}},
            "multi_step_forecasts": [
                {"period": infer_next_term_label(last_term, step), "predicted_enrollment": round(pred, 2)}
                for step in range(1, periods_ahead + 1)
            ],
        }

    # Case 2: 2-3 historical terms -> baseline moving average only
    if n <= 3:
        # Walk-forward check if n == 3
        val_metrics = {"mae": None, "rmse": None, "mape": None, "validation_splits": 0}
        if n == 3:
            ma_pred_t2 = (counts[0] + counts[1]) / 2.0
            val_metrics = compute_regression_metrics([counts[2]], [ma_pred_t2])

        # Multi-step moving average forecast
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
            "confidence_level": "Low",
            "growth_rate_pct": round(growth_pct, 2),
            "trend_direction": _classify_trend(growth_pct),
            "demand_tier": _classify_demand_tier(final_pred, capacity),
            "utilization_pct": round((final_pred / capacity) * 100.0, 2) if capacity and capacity > 0 else None,
            "model_used": "MovingAverageBaseline",
            "validation_status": "baseline",
            "data_sufficiency": "baseline_only",
            "evaluation_metrics": val_metrics,
            "baseline_comparison": {"MovingAverageBaseline": val_metrics},
            "multi_step_forecasts": step_forecasts,
        }

    # Case 3: >= 4 historical terms -> Walk-forward validation comparing Naive, MovingAverage, and Ridge Regression
    naive_true, naive_preds = [], []
    ma_true, ma_preds = [], []
    ridge_true, ridge_preds = [], []

    for t in range(2, n):
        y_actual = counts[t]
        naive_true.append(y_actual)
        naive_preds.append(counts[t - 1])

        ma_true.append(y_actual)
        ma_preds.append((counts[t - 1] + counts[t - 2]) / 2.0)

        # Train Ridge on strictly past observations [2 .. t-1] when at least 2 lag samples exist (t >= 4)
        if t >= 4:
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

    best_model = "MovingAverage2" if (ma_metrics["mae"] or 0) <= (naive_metrics["mae"] or 0) else "NaiveLastValue"
    best_metrics = comparison[best_model]
    best_preds_for_std = ma_preds if best_model == "MovingAverage2" else naive_preds
    best_true_for_std = ma_true if best_model == "MovingAverage2" else naive_true

    if ridge_true:
        ridge_metrics = compute_regression_metrics(ridge_true, ridge_preds)
        comparison["RidgeLagForecaster"] = ridge_metrics
        # Compare Ridge vs best baseline on overlapping validation splits
        if ridge_metrics["mae"] is not None and best_metrics["mae"] is not None:
            if ridge_metrics["mae"] <= best_metrics["mae"]:
                best_model = "RidgeLagForecaster"
                best_metrics = ridge_metrics
                best_preds_for_std = ridge_preds
                best_true_for_std = ridge_true

    # Fit final model on all available history and forecast `periods_ahead` recursively
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

    # Residual uncertainty interval
    residuals = [yt - yp for yt, yp in zip(best_true_for_std, best_preds_for_std)]
    res_std = float(np.std(residuals)) if residuals else max(1.0, final_pred * 0.1)
    # Widen interval slightly with horizon
    horizon_factor = math.sqrt(periods_ahead)
    margin = max(1.0, 1.28 * res_std * horizon_factor)

    growth_pct = ((final_pred - latest_actual) / latest_actual * 100.0) if latest_actual > 0 else 0.0
    confidence_level = "High" if n >= 6 and (best_metrics.get("mape") or 100) <= 15.0 else "Moderate"
    validation_status = "validated" if n >= 6 else "experimental"

    return {
        "forecast_period": step_forecasts[-1]["period"],
        "periods_ahead": periods_ahead,
        "latest_actual_enrollment": latest_actual,
        "predicted_enrollment": round(final_pred, 2),
        "confidence_lower": max(0.0, round(final_pred - margin, 2)),
        "confidence_upper": round(final_pred + margin, 2),
        "confidence_level": confidence_level,
        "growth_rate_pct": round(growth_pct, 2),
        "trend_direction": _classify_trend(growth_pct),
        "demand_tier": _classify_demand_tier(final_pred, capacity),
        "utilization_pct": round((final_pred / capacity) * 100.0, 2) if capacity and capacity > 0 else None,
        "model_used": best_model,
        "validation_status": validation_status,
        "data_sufficiency": "sufficient",
        "evaluation_metrics": best_metrics,
        "baseline_comparison": comparison,
        "multi_step_forecasts": step_forecasts,
    }


def _classify_trend(growth_pct: float) -> str:
    """Classify enrollment growth or decline direction."""
    if growth_pct >= 5.0:
        return "Growth"
    if growth_pct <= -5.0:
        return "Decline"
    return "Stable"


def _classify_demand_tier(predicted: float, capacity: Optional[int]) -> str:
    """Classify demand tier based on capacity utilization or relative enrollment volume."""
    if capacity and capacity > 0:
        util = predicted / capacity
        if util >= 0.85:
            return "High Demand"
        if util >= 0.45:
            return "Moderate Demand"
        return "Low Demand"
    if predicted >= 30:
        return "High Demand"
    if predicted >= 10:
        return "Moderate Demand"
    return "Low Demand"
