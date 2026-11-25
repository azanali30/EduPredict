"""
EduPredict - Course Demand Forecasting ML Tests (Phase 8B)
Module: tests.test_demand_ml
Purpose: Verify chronological term parsing, lag feature engineering without target leakage,
fair common-origin walk-forward validation, minimum evidence thresholds, heuristic uncertainty,
capacity-based demand classification, and MAPE zero-value edge cases.
"""

import pytest
from backend.ml.demand_forecaster import (
    parse_academic_term_sort_key,
    infer_next_term_label,
    build_lag_features_at_index,
    compute_regression_metrics,
    forecast_subject_demand,
    _classify_demand_tier,
    MIN_RIDGE_HISTORY_TERMS,
    MIN_RIDGE_VALIDATION_SPLITS,
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
    assert fc_empty["demand_tier"] == "Insufficient Data"

    fc_one = forecast_subject_demand(
        [{"academic_term": "2025-2026-T1", "total_count": 24, "completed_count": 20}],
        periods_ahead=1,
    )
    assert fc_one["data_sufficiency"] == "insufficient"
    assert fc_one["validation_status"] == "insufficient_data"
    assert fc_one["model_used"] == "LastObservationBaseline"
    assert fc_one["predicted_enrollment"] == 24.0
    assert fc_one["confidence_level"] == "Low (Heuristic)"
    assert fc_one["is_calibrated_confidence_interval"] is False

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
    assert "RidgeLagForecaster" in fc_two["excluded_models"]


def test_experimental_excludes_ridge_when_below_minimum_evidence():
    """With 4-6 terms (< 7), RidgeLagForecaster must be excluded and baselines compared on identical splits."""
    history_6 = [
        {"academic_term": f"2024-2025-T{i}", "total_count": 20 + i * 2, "completed_count": 15}
        for i in range(1, 4)
    ] + [
        {"academic_term": f"2025-2026-T{i}", "total_count": 26 + i * 2, "completed_count": 20}
        for i in range(1, 4)
    ]
    fc = forecast_subject_demand(history_6, periods_ahead=1, capacity=50)
    assert fc["validation_status"] == "experimental"
    assert fc["confidence_level"] == "Low (Heuristic)"
    assert fc["is_calibrated_confidence_interval"] is False
    assert "RidgeLagForecaster" in fc["excluded_models"]
    assert "RidgeLagForecaster" not in fc["baseline_comparison"]
    assert fc["baseline_comparison"]["NaiveLastValue"]["validation_splits"] == fc["common_validation_window"]["split_count"]
    assert fc["baseline_comparison"]["MovingAverage2"]["validation_splits"] == fc["common_validation_window"]["split_count"]


def test_fair_common_origin_walk_forward_validation_and_multi_step():
    """
    With >= 7 chronological terms, NaiveLastValue, MovingAverage2, and RidgeLagForecaster
    must ALL be evaluated on identical common validation origins (t=4..n-1) with >= 3 splits,
    labeled walk_forward_evaluated (never institutionally validated).
    """
    history_7 = [
        {"academic_term": "2024-2025-T1", "total_count": 20, "completed_count": 18},
        {"academic_term": "2024-2025-T2", "total_count": 24, "completed_count": 21},
        {"academic_term": "2024-2025-T3", "total_count": 28, "completed_count": 25},
        {"academic_term": "2025-2026-T1", "total_count": 32, "completed_count": 29},
        {"academic_term": "2025-2026-T2", "total_count": 36, "completed_count": 33},
        {"academic_term": "2025-2026-T3", "total_count": 40, "completed_count": 37},
        {"academic_term": "2026-2027-T1", "total_count": 44, "completed_count": 40},
    ]
    fc = forecast_subject_demand(history_7, periods_ahead=3, capacity=50)
    assert fc["data_sufficiency"] == "sufficient"
    assert fc["validation_status"] == "walk_forward_evaluated"
    assert fc["confidence_level"] == "Moderate (Heuristic)"
    assert fc["is_calibrated_confidence_interval"] is False
    assert fc["common_validation_window"]["start_idx"] == 4
    assert fc["common_validation_window"]["split_count"] == 3

    # All three models must have identical validation split counts
    for model_name in ("NaiveLastValue", "MovingAverage2", "RidgeLagForecaster"):
        assert model_name in fc["baseline_comparison"]
        assert fc["baseline_comparison"][model_name]["validation_splits"] == 3

    assert fc["confidence_lower"] <= fc["predicted_enrollment"] <= fc["confidence_upper"]
    assert len(fc["multi_step_forecasts"]) == 3


def test_demand_classification_missing_zero_and_invalid_capacity():
    """
    Missing, zero, negative, or invalid capacity must return 'Unclassified'
    instead of unsupported fixed enrollment thresholds.
    """
    assert _classify_demand_tier(50.0, None) == "Unclassified"
    assert _classify_demand_tier(50.0, 0) == "Unclassified"
    assert _classify_demand_tier(50.0, -10) == "Unclassified"
    assert _classify_demand_tier(50.0, "invalid") == "Unclassified"  # type: ignore[arg-type]

    # Verified capacity utilization rules
    assert _classify_demand_tier(35.0, 40) == "High Demand"      # 87.5%
    assert _classify_demand_tier(20.0, 40) == "Moderate Demand"  # 50.0%
    assert _classify_demand_tier(10.0, 40) == "Low Demand"       # 25.0%


def test_mape_all_zero_and_mixed_zero_edge_cases():
    """MAPE must return None (not 0.0) when all actuals are zero, and exclude zeros when mixed."""
    all_zero = compute_regression_metrics([0.0, 0.0, 0.0], [1.0, 2.0, 0.0])
    assert all_zero["mape"] is None
    assert "all actual enrollment values" in all_zero["mape_note"].lower()
    assert all_zero["mae"] == 1.0
    assert all_zero["rmse"] is not None

    mixed = compute_regression_metrics([0.0, 10.0, 20.0], [2.0, 12.0, 18.0])
    # Non-zero actuals: |10-12|/10 = 20%, |20-18|/20 = 10% -> mean = 15.0%
    assert mixed["mape"] == 15.0
    assert mixed["mae"] == 2.0
    assert mixed["validation_splits"] == 3
