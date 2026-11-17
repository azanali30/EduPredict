# EduPredict – Development Log

## Phase 0: Baseline Audit & GitHub Backup
- **Date**: 2026-11-17
- **Status**: Completed & Backed Up to GitHub
- **Commits**: `5d45fe3`, `1541a73`, `dd0e42b`, `80fecdf`
- **Actions Executed**: Project directory audit, Python 3.12.16 & MongoDB 6.0.29 verification, `.gitignore` setup, public repository security audit, GitHub `origin/main` push, and Aptech Big Data feasibility assessment.

---

## Phase 1: Application Architecture & Dependency Configuration
- **Date**: 2026-11-17
- **Status**: Completed & Tested
- **Commits**: `6f6c796`, `fdedb5e`
- **Actions Executed**: Installed `pymongo`, `Flask-Login`, `Flask-WTF`, `email-validator`, `python-dotenv`, `pytest`, `pytest-flask`. Implemented Flask application factory, environment configurations, resilient `MongoManager` for MongoDB 6.x, health routes, and 14 unit tests (100% passing).

---

## Phase 2: Database Design, Authentication & Role-Based Authorization
- **Date**: 2026-11-17
- **Status**: Completed & Tested
- **Commits**: `e99e045`, `5543b10`
- **Actions Executed**: Installed `bcrypt (5.0.0)`. Configured MongoDB 6 collections (`users`, `academic_records`, `predictions`, `teacher_student_assignments`, `system_logs`) with unique and compound indexes. Built User domain entity with Flask-Login, bcrypt password hashing, RBAC decorators (`@role_required`), administrative governance routes, CLI commands (`create-admin`, `init-db`), and 41 automated tests (100% passing).

---

## Phase 3: Professional React Frontend Development & Flask API Integration
- **Date**: 2026-11-17
- **Status**: Completed & Verified
- **Actions Executed**:
  1. **Frontend Architecture & Scaffolding**:
     - Configured modern React 18, TypeScript, and Vite 6 application inside `frontend/`.
     - Integrated `lucide-react` for modern, accessible SVG UI iconography.
     - Configured Vite development proxy forwarding `/auth`, `/api`, and `/health` requests to `http://127.0.0.1:5000` to ensure seamless cookie handling.
  2. **Security & API Communication**:
     - Centralized `api.ts` service with automated `X-CSRFToken` retrieval and attachment on mutating requests (`POST`, `PUT`, `DELETE`).
     - Configured session cookie credentials (`credentials: 'include'`).
     - Implemented automatic CSRF token refresh and retry on expired/missing token errors.
     - Centralized `AuthContext.tsx` restoring session state on page refresh via `GET /api/me`.
  3. **Visual Design System**:
     - Created `frontend/src/styles/global.css` with a refined Navy blue and Light cyan educational SaaS theme (`#0B192C`, `#1E3E62`, `#0284c7`, `#38bdf8`, `#f8fafc`).
     - Built accessible form components (`InputField.tsx`, `Button.tsx` with loading states), `StatCard.tsx`, `LoadingSkeleton.tsx`, `EmptyState.tsx`, `ErrorAlert.tsx`, and `Modal.tsx`.
  4. **Public Authentication Pages**:
     - `LoginPage.tsx`: Email, password with toggle show/hide, remember me, validation, error alert.
     - `RegisterPage.tsx`: Student registration with live password requirements checklist. Enforces `role='student'`.
     - `ForgotPasswordPage.tsx`: Clearly labeled notice detailing that automated self-service email recovery is unavailable and directing users to the system administrator.
     - `UnauthorizedPage.tsx`: Access denied 403 fallback.
     - `NotFoundPage.tsx`: 404 fallback.
  5. **Role-Based Layouts & Workspaces**:
     - `AuthLayout.tsx`: Centered auth card layout.
     - `DashboardLayout.tsx`: Responsive layout with sticky sidebar and header bar.
     - **Student Workspace**: `StudentOverview.tsx`, `StudentProfile.tsx` (edit name, change password), `StudentRecords.tsx`, `StudentPredictions.tsx` (clear empty state for Phase 4 ML models).
     - **Teacher Workspace**: `TeacherOverview.tsx` (real count of assigned students), `TeacherStudents.tsx` (searchable roster, student detail inspection modal).
     - **Admin Workspace**: `AdminOverview.tsx` (platform telemetry, user counts, MongoDB engine status), `UserManagement.tsx` (search, role filtering, role update modal), `TeacherAssignments.tsx` (link teachers to students), `SystemLogs.tsx` (audit trail table).
  6. **Build & Test Verification**:
     - Verified TypeScript strict type checking: 0 errors.
     - Executed production build (`tsc -b && vite build`): bundle compiled in ~6.58s.
     - Executed backend pytest suite: 41 / 41 passed in ~20.47s.

