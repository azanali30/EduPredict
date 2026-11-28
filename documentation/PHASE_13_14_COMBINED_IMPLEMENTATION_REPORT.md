# EduPredict — Combined Phase 13 + Phase 14 Implementation Report

> **Naming & Governance Note:** "Combined Phase 13" (Academic Data Integrity, Real Attendance Management, Academic Records Ingestion & Dashboard Metric Truthfulness) and "Combined Phase 14" (Tableau BI Integration, Model Training/Evaluation Notebook & Parallel Batch Benchmark) are **proposed development phases** derived from the Aptech SRS compliance audit — **not** an original canonical Aptech phase numbering sequence.

---

## 1. Executive Summary

Starting cleanly from verified baseline commit `91106962659913c88a9dae1bfc7bdc062a41a1da` on `main` (single-institution, four-role architecture: `admin`, `teacher`, `student`, `analyst`), this implementation delivers both **Workstream A (Phase 13)** and **Workstream B (Phase 14)** with full RBAC enforcement, statistical privacy controls, zero hard-coded dashboard metrics, verified ML non-overwrite isolation, executed notebook reproducibility, and sequential full-stack verification.

---

## 2. Workstream A — Phase 13 Summary

### 2.1 Real Institutional Attendance Register (`attendance_sessions` & `attendance_records`)
- **Models & Schema:** Added `AttendanceSession` and `AttendanceRecord` in [`backend/models/attendance_model.py`](../backend/models/attendance_model.py) supporting `Present`, `Absent`, `Late`, and `Excused` statuses, plus unique compound and query indexes in [`backend/database/schema.py`](../backend/database/schema.py) (`idx_att_sessions_unique`, `idx_att_records_session_student_unique`), added both collections to `DEFAULT_BACKUP_COLLECTIONS` in [`backend/services/backup_service.py`](../backend/services/backup_service.py) (bringing total governed collections to **20**), and updated `clean_db` in [`tests/conftest.py`](../tests/conftest.py).
- **Service & REST Endpoints:** Implemented [`backend/services/attendance_service.py`](../backend/services/attendance_service.py) and [`backend/routes/attendance_routes.py`](../backend/routes/attendance_routes.py) (`POST /api/attendance/sessions`, `GET /api/attendance/sessions`, `GET /api/attendance/sessions/<id>`, `PUT|POST /api/attendance/sessions/<id>/records`, `GET /api/attendance/student/my`, `GET /api/attendance/summary`) with:
  - Strict teacher subject/term assignment checks (`403` otherwise), active student enrollment validation (`403`), calendar & non-future date checks (`400`), duplicate session guard (`409`), duplicate student row guard (`400`), and CRLF/XSS text cleaning.
  - Student self-only read isolation (`403` on cross-student IDOR or class session lists) and strict `403` block for `analyst` on student-level attendance routes.
- **ML Proxy Separation:** Verified Institutional Attendance never alters or overwrites `predictions` or the 60-session `Estimated ML Attendance Proxy` (`max(0, 100 - (absences / 60) * 100)`). Both [`TeacherAttendance.tsx`](../frontend/src/pages/teacher/TeacherAttendance.tsx) and [`StudentAttendance.tsx`](../frontend/src/pages/student/StudentAttendance.tsx) display these indicators separately and show `"No attendance sessions recorded"` when zero roll-call sessions exist.

### 2.2 Academic Records Ingestion, Validation & CRUD (`academic_records`)
- **Service & API:** Added [`backend/services/academic_record_service.py`](../backend/services/academic_record_service.py) and [`backend/routes/academic_record_routes.py`](../backend/routes/academic_record_routes.py) (`GET /api/academic-records`, `GET /api/academic-records/<id>`, `POST /api/academic-records`, `PUT|PATCH /api/academic-records/<id>`, `POST /api/academic-records/import-csv`).
  - Preserves existing `idx_records_student_subject_term_unique` and backward compatibility with `EventStreamer._sync_academic_state()` and `AcademicRecord`.
  - Validates numeric score bounds (`g1`, `g2`, `final_exam_marks` in `0..20`; `assignment_completion_rate`, `quiz_average`, `previous_exam_marks`, `attendance_percentage` in `0..100`; `study_hours_per_week` in `0..60`; `absences` in `0..93`; `failures` in `0..4`), rejects duplicate `(student, subject, term)` POSTs (`409`), enforces teacher subject/enrollment RBAC (`403`), restricts students to self-read (`403` on writes/others), blocks analysts (`403`), and returns row-level CSV import summaries (`total_rows`, `successful`, `rejected`, `duplicate`, `errors`).
