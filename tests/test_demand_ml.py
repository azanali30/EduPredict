"""
EduPredict - Course Demand Forecasting ML Tests (Phase 8B)
Module: tests.test_demand_ml
Purpose: Verify chronological term parsing, lag feature engineering without target leakage,
data sufficiency handling, walk-forward validation, evaluation metrics, and multi-step forecasting.
"""

import pytest
from backend.ml.demand_forecaster import (
    parse_academic_term_sort_key,
    infer_next_term_label,
    build_lag_features_at_index,
    compute_regression_metrics,
    forecast_subject_demand,
)


def test_term_chronological_parsing_and_next_term_inference():
    """Academic terms must sort chronologically and infer future term labels cleanly."""
    terms = ["2025-2026-T2", "2024-2025-T1", "2025-2026-T1", "2024-2025-T3"]
    sorted_terms = sorted(terms, key=parse_academic_term_sort_key)
    assert sorted_terms == ["2024-2025-T1", "2024-2025-T3", "2025-2026-T1", "2025-2026-T2"]

    assert infer_next_term_label("2025-2026-T2", 1) == "2025-2026-T3"
    assert infer_next_term_label("2025-2026-T3", 1) == "2026-2027-T1"
    assert infer_next_term_label("2025-2026-T1", 2) == "2025-2026-T3"


def test_lag_feature_engineering_no_leakage():
    """
    Features built for step idx must depend strictly on indices < idx.
    Modifying counts[idx] or future indices must never alter the feature vector.
    """
    counts_a = [10.0, 14.0, 18.0, 22.0, 30.0]
    counts_b = [10.0, 14.0, 999.0, 888.0, 777.0]
    comp_a = [0.8, 0.85, 0.9, 0.9, 0.95]
    comp_b = [0.8, 0.85, 0.1, 0.1, 0.1]
    seasons = [1, 2, 3, 1, 2]

    feats_a = build_lag_features_at_index(counts_a, comp_a, seasons, idx=2)
    feats_b = build_lag_features_at_index(counts_b, comp_b, seasons, idx=2)
    assert feats_a == feats_b

    with pytest.raises(ValueError):
        build_lag_features_at_index(counts_a, comp_a, seasons, idx=1)


def test_insufficient_and_baseline_data_handling():
    """Verify honest handling of 0, 1, and 2-3 historical terms without inventing data."""
    fc_empty = forecast_subject_demand([], periods_ahead=1)
    assert fc_empty["data_sufficiency"] == "insufficient"
    assert fc_empty["validation_status"] == "insufficient_data"
    assert fc_empty["predicted_enrollment"] == 0.0

    fc_one = forecast_subject_demand(
        [{"academic_term": "2025-2026-T1", "total_count": 24, "completed_count": 20}],
        periods_ahead=1,
    )
    assert fc_one["data_sufficiency"] == "insufficient"
    assert fc_one["model_used"] == "LastObservationBaseline"
    assert fc_one["predicted_enrollment"] == 24.0
    assert fc_one["confidence_level"] == "Low"

    fc_two = forecast_subject_demand(
        [
            {"academic_term": "2025-2026-T1", "total_count": 20, "completed_count": 16},
            {"academic_term": "2025-2026-T2", "total_count": 30, "completed_count": 25},
        ],
        periods_ahead=1,
    )
    assert fc_two["data_sufficiency"] == "baseline_only"
    assert fc_two["validation_status"] == "baseline"
    assert fc_two["model_used"] == "MovingAverageBaseline"
    assert fc_two["predicted_enrollment"] == 25.0


def test_walk_forward_validation_and_multi_step_forecast():
    """
    With >= 6 chronological terms, walk-forward validation compares baselines vs. RidgeLagForecaster,
    computes MAE/RMSE/MAPE, generates valid confidence bounds, and produces multi-step horizons.
    """
    history = [
        {"academic_term": "2024-2025-T1", "total_count": 20, "completed_count": 18},
        {"academic_term": "2024-2025-T2", "total_count": 24, "completed_count": 21},
        {"academic_term": "2024-2025-T3", "total_count": 28, "completed_count": 25},
        {"academic_term": "2025-2026-T1", "total_count": 32, "completed_count": 29},
        {"academic_term": "2025-2026-T2", "total_count": 36, "completed_count": 33},
        {"academic_term": "2025-2026-T3", "total_count": 40, "completed_count": 37},
    ]
    fc = forecast_subject_demand(history, periods_ahead=3, capacity=50)
    assert fc["data_sufficiency"] == "sufficient"
    assert fc["validation_status"] == "validated"
    assert fc["forecast_period"] == "2026-2027-T3"
    assert fc["predicted_enrollment"] >= 0
    assert fc["confidence_lower"] <= fc["predicted_enrollment"] <= fc["confidence_upper"]
    assert fc["evaluation_metrics"]["mae"] is not None
    assert fc["evaluation_metrics"]["rmse"] is not None
    assert "NaiveLastValue" in fc["baseline_comparison"]
    assert "MovingAverage2" in fc["baseline_comparison"]
    assert "RidgeLagForecaster" in fc["baseline_comparison"]
    assert len(fc["multi_step_forecasts"]) == 3


def test_compute_regression_metrics():
    """Verify MAE, RMSE, MAPE, and directional accuracy calculations."""
    metrics = compute_regression_metrics([10.0, 20.0, 30.0], [12.0, 18.0, 33.0])
    assert metrics["mae"] == round((2.0 + 2.0 + 3.0) / 3.0, 3)
    assert metrics["validation_splits"] == 3
    assert metrics["directional_accuracy"] == 100.0