---

## Phase 3 Extension: Professional SaaS UI/UX Redesign
- **Date**: 2026-11-17
- **Status**: Completed & Verified
- **Actions Executed**:
  1. **Visual System & Dependency Expansion**:
     - Installed `recharts@^2.15.0` for interactive educational analytics visualizations.
     - Upgraded `frontend/tailwind.config.js` with deep slate navy shades (`#07101e`, `#0B192C`, `#132742`, `#1E3E62`), cyan glows, soft card shadows, and rounded radius tokens.
     - Refined `frontend/src/styles/global.css` with custom scrollbars, card elevation hover effects, and crisp badge utilities.
  2. **Split-Screen Authentication Redesign**:
     - Redesigned `AuthLayout.tsx` into a modern split-screen SaaS layout (left: educational analytics branding panel with simulated cohort vectors and security highlights; right: focused, elevated form card).
     - Redesigned `LoginPage.tsx` with clear typography, input states, remember-me checkbox, and recovery links.
     - Redesigned `RegisterPage.tsx` with live password strength checklist and automated redirect.
     - Updated `ForgotPasswordPage.tsx`, `NotFoundPage.tsx`, and `UnauthorizedPage.tsx` with consistent design system components.
  3. **Student Analytics Workspace Redesign**:
     - Rebuilt `StudentOverview.tsx` with a personalized hero greeting banner, 4 core KPI indicator cards, an attendance trajectory area chart (Recharts), and a subject competency radar chart (Recharts).
     - Integrated a clearly structured ML Prediction Engine status card with an honest pending state awaiting Phase 4 & 5.
     - Added honest empty states for Subject Strengths & Bottlenecks and Actionable Study Strategies.
     - Polished `StudentRecords.tsx`, `StudentPredictions.tsx`, and `StudentProfile.tsx`.
  4. **Teacher Workspace Redesign**:
     - Upgraded `TeacherOverview.tsx` with real-time assigned student statistics, cohort engagement distribution bar chart (Recharts), and searchable student roster table.
     - Rebuilt `TeacherStudents.tsx` with student inspection modal providing full demographic and enrollment data.
  5. **Admin Governance Console Redesign**:
     - Enhanced `AdminOverview.tsx` with live platform telemetry (total accounts, student count, teacher count, admin count), MongoDB 6.0.29 engine latency monitoring, and a real user role distribution donut/pie chart (Recharts).
     - Refactored `UserManagement.tsx` with role filter tabs, user search, and role modification modal with self-demotion prevention.
     - Refactored `TeacherAssignments.tsx` with instructor-student mapping form and RBAC policy reference card.
     - Refactored `SystemLogs.tsx` with immutable audit trail telemetry and event badges.
  6. **Build & Automated Verification**:
     - Executed production build (`tsc -b && vite build`): bundle compiled in 25.29s with 0 errors (`dist/assets/index-BpR1vFdi.css` 36.27 kB, `dist/assets/index-cwR6B7wV.js` 735.12 kB).
     - Executed full backend pytest suite: 41 / 41 passed in 31.80s.
     - Captured fresh headless Chrome screenshots for all 5 core application views:
       - `screenshots/01_login_page.png` (Split-Screen Login)
       - `screenshots/02_register_page.png` (Split-Screen Registration)
       - `screenshots/03_student_dashboard.png` (Student Analytics Dashboard)
       - `screenshots/04_teacher_dashboard.png` (Teacher Workspace Dashboard)
       - `screenshots/05_admin_dashboard.png` (Admin Governance Dashboard)