- **UI Upgrades:** Upgraded [`TeacherAcademicRecords.tsx`](../frontend/src/pages/teacher/TeacherAcademicRecords.tsx), [`AdminAcademicRecords.tsx`](../frontend/src/pages/admin/AdminAcademicRecords.tsx), and read-only [`StudentRecords.tsx`](../frontend/src/pages/student/StudentRecords.tsx).

### 2.3 Dashboard Metric Truthfulness Remediation
- **Analyst Cohort Trends API:** Added [`backend/services/analyst_trends_service.py`](../backend/services/analyst_trends_service.py) and `GET /api/analyst/trends` in [`backend/routes/analyst_routes.py`](../backend/routes/analyst_routes.py) enforcing `N < 5` Statistical Disclosure Control (SDC) and complementary cell suppression across persisted `predictions`, `academic_records`, and `attendance_records`.
- **Frontend Fixes:**
  - [`StudentOverview.tsx`](../frontend/src/pages/student/StudentOverview.tsx): Removed static `benchmarkTrajectory` and `subjectCurriculumRadar` arrays and outdated `"Phase 4"` copy; displays live attendance, study hours, assignment rate, latest prediction, and honest empty states (`"Insufficient historical data"`, `"No sessions recorded"`, `"Prediction unavailable"`).
  - [`StudentProgress.tsx`](../frontend/src/pages/student/StudentProgress.tsx): Replaced hardcoded `'+1.2 pts'` with live prediction trajectory delta or `'Baseline (1 run)'` / `'Insufficient historical data'`.
  - [`StudentRecommendations.tsx`](../frontend/src/pages/student/StudentRecommendations.tsx): Removed hardcoded `3.5` / `2` / `65.0` fallbacks and `'+2.5 pts'`; computes target headroom cleanly or renders `"Prediction unavailable"`.
  - [`AnalystTrends.tsx`](../frontend/src/pages/analyst/AnalystTrends.tsx): Replaced discarded API call, static `termTrendData`, `12.7`, `+0.5 pts / year`, and `5 Cycles` with live `api.getAnalystTrends()` metrics and `"Not enough data to calculate a trend"` empty state.
  - [`AdminReports.tsx`](../frontend/src/pages/admin/AdminReports.tsx): Replaced hardcoded `'2026-T1'` and `'100% SDC Verified'` claims with live derived term scope, truthful `"Admin Scoped"` governance copy, CSV formula-injection neutralization, and Tableau BI exports.

---

## 3. Workstream B — Phase 14 Summary

### 3.1 Tableau BI Integration
- **Export Service & Routes:** Created [`backend/services/bigdata/tableau_export_service.py`](../backend/services/bigdata/tableau_export_service.py) and [`backend/routes/tableau_routes.py`](../backend/routes/tableau_routes.py) exposing `GET /api/tableau/datasets` and `GET /api/tableau/export/<dataset>?format=csv|json` across 6 de-identified analytical schemas (`academic_performance`, `subject_trends`, `attendance_summary`, `dropout_risk_summary`, `demand_forecast_summary`, `anomaly_summary`). Enforces zero PII across all exports, CSV formula escaping (`=`, `+`, `-`, `@`, `\t`, `\r`), server-locked `N < 5` SDC for `analyst` (`403` for `student` and `teacher`), and `system_logs` auditing.
- **Workbook & UI:** Built [`tableau/EduPredict_Analytics_Workbook.twb`](../tableau/EduPredict_Analytics_Workbook.twb) (validated via `xml.etree.ElementTree`, 5 datasources, 5 worksheets, 1 executive dashboard), triggered download buttons from [`AdminReports.tsx`](../frontend/src/pages/admin/AdminReports.tsx), and documented usage and external Tableau Desktop runtime status in [`documentation/TABLEAU_INTEGRATION_GUIDE.md`](TABLEAU_INTEGRATION_GUIDE.md).

