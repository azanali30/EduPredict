# EduPredict — Phases 8C, 8D, and 8E Integrated System Documentation

**Milestone Scope:**
- **Phase 8C — Model Evaluation & Comparison**
- **Phase 8D — Prediction API Integration**
- **Phase 8E — Role-Based Prediction Dashboard**

**Status:** Implemented & Integrated (Preserving Phases 1–8B)

---

## 1. Phase 8C — Model Evaluation, Comparison & Registry

### 1.1 Domain Separation Policy
- **Dropout Classification** (binary risk classification) and **Course Demand Forecasting** (time-series regression) are evaluated and presented separately. Classification and regression metrics are never mixed into a single leaderboard.

### 1.2 Dropout Classification Evaluation (`GET /api/models/evaluation/dropout`)
- **Validation Status:** `benchmark_only` (`local_institutional_validation: false`). Reported metrics reflect holdout evaluation on the UCI Portuguese higher-education dataset (ID 697), **not** validated local EduPredict institutional outcomes.
- **Metrics Reported:** Accuracy, Precision, Recall, F1 Score, ROC-AUC, PR-AUC, Brier Score, Expected Calibration Error (ECE), Confusion Matrix (`tn`, `fp`, `fn`, `tp`), ROC Curve points, Precision-Recall Curve points, Calibration Reliability Curve, and Top Feature Contributions (with explicit correlation-not-causation disclaimer).
- **Access:** Authenticated `admin` and `analyst` roles (`403 Forbidden` for `teacher` and `student`).

### 1.3 Course Demand Forecasting Evaluation (`GET /api/models/evaluation/demand`)
- **Validation Methodology:** Walk-Forward Time-Series Cross-Validation, strictly scoped to the authenticated user's `organization_id` (fail-closed when missing).
- **Metrics Reported:** MAE, RMSE, MAPE, sMAPE, Forecast Bias, Directional Accuracy, and Actual vs Predicted subject-level comparison.
- **Honest Insufficient Data Reporting:** When subjects have fewer than 4 observed academic terms, walk-forward evaluation metrics return `null` with `Insufficient Data` status and an explicit `insufficient_data_notice` rather than fabricating synthetic scores.

### 1.4 Governed Model Registry (`ModelRegistryEntry` in `model_registry`)
- `GET /api/models/registry?model_type=dropout|demand` — Lists organization-scoped and shared benchmark models (`admin` and `analyst`).
- `POST /api/models/registry/<model_id>/activate` — Admin only; requires non-empty `approval_notes` (`400 Bad Request` if omitted); archives previously active models of the same `model_type` within the same organization scope.
- `POST /api/models/registry/<model_id>/deactivate` — Admin only; enforces organization isolation (`403 Forbidden` across organizations).

---

## 2. Phase 8D — Integrated Prediction APIs

### 2.1 New & Extended Dropout Prediction Endpoints (`/api/dropout/*`)
| Endpoint | Method | Roles | Rate Limit | Purpose |
|---|---|---|---|---|
| `/api/dropout/predict` | `POST` | `admin`, `teacher` | 30 / 60s | Single student dropout assessment (also appends to `dropout_prediction_history`). |
| `/api/dropout/predict/bulk` | `POST` | `admin`, `teacher` | 20 / 60s | Bulk dropout evaluation for up to 100 `student_ids` with per-student RBAC & org isolation. |
| `/api/dropout/student/<student_id>/history` | `GET` | `admin`, `teacher` (assigned), `student` (self) | — | Paginated historical dropout assessments (`403` for `analyst`). |
| `/api/dropout/prediction/<prediction_id>` | `GET` | `admin`, `teacher` (assigned), `student` (self) | — | Single prediction detail & explanations (`403` for `analyst`). |
| `/api/dropout/admin/records` | `GET` | `admin` | — | Organization-scoped, filterable (`risk_tier`, `academic_term`, `search`) paginated records. |
| `/api/dropout/analyst/trends` | `GET` | `analyst` | — | Organization-scoped, term-grouped dropout trends with Statistical Disclosure Control ($N < 5$ complementary suppression). |

### 2.2 Example Requests & Responses
```json
// POST /api/dropout/predict/bulk
{
  "student_ids": ["665f1a2b3c4d5e6f7a8b9c0d"],
  "academic_term": "2026-Fall"
}
```
```json
// POST /api/models/registry/<id>/activate
{
  "approval_notes": "Approved after UCI holdout & calibration review."
}
```

### 2.3 Security & Rate Limiting
- Implemented thread-safe sliding-window rate limiting in `backend/utils/rate_limiter.py` returning HTTP `429 Too Many Requests` when exceeded (bypassed in `TESTING` unless `ENFORCE_RATE_LIMIT_IN_TESTS=True`).
- All endpoints enforce Flask-Login authentication, server-side role decorators, and `organization_id` isolation.

---

## 3. Phase 8E — Role-Based Prediction Dashboards

- **Model Evaluation & Comparison Dashboard** (`/admin/model-evaluation`, `/analyst/model-evaluation`):
  - **Dropout Classification Tab:** Benchmark disclosure banner, Champion KPIs, Candidate Model Comparison table, ROC Curve, Precision-Recall Curve, Calibration Reliability Diagram, Confusion Matrix, and Feature Contributions.
  - **Course Demand Forecasting Tab:** Walk-forward comparison table (MAE, RMSE, MAPE, sMAPE, Bias), Actual vs Predicted chart, and honest `Insufficient Data` notice.
  - **Model Registry Tab:** Governed lifecycle view with Admin-only Activate/Deactivate controls (requiring approval notes) and read-only view for Analysts.
- **Role Dashboards:**
  - **Admin (`AdminRiskMonitoring.tsx`):** Filterable organization-wide dropout prediction records (`risk_tier`, `search`) alongside anomaly & high-risk monitoring.
  - **Teacher (`TeacherAtRisk.tsx`):** Subject-scoped at-risk triage and dropout roster integration.
  - **Student (`StudentRecommendations.tsx`):** Personal early-warning tier, disclaimer, and recent assessment history.
  - **Analyst (`AnalystRisk.tsx`):** Privacy-protected (`N < 5` suppressed) term-by-term dropout risk trends.

---

## 4. Roadmap Status Update
- **Phase 8A:** Student Dropout Prediction — Completed
- **Phase 8B:** Course Demand Forecasting — Completed
- **Phase 8C:** Model Evaluation & Comparison — Completed
- **Phase 8D:** Prediction API Integration — Completed
- **Phase 8E:** Role-Based Prediction Dashboard — Completed
- **Phase 9+:** Not started (out of scope for this milestone)