---

## Phase 4: Dataset Engineering, Big Data Storage & Exploratory Data Analysis
- **Date**: 2026-11-17
- **Status**: Completed & Verified
- **Commits**: `5bf1cae`, `76c07bd`
- **Actions Executed**:
  1. **Dataset Research & Curation**:
     - Curated and downloaded the official UCI Student Performance benchmark dataset (`student-mat.csv` with 395 records, `student-por.csv` with 649 records; total 1,044 observations, CC BY 4.0 license).
     - Standardized delimiters, column naming conventions, and composite indicators.
     - Preserved raw files verbatim under `data/raw/`.
  2. **Data Cleaning & Indicator Engineering Pipeline** (`backend/data_engineering/clean_dataset.py`):
     - Engineered continuous and ordinal standardized features: `study_hours_per_week`, `absences_cleaned`, `attendance_percentage` (0–100%), `previous_exam_marks` (G1 scaled to 0–100), `quiz_scores` (G2 scaled to 0–100), `final_exam_marks` (G3 scaled to 0–100), `assignment_completion_rate`, and three-tier `academic_status` (`Low Risk / On Track`, `Moderate Risk`, `High Risk`).
     - Generated `data/processed/cleaned_academic_records.csv` (1,044 rows, 45 attributes) and `data/processed/academic_features_normalized.csv`.
     - Exported machine-readable `data/processed/data_dictionary.json` and `data/processed/cleaning_summary.json`.
  3. **MongoDB 6.0 Schema & Resilient Ingestion Pipeline** (`backend/data_engineering/ingest_mongodb.py`):
     - Added `analytical_academic_records` collection with compound unique index on `(student_code, subject, academic_year)` and single indexes on `subject`, `academic_status`, `attendance_percentage`.
     - Built chunked batch upsert pipeline (`bulk_write` with `UpdateOne(upsert=True)`).
     - Verified idempotency: First run ingested 1,044 records; second run resulted in 0 duplicates inserted (1,044 matched, net added: 0).
  4. **Hadoop / HDFS Lakehouse Architecture** (`backend/data_engineering/hdfs_lakehouse.py` & `analytics/hdfs/docker-compose-hdfs.yml`):
     - Designed multi-tier Lakehouse directory taxonomy (`/edupredict/raw/academic/`, `/edupredict/processed/academic/`, `/edupredict/analytics/...`).
     - Built `HDFSLakehouseManager` supporting WebHDFS REST API operations (`LISTSTATUS`, `MKDIRS`, `CREATE`).
     - Performed active socket probe on port 9870; honestly documented NameNode offline status and 8GB RAM host constraints.
     - Created standalone Docker Compose deployment recipe for optional Linux/container testbeds.
  5. **Apache Impala MPP Analytical Engine** (`analytics/impala/`):
     - Penned `01_create_academic_lakehouse_tables.sql` defining external text staging and compressed Snappy Parquet tables.
     - Implemented all 7 required analytical queries (`02_analytical_queries.sql`) covering subject aggregates, attendance velocity correlation, top 10 scholars via `DENSE_RANK()`, early warning declining trajectories, longitudinal term progression, percentile dispersion, and data quality anomaly detection.
     - Built diagnostic client runner `impala_query_runner.py` with port 21050 active socket probe.
     - Penned `analytics/impala/README.md` with cluster execution documentation.
  6. **Exploratory Data Analysis (EDA) Jupyter Notebook** (`notebooks/eda_academic_performance.ipynb`):
     - Created and executed reproducible 16-cell notebook with embedded Markdown narrative, statistical tables, and high-resolution plots.
     - Generated plots: G3 grade distributions by subject, longitudinal grade trajectory ($G_1 \rightarrow G_2 \rightarrow G_3$), correlation heatmap, and academic risk category composition.
  7. **RStudio / R Statistical Validation Pipeline** (`analytics/r/statistical_validation.R`):
     - Executed via installed native R 4.6.2 (`C:\Program Files\R\R-4.6.2\bin\x64\Rscript.exe`).
     - Executed Welch's two-sample t-test ($t = -5.67, p = 2.22 \times 10^{-8}$), Wilcoxon rank-sum test ($W = 103715, p = 1.95 \times 10^{-7}$), one-way ANOVA ($F = 1488, p < 2 \times 10^{-16}$), Kruskal-Wallis test ($\chi^2 = 888.86, p < 2.2 \times 10^{-16}$), and Pearson correlation analysis.
     - Exported `analytics/r/statistical_summary_output.txt`, `analytics/r/correlation_matrix.csv`, and rendered high-res plots: `analytics/r/grade_distribution_by_subject.png` and `analytics/r/attendance_vs_grade_scatter.png`.
  8. **Comprehensive Automated Test Suite** (`tests/test_data_pipeline.py`):
     - Authored 13 dedicated automated unit/integration tests covering dataset cleaning, metadata schemas, MongoDB ingestion idempotency, HDFS Lakehouse manager, Impala query parsing, and R statistical artifacts.
     - Executed full test suite: **54 / 54 tests passing (100%)** across existing backend modules and new data pipeline.
  9. **Frontend Integrity Verification**:
     - Ran production Vite build (`npm run build`): completed in 21.80s with 0 errors.

