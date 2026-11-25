# EduPredict — Phase 8B: Course Demand Forecasting

## 1. Architecture Overview

Phase 8B delivers a multi-tenant **Course & Subject Demand Forecasting** module built on EduPredict's Flask + MongoDB 6.x + React 18/TypeScript stack. It extracts historical term-level enrollments from `student_subject_enrollments`, enforces **fail-closed** organization isolation and role-based access control, performs leakage-free time-series forecasting with fair common-origin walk-forward comparison, and provides interactive planning dashboards.

---

## 2. Fail-Closed Organization Isolation & Security

- **Mandatory Organization Context**: Every institutional forecasting operation (`overview`, `subject`, `forecast`, `history`, `model-metadata`) validates `current_user.organization_id` via `_require_valid_org_id()`. Missing or empty `organization_id` fails closed with `403 Forbidden` and never grants cross-organization access.
- **Shared Subjects vs. Tenant Enrollments**: Canonical subjects without an `organization_id` remain available across organizations, while all enrollment aggregations are strictly filtered to students belonging to the caller's `organization_id`. Custom subjects with an `organization_id` are visible only to that organization.
- **Untrusted Client Payloads**: Any client-supplied `organization_id` in `POST /api/demand/forecast` is ignored; persisted forecasts and metadata always record `current_user.organization_id`.
- **RBAC**:
  - **Admin**: Full organization-scoped forecasting, snapshot generation, history, and metadata.
  - **Analyst**: Read-only organization-scoped aggregates, history, and metadata; zero student PII.
  - **Teacher**: Strictly scoped to actively assigned subjects within their organization.
  - **Student**: Denied (`403 Forbidden`).

---

## 3. ML Methodology, Fair Comparison & Evidence Thresholds

Implemented in `backend/ml/demand_forecaster.py`:

### 3.1 Common-Origin Walk-Forward Validation
- **Minimum Evidence Requirement**: `RidgeLagForecaster` requires `>= 7` historical terms (`MIN_RIDGE_HISTORY_TERMS = 7`), ensuring at least `3` common walk-forward validation splits (`t = 4 .. n-1`) where `NaiveLastValue`, `MovingAverage2`, and `RidgeLagForecaster` are evaluated on **identical validation origins**.
- **Exclusion Transparency**: When `< 7` historical terms exist, `RidgeLagForecaster` is explicitly excluded (and recorded in `excluded_models`) rather than compared on fewer splits than baselines.
- **Leakage Prevention**: `build_lag_features_at_index()` constructs `lag_1`, `lag_2`, `rolling_mean_2`, `momentum`, `term_idx`, `season`, and `completion_lag_1` strictly from indices `< idx`.

### 3.2 Validation Terminology
- **`insufficient_data`** (`0–1` terms): Single observation or zero fallback; cannot compute trend.
- **`baseline`** (`2–3` terms): Conservative `MovingAverageBaseline`.
- **`experimental`** (`4–6` terms): Common-origin baseline comparison (`NaiveLastValue` vs. `MovingAverage2`); ML model excluded due to insufficient history.
- **`walk_forward_evaluated`** (`>= 7` terms): All three candidate models evaluated on identical `>= 3` walk-forward splits. This is **not** institutional validation.
- **`institutionally_validated`**: Reserved strictly for externally verified institutional cohorts; never auto-assigned.

### 3.3 Heuristic Uncertainty Intervals
Prediction intervals (`confidence_lower`, `confidence_upper`) are **heuristic residual-based bands** (`interval_type: "heuristic_residual_band"`, `is_calibrated_confidence_interval: false`), scaled by `1.28 * residual_std * sqrt(horizon)`. They are explicitly **not** statistically calibrated confidence intervals.

### 3.4 Demand Classification Methodology
- When verified subject `capacity` (`> 0`) is present:
  - `High Demand`: utilization `>= 85%`
  - `Moderate Demand`: utilization `45% – 84.9%`
  - `Low Demand`: utilization `< 45%`
- When `capacity` is missing, zero, or invalid, the tier is explicitly marked **`Unclassified`** rather than inventing unsupported fixed enrollment thresholds.

### 3.5 MAPE Zero-Value Handling
- If **all** actual enrollment values in the validation window are `0`, `MAPE` is undefined and returns `None` (never `0.0`) with an explanatory `mape_note`.
- If **mixed** zero and non-zero actual values exist, `MAPE` is computed strictly over non-zero actual terms while `MAE` and `RMSE` remain computed across all splits.

---

## 4. API & Query Safety

- **Pagination Bounds**: `GET /api/demand/history` enforces `page >= 1` and `1 <= limit <= 100` (`400 Bad Request` otherwise), preventing unbounded queries.
- **Input Validation**: `periods_ahead` restricted to `1..4`; `subject_id` validated via `to_object_id`; `forecast_period` override limited to non-empty strings `<= 64` characters.
- **Batch Aggregation**: `get_demand_overview` and `generate_and_save_forecasts` batch-query `student_subject_enrollments` once per request to avoid N+1 database queries.
