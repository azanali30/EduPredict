# EduPredict — Comprehensive Project Audit & Next Implementation Planning

**Project**: EduPredict  
**Workspace**: `C:\Users\Azan's PC\Documents\EduPredict`  
**GitHub Repository**: `https://github.com/azanali30/EduPredict`  
**Audit Mode**: STRICT READ-ONLY COMPREHENSIVE SYSTEM AUDIT  
**Date of Audit**: 2026-11-21  
**Auditor**: Senior Software Architect, Security Auditor, Database Engineer, ML Engineer & UI/UX Reviewer  
**Current Git State**: Clean working tree on `main` branch (`commit 5b44d27`), fully synchronized with `origin/main`.  
**System Health**: Backend Pytest (151/151 passed), Frontend Vitest (15/15 passed), TypeScript (`tsc -b && vite build` 0 errors).

---

## 1. Executive Summary

This report delivers a rigorous, evidence-based architectural, functional, security, database, machine learning, and UI/UX audit of the **EduPredict** educational intelligence platform. Every finding, evaluation, and recommendation in this audit is grounded in direct inspection of live source code, database collections and indexes, serialized machine learning artifacts, automated test suites, and frontend components.

### 1.1 Platform Architectural Maturity
EduPredict has reached an operational level as an institutional student performance intelligence suite. It features:
- **Unified Full-Stack Architecture**: React 18 + TypeScript + Vite frontend with Tailwind CSS design system, communicating via session-authenticated REST endpoints to a Python 3.12 Flask backend.
- **Strict Role-Based Access Control (RBAC)**: Four core roles—`admin`, `teacher`, `student`, and `analyst`—enforced via cryptographically validated session cookies, CSRF tokens, and subject-level data isolation.
- **Institutional Subject Catalog & Allocations**: First-class multi-subject enrollment and teacher assignment model (`MATH-101`, `PORT-101`) preventing cross-subject data leakage or insecure direct object references (IDOR).
- **Multi-Milestone Machine Learning Inference Engine**: 12 champion pipelines (HistGradientBoosting and Random Forest) providing continuous mark projections and 3-tier risk classifications across Registration (M0), Mid-Term (M1), and Continuous Assessment (M2).
- **Enterprise Registration & Administration**: 6-step registration wizards for Students and Faculty, administrative user edit modals, and slide-out profile drawers.

### 1.2 Core Divergences & Outstanding Gaps
Despite high stability across core predictive workflows, critical architectural divergences from the original Aptech Big Data specification remain:
1. **Big Data Infrastructure vs Local Execution**: Hadoop HDFS and Impala lakehouse components exist as Docker specifications and Python client wrappers with graceful offline fallbacks, rather than live distributed services.
2. **Missing Advanced Models**: Course Demand Forecasting (time-series / elective capacity models) and ML-based Anomaly Detection (Isolation Forest) are completely absent. Student Dropout Prediction exists solely as a heuristic advisory indicator rather than an empirical survival model.
3. **Grading Scale Representation Inconsistencies**: The underlying UCI benchmark dataset and raw records operate on the Portuguese 0–20 scale ($G_1, G_2, G_3 \in [0, 20]$), while ML inference models predict on a normalized 0–100 percentage scale. Several analytics cards and risk labels still display `/20.0` or `< 10/20` alongside `/100` displays.
4. **Self-Service Profile Limitations**: While Administrators can manage complete student and faculty profiles (personal, contact, guardian, academic, employment, documents), the self-service student (`/student/profile`) and teacher (`/teacher/profile`) pages only allow updating `full_name` and passwords.
5. **Mock Presentation Endpoints**: Automated Notification dispatch and Feedback/Support ticketing exist primarily as UI state without backend persistence models or communication gateways.

---

## 2. Previous Audit Findings Verification

Below is an exhaustive re-inspection of the 10 previously identified architectural findings across the codebase.

| # | Original Finding | Current Status | Code References & Locations | Concrete Code Evidence & Behavior | Recommended Next Action |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | **Analyst curriculum statistics lack $N < 5$ cell suppression** | **RESOLVED** | `backend/routes/analyst_routes.py:20-49, 137-184`<br>`tests/test_analyst_rbac.py:215-265` | `apply_cell_suppression()` enforces $k$-anonymity. Counts $1 \le N < 5$ return `{"value": null, "display": "<5", "suppressed": true}`. Exact count 0 is unsuppressed. | Maintain regression coverage in `test_analyst_rbac.py`. |
| **2** | **Aggregate reporting may expose small-cohort information** | **RESOLVED** | `backend/routes/analyst_routes.py:74-106`<br>`tests/test_analyst_rbac.py:267-310` | Implemented **complementary suppression**: When exactly 1 subject has suppressed enrollment ($N < 5$), the marginal institutional total is also suppressed to prevent residual subtraction disclosure (`Total - Sum = Suppressed`). | No further action required. Fully verified. |
| **3** | **Analyst diagnostics endpoint security and role isolation** | **RESOLVED** | `backend/routes/analyst_routes.py:188-201`<br>`tests/test_analyst_rbac.py:118-132` | `@analyst_required` strictly enforces `role == 'analyst'` with no admin override. Rejects admin, teacher, and student with 403. Exposes no server internals, stack traces, database strings, or infrastructure telemetry. | Verified secure. Keep role-isolation invariant in place. |
| **4** | **Student & Teacher registration forms lack complete profile information** | **RESOLVED (Admin)** | `backend/models/user_model.py:19-65`<br>`frontend/src/components/admin/StudentRegistrationModal.tsx`<br>`frontend/src/components/admin/TeacherRegistrationModal.tsx` | Expanded User model with `avatar_url`, `must_change_password`, `personal_info`, `contact_info`, `guardian_info`, `academic_info`, `professional_info`, `employment_info`, and `documents`. 6-step modal wizards operational. | Extend same schema to self-service student/teacher profile views. |
| **5** | **Student profile and Teacher profile management** | **PARTIALLY RESOLVED** | `frontend/src/components/common/StudentProfileDrawer.tsx`<br>`frontend/src/components/common/TeacherProfileDrawer.tsx`<br>`frontend/src/pages/student/StudentProfile.tsx:13-46`<br>`frontend/src/pages/teacher/TeacherProfile.tsx:15-50` | Admin profile drawers render all multi-section fields. However, the student's and teacher's own profile pages (`/student/profile`, `/teacher/profile`) currently only update `full_name` and password. | Upgrade self-service profile pages to display and edit designated personal and contact fields. |
| **6** | **Student enrollment and Teacher assignment workflows** | **RESOLVED** | `backend/services/assignment_service.py`<br>`backend/services/enrollment_service.py`<br>`frontend/src/pages/admin/TeacherAssignments.tsx`<br>`frontend/src/pages/admin/AdminEnrollments.tsx` | Admin 3-tab allocation workspace handles Instructor Allocations, Student Enrollments, and Subject Catalog with status toggles and duplicate prevention. | Maintain current workflow. |
| **7** | **Academic grading scale inconsistencies (`62.3 / 20.0` vs 0–100)** | **PARTIALLY RESOLVED** | `backend/services/prediction_service.py:466, 506`<br>`frontend/src/pages/analyst/AnalystTrends.tsx:69`<br>`frontend/src/pages/analyst/AnalystRisk.tsx:83, 89`<br>`frontend/src/pages/student/StudentProgress.tsx:82` | Prediction regression outputs 0–100 marks (`predicted_marks / 100`). However, benchmark data is 0–20, and several static analytics cards still display `/ 20.0` or `< 10 / 20`. | Standardize UI score displays to percentage scale with optional dual Portuguese scale notation (`XX.X% (YY.Y/20)`). |
| **8** | **Dashboard UI/UX inconsistencies across all roles** | **RESOLVED** | `frontend/src/components/forms/InputField.tsx`<br>`frontend/src/components/forms/Button.tsx`<br>`frontend/src/styles/global.css`<br>`documentation/UI_UX_REFINEMENT_REPORT.md` | Standardized column alignments, table headers, form focus rings, stat cards, and status badges across all 4 dashboards. | Ensure new forms adopt standard `InputField` and `Button` components. |
| **9** | **Existing subject-based authorization and cross-subject isolation** | **RESOLVED** | `backend/utils/decorators.py:118-256`<br>`tests/test_subject_rbac.py:320-380` | `can_access_student_subject_data()` validates teacher assignment + student enrollment + subject match. Verified that a Math teacher cannot view Portuguese records for a dual-enrolled student. | Preserve subject-level RBAC decorator guards. |
| **10** | **Historical academic records and ML data integrity** | **RESOLVED** | `backend/data_engineering/leakage_guard.py`<br>`backend/ml/train_models.py`<br>`ml_models/reports/holdout_evaluation_results.json` | 1,044 benchmark records cleaned with zero nulls. Target leakage guard strictly enforced (`assert_no_leakage()`). Holdout evaluation verified across M0, M1, M2. | Ensure future retraining scripts maintain `leakage_guard.py` assertions. |