---

## Phase 4 Extension: Final Data Integrity Audit & Machine Learning Leakage Guard
- **Date**: 2026-11-17
- **Status**: Completed & Verified
- **Commits**: `1937720`, `cb16858`
- **Actions Executed**:
  1. **Dataset Identity Audit**:
     - Audited original UCI files and `student-merge.R`.
     - Confirmed that 382 students appear in both Math and Portuguese datasets, totaling 662 distinct physical students across 1,044 enrollment records.
     - Documented identity leakage risks of unconstrained random train/test splits.
     - Built `backend.data_engineering.leakage_guard.generate_student_group_ids` implementing group-level clustering for `GroupShuffleSplit` / `GroupKFold`.
  2. **Attendance Indicator Audit**:
     - Reclassified `attendance_percentage` as an **Estimated Attendance Proxy** in `backend/data_engineering/clean_dataset.py`, `data_dictionary.json`, and `DATA_DICTIONARY.md`.
     - Explicitly established that the 60-session denominator is an assumed synthetic proxy baseline, not verified roll-call attendance.
  3. **Machine Learning Feature Leakage Prevention**:
     - Audited all 45 columns across CSVs and MongoDB.
     - Formally isolated targets (`final_exam_marks`, `academic_status`, `G3`) from permitted inputs.
     - Implemented `backend.data_engineering.leakage_guard.assert_no_leakage()` enforcing strict feature segregation.
  4. **Study Hours Audit**:
     - Documented mapping of ordinal `studytime` ($1-4$) to continuous midpoints ($1.5, 3.5, 7.5, 12.0$).
     - Confirmed preservation of original categorical `studytime` for tree-based models.
  5. **Train/Test Strategy Formulation**:
     - Designed subject-stratified splits (Math $N=395$, Portuguese $N=649$) and group-aware pooled splits.
     - Established 5-fold stratified cross-validation on training folds, regression/classification evaluation metrics, and Dummy/Linear/Logistic baselines.
  6. **Automated Testing & Build Verification**:
     - Authored `tests/test_feature_leakage.py` (8 automated tests).
     - Executed full test suite: **62 / 62 tests passing (100%)**.
     - Ran frontend production build: 0 errors in 16.53s.

---

