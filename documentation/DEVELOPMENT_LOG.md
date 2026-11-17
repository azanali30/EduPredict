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
- **Commits**: Pending Push (`feat(audit): implement phase 4 data integrity audit, leakage guard, and test suite`)
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