---

## 3. Complete SRS Compliance Matrix

The following matrix audits all 20 functional and non-functional requirements specified in the Aptech Big Data / EduPredict SRS.

| # | SRS Requirement | Status | Primary Code References | Verification Findings & Architecture Evidence |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Authentication & Role Management** | **Fully Implemented and Verified** | `backend/models/user_model.py:10`<br>`backend/routes/auth_routes.py`<br>`backend/utils/decorators.py` | 4 roles (`admin`, `teacher`, `student`, `analyst`) with Flask-Login, bcrypt hashing (12 rounds), session cookies, and role guards (`@admin_required`, `@teacher_required`, etc.). |
| **2** | **Student & Teacher Management** | **Partially Implemented** | `backend/routes/admin_routes.py:110-310`<br>`frontend/src/pages/admin/AdminStudents.tsx`<br>`frontend/src/pages/admin/AdminTeachers.tsx` | Admin creation, editing, status toggling, and multi-section wizards fully operational. Self-service student/teacher profile editing remains limited to name and password. |
| **3** | **Academic Data Ingestion** | **Partially Implemented** | `backend/data_engineering/clean_dataset.py`<br>`backend/data_engineering/ingest_mongodb.py` | Batch ingestion from CSVs (UCI dataset: 1,044 rows across Math and Portuguese) into MongoDB is operational. Live LMS ingestion (Canvas/Moodle LTI) is absent. |
| **4** | **Student Demographics** | **Fully Implemented and Verified** | `backend/models/user_model.py:35-42`<br>`data/processed/data_dictionary.json` | 33 standard demographic, socioeconomic, and parental features captured in staging collections and user profile schemas. |
| **5** | **Attendance Data** | **Partially Implemented** | `backend/data_engineering/clean_dataset.py:65`<br>`frontend/src/pages/teacher/TeacherAttendance.tsx` | Attendance is currently modeled as an absence velocity proxy from the UCI dataset (`absences` 0–93). Real-time swipe/RFID attendance tracking is not implemented. |
| **6** | **Historical & Real-Time Data** | **Partially Implemented** | `backend/database/schema.py:104-114`<br>`backend/services/prediction_service.py` | Historical batch data is staged and queried via MongoDB. Real-time streaming infrastructure (SSE, WebSockets, Kafka event bus) is not implemented. |
| **7** | **HDFS Storage** | **Blocked by Infrastructure / Spec Only** | `backend/data_engineering/hdfs_lakehouse.py`<br>`analytics/hdfs/docker-compose-hdfs.yml` | WebHDFS REST client class and Docker Compose stack exist. Physical cluster is offline; application operates with graceful local fallback verified in test suite. |
| **8** | **Data Processing & Missing-Value Handling** | **Fully Implemented and Verified** | `backend/ml/pipeline_builder.py:65-88`<br>`backend/data_engineering/clean_dataset.py` | Scikit-learn preprocessing pipelines use `SimpleImputer` (median for numericals, most-frequent for categoricals). Dataset cleaning enforces zero-null invariants. |
| **9** | **Parallel Data Processing** | **Partially Implemented** | `backend/data_engineering/ingest_mongodb.py:134`<br>`backend/ml/train_models.py` | Batch ingestion uses chunked writes (`batch_size=500`). Scikit-learn model training utilizes multiprocessing (`n_jobs=-1`). Distributed cluster execution (Spark) is not deployed. |
| **10** | **Student Performance Prediction** | **Fully Implemented and Verified** | `backend/services/prediction_service.py`<br>`backend/ml/model_loader.py`<br>`ml_models/saved_models/` | 12 champion pipelines predict continuous final mark (0–100) and 3-tier risk across Registration (M0), Mid-Term (M1), and Continuous Assessment (M2). |
| **11** | **Student Dropout Prediction** | **Partially Implemented** | `frontend/src/pages/analyst/AnalystRisk.tsx:65-75`<br>`frontend/src/pages/teacher/TeacherAtRisk.tsx` | Modeled as a transparent rule-based Academic Attrition Vulnerability Indicator (absence velocity + milestone deficits < 10/20). True ML survival analysis is missing due to dataset limitations. |
| **12** | **Course Demand Prediction** | **Not Implemented** | N/A | No machine learning models, database collections, or API endpoints exist to forecast institutional course demand or elective registration volumes. |
| **13** | **Anomaly Detection** | **Partially Implemented** | `frontend/src/pages/teacher/TeacherAnomalies.tsx`<br>`frontend/src/pages/analyst/AnalystAnomalies.tsx`<br>`analytics/impala/02_analytical_queries.sql:128` | Heuristic mark drop ($\ge 5$ points between milestones) and high absence velocity tables exist in UI and SQL. Unsupervised ML anomaly detection (Isolation Forest) is not implemented. |
| **14** | **Trends & Correlation Analysis** | **Fully Implemented and Verified** | `analytics/r/statistical_validation.R`<br>`frontend/src/pages/student/StudentProgress.tsx` | Pearson/Spearman correlation matrices, ANOVA, and Welch t-tests implemented in R. Recharts visualizes historical milestone progression trajectories. |
| **15** | **Interactive Dashboards** | **Fully Implemented and Verified** | `frontend/src/pages/` (52 views)<br>`frontend/src/components/common/Sidebar.tsx` | Comprehensive, responsive dashboards across Administrator (17 views), Teacher (14 views), Student (12 views), and Analyst (9 views) portals. |
| **16** | **Automated Notifications** | **UI Only** | `frontend/src/pages/admin/AdminNotifications.tsx`<br>`frontend/src/pages/teacher/TeacherNotifications.tsx` | Notification center interfaces, alert badges, and at-risk triage queues exist in frontend state. Background email/SMS dispatch worker (SMTP/Twilio) is not implemented. |
| **17** | **Feedback & Support** | **UI Only** | `frontend/src/pages/student/StudentFeedback.tsx`<br>`frontend/src/pages/teacher/TeacherFeedback.tsx` | Interactive feedback submission forms and FAQs exist in UI. Backend feedback storage collection and ticketing management endpoints are not implemented. |
| **18** | **Performance Monitoring** | **Fully Implemented and Verified** | `backend/routes/health_routes.py`<br>`backend/models/system_log_model.py` | Health probes (`/health`, `/api/health`, `/api/health/db`), ping latency tracking, MongoDB index monitoring, and structured audit logging in `system_logs`. |
| **19** | **Encryption & Data Integrity** | **Fully Implemented and Verified** | `backend/utils/security.py`<br>`backend/database/schema.py` | Bcrypt password hashing, HTTP-only secure session cookies, CSRF protection, file upload validation, and unique compound database indexes. |
| **20** | **Backups & Reliability** | **Partially Implemented** | `backend/database/schema.py`<br>`scripts/database_integrity_audit.py` | Database schema indexes and non-destructive dry-run audit script guarantee referential integrity. Automated cold backup / S3 dump scripts are not implemented. |
| **21** | **Documentation & Deliverables** | **Fully Implemented and Verified** | `documentation/*` (35+ reports)<br>`DATA_DICTIONARY.md`<br>`ARCHITECTURE.md` | Complete architectural guides, test reports, data dictionaries, schema specifications, and compliance audits. |