## Phase 5 Readiness Verification: Pre-Modeling Protocols & Audit Review
- **Date**: 2026-11-17
- **Status**: Completed & Verified (Zero Models Trained)
- **Commits**: `82ccfd1` (`feat(readiness): document phase 5 readiness verification, split protocols, and metrics`)
- **Actions Executed**:
  1. **Student Identity Grouping Limitations Audit**:
     - Investigated exact mathematical reconciliation: 1,044 enrollment records vs. 662 demographic profile equivalence classes vs. 382 merge rows in `student-merge.R`.
     - Confirmed that 662 is an *estimated demographic profile count*, not a verified physical human student count, due to cohort demographic vector collisions (8 duplicate rows in Math, 23 in Portuguese).
     - Recommended Mathematics ($N=395$) and Portuguese ($N=649$) subject-specific models as primary architecture.
  2. **Regression & Classification Split Strategy Formulation**:
     - Solved the continuous target stratification error by defining `get_regression_stratification_bins()` for performance tiers and quantiles.
     - Separated continuous regression cross-validation (`KFold`) from classification (`StratifiedKFold`).
     - Established 20% holdout test partition isolation rules.
  3. **Preprocessing Leakage Audit**:
     - Verified that existing Phase 4 feature scalings rely on fixed domain formulas (zero global statistical leakage).
     - Mandated Scikit-learn `Pipeline` and `ColumnTransformer` encapsulation for all future training fold transformers.
  4. **Evaluation Metrics Corrections**:
     - Audited zero-division in standard MAPE caused by 53 student records with $G_3 = 0$.
     - Replaced standard MAPE with bounded Symmetric MAPE (`safe_smape`) and prioritized MAE and RMSE.
     - Formalized classification metrics: Macro F1, Weighted F1, Balanced Accuracy, Precision, Recall, Confusion Matrix.
  5. **Verification & Automated Testing**:
     - Authored `documentation/PHASE_5_READINESS_VERIFICATION.md`.
     - Added unit tests for regression stratification binning and `safe_smape`.
     - Full test suite passed: **64 / 64 tests passing (100%)**.
     - Frontend production build passed: 0 errors in 17.35s.

---

## Phase 5A: Machine Learning Model Development & Empirical Evaluation
- **Date**: 2026-11-17
- **Status**: Completed & Empirically Verified
- **Commits**: `80e8829`, `f56c53b`, `a3cecf6`, `cf7b879`
- **Actions Executed**:
  1. **Subject Separation & Milestone Feature Partitions**:
     - Enforced independent training on Mathematics ($N=395$) and Portuguese Language ($N=649$) cohorts.
     - Implemented Milestone 0 (33 features, strictly zero grades), Milestone 1 (34 features, M0 + $G_1$), and Milestone 2 (35 features, M1 + $G_2$) in `backend/data_engineering/leakage_guard.py`.
     - Strictly excluded $G_3$, `final_exam_marks`, `academic_status`, `student_code`, and database identifiers from all input feature matrices.
  2. **Pipeline Preprocessing & Encapsulation**:
     - Built `backend/ml/pipeline_builder.py` using Scikit-learn `Pipeline` and `ColumnTransformer`.
     - Implemented model-specific preprocessors: standard scaling + one-hot encoding for linear models, passthrough + one-hot encoding for Random Forest, and ordinal encoding for HistGradientBoosting.
     - Embedded all transformations inside Scikit-learn pipelines to ensure 100% data-dependent fitting happens inside training folds.
  3. **Model Training & 5-Fold Cross-Validation**:
     - Evaluated 54 candidate pipelines across 2 subjects, 3 milestones, and 2 prediction tasks.
     - Regression algorithms evaluated: DummyRegressor (Mean), Linear Regression (OLS), Ridge Regression ($L_2$), Random Forest Regressor, HistGradientBoosting Regressor.
     - Classification algorithms evaluated: DummyClassifier (Prior), Logistic Regression ($L_2$), Random Forest Classifier, HistGradientBoosting Classifier.
     - Observed and documented OLS linear model collapse under multicollinearity in small-sample Math cohort (CV MAE 62.78 vs Ridge 17.22 vs RF 14.78).
     - Selected 12 champion pipelines based on lowest CV MAE (regression) and highest CV Macro F1 (classification).
  4. **Model Serialization & Reports Export**:
     - Serialized all 12 champion pipelines (`.joblib`) with metadata files (`_meta.json`) into `ml_models/saved_models/`.
     - Built thread-safe loader and inference utility `backend/ml/model_loader.py`.
     - Generated machine-readable evaluation outputs in `ml_models/reports/`: `cross_validation_results.json`, `holdout_evaluation_results.json`, `confusion_matrices.json`, `champion_models_manifest.json`.
  5. **Holdout Evaluation & Safety Analysis**:
     - Evaluated champions against unseen 20% holdout test partitions ($N=79$ Math, $N=130$ Portuguese).
     - Math Regression holdout MAE: 14.41% (M0) -> 9.10% (M1) -> 4.70% (M2, 71.27% error reduction over baseline).
     - Math Classification holdout Macro F1: 0.5599 (M0) -> 0.7386 (M1) -> 0.8632 (M2, +339.51% lift over baseline). At M2, High Risk recall reached 92.3% (24/26).
     - Portuguese Regression holdout MAE: 10.62% (M0) -> 6.36% (M1) -> 3.72% (M2, 69.36% error reduction over baseline).
     - Portuguese Classification holdout Macro F1: 0.4711 (M0) -> 0.7060 (M1) -> 0.8121 (M2, +244.84% lift over baseline).
  6. **Automated Testing & Documentation**:
     - Authored `tests/test_ml_models.py` (8 automated tests covering subject separation, milestone restrictions, leakage prevention, train/test isolation, pipeline preprocessing, artifact loading, inference reproducibility, and metric calculations).
     - Full test suite passed: **72 / 72 tests passing (100%)**.
     - Frontend production build passed: 0 errors in 17.58s.
     - Authored comprehensive documentation `documentation/PHASE_5A_ML_MODEL_DEVELOPMENT.md` and read-only audit report `documentation/PHASE_5A_FINAL_INTEGRITY_AUDIT.md`.

