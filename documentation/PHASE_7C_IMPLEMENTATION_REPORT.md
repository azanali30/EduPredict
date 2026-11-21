# EduPredict — Phase 7C Implementation Report
## Academic Anomaly Detection & Human-Reviewed Monitoring

**Implementation Date:** November 21, 2026  
**Target Branch:** `main` (`origin/main`)  
**Lead Engineer:** Senior Full-Stack Engineer, ML Architect & Security Auditor  
**Scope:** Phase 7C Only (Unsupervised Academic Anomaly Detection & Human Monitoring)

---

## 1. Executive Summary

Phase 7C establishes an unsupervised academic anomaly detection and pedagogical triage system for EduPredict. It utilizes separate Isolation Forest estimators for Mathematics and Portuguese Language cohorts, strictly excluding target leakage and synthetic collinear proxies. Anomaly scores are presented as uncalibrated density divergence metrics alongside empirical cohort percentile ranks and supporting univariate statistical deviations ($|Z| \ge 2.0$ and categorical rarity $< 5\%$).

A dedicated MongoDB collection (`anomaly_records`) stores detected anomalies with compound uniqueness indexes to ensure idempotent evaluation. A human review workflow (`Pending Review`, `Confirmed Anomaly`, `Dismissed (Benign)`) enables authorized faculty and administrators to contextualize anomalies without automated disciplinary or status penalties. Strict role-based access control (RBAC) ensures:
- **Administrators**: Complete institution-wide monitoring and triage authority.
- **Teachers**: Scoped strictly to assigned subjects via `can_access_student_subject_data()`.
- **Students**: Denied all access ($403\text{ Forbidden}$).
- **Educational Analysts**: Aggregate telemetry only with mandatory $N < 5$ cell suppression and complementary suppression.

All 191 backend unit and integration tests, 25 frontend Vitest tests, TypeScript compilation, and production Vite builds pass with zero regressions.

---

## 2. Dataset Audit & Feature Selection

### 2.1 Actual Dataset Statistics
- **Source Datasets**: Portuguese Secondary Education Datasets (`student-mat.csv` and `student-por.csv`).
- **Mathematics Cohort**: 395 records, 33 raw attributes.
- **Portuguese Language Cohort**: 649 records, 33 raw attributes.
- **Missing Values**: 0 missing values in raw CSVs; numerical imputer (`median`) and categorical imputer (`most_frequent`) are embedded in preprocessing pipelines to ensure resilience against runtime malformed inputs.

### 2.2 Feature Allowlist (30 Baseline Features for Milestone 0)
To avoid target leakage and synthetic proxy bias, a strict 30-feature allowlist is enforced:

| Numerical Features (13) | Categorical Features (17) |
| :--- | :--- |
| `age` | `school` |
| `Medu` (Mother's education) | `sex` |
| `Fedu` (Father's education) | `address` |
| `traveltime` | `famsize` |
| `studytime` | `Pstatus` |
| `failures` (Past class failures) | `Mjob` |
| `famrel` (Family relations quality) | `Fjob` |
| `freetime` | `reason` |
| `goout` | `guardian` |
| `Dalc` (Workday alcohol consumption) | `schoolsup` |
| `Walc` (Weekend alcohol consumption) | `famsup` |
| `health` | `paid` |
| `absences` | `activities` |
| | `nursery` |
| | `higher` |
| | `internet` |
| | `romantic` |

### 2.3 Explicit Feature Exclusions (Target Leakage & Collinear Proxies)
The following fields are strictly rejected by the preprocessing pipeline:
1. **Target Leakage Fields**:
   - `G3` / `final_exam_marks`: Ground truth outcome.
   - `academic_status` / `pass_status`: Derived classification labels.
2. **Intermediate Grade Leakage**:
   - `G1`, `G2`: Excluded from Milestone 0 anomaly baselines to assess early-stage profile divergence prior to midterm examinations.
3. **Synthetic / Collinear Proxies**:
   - `assignment_completion_rate`: Derived synthetic proxy.
   - `attendance_percentage`: Collinear with true recorded `absences`.
   - `study_hours_per_week`: Collinear with canonical ordinal `studytime`.
   - `previous_exam_marks`, `quiz_scores`: Artificially simulated metrics.

---

## 3. Machine Learning Architecture & Model Training

### 3.1 Model Configuration
Separate scikit-learn `IsolationForest` models were trained and serialized for each curriculum track:
- **Algorithm**: `sklearn.ensemble.IsolationForest`
- **Number of Estimators**: `n_estimators=100`
- **Subsample Size**: `max_samples='auto'` ($\min(256, n)$)
- **Contamination Factor**: `contamination=0.05` ($5\%$ expected anomalous density)
- **Random State**: `random_state=42` (deterministic repeatability)
- **Preprocessing**:
  - Categoricals: `SimpleImputer(strategy='most_frequent')` $\rightarrow$ `OneHotEncoder(handle_unknown='ignore', sparse_output=False)`
  - Numericals: `SimpleImputer(strategy='median')` $\rightarrow$ `RobustScaler()` (robust against outlier influence on medians/IQRs)

### 3.2 Serialized Artifacts
- **Mathematics Anomaly Detector**:
  - Path: `ml_models/anomaly_models/math_anomaly_detector_m0.joblib`
  - Model Version: `1.0.0-m0`
  - File Size: 464 KB
  - Training Latency: 0.38 seconds
  - Identified Anomalies at 0.05 contamination: 20 records ($5.06\%$)
- **Portuguese Anomaly Detector**:
  - Path: `ml_models/anomaly_models/portuguese_anomaly_detector_m0.joblib`
  - Model Version: `1.0.0-m0`
  - File Size: 474 KB
  - Training Latency: 0.36 seconds
  - Identified Anomalies at 0.05 contamination: 33 records ($5.08\%$)

### 3.3 Contamination Sensitivity Study
To evaluate model stability across varying contamination rates ($\nu \in [0.01, 0.10]$):

| Contamination Rate | Math Threshold | Math Anomalies Count | Portuguese Threshold | Portuguese Anomalies Count |
| :---: | :---: | :---: | :---: | :---: |
| **0.01** | -0.1501 | 4 ($1.01\%$) | -0.1584 | 7 ($1.08\%$) |
| **0.03** | -0.1082 | 12 ($3.04\%$) | -0.1205 | 20 ($3.08\%$) |
| **0.05 (Default)** | **-0.0831** | **20 ($5.06\%$)** | **-0.0987** | **33 ($5.08\%$)** |
| **0.08** | -0.0564 | 32 ($8.10\%$) | -0.0712 | 52 ($8.01\%$) |
| **0.10** | -0.0418 | 40 ($10.13\%$) | -0.0583 | 65 ($10.02\%$) |

*Finding*: Decision boundaries scale smoothly across contamination thresholds without threshold cliff instability.

### 3.4 Controlled LOF vs. Isolation Forest Benchmark
A controlled benchmark was executed on the same preprocessed feature spaces:
- **Training Time**: Isolation Forest = 0.37s vs. Local Outlier Factor (LOF) = 0.08s.
- **Out-of-Sample Inference**: Isolation Forest supports $O(t \cdot \psi \log \psi)$ tree inference without holding dataset matrices in memory. LOF is a transductive non-parametric $k$-NN method requiring neighbor search over all stored points or `novelty=True` fitting.
- **Jaccard Concordance**: $29.0\%$ for Mathematics; $29.4\%$ for Portuguese. Both identify severe multidimensional outliers, but Isolation Forest is significantly better suited for streaming inference on constrained hardware.

---

## 4. Score Interpretation & Explainability Governance

### 4.1 Strict Terminology Enforcement
- **Uncalibrated Model Score**: Raw Isolation Forest decision function values ($s(x) \in [-\infty, +\infty]$). Negative values denote isolated atypical points; positive values denote nominal density.
- **Cohort Percentile Rank**: Empirical CDF ranking of the anomaly score relative to training cohort distribution ($0.0\% - 100.0\%$).
- **Zero Probability Claims**: The application strictly prohibits presenting anomaly scores as "probability of failure", "misconduct likelihood", or "attrition risk percent".

### 4.2 Supporting Statistical Deviations
When an anomaly is flagged, the inference engine inspects the sample's features against cohort baseline statistics:
- **Numerical Features**: Evaluated via Z-score $Z = \frac{x_i - \mu_i}{\sigma_i}$. Feature deviations with $|Z| \ge 2.0$ are cataloged.
- **Categorical Features**: Evaluated via frequency proportion $P(c_j) = \frac{N(c_j)}{N_{\text{total}}}$. Categories observed in $< 5\%$ of the cohort are cataloged as rare attributes.
- **Pedagogical Governance Notice**: Explicitly labeled in the UI as **Supporting Statistical Deviation**. Documentation clearly clarifies that these statistical deviations provide context for human mentors and do not imply causality.

---

## 5. MongoDB Schema & Indexing

### 5.1 Collection: `anomaly_records`
```json
{
  "_id": "ObjectId",
  "source_record_id": "string",
  "student_id_ref": "ObjectId | null",
  "subject": "string ('Mathematics' | 'Portuguese Language')",
  "model_version": "string ('1.0.0-m0')",
  "milestone": "string ('Milestone 0 (Baseline)')",
  "anomaly_score": "float",
  "cohort_percentile": "float",
  "is_anomaly": "boolean",
  "anomaly_severity": "string ('Low' | 'Medium' | 'High' | 'Critical')",
  "supporting_deviations": [
    {
      "feature": "string",
      "observed_value": "any",
      "cohort_mean_or_mode": "any",
      "z_score": "float | null",
      "rarity_percentage": "float | null",
      "deviation_type": "string ('z_score' | 'rare_category')",
      "description": "string"
    }
  ],
  "review_status": "string ('Pending Review' | 'Confirmed Anomaly' | 'Dismissed (Benign)')",
  "reviewed_by": "ObjectId | null",
  "reviewed_by_name": "string | null",
  "reviewed_at": "datetime | null",
  "review_notes": "string | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 5.2 Performance & Idempotency Indexes
Added to `backend/database/schema.py`:
1. `{"source_record_id": 1, "subject": 1, "model_version": 1}` — **Unique Compound Index** (guarantees idempotency; prevents duplicate anomaly evaluation).
2. `{"subject": 1, "is_anomaly": 1, "review_status": 1}` — Compound query index for fast teacher and admin triage queues.
3. `{"review_status": 1, "created_at": -1}` — Review queue index.
4. `{"student_id_ref": 1, "created_at": -1}` — Student reference index.
5. `{"anomaly_severity": 1, "created_at": -1}` — Severity sorting index.

---

## 6. RBAC & Security Enforcement

| Role | Anomaly List (`/api/anomalies`) | Anomaly Detail (`/api/anomalies/<id>`) | Status Update (`/api/anomalies/<id>/status`) | Aggregate Stats (`/api/analyst/anomalies/stats`) |
| :--- | :---: | :---: | :---: | :---: |
| **Admin** | Full Access (All Subjects) | Full Access | Permitted | Permitted |
| **Teacher** | Scoped to Assigned Subjects | Scoped to Assigned Subjects | Permitted (Assigned Subjects Only) | $403\text{ Forbidden}$ |
| **Student** | $403\text{ Forbidden}$ | $403\text{ Forbidden}$ | $403\text{ Forbidden}$ | $403\text{ Forbidden}$ |
| **Analyst** | $403\text{ Forbidden}$ | $403\text{ Forbidden}$ | $403\text{ Forbidden}$ | Full Access ($N < 5$ Suppressed) |

### 6.1 Security Implementation Highlights
- **Subject Scoping Fail-Closed**: In `AnomalyService.list_anomalies` and `get_anomaly_by_id`, teacher assignments are queried using `AssignmentService.get_subjects_for_teacher(db, actor_user.id)`. If the teacher has no assignments or requests an unassigned subject, access is denied ($403\text{ Forbidden}$).
- **Row-Level Student Isolation**: Students receive an immediate $403\text{ Forbidden}$ error when attempting to hit `/api/anomalies` or any record sub-route.
- **Statistical Disclosure Control (SDC)**: `GET /api/analyst/anomalies/stats` calculates counts across subjects, severities, and review statuses. Any cell with $1 \le count < 5$ is suppressed and masked as `<5`. When an analyst views aggregate counts, zero individual student records or PII are exposed.

---

## 7. Human Review Workflow

The human review workflow enforces three distinct pedagogical statuses:
1. **`Pending Review`** (Default upon detection): Flagged by Isolation Forest, awaiting faculty triage.
2. **`Confirmed Anomaly`**: Verified by faculty or administrator as an atypical academic trajectory warranting advisory mentorship.
3. **`Dismissed (Benign)`**: Evaluated by reviewer as a harmless demographic or lifestyle outlier requiring no intervention.

**Auditing**: Every status change requires a non-empty contextual note, sets `reviewed_by` and `reviewed_by_name`, stamps `reviewed_at`, updates `updated_at`, and logs an immutable audit entry in `system_logs` with action `ANOMALY_REVIEW_UPDATED`. No automated disciplinary measures, suspensions, or grade changes are permitted.

---

## 8. Frontend Implementation

### 8.1 Admin Risk & Anomaly Monitor (`frontend/src/pages/admin/AdminRiskMonitoring.tsx`)
- Tabbed interface separating **Unsupervised Anomaly Triage (Phase 7C)** and **Supervised Risk Warnings**.
- Summary KPI Cards: Flagged Anomalies, Pending Human Reviews, Confirmed Anomalies, Dismissed (Benign).
- Interactive Filter Bar: Subject, Severity (`Critical`, `High`, `Medium`, `Low`), and Review Status.
- "Run Batch Anomaly Scan" action triggering asynchronous cohort evaluation.
- Anomaly Records Table displaying Uncalibrated Scores, Cohort Percentile ranks, Supporting Deviations, and Triage action buttons.
- Connects to `AnomalyReviewModal` for review status transitions and note recording.

### 8.2 Teacher Anomaly Monitoring (`frontend/src/pages/teacher/TeacherAnomalies.tsx`)
- Scoped strictly to the active subject selected in `TeacherSubjectContext` (`selectedSubject?.name`).
- Classroom KPI Cards: Flagged Anomalies, Pending Review, Confirmed, Dismissed.
- Subject-scoped records table with uncalibrated anomaly scores, cohort percentiles, and supporting deviations.
- Integrates `AnomalyReviewModal` allowing teachers to confirm or dismiss anomalies with pedagogical notes.
- Prominent pedagogical disclosure banner explaining the advisory nature of the alerts.

### 8.3 Analyst Aggregate Anomaly Telemetry (`frontend/src/pages/analyst/AnalystAnomalies.tsx`)
- Strictly aggregate telemetry consuming `GET /api/analyst/anomalies/stats`. Zero individual student rows.
- KPI cards with automatic `<5 (Suppressed)` masking badges.
- Subject Cohort Telemetry card breaking down evaluated records and flagged anomaly counts.
- Severity & Review Status distribution cards with cell suppression.
- Methodology matrix detailing contamination parameters ($0.05$), uncalibrated scores, and target leakage immunity.

### 8.4 Anomaly Review Modal Component (`frontend/src/components/anomalies/AnomalyReviewModal.tsx`)
- Reusable modal for Admin and Teacher triage.
- Displays record metadata, uncalibrated score, cohort percentile rank, severity badge, and supporting statistical deviation pills.
- Interactive status selector (`Pending Review`, `Confirmed Anomaly`, `Dismissed (Benign)`).
- Reviewer note textarea and past review audit metadata display.

---

## 9. Verification & Automated Test Results

### 9.1 Backend Pytest Suite
- Command: `.venv\Scripts\pytest -q`
- Result: **`191 passed in 136.57s`**
- Anomaly Detection Test Suite (`tests/test_anomaly_detection.py`): **21 passed in 7.08s**:
  1. `test_feature_allowlist_completeness`: PASSED
  2. `test_target_leakage_and_synthetic_proxy_rejection[G3]`: PASSED
  3. `test_target_leakage_and_synthetic_proxy_rejection[final_exam_marks]`: PASSED
  4. `test_target_leakage_and_synthetic_proxy_rejection[academic_status]`: PASSED
  5. `test_target_leakage_and_synthetic_proxy_rejection[pass_status]`: PASSED
  6. `test_target_leakage_and_synthetic_proxy_rejection[assignment_completion_rate]`: PASSED
  7. `test_target_leakage_and_synthetic_proxy_rejection[attendance_percentage]`: PASSED
  8. `test_target_leakage_and_synthetic_proxy_rejection[study_hours_per_week]`: PASSED
  9. `test_target_leakage_and_synthetic_proxy_rejection[previous_exam_marks]`: PASSED
  10. `test_target_leakage_and_synthetic_proxy_rejection[quiz_scores]`: PASSED
  11. `test_missing_and_unexpected_values_handled_safely`: PASSED
  12. `test_deterministic_repeatability`: PASSED
  13. `test_separate_math_and_portuguese_models`: PASSED
  14. `test_synthetic_anomaly_detection_sensitivity`: PASSED
  15. `test_anomaly_record_persistence_and_idempotency`: PASSED
  16. `test_human_review_status_workflow`: PASSED
  17. `test_admin_can_access_anomaly_endpoints`: PASSED
  18. `test_teacher_subject_authorization_enforced`: PASSED
  19. `test_student_and_analyst_denied_row_level_anomalies`: PASSED
  20. `test_analyst_aggregate_stats_with_cell_suppression`: PASSED
  21. `test_inference_latency_budget`: PASSED ($58.4\text{ ms} < 100\text{ ms}$)

### 9.2 Frontend Vitest Suite
- Command: `cmd /c "cd frontend && npx vitest run"`
- Result: **`3 test files passed, 25 tests passed in 6.25s`**:
  - `src/__tests__/grade_utils.test.ts` (8 tests): PASSED
  - `src/__tests__/anomaly_monitoring.test.tsx` (2 tests): PASSED
  - `src/__tests__/subject_workspace.test.tsx` (15 tests): PASSED

### 9.3 TypeScript Check & Production Build
- Command: `cmd /c "cd frontend && npx tsc -b && vite build"`
- Result: **`Zero errors, built in 24.61s`**. Output bundle: `dist/`.

---

## 10. Actual Performance Measurements (i5-3360M Hardware)

| Metric | Measured Value | Budget / SLA | Status |
| :--- | :---: | :---: | :---: |
| **Mathematics Training Time** | 0.38 s | $\le 5.0\text{ s}$ | PASS |
| **Portuguese Training Time** | 0.36 s | $\le 5.0\text{ s}$ | PASS |
| **Single Record Inference Latency** | 58.4 ms | $\le 100\text{ ms}$ | PASS |
| **Batch Inference (395 records)** | 0.82 s | $\le 5.0\text{ s}$ | PASS |
| **Memory Footprint per Model** | ~470 KB | $\le 50\text{ MB}$ | PASS |
| **MongoDB Query Time (with indexes)** | 4.2 ms | $\le 20\text{ ms}$ | PASS |

---

## 11. Known Limitations & Institutional Risks

1. **UCI Benchmark Data Representation**:
   The underlying dataset originates from secondary schools in Portugal (Alentejo region, 2005–2006). Patterns of absenteeism, family relationships, and alcohol consumption reflect specific cultural contexts and cannot establish generalizable anomaly detection accuracy across diverse international or higher-education institutions without localized re-benchmarking.
2. **Absence of Ground Truth Anomaly Labels**:
   Because the dataset does not contain validated "real-world academic anomaly" ground-truth labels, unsupervised precision/recall/F1 cannot be scientifically computed. Contamination is set conservatively to $0.05$ based on distribution quantile analysis.
3. **Multi-Variate Masking**:
   Some multi-dimensional anomalies occur due to interactions between 3 or more features that each have modest univariate Z-scores ($|Z| < 2.0$). In these cases, no univariate deviation pill is displayed; the UI clearly notes "multi-dimensional feature interaction".

---

## 12. Summary of Files Created & Modified

### Backend
- `backend/ml/anomaly_detector.py` (Created: Preprocessing pipelines, Isolation Forest estimator wrappers, sensitivity study, LOF benchmark).
- `backend/ml/anomaly_loader.py` (Created: In-memory cached model loading).
- `backend/models/anomaly_record_model.py` (Created: AnomalyRecord domain model and serialization).
- `backend/services/anomaly_service.py` (Created: Anomaly inference, persistence, review updates, RBAC scoping, SDC stats).
- `backend/routes/anomaly_routes.py` (Created: REST endpoints `/api/anomalies`, `/<id>`, `/<id>/status`, `/batch-evaluate`).
- `backend/app.py` (Modified: Registered `anomaly_bp`).
- `backend/database/schema.py` (Modified: Added 5 compound indexes for `anomaly_records`).
- `backend/routes/analyst_routes.py` (Modified: Added `GET /api/analyst/anomalies/stats` with $N < 5$ suppression).
- `ml_models/anomaly_models/math_anomaly_detector_m0.joblib` (Created: Serialized Mathematics model).
- `ml_models/anomaly_models/portuguese_anomaly_detector_m0.joblib` (Created: Serialized Portuguese model).

### Frontend
- `frontend/src/types/index.ts` (Modified: Added `AnomalyRecord`, `SupportingDeviation`, `AnomalyReviewStatus`, `AnomalySeverity`, `AnalystAnomalyStats`).
- `frontend/src/services/api.ts` (Modified: Added `listAnomalies`, `getAnomalyDetail`, `updateAnomalyStatus`, `batchEvaluateAnomalies`, `getAnalystAnomalyStats`).
- `frontend/src/components/anomalies/AnomalyReviewModal.tsx` (Created: Human review triage modal with pedagogical notice).
- `frontend/src/pages/admin/AdminRiskMonitoring.tsx` (Modified: Tabbed monitor with live anomaly queue, filters, batch scan trigger).
- `frontend/src/pages/teacher/TeacherAnomalies.tsx` (Modified: Scoped live anomaly monitor for assigned subjects).
- `frontend/src/pages/analyst/AnalystAnomalies.tsx` (Modified: Privacy-preserving aggregate telemetry with $N < 5$ suppression).
- `frontend/src/__tests__/anomaly_monitoring.test.tsx` (Created: Vitest component tests).

### Tests & Documentation
- `tests/test_anomaly_detection.py` (Created: 21 comprehensive pytest tests).
- `tests/conftest.py` (Modified: Added `clean_db` teardown for `anomaly_records`).
- `documentation/PHASE_7C_READINESS_AUDIT.md` (Created: Technical feasibility audit).
- `documentation/PHASE_7C_IMPLEMENTATION_REPORT.md` (Created: This document).

---

## 13. Git & Push Verification

- Working Tree: Clean and verified.
- Status: Staged and committed to branch `main`.
- Push Target: `origin/main` (`https://github.com/azanali30/EduPredict`).
- Verification: All pre-commit checks, typechecks, Vitest unit tests, and full Pytest suites verified prior to pushing.

---

**End of Phase 7C Implementation Report.**  
*Execution halted per user directive. Phase 7D will not begin without explicit approval.*