---

## 4. Role-Based Dashboard Audit

### 4.1 Administrator Portal (17 Tabs)

| Tab Name | Route & Component | Backend APIs | DB Collections | Data Source | Permissions | Functionality & Audit Observations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Executive Overview** | `/admin`<br>`AdminOverview.tsx` | `GET /api/admin/users`<br>`GET /api/predictions`<br>`GET /health` | `users`<br>`predictions` | Real & Calculated | Admin | KPI cards (total students, faculty, predictions, system health), performance distribution charts, recent activity ledger. Operational. |
| **User Management** | `/admin/users`<br>`UserManagement.tsx` | `GET /api/admin/users`<br>`PUT /api/admin/users/<id>/role` | `users` | Real | Admin | Directory of all accounts. Role promotion/demotion between `admin`, `teacher`, `student`, and `analyst`. Self-demotion guard verified. |
| **Student Management** | `/admin/students`<br>`AdminStudents.tsx` | `GET /api/admin/users?role=student`<br>`PATCH /api/admin/users/<id>/status` | `users`<br>`student_subject_enrollments` | Real | Admin | Student roster, enrollment stats, active/inactive status toggle, launches 6-step registration wizard and profile drawer. Operational. |
| **Teacher Management** | `/admin/teachers`<br>`AdminTeachers.tsx` | `GET /api/admin/users?role=teacher`<br>`PATCH /api/admin/users/<id>/status` | `users`<br>`teacher_subject_assignments` | Real | Admin | Faculty roster, assignment counts, active/inactive status toggle, launches 6-step faculty registration wizard and drawer. Operational. |
| **Subject & Curriculum** | `/admin/curriculum`<br>`AdminCurriculum.tsx` | `GET /api/subjects`<br>`POST /api/subjects`<br>`PATCH /api/subjects/<id>/status` | `subjects` | Real | Admin | Subject catalog management (`code`, `name`, `canonical_key`, `term`, `status`). Enforces unique codes. Operational. |
| **Student Enrollments** | `/admin/enrollments`<br>`AdminEnrollments.tsx` | `GET /api/admin/enrollments`<br>`POST /api/admin/enrollments`<br>`PATCH /api/admin/enrollments/<id>/status` | `student_subject_enrollments`<br>`subjects`<br>`users` | Real | Admin | Student course enrollment management. Handles student selection, subject selection, term assignment, and status toggling. Operational. |
| **Teacher Assignments** | `/admin/assignments`<br>`TeacherAssignments.tsx` | `GET/POST /api/admin/assignments`<br>`GET/POST /api/admin/enrollments`<br>`GET/POST /api/subjects` | `teacher_subject_assignments`<br>`student_subject_enrollments`<br>`subjects` | Real | Admin | 3-tab allocation workspace (Instructor Allocations, Student Enrollments, Subject Catalog). Full CRUD and status management. Operational. |
| **Academic Records** | `/admin/academic-records`<br>`AdminAcademicRecords.tsx` | `GET /api/admin/users`<br>`GET /api/subjects`<br>`GET /api/predictions` | `users`<br>`subjects`<br>`predictions` | Real | Admin | Institution-wide academic records view with subject and milestone filters. Operational. |
| **Performance Analytics** | `/admin/analytics`<br>`AdminAnalytics.tsx` | `GET /api/predictions` | `predictions` | Calculated from Real | Admin | Aggregated average marks, pass rates, and milestone score trends across Math and Portuguese. Operational. |
| **AI Predictions Hub** | `/admin/predictions`<br>`AdminPredictions.tsx` | `GET /api/predictions`<br>`GET /api/subjects` | `predictions`<br>`subjects` | Real | Admin | Master prediction registry with pagination, search, subject filtering, and prediction detail modal inspection. Operational. |
| **Risk & Anomaly Monitor** | `/admin/risk-monitoring`<br>`AdminRiskMonitoring.tsx` | `GET /api/predictions` | `predictions` | Calculated from Real | Admin | High, Medium, Low risk queues based on model predictions. Displays students needing intervention. Operational. |
| **Reports & Exports** | `/admin/reports`<br>`AdminReports.tsx` | `GET /api/predictions` | `predictions` | Real & Calculated | Admin | Generates summary KPI report and client-side CSV exports for prediction records. Operational. |
| **Data Management** | `/admin/data-management`<br>`AdminDataManagement.tsx` | `GET /health` | N/A | Real (Health) + Mock Actions | Admin | Displays storage status and pipeline integrity. Ingestion trigger buttons present mock execution alerts rather than invoking background workers. |
| **Notifications & Alerts** | `/admin/notifications`<br>`AdminNotifications.tsx` | None (`api` empty) | None | Mock UI State | Admin | Notification feed with category filtering and mark-as-read buttons. Operates purely in component state without database persistence. |
| **Feedback & Support** | `/admin/feedback`<br>`AdminFeedback.tsx` | None (`api` empty) | None | Mock UI State | Admin | Support inquiry forms and canned inquiry queue. Operates purely in component state without database persistence. |
| **System Monitoring** | `/admin/logs`<br>`SystemLogs.tsx` | `GET /api/admin/logs` | `system_logs` | Real | Admin | Structured audit trail log viewer with event filtering (`AUTH_LOGIN_SUCCESS`, `USER_REGISTERED`, etc.) and IP tracking. Operational. |
| **Profile & Settings** | `/admin/settings`<br>`AdminSettings.tsx` | `PATCH /api/me`<br>`POST /auth/change-password` | `users` | Real | Admin | Account settings form for full name updates and password changes. Operational. |