---

## Phase 5B: Secure Prediction API Development
- **Date**: 2026-11-17
- **Status**: Completed & Empirically Verified
- **Commits**: Pending Commit (`feat(phase-5b): secure prediction api, rbac enforcement, history persistence, and tests`)
- **Actions Executed**:
  1. **Prediction Model & Persistence Layer**:
     - Implemented `PredictionRecord` domain model in `backend/models/prediction_model.py` with full provenance, metadata, and JSON/BSON serialization.
     - Extended MongoDB `predictions` schema and indexes in `backend/database/schema.py` with compound index `idx_preds_student_created` and `idx_preds_subject_milestone`.
  2. **In-Memory Model Caching & Joint Inference**:
     - Enhanced `backend/ml/model_loader.py` with thread-safe model caching (`_MODEL_CACHE`) and `predict_student()` joint inference engine.
     - Executes continuous regression mark prediction alongside discrete risk classification and uncalibrated class probability extraction.
  3. **Prediction Business Service & Input Validation**:
     - Built `backend/services/prediction_service.py` with comprehensive schema validation.
     - Validates subject, milestone (0, 1, 2), numeric ranges, and categorical domains across all 33–35 features.
     - Strictly intercepts prohibited target fields (`G3`, `final_exam_marks`, `academic_status`, `student_code`) and milestone temporal violations.
  4. **Role-Based Access Control & IDOR Defense**:
     - Integrated `can_access_student_data` authorization checks into all prediction endpoints.
     - Enforces that students can only generate and list predictions for themselves (attempting other student IDs returns 403 Forbidden).
     - Enforces that teachers can only generate and list predictions for students assigned to them in `teacher_student_assignments`.
     - Grants administrators system-wide prediction governance.
  5. **Educational Safety Advisories & Uncertainty Warnings**:
     - Injected mandatory Milestone 0 Early Warning Advisory alerting users to the >60% false negative rate without exam grades.
     - Attached uncertainty warning flags whenever top-class probability is below 0.55.
     - Labeled estimated proxies (`assignment_completion_rate`, `attendance_percentage`, `study_hours_per_week`) explicitly in metadata.
  6. **Secure REST API Blueprint**:
     - Created `backend/routes/prediction_routes.py` with `/api/predictions/options`, `POST /api/predictions`, `GET /api/predictions`, and `GET /api/predictions/<id>`.
     - Registered `prediction_bp` in application factory `backend/app.py`.
  7. **Testing & Build Verification**:
     - Authored `tests/test_prediction_api.py` with 14 automated unit/integration tests.
     - Full test suite passed: **86 / 86 tests passing (100%)**.
     - Frontend production build passed: 0 errors in 14.37s.
     - Authored documentation `documentation/PHASE_5B_PREDICTION_API.md`.