### 3.2 Reproducible Model Training & Evaluation Notebook
- **Notebook:** Authored [`notebooks/02_model_training_and_evaluation.ipynb`](../notebooks/02_model_training_and_evaluation.ipynb) covering 20 structured markdown/code sections (`19` executable code cells) strictly in memory: leakage audit via `backend/data_engineering/leakage_guard.py`, 80/20 stratified holdout splits (`random_state=42`), 5-fold cross-validation candidate comparisons, CV-only champion selection, holdout regression & classification metrics, confusion matrices, predicted-vs-actual residual plots, M0->M2 lift curve, UCI dropout benchmark, IsolationForest sanity check, 60-session attendance proxy audit, and SHA-256 verification of all 13 untouched production `.joblib` files.
- **Verified Execution (`C:\Annaconda\Scripts\jupyter.exe nbconvert --execute --inplace`):** All 19 code cells executed (`exec_counts: [1..19]`, `0` errors), observing:
  - Mathematics M2 Holdout: `MAE=4.709`, `R²=0.901` (`71.2%` MAE reduction vs Dummy), Classifier `Macro F1=0.836`, `Balanced Acc=0.824`.
  - Portuguese Language M2 Holdout: `MAE=3.681`, `R²=0.884` (`69.7%` MAE reduction vs Dummy), Classifier `Macro F1=0.836`, `Balanced Acc=0.832`.
  - Dropout Dataset Holdout (`N=885` from `4,424` rows): `Macro F1=0.860`, `Balanced Acc=0.855`.
  - Production `ml_models/saved_models/*.joblib`: `git status -s ml_models/` confirmed zero modified artifacts.

### 3.3 Parallel Batch Processing Benchmark
- **Script:** Created [`scripts/benchmark_batch_processing.py`](../scripts/benchmark_batch_processing.py) comparing Sequential vs `ThreadPoolExecutor` vs `ProcessPoolExecutor` on deterministic in-memory workloads with zero database or `.joblib` writes.
- **Measured Host Run (`--records 200 --workers 2 --iters 1200`, Windows host `CPUs: 4`):**
  - `sequential` (`1` worker): `2.1615s` | `92.53 rec/s` | `1.000x` | parent `tracemalloc` peak `0.0004 MB`
  - `thread` (`2` workers): `1.7241s` | `116.00 rec/s` | `1.254x` | parent `tracemalloc` peak `0.0166 MB`
  - `process` (`2` workers): `0.6549s` | `305.38 rec/s` | `3.301x` | parent `tracemalloc` peak `0.2026 MB`

---

## 4. Database Governance & Documentation Synchronization
- Synchronized [`AdminDataManagement.tsx`](../frontend/src/pages/admin/AdminDataManagement.tsx) collection governance panel from 7 legacy entries to all **20 collections**.
- Synchronized [`README.md`](../README.md), [`documentation/ARCHITECTURE.md`](ARCHITECTURE.md), [`documentation/PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md), [`documentation/BIG_DATA_IMPLEMENTATION_PLAN.md`](BIG_DATA_IMPLEMENTATION_PLAN.md), and [`documentation/EDUPREDICT_SRS_TRACEABILITY_MATRIX.md`](EDUPREDICT_SRS_TRACEABILITY_MATRIX.md).

---

## 5. Verification Results (Sequential Suite on Final Codebase)
- **Backend Full Suite (`.\.venv\Scripts\pytest.exe -q`):** `384 passed in 376.14s` (`0` failed, `0` skipped), including [`tests/test_phase_13_14.py`](../tests/test_phase_13_14.py) (`7` comprehensive backend integration/security tests).
- **Frontend Vitest Suite (`npx.cmd vitest run`):** `10 test files passed (10), 49 tests passed (49)` in `34.82s`, including [`phase13_attendance_records_dashboards.test.tsx`](../frontend/src/__tests__/phase13_attendance_records_dashboards.test.tsx).
- **TypeScript & Vite Production Build (`tsc -b && npm run build`):** `0` TypeScript errors, `2,091 modules transformed`, clean bundle built in `36.15s`.
- **Notebook Verification (`nbconvert --execute`):** 19/19 code cells executed (`errors: []`).
- **Explicit Deferrals / Non-Running External Services:**
  - `100+ students / 25+ teachers / 1 admin` large-scale load test intentionally not run per baseline governance rules.
  - Native Hadoop HDFS daemons, Impala server, multi-node Apache `httpd`, and Tableau Desktop GUI are not installed/started locally; integration contracts, SQL validation harness, and workbook XML validation substitute cleanly in local CI.