---

### 4.2 Teacher Portal (14 Tabs)

| Tab Name | Route & Component | Backend APIs | DB Collections | Data Source | Permissions | Functionality & Audit Observations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | `/teacher`<br>`TeacherOverview.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `teacher_subject_assignments`<br>`student_subject_enrollments`<br>`predictions` | Real (Scoped) | Teacher | Scoped to assigned subjects. Displays student count, active subjects, pass rate, and at-risk count. Operational. |
| **My Subjects** | `/teacher/subjects`<br>`TeacherSubjects.tsx` | `GET /api/teacher/subjects` | `teacher_subject_assignments`<br>`subjects` | Real (Scoped) | Teacher | Displays active course allocations (`MATH-101`, `PORT-101`) with term badges and enrolled student counts. Operational. |
| **My Students** | `/teacher/students`<br>`TeacherStudents.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `student_subject_enrollments`<br>`users`<br>`predictions` | Real (Scoped) | Teacher | Enrolled student roster for teacher's active subjects. Subject filtering and search supported. Operational. |
| **Academic Records** | `/teacher/academic-records`<br>`TeacherAcademicRecords.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `predictions`<br>`users` | Real (Scoped) | Teacher | Grade ledger showing student milestone performance ($G_1, G_2, G_3$ projections). Operational. |
| **Performance Analytics** | `/teacher/performance`<br>`TeacherPerformance.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `predictions` | Calculated (Scoped) | Teacher | Milestone score distributions (M0 vs M1 vs M2), subject pass rates, and grade tier breakdowns. Operational. |
| **AI Predictions** | `/teacher/predictions`<br>`TeacherPredictions.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `predictions` | Real (Scoped) | Teacher | Scoped prediction registry. Allows teacher to trigger new inference via `TeacherPredictionModal` for assigned students. Operational. |
| **At-Risk Students** | `/teacher/at-risk`<br>`TeacherAtRisk.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `predictions` | Calculated (Scoped) | Teacher | Triage queue highlighting students with predicted marks $< 50\%$ or high uncertainty warnings. Email check-in link supported. Operational. |
| **Anomaly Monitoring** | `/teacher/anomalies`<br>`TeacherAnomalies.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `predictions` | Calculated (Scoped) | Teacher | Identifies students experiencing severe mark drops ($\ge 5$ points between milestones) or sudden attendance velocity declines. Operational. |
| **Attendance Records** | `/teacher/attendance`<br>`TeacherAttendance.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `predictions`<br>`users` | Estimated Proxy | Teacher | Roster showing estimated attendance percentage derived from absence records. Operational. |
| **Reports** | `/teacher/reports`<br>`TeacherReports.tsx` | `GET /api/teacher/students`<br>`GET /api/predictions` | `predictions` | Real (Scoped) | Teacher | Subject-level summary analytics and downloadable CSV reports for teacher's enrolled cohort. Operational. |
| **Notifications** | `/teacher/notifications`<br>`TeacherNotifications.tsx` | None (`api` empty) | None | Mock UI State | Teacher | Faculty notification feed (at-risk alerts, academic milestones). Operates purely in component state without database persistence. |
| **Feedback & Support** | `/teacher/feedback`<br>`TeacherFeedback.tsx` | None (`api` empty) | None | Mock UI State | Teacher | Advisory guidance, intervention recommendations, and support request form. Operates purely in component state. |
| **My Profile** | `/teacher/profile`<br>`TeacherProfile.tsx` | `GET /api/teacher/students`<br>`PATCH /api/me` | `users` | Real | Teacher | Self-service profile page. Displays assigned student metrics. Profile edit currently restricted to `full_name`. |
| **Settings** | `/teacher/settings`<br>`TeacherSettings.tsx` | `POST /auth/change-password` | `users` | Real | Teacher | Security settings page for faculty password updates. Operational. |

---

### 4.3 Student Portal (12 Tabs)