---

## Phase 5C: Frontend Prediction Interfaces & Role-Based Workspaces
- **Date**: 2026-11-17
- **Status**: Completed & Verified
- **Commits**: Pending Commit (`feat(phase-5c): modern prediction workspaces, dynamic forms, model disagreement handling, and role-based analytics`)
- **Actions Executed**:
  1. **Frontend Prediction Architecture & Domain Types**:
     - Defined comprehensive TypeScript domain interfaces in `frontend/src/types/index.ts` (`PredictionRecord`, `EarlyWarningAdvisory`, `PredictionFeatureSummaryItem`, `MilestoneOption`, `PredictionOptions`, `CreatePredictionPayload`).
     - Added strongly typed client endpoints in `frontend/src/services/api.ts` (`getPredictionOptions`, `createPrediction`, `listPredictions`, `getPredictionDetail`) with automatic CSRF management.
  2. **Prediction Component Suite (`frontend/src/components/predictions/`)**:
     - `PredictionForm.tsx`: Dynamic form rendering selective feature sets per milestone (33 for M0, 34 for M1, 35 for M2). Includes rapid testing presets ("At Risk", "Average", "Excelling"), numeric range and categorical constraints, and clear synthetic feature badges (`Estimated Study Discipline Index`, `Estimated Attendance Proxy`, `Estimated Weekly Study Hours`).
     - `PredictionResultCard.tsx`: Displays continuous projected marks ($0 - 100$) with visual progress bar, discrete risk status badge (`High Risk`, `Moderate Risk`, `Low Risk / On Track`), model disagreement advisory (flagging when regression score band conflicts with classification category), uncalibrated confidence probability breakdowns, and low-confidence uncertainty warnings ($<0.55$).
     - `PredictionHistoryTable.tsx`: Filterable audit table (Subject, Milestone, Risk Level) with quick refresh and audit modal launcher.
     - `PredictionDetailModal.tsx`: Comprehensive audit dialog displaying complete input feature payloads, estimator provenance, and confidence metrics.
     - `TeacherPredictionModal.tsx`: Instructor assessment drawer enabling teachers to generate predictions on behalf of assigned learners with live result cards and prior audit history.
  3. **Role-Based Workspaces**:
     - **Student Prediction Workspace (`/student/predictions`)**: Replaced placeholder page with full dual-tab workspace (Generate Prediction and History & Audits). Incorporates prominent Milestone 0 Early Warning Advisory banners detailing empirical false-negative rates ($61.54\%$ for Mathematics, $75.00\%$ for Portuguese).
     - **Teacher Workspaces (`/teacher/students` & `/teacher`)**: Added student roster AI diagnostic status indicators (`Latest AI Status`, `Projected Mark`), one-click "Predict AI" actions, cohort attention alert banner for flagged learners, and Recharts risk category distribution visualizations on the teacher overview.
     - **Admin Prediction Intelligence (`/admin`)**: Added dynamic system-wide prediction telemetry cards, Recharts visualizations for risk category breakdown and milestone spread, and an institutional prediction activity log.
  4. **Build & Automated Testing Verification**:
     - Executed production Vite build (`tsc -b && vite build`): bundle compiled in 19.44s with **0 TypeScript errors**.
     - Executed full backend pytest suite: **86 / 86 tests passed (100% pass rate)**.
     - Authored comprehensive documentation `documentation/PHASE_5C_FRONTEND_PREDICTION_WORKSPACES.md`.
