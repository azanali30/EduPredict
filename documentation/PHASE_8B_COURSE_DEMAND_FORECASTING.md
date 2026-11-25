# EduPredict — Phase 8B: Course Demand Forecasting

## 1. Architecture Overview

Phase 8B introduces an end-to-end **Course & Subject Demand Forecasting** module integrated into EduPredict's existing Flask + MongoDB 6.x + React 18/TypeScript architecture. It extracts genuine historical enrollment records from `student_subject_enrollments`, enforces strict organization/tenant isolation and role-based access control, performs leakage-free time-series forecasting with walk-forward validation, and presents interactive demand planning dashboards.

---

## 2. Course Enrollment Data Pipeline

### 2.1 Data Sources
- **`subjects` collection**: `subject_id`, `code`, `name`, `department`, `is_active`, optional `capacity`, optional `organization_id`.
- **`student_subject_enrollments` collection**: `student_id`, `subject_id`, `academic_term`, `status` (`active`, `completed`, `dropped`), `enrolled_at`.
- **`users` collection**: Student/actor `organization_id` for multi-tenant isolation.

### 2.2 Data Sufficiency Classification
The pipeline never invents synthetic historical enrollment records. Each subject series is classified transparently:
- **`insufficient`** (`< 2` historical terms): Cannot compute trend or time-series validation. Returns `0` (if 0 terms) or `LastObservationBaseline` (if 1 term) with `Low` confidence.
- **`baseline_only`** (`2–3` historical terms): Uses `MovingAverageBaseline` (2-term rolling average) with `Low` confidence.
- **`sufficient`** (`>= 4` historical terms): Executes expanding-window walk-forward validation (`experimental` for 4–5 terms; `validated` for `>= 6` terms).

---

## 3. ML Forecasting Engine & Leakage Prevention

Implemented in `backend/ml/demand_forecaster.py`:
- **Chronological Term Parsing**: `parse_academic_term_sort_key()` orders terms chronologically (e.g., `2024-2025-T1` → `2024-2025-T2` → `2024-2025-T3` → `2025-2026-T1`) and extracts seasonal cycle indices.
- **Strictly Past-Only Feature Engineering**: `build_lag_features_at_index(counts, completion_rates, seasons, idx)` constructs features strictly from indices `< idx`:
  - `lag_1` (`t-1` enrollment)
  - `lag_2` (`t-2` enrollment)
  - `rolling_mean_2`
  - `momentum` (`lag_1 - lag_2`)
  - `term_idx`
  - `season`
  - `completion_lag_1` (prior-term completion ratio)
- **Walk-Forward Validation & Baseline Comparison**:
  - Compares `NaiveLastValue`, `MovingAverage2`, and regularized `RidgeLagForecaster` (`StandardScaler` + `Ridge(alpha=1.0)`) on expanding-window splits.
  - Evaluates **MAE**, **RMSE**, **MAPE**, and **Directional Accuracy**.
  - Selects the lowest-MAE model per series and computes residual-based prediction intervals (`confidence_lower`, `confidence_upper`).

---

## 4. Database Changes (`backend/database/schema.py` & `backend/models/`)

- **`backend/models/demand_forecast_model.py`** (`DemandForecastRecord`): Stores subject metadata, `organization_id`, `forecast_period`, `periods_ahead`, `historical_series`, `predicted_enrollment`, confidence bounds, `growth_rate_pct`, `trend_direction`, `demand_tier`, `utilization_pct`, `model_used`, `validation_status`, `data_sufficiency`, `evaluation_metrics`, and planning disclaimer.
- **`backend/models/subject_model.py`**: Added optional `capacity` and `organization_id` fields (backward-compatible).
- **MongoDB Indexes**:
  - `demand_forecasts`: `idx_demand_org_period_created`, `idx_demand_subject_period`, `idx_demand_created_at`.
  - `demand_model_metadata`: `idx_demand_meta_org_created`.

---

## 5. REST API Endpoints (`backend/routes/demand_routes.py`)

| Endpoint | Method | Allowed Roles | Scope & Behavior |
| :--- | :---: | :---: | :--- |
| `/api/demand/overview` | GET | Admin, Analyst, Teacher | Organization-scoped overview; Teacher scoped strictly to active assigned subjects. |
| `/api/demand/forecast` | POST | Admin | Generates and persists forecast snapshots + metadata; ignores client-supplied `organization_id`. |
| `/api/demand/history` | GET | Admin, Analyst | Organization-scoped paginated forecast history. |
| `/api/demand/subject/<subject_id>` | GET | Admin, Analyst, Teacher | Subject-level historical trend & forecast; Teacher denied (`403`) on unassigned subjects. |
| `/api/demand/model-metadata` | GET | Admin, Analyst | Engine methodology and latest run evaluation summary. |

---

## 6. Security & Multi-Tenant Isolation

- **Unauthenticated Requests**: Rejected with `401 Unauthorized`.
- **Students**: Strictly denied (`403 Forbidden`) from institutional demand endpoints.
- **Analysts**: Read-only aggregate access with zero student PII; denied (`403`) from `POST /api/demand/forecast`.
- **Teachers**: Strictly scoped to active `teacher_subject_assignments`.
- **Organization Isolation**: Always derived server-side from `current_user.organization_id`. Student enrollments and saved forecast history are filtered strictly by organization; client-supplied `organization_id` values are ignored.

---

## 7. Known Limitations & Production Readiness Requirements

1. **Historical Depth**: Institutions with fewer than 4 historical terms per subject will receive `baseline_only` or `insufficient` forecasts; multi-term institutional enrollment history must accumulate before ML models are locally validated.
2. **External Factors**: Current enrollments do not capture external curriculum policy changes, prerequisites, or marketing campaigns.
3. **Advisory Planning Only**: Every forecast carries the disclaimer: *"Estimated enrollment demand for academic planning only — not confirmed registration."*