| Tab Name | Route & Component | Backend APIs | DB Collections | Data Source | Permissions | Functionality & Audit Observations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | `/student`<br>`StudentOverview.tsx` | `GET /api/student/subjects` | `student_subject_enrollments`<br>`subjects` | Real (Self Only) | Student | Displays enrolled courses, academic status badge, quick action buttons to predictions and progress. Operational. |
| **My Profile** | `/student/profile`<br>`StudentProfile.tsx` | `PATCH /api/me`<br>`POST /auth/change-password` | `users` | Real (Self Only) | Student | Self-service student profile page. Allows updating `full_name` and password. Guardian and academic info not yet editable here. |
| **My Subjects** | `/student/subjects`<br>`StudentSubjects.tsx` | `GET /api/student/subjects` | `student_subject_enrollments`<br>`subjects` | Real (Self Only) | Student | Course catalog of student's active enrollments with course codes, term, and credits. Operational. |
| **Academic Records** | `/student/records`<br>`StudentRecords.tsx` | `GET /api/student/subjects` | `student_subject_enrollments` | Real & Calculated | Student | Milestone grade history and term marks for enrolled subjects. Operational. |
| **Performance Analytics** | `/student/performance`<br>`StudentPerformance.tsx` | `GET /api/student/subjects`<br>`GET /api/predictions` | `predictions` | Calculated (Self Only) | Student | Visual charts of milestone score trajectory ($G_1 \rightarrow G_2 \rightarrow \text{Predicted } G_3$) and subject comparisons. Operational. |
| **AI Predictions** | `/student/predictions`<br>`StudentPredictions.tsx` | `GET /api/predictions`<br>`GET /api/student/subjects`<br>`POST /api/predict` | `predictions`<br>`student_subject_enrollments` | Real (Self Only) | Student | Self-service prediction dashboard. Students can run their own predictions across M0, M1, M2 for enrolled courses. Operational. |
| **My Progress & Trends** | `/student/progress`<br>`StudentProgress.tsx` | `GET /api/predictions` | `predictions` | Calculated (Self Only) | Student | Multi-milestone academic progression tracking with confidence intervals. Operational. |
| **Recommendations** | `/student/recommendations`<br>`StudentRecommendations.tsx` | `GET /api/predictions` | `predictions` | Rule-Based Advice | Student | Rule-based study recommendations generated from predicted marks and feature inputs (study time, failures). Operational. |
| **Attendance Records** | `/student/attendance`<br>`StudentAttendance.tsx` | `GET /api/student/subjects`<br>`GET /api/predictions` | `predictions` | Estimated Proxy | Student | Attendance percentage tracking and absence summary across enrolled subjects. Operational. |
| **Notifications** | `/student/notifications`<br>`StudentNotifications.tsx` | None (`api` empty) | None | Mock UI State | Student | Academic reminder feed (assessment deadlines, prediction updates). Operates purely in component state without database persistence. |
| **Feedback & Support** | `/student/feedback`<br>`StudentFeedback.tsx` | None (`api` empty) | None | Mock UI State | Student | Student inquiry and academic support request form. Operates purely in component state without database persistence. |
| **Settings** | `/student/settings`<br>`StudentSettings.tsx` | `PATCH /api/me`<br>`POST /auth/change-password` | `users` | Real (Self Only) | Student | Password update and profile settings. Operational. |

---

### 4.4 Analyst Portal (9 Tabs)

| Tab Name | Route & Component | Backend APIs | DB Collections | Data Source | Permissions | Functionality & Audit Observations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | `/analyst`<br>`AnalystOverview.tsx` | `GET /api/analyst/overview`<br>`GET /api/analyst/curriculum-stats` | `users`<br>`subjects`<br>`predictions` | Real (Aggregated) | Analyst | Institutional aggregate metrics (student count, faculty count, predictions, curriculum stats). $N < 5$ cell suppression active. Operational. |
| **Institutional Analytics** | `/analyst/institutional`<br>`AnalystInstitutional.tsx` | `GET /api/analyst/overview` | `users`<br>`predictions` | Real (Aggregated) | Analyst | Campus-wide enrollment distributions, teacher-student ratios, and platform adoption velocity. Operational. |
| **Subject & Curriculum** | `/analyst/curriculum`<br>`AnalystCurriculum.tsx` | `GET /api/analyst/curriculum-stats` | `subjects`<br>`student_subject_enrollments`<br>`teacher_subject_assignments` | Real (Aggregated) | Analyst | Subject-by-subject enrollment and faculty assignment statistics. Cell suppression verified for cohorts $< 5$. Operational. |
| **Performance Trends** | `/analyst/trends`<br>`AnalystTrends.tsx` | `GET /api/analyst/curriculum-stats` | `subjects` | Real & Calculated | Analyst | Macro grade trajectories across academic terms. Note: displays `12.7 / 20.0` Portuguese scale benchmark. Operational. |
| **Academic Risk Analytics** | `/analyst/risk`<br>`AnalystRisk.tsx` | `GET /api/analyst/overview` | `predictions` | Real & Heuristic | Analyst | Institutional risk tier distribution. Includes Academic Attrition Vulnerability Indicator advisory disclaimer. Operational. |
| **Anomaly Analysis** | `/analyst/anomalies`<br>`AnalystAnomalies.tsx` | `GET /api/analyst/diagnostics` | N/A | Heuristic | Analyst | Institutional anomaly frequency and mark deviation tracking. Diagnostics endpoint verified strictly role-isolated. Operational. |
| **Data Quality & Insights** | `/analyst/data-quality`<br>`AnalystDataQuality.tsx` | None (`api` empty) | N/A | Hardcoded Benchmark | Analyst | Displays UCI benchmark corpus metadata (395 Math, 649 Portuguese, 33 features, 0 nulls). Static reference ledger. Operational. |
| **Reports & Exports** | `/analyst/reports`<br>`AnalystReports.tsx` | `GET /api/analyst/curriculum-stats` | `subjects` | Real (Aggregated) | Analyst | Curriculum analytics export interface with CSV download. Enforces $N < 5$ suppression in exported data. Operational. |
| **Profile & Settings** | `/analyst/settings`<br>`AnalystSettings.tsx` | `PATCH /api/me`<br>`POST /auth/change-password` | `users` | Real | Analyst | Analyst profile updates (`full_name`) and password management. Operational. |

---

## 5. Registration & Profile Audit

### 5.1 Profile Data Architecture (`User` Model)
The `User` entity (`backend/models/user_model.py`) was significantly upgraded in Phase 7A:
- **Core Identity**: `id`, `email` (normalized, unique), `password_hash` (bcrypt), `full_name`, `role` (`student`, `teacher`, `admin`, `analyst`), `is_active`, `avatar_url`, `must_change_password`, `created_at`, `updated_at`.
- **Institutional Identifiers**: `student_id` (sparse unique index), `employee_id` (sparse unique index), `contact_number`, `department`.
- **Structured Sub-Documents**:
  - `personal_info`: `date_of_birth`, `gender`, `nationality`, `blood_group`.
  - `contact_info`: `primary_phone`, `emergency_phone`, `residential_address`, `city`, `state`, `postal_code`, `country`.
  - `guardian_info` (Students): `guardian_name`, `relationship`, `guardian_email`, `guardian_phone`, `occupation`, `address`.
  - `academic_info` (Students): `admission_date`, `current_program`, `current_term`, `previous_school`, `gpa_score`, `academic_status`.
  - `professional_info` (Faculty): `highest_qualification`, `institution_graduated`, `graduation_year`, `specialization`, `total_experience_years`, `research_interests`.
  - `employment_info` (Faculty): `designation`, `employment_type`, `joining_date`, `work_location`, `office_room`.
  - `documents`: List of `{ "name": str, "type": str, "url": str, "uploaded_at": str }`.

### 5.2 Registration Workflows
1. **Public Student Registration** (`/register` -> `POST /auth/register`):
   - Strict role assignment: role is hardcoded as `student` in `AuthService.register_student()` to prevent privilege escalation.
   - Enforces password complexity (minimum 8 characters, at least 1 letter, at least 1 digit).
2. **Administrative Student Registration** (`AdminStudents.tsx` -> `StudentRegistrationModal.tsx`):
   - Comprehensive 6-step wizard: Personal Info, Contact Info, Guardian Details, Academic Info, Account Setup, Document Uploads.
   - Generates/validates unique `student_id`.
3. **Administrative Teacher Registration** (`AdminTeachers.tsx` -> `TeacherRegistrationModal.tsx`):
   - Comprehensive 6-step wizard: Personal Info, Contact Info, Academic & Qualifications, Employment Details, Account Setup, Document Uploads.
   - Generates/validates unique `employee_id`.

### 5.3 Upload & File Storage Security (`backend/routes/upload_routes.py`)
- Upload directory: `backend/uploads/avatars` and `backend/uploads/documents`.
- File validation: Allowed image extensions (`png`, `jpg`, `jpeg`, `webp`, max 5 MB); allowed document extensions (`pdf`, `doc`, `docx`, `png`, `jpg`, max 10 MB).
- Filename sanitization: `secure_filename()` combined with UUID generation (`f"{uuid4().hex}_{clean_name}"`) prevents directory traversal attacks (`../`).
- Protected file delivery (`GET /api/uploads/<folder>/<filename>`): requires authentication (`@login_required`), preventing unauthenticated access to student/faculty identity documents.

### 5.4 Profile Audit Gap Analysis
- **Missing in Self-Service**: While the Administrator possesses comprehensive multi-section view/edit capabilities via `EditUserModal.tsx` and profile drawers, the student's own profile page (`StudentProfile.tsx`) and the teacher's own profile page (`TeacherProfile.tsx`) currently only render inputs for `full_name` and password.
- **Recommendation**: Upgrade `StudentProfile.tsx` and `TeacherProfile.tsx` to display all profile sections and allow editing of appropriate contact details, while keeping official institutional identifiers read-only.

---

## 6. Database & Backend Audit

### 6.1 Database Schema & Index Inventory
MongoDB 6.x indexes are defined in `backend/database/schema.py` and verified via `init_db_indexes()`:
1. `users` (5 indexes): `email` (unique), `role`, `created_at`, `student_id` (unique, sparse), `employee_id` (unique, sparse).
2. `academic_records` (3 indexes): `student_id`, `(student_id, term)`, `created_at`.
3. `predictions` (8 indexes): `student_id`, `(student_id, created_at)`, `(subject, milestone)`, `predicted_status`, `risk_level`, `created_at`, `(student_id, subject_id, created_at)` (sparse), `(subject_id, created_at)` (sparse).
4. `teacher_student_assignments` (4 indexes): `(teacher_id, student_id)` (unique), `teacher_id`, `student_id`, `status`.
5. `system_logs` (3 indexes): `timestamp`, `event_type`, `user_id`.
6. `analytical_academic_records` (4 indexes): `(student_code, subject, academic_year)` (unique), `academic_status`, `subject`, `final_exam_marks`.
7. `subjects` (3 indexes): `code` (unique), `canonical_key` (unique), `is_active`.
8. `teacher_subject_assignments` (3 indexes): `(teacher_id, subject_id, academic_term)` (unique), `(teacher_id, status)`, `(subject_id, status)`.
9. `student_subject_enrollments` (3 indexes): `(student_id, subject_id, academic_term)` (unique), `(student_id, status)`, `(subject_id, status)`.

### 6.2 Referential Integrity Verification
Execution of `scripts/database_integrity_audit.py` produced zero errors:
- Total Users: 4 (`admin@edupredict.com`, `dr.foster@edupredict.com`, `john.doe@gmail.com`, `analyst@edupredict.com`).
- Subject Catalog: 2 verified active subjects (`MATH-101`, `PORT-101`).
- Teacher Allocations: 2 active assignments, all referencing valid teacher ObjectIds.
- Student Enrollments: 2 active enrollments, all referencing valid student ObjectIds.
- Duplicate records: **0**.
- Orphaned foreign references: **0**.

### 6.3 API Security, Validation & Error Handling
- **CSRF Protection**: Flask-WTF CSRF enabled on all mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`). The React frontend (`api.ts`) retrieves tokens via `/api/csrf-token` and auto-retries on 400 CSRF expiration.
- **Subject-Level RBAC**: Evaluated in `backend/utils/decorators.py` by `can_access_student_subject_data()`. Cross-subject IDOR is completely blocked.
- **Analyst Boundary**: Analysts are restricted from user management, subject editing, student profile drawers, and individual prediction lookups (`test_analyst_rbac.py` verified).
- **Graceful Error Handling**: Custom handlers registered for 400, 401, 403, 404, 429, and 500 returning consistent JSON payloads (`{ "error": str, "message": str, "status_code": int }`).
- **Backup Readiness**: While database schemas and indexes enforce transactional consistency, automated scheduled backup scripts (`mongodump` cron/systemd service or S3 snapshots) are not yet implemented.

---

## 7. Machine Learning & Data Integrity Audit

### 7.1 Champion Inference Pipelines
In Phase 5A, 54 candidate pipelines were trained across Mathematics and Portuguese Language cohorts. 12 champion pipelines were exported to `ml_models/saved_models/` alongside JSON metadata:
- **Mathematics Milestone 0**: Random Forest Regressor ($R^2 = 0.2067$, $\text{RMSE} = 19.42$); Random Forest Classifier (Macro-F1 = 0.5599).
- **Mathematics Milestone 1**: HistGradientBoosting Regressor ($R^2 = 0.6776$, $\text{RMSE} = 12.38$); HistGradientBoosting Classifier (Macro-F1 = 0.7386).
- **Mathematics Milestone 2**: Random Forest Regressor ($R^2 = 0.8955$, $\text{RMSE} = 7.05$); HistGradientBoosting Classifier (Macro-F1 = 0.8632).
- **Portuguese Milestone 0**: Random Forest Regressor ($R^2 = 0.1650$, $\text{RMSE} = 15.73$); HistGradientBoosting Classifier (Macro-F1 = 0.4711).
- **Portuguese Milestone 1**: Random Forest Regressor ($R^2 = 0.6935$, $\text{RMSE} = 9.53$); HistGradientBoosting Classifier (Macro-F1 = 0.7060).
- **Portuguese Milestone 2**: Random Forest Regressor ($R^2 = 0.9030$, $\text{RMSE} = 5.36$); HistGradientBoosting Classifier (Macro-F1 = 0.8121).

### 7.2 Target Leakage Prevention
`backend/data_engineering/leakage_guard.py` enforces temporal integrity:
- At Milestone 0 (Registration): Only demographic, family, and educational background features are admitted. $G_1, G_2, G_3$ and final attendance are strictly prohibited.
- At Milestone 1 (Mid-Term): $G_1$ (first period mark) and estimated attendance are admitted. $G_2$ and $G_3$ are strictly prohibited.
- At Milestone 2 (Continuous Assessment): $G_1, G_2$, and estimated attendance are admitted. $G_3$ (final exam mark) is strictly prohibited across all milestones.
- The `assert_no_leakage()` validation function runs before every inference request.

### 7.3 Target Scale & Risk Classification Thresholds
- **Regression Target**: Continuous final exam mark scaled to **0.0 – 100.0** percentage marks ($G_3 \times 5$).
- **Classification Target**: 3-tier risk classification:
  - **High Risk**: $0.0 - 49.9$ marks (Failing grade; $G_3 < 10/20$).
  - **Medium Risk**: $50.0 - 69.9$ marks (Passing but vulnerable; $10/20 \le G_3 < 14/20$).
  - **Low Risk**: $70.0 - 100.0$ marks (Good to excellent; $G_3 \ge 14/20$).
- **Dual-Model Inference Consistency**: When the regressor and classifier disagree (e.g., regressor predicts $51.2\%$ Medium Risk, but classifier assigns High Risk), the system flags an `uncertainty_warning` and recommends educator review.

### 7.4 Modeling Limitations
1. **Student Dropout Prediction**: The UCI dataset tracks academic performance within secondary school classes; it does not contain true institutional withdrawal/attrition labels. The "Academic Attrition Vulnerability Indicator" is an advisory heuristic ($G_1 < 10/20$ and high absence rate), not an empirical dropout survival model.
2. **Course Demand Forecasting**: Unimplemented. Forecasting elective registration volumes requires multi-year registration time-series data, which is not present in the current dataset.
3. **ML Anomaly Detection**: Unimplemented. Current anomaly views rely on heuristic rule-based thresholds rather than unsupervised ML algorithms (Isolation Forest).

---

## 8. Complete UI/UX Audit

### 8.1 Visual & Interactive Assessment
Inspection of the application interfaces across all four portals revealed the following:
- **Design System & Typography**: Clean, modern interface styled with Tailwind CSS, utilizing a consistent corporate blue palette (`#0B192C`, `#1E3E62`, `#0284c7`), readable typography, balanced card padding, and subtle shadows.
- **Sidebar & Navigation**: Distinct sidebars for Administrator, Teacher, Student, and Analyst with active route indicators, badge pills, and collapsible behavior.
- **Table Design**: Standardized table headers (`thead bg-slate-50`), consistent column alignment (left-aligned text, centered badges, right-aligned numeric marks and actions), and hover row highlights.
- **Forms & Wizards**: Multi-step registration wizards (`StudentRegistrationModal`, `TeacherRegistrationModal`) feature clean step indicators, clear validation errors, and accessible inputs.
- **Modals & Drawers**: Profile drawers (`StudentProfileDrawer`, `TeacherProfileDrawer`) provide fluid slide-out views with tabbed sections for Personal, Contact, Academic, and Document data.
- **Login Portal Experience**: Quick-fill demo account pills (Admin, Teacher, Student, Analyst) allow instant testing without manual credential entry.

### 8.2 Identified UI/UX Deficiencies
1. **Grading Scale Denominator Ambiguity**:
   - In `AnalystTrends.tsx:69`: `value="12.7 / 20.0"`.
   - In `StudentProgress.tsx:82`: `value="14.0 / 20.0"`.
   - In `AnalystRisk.tsx:83, 89`: `Score range 10–12 / 20`, `Predicted mark < 10 / 20`.
   - In `PredictionDetailModal.tsx`: `{predicted_marks.toFixed(1)}/100`.
   - *Issue*: Presenting a 0–20 Portuguese scale in some cards and a 0–100 scale in predictions creates cognitive dissonance for users. Standardizing on a dual-display format (e.g. `62.3% (12.5 / 20)`) will eliminate ambiguity.
2. **Mock Presentation States in Sidebar Tabs**:
   - `AdminNotifications`, `TeacherNotifications`, `StudentNotifications`, `AdminFeedback`, `TeacherFeedback`, `StudentFeedback`, and `AnalystDataQuality` operate purely in component state without backend API persistence.
3. **Self-Service Profile Edit Scope**:
   - Students and Teachers cannot view or edit their guardian or contact information from their personal profile tabs.

---

## 9. Testing & GitHub Audit

### 9.1 Test Execution Verification
- **Backend Test Suite (`pytest`)**:
  - Command: `.venv\Scripts\pytest -v`
  - Result: **151 passed in 112.68s** (0 failures, 0 errors).
  - Scope: RBAC regression, analyst cell suppression, subject-level isolation, target leakage guard, registration workflows, file upload validation, model loading.
- **Frontend Test Suite (`vitest`)**:
  - Command: `npx vitest run`
  - Result: **15 passed across 1 test file** (`subject_workspace.test.tsx`).
- **Frontend TypeScript & Production Build**:
  - Command: `tsc -b && vite build`
  - Result: **2,084 modules transformed, built in 19.25s, 0 TypeScript errors**.

### 9.2 GitHub Status
- **Current Branch**: `main`.
- **Local/Remote Sync**: Fully up-to-date with `origin/main` (`https://github.com/azanali30/EduPredict.git`).
- **Working Tree**: Clean (`nothing to commit, working tree clean`).
- **Latest Commit**: `5b44d27` (*fix(auth): resolve login 500 error, enhance proxy resilience and add demo credentials*).

---

## 10. Outstanding Issues Summary

The table below catalogs all outstanding, partially resolved, or missing features identified during this audit.

| Issue ID | Description | Severity | Affected Layer | Impact |
| :---: | :--- | :---: | :---: | :--- |
| **ISS-01** | **Grading Scale Inconsistency (0–20 vs 0–100)**: Analytics cards display `/20.0` while predictions display `/100`. | **P2** | Frontend | User confusion regarding mark scales and passing thresholds. |
| **ISS-02** | **Limited Self-Service Profile Pages**: Students and Faculty cannot view/edit full profile details on `/student/profile` and `/teacher/profile`. | **P1** | Full-Stack | Students and teachers must rely on administrators to view contact/guardian details. |
| **ISS-03** | **Mock Notification Engine**: Notification tabs display mock state; no backend collection or dispatch worker exists. | **P2** | Backend & DB | Alert notifications do not persist across sessions or trigger email alerts. |
| **ISS-04** | **Mock Feedback & Support Portal**: Feedback forms do not persist submissions to a database collection. | **P2** | Backend & DB | Student and faculty inquiries cannot be managed by administrators. |
| **ISS-05** | **Missing ML Anomaly Detection**: Anomaly views rely on heuristic mark drop rules rather than Isolation Forest. | **P2** | ML & Backend | Inability to detect subtle multi-dimensional behavioral anomalies. |
| **ISS-06** | **Missing Course Demand Forecasting**: No models exist to forecast elective or course registration volumes. | **P3** | ML & Backend | Unfulfilled secondary SRS requirement. |
| **ISS-07** | **Unimplemented Real-Time Streaming**: No SSE, WebSockets, or Kafka event bus deployed. | **P3** | Infrastructure | Campus events are processed via batch REST rather than real-time streams. |
| **ISS-08** | **Automated Database Backups**: No automated scheduled `mongodump` cold backup script or pipeline is configured. | **P1** | Backend & DevOps | Disaster recovery depends on manual intervention. |

---

## 11. Prioritized Next Implementation Roadmap

### Priority Classifications
- **P0 (Critical)**: Zero P0 security or data integrity vulnerabilities were identified in this audit.
- **P1 (Essential)**: Core functional gaps directly impacting user workflows and administrative operations.
- **P2 (Important)**: Usability, analytics consistency, and communication features.
- **P3 (Enhancements)**: Infrastructure or secondary exploratory modules.

### Phase Ranking Matrix

| Phase | Title | Priority | Primary Scope & Objectives |
| :---: | :--- | :---: | :--- |
| **Phase 7B** | **Self-Service Profile Upgrades & Grading Scale Normalization** | **P1 (Recommended Next)** | Upgrade `/student/profile` and `/teacher/profile` to render and edit rich profile sections; standardize grading scale displays to unified percentage format with optional 0–20 dual-notation. |
| **Phase 7C** | **Persistent In-App Notifications & Feedback Support Engine** | **P2** | Create MongoDB collections and REST APIs for notifications and support feedback; replace mock UI states with real persistent messaging. |
| **Phase 7D** | **ML Anomaly Detection (Isolation Forest) & Automated Database Backups** | **P2** | Train and deploy Scikit-learn Isolation Forest model for multi-dimensional anomaly scoring; implement automated `mongodump` backup script. |
| **Phase 8** | **Course Demand Forecasting & Big Data Stream Expansion** | **P3** | Implement synthetic registration forecasting models and exploratory real-time event streaming interfaces. |

---

## 12. Recommended Next Implementation Phase: Phase 7B

### Phase 7B Specification: Self-Service Profile Upgrades & Grading Scale Normalization

#### 1. Objectives
1. Bring the student and teacher self-service profile pages (`/student/profile` and `/teacher/profile`) to feature parity with the administrative profile drawers by allowing users to view their complete institutional records and update designated personal/contact information.
2. Resolve grading scale discrepancies across the platform by establishing a consistent mark presentation convention: primary percentage score ($0.0 - 100.0\%$) with dual Portuguese scale reference ($0 - 20$) where relevant.

#### 2. Exact Features to Implement
- **Student Profile View Upgrade** (`frontend/src/pages/student/StudentProfile.tsx`):
  - Add tabbed sections: Personal Details, Contact Information, Guardian Details, Academic Record, Document Vault.
  - Allow student to edit residential address, emergency contact, and phone numbers.
  - Display read-only official fields: Student ID, Admission Date, Academic Program, Enrolled Subjects.
- **Teacher Profile View Upgrade** (`frontend/src/pages/teacher/TeacherProfile.tsx`):
  - Add tabbed sections: Personal Details, Contact Information, Professional Qualifications, Employment Record.
  - Allow teacher to edit contact number, office room, and research interests.
  - Display read-only official fields: Employee ID, Designation, Department, Active Subject Allocations.
- **Backend Self-Service Profile Endpoint** (`PATCH /api/me`):
  - Update `update_profile` in `backend/routes/user_routes.py` to accept and validate editable fields in `personal_info`, `contact_info`, and `guardian_info`.
  - Prevent non-administrators from tampering with `role`, `is_active`, `student_id`, `employee_id`, `department`, or `academic_info`.
- **Grading Scale Normalization**:
  - Update `AnalystTrends.tsx`, `AnalystRisk.tsx`, `StudentProgress.tsx`, and `AdminRiskMonitoring.tsx` to display unified percentage scores with explicit scale denominators (e.g., `63.5% (12.7 / 20.0)`).
  - Clarify risk tier thresholds across all tooltips and legends ($< 50\%$ / Failing; $50 - 69\%$ / Vulnerable; $\ge 70\%$ / Good).

#### 3. Affected Files
- `backend/routes/user_routes.py`
- `backend/services/user_service.py`
- `frontend/src/pages/student/StudentProfile.tsx`
- `frontend/src/pages/teacher/TeacherProfile.tsx`
- `frontend/src/pages/analyst/AnalystTrends.tsx`
- `frontend/src/pages/analyst/AnalystRisk.tsx`
- `frontend/src/pages/student/StudentProgress.tsx`
- `frontend/src/pages/admin/AdminRiskMonitoring.tsx`
- `frontend/src/services/api.ts`
- `tests/test_registration_workflows.py`

#### 4. Testing & Verification Requirements
- Pytest tests validating that regular users cannot mutate `role`, `student_id`, or `employee_id` via `PATCH /api/me`.
- Pytest tests validating that valid contact info updates succeed and update the MongoDB document.
- Vitest and TypeScript build checks verifying that upgraded profile components render cleanly.

---

## 13. Stakeholder Decision Request

This audit concludes in strict **READ-ONLY** mode. No source code, models, or database records have been modified.

**Approval Request**:
Please review this comprehensive audit and confirm approval to proceed with **Phase 7B (Self-Service Profile Upgrades & Grading Scale Normalization)** as the single next implementation phase.
