# EduPredict – System Architecture & Technical Design

## 1. Architectural Philosophy
EduPredict is an AI/ML-driven Educational Performance Prediction and Analytics Platform designed using a **Decoupled Modular Architecture**. It combines a responsive modern React 18 Single Page Application (SPA), a high-throughput operational NoSQL datastore (MongoDB 6.x), a subject-based Role-Based Access Control (RBAC) security layer, a multi-milestone machine learning inference engine, and deployable Big Data Lakehouse bridges.

```
                      +-------------------------------------------------------+
                      |         Presentation Tier: React 18 / TypeScript SPA  |
                      |  - Vite 6 Bundler & Dev Proxy                         |
                      |  - Centralized AuthContext (Session Restoration)      |
                      |  - TeacherSubjectContext (Scoped Subject Switching)   |
                      |  - Role-Partitioned Dashboards (Student, Teacher, Admin)|
                      |  - Responsive SaaS Layout & Lucide Iconography        |
                      +---------------------------+---------------------------+
                                                  |
                                            HTTP / JSON
                                  (Credentials: include, X-CSRFToken)
                                                  v
                      +-------------------------------------------------------+
                      |              Web & Application Gateway                |
                      |  - Flask WSGI Application                             |
                      |  - Authentication & RBAC Guard (@role_required)       |
                      |  - Subject Authorization Guard (can_access_student...) |
                      |  - CSRF Protection & Secure Session Cookies           |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |                Service Business Tier                  |
                      |  - AuthService & Role Enforcement                     |
                      |  - UserService (Profile, Passwords, Role Management)  |
                      |  - SubjectService (Curriculum Catalog Management)     |
                      |  - AssignmentService (Teacher-Subject Allocations)    |
                      |  - EnrollmentService (Student-Subject Enrollments)    |
                      |  - PredictionService (Multi-Milestone Inference & Logs)|
                      |  - SystemLogService (Audit Trail)                     |
                      +-------------------+-------------------+---------------+
                                          |                   |
                        +-----------------+                   +-----------------+
                        v                                                       v
    +---------------------------------------+               +---------------------------------------+
    |         Operational Datastore         |               |          Big Data & ML Layer          |
    |  - MongoDB Server 6.0.29 (Native)     |               |  - Multi-Milestone ML Models (M0,M1,M2|
    |  - Collections: users, records,       |               |  - Scikit-Learn (HistGradBoost, RF)   |
    |    subjects, teacher_subject_assign,  |               |  - Subject Pipelines (Math, Port)     |
    |    student_subject_enroll, preds, logs|               |  - Optional HDFS/Impala Docker Stack  |
    +---------------------------------------+               +---------------------------------------+
```

---

## 2. Frontend Application Architecture (React 18 + TypeScript + Vite + Tailwind CSS)

The frontend is structured as a dedicated TypeScript SPA inside `frontend/` powered by Vite 6 and Tailwind CSS v3:
```text
frontend/
├── package.json              # React 18, Tailwind CSS 3.4, Recharts 2.15, Lucide-React
├── tsconfig.json             # Strict TypeScript compiler options
├── vite.config.ts            # Local development proxy (/auth, /api -> :5000)
├── tailwind.config.js        # Design tokens: Navy, Brand Blue, Cyan, Card Surfaces
├── src/
│   ├── main.tsx              # Application bootstrap with global styles
│   ├── App.tsx               # Route hierarchy with TeacherSubjectProvider scoping
│   ├── types/
│   │   └── index.ts          # SubjectItem, TeacherSubjectAssignmentItem, StudentSubjectEnrollmentItem, etc.
│   ├── services/
│   │   └── api.ts            # Centralized API service with automated CSRF injection & multi-subject client
│   ├── context/
│   │   ├── AuthContext.tsx           # Authentication session & user state
│   │   └── TeacherSubjectContext.tsx # Dynamic teacher subject selector & context management
│   ├── components/
│   │   ├── common/           # Navbar, Sidebar, PageHeader, StatCard, EmptyState, Modal
│   │   └── predictions/      # PredictionForm (scoped subjects), TeacherPredictionModal
│   ├── layouts/
│   │   ├── AuthLayout.tsx    # Branded centered container for authentication
│   │   └── DashboardLayout.tsx # Sticky sidebar, header with subject selector, and workspace container
│   ├── routes/
│   │   └── ProtectedRoute.tsx# Enforces authentication & role-based route protection
│   ├── pages/
│   │   ├── auth/             # LoginPage, RegisterPage, ForgotPasswordPage
│   │   ├── student/          # StudentOverview, StudentPredictions, StudentRecords, StudentProfile
│   │   ├── teacher/          # TeacherOverview, TeacherStudents, TeacherPerformance, TeacherPredictions,
│   │   │                     # TeacherAtRisk, TeacherReports, TeacherProfile, TeacherSettings
│   │   ├── admin/            # AdminOverview, UserManagement, TeacherAssignments (3 Tabs), SystemLogs
│   │   └── status/           # UnauthorizedPage (403), NotFoundPage (404)
│   └── __tests__/
│       └── ...               # 10 Vitest integration test suites (49 frontend tests)
```

---

## 3. Frontend-Backend Security & Authentication Flow

1. **CSRF Protection via Session Secret**:
   - On application load or prior to mutating requests, `api.ts` invokes `GET /api/csrf-token`.
   - Flask-WTF generates a signed CSRF token bound to the active session.
   - For all `POST`, `PUT`, `PATCH`, `DELETE` requests, `api.ts` automatically attaches the token in the `X-CSRFToken` request header.
   - If a request encounters a CSRF expiration error (400), `api.ts` automatically refreshes the token and transparently retries the mutation once.
2. **Session Cookies & Credentials**:
   - All fetch requests specify `credentials: 'include'`.
   - Flask-Login issues secure HTTP-only cookies (`session=...`).
   - Sensitive credentials (passwords, tokens) are never stored in client-side storage (`localStorage` or `sessionStorage`).
3. **Session Restoration**:
   - When the user refreshes their browser, `AuthContext` calls `GET /api/me`.
   - If the session cookie is valid, the user state is restored and the user remains on their dashboard.
   - If the session has expired or is invalid (401), the user is redirected to `/login`.
4. **Client-Side Role Authorization & Route Guards**:
   - `ProtectedRoute` inspects `user.role` against `allowedRoles`.
   - If an unauthorized user attempts direct URL navigation, they are redirected to `/unauthorized` (403 Access Denied).
   - Server-side decorators (`@role_required`, `@admin_required`, `can_access_student_subject_data`) remain the primary source of truth.

---

## 4. Database Schema & Operational Collections (MongoDB 6.x)

The operational database runs on MongoDB 6.x on port `27017` with 20 indexed operational and analytical collections:

### 4.1 Operational, Institutional & Analytical Collections
1. **`users`**:
   - Stores user authentication and profile data (`admin`, `teacher`, `student`, `analyst`).
   - Indexes: Unique `email`, Single `role`, Compound `(role, is_active)`.
2. **`subjects`**:
   - Curriculum catalog entities (`Mathematics` `MATH-101`, `Portuguese Language` `PORT-101`).
   - Indexes: Unique `code` (case-insensitive), Unique `canonical_key`, Single `name`, Single `is_active`.
3. **`teacher_subject_assignments`**:
   - Institutional allocations linking teachers to subjects and academic terms.
   - Indexes: Compound Unique `(teacher_id, subject_id, academic_term)`, Single `teacher_id`, Single `subject_id`, Single `status`.
4. **`student_subject_enrollments`**:
   - Course registrations linking students to subjects and academic terms.
   - Indexes: Compound Unique `(student_id, subject_id, academic_term)`, Single `student_id`, Single `subject_id`, Single `status`.
5. **`attendance_sessions`**:
   - Teacher-conducted institutional roll-call sessions per subject, term, date, and title.
   - Indexes: Compound Unique `(subject_id, academic_term, session_date, session_title)`, Compound `(teacher_id, session_date)`, Compound `(subject_id, academic_term, session_date)`.
6. **`attendance_records`**:
   - Verified student roll-call attendance statuses (`Present`, `Absent`, `Late`, `Excused`), strictly isolated from ML 60-session proxies.
   - Indexes: Compound Unique `(session_id, student_id)`, Compound `(student_id, subject_id, academic_term, session_date)`, Compound `(subject_id, academic_term, session_date)`.
7. **`academic_records`**:
   - Institutional coursework assessments (`g1`, `g2`, `final_exam_marks`, `assignment_completion_rate`, `quiz_average`, `study_hours_per_week`) via REST CRUD, CSV bulk import, and stream sync.
   - Indexes: Partial Unique `(student_id, subject, term)`, `student_id`, `(student_id, term)`, `created_at`.
8. **`analytical_academic_records`**:
   - De-identified benchmark observations imported for analytics and Parquet lakehouse export.
9. **`predictions`**:
   - Multi-milestone ML inference records (`predicted_marks`, `predicted_status`, `features_summary`, `academic_term`, `subject`, `subject_id`, `milestone`). Derived 0–20 analytical views convert `predicted_marks / 5.0` dynamically.
10. **`dropout_records`** & 11. **`dropout_prediction_history`**:
   - Student early-warning dropout risk tiers (`risk_tier`, `risk_probability`) and longitudinal snapshots.
12. **`demand_forecasts`** & 13. **`demand_model_metadata`**:
   - Institutional enrollment demand projections and confidence intervals per course/term.
14. **`anomaly_records`**:
   - Human-reviewed academic performance anomalies detected via IsolationForest / statistical checks.
15. **`model_registry`**:
   - Serialized champion model metadata, version provenance, and holdout performance summaries.
16. **`stream_events`**:
   - Idempotent real-time academic event ingestion ledger and retry states.
17. **`notifications`**:
   - Role-scoped persistent alerts (early-warning prediction/dropout/anomaly triggers and admin broadcasts).
18. **`feedback_tickets`**:
   - Student and teacher support inquiries, administrative responses, and teacher-visible intervention follow-ups.
19. **`system_logs`**:
   - CRLF-sanitized, credential-redacted security, audit, and export trail.
20. **`teacher_student_assignments` (Preserved Legacy Collection)**:
   - Preserved read-only for backward auditability; superseded by `teacher_subject_assignments` and `student_subject_enrollments`.

---

## 5. Subject-Based Role-Based Access Control (RBAC) Architecture

### 5.1 Authorization Matrix
| Capability | Student | Teacher | Administrator |
| :--- | :--- | :--- | :--- |
| **View Student Profile** | Self only | Only if student enrolled in teacher's assigned subject | Full access |
| **View Academic Records** | Self (enrolled subjects) | Only for assigned subjects & enrolled students | Full access |
| **Generate Prediction** | Self (enrolled subjects) | Only for assigned subjects & enrolled students in matching term | Full access |
| **View Prediction History** | Self (enrolled subjects) | Only for assigned subjects & enrolled students | Full access |
| **Manage Subjects & Catalog** | Denied | Denied | Full CRUD access |
| **Allocate Teachers to Subjects**| Denied | Denied | Full CRUD access |
| **Enroll Students in Subjects** | Denied | Denied | Full CRUD access |

### 5.2 Academic Term Alignment Rules
A teacher is authorized to access a student's academic record or generate a prediction only when **all** of the following hold:
1. Teacher holds an active allocation in `teacher_subject_assignments` for that subject.
2. Student holds an active enrollment in `student_subject_enrollments` for that subject.
3. If an `academic_term` is specified, both allocations must match that exact term; if unspecified, teacher and student must share at least one active academic term.

---

## 6. Machine Learning Architecture & Governance

EduPredict implements a multi-milestone progressive inference architecture tailored per academic discipline:

1. **Milestones**:
   - **Milestone 0 (Term Registration)**: 33 demographic, parental, and behavioral indicators (zero exam marks). Serves as an early diagnostic with explicit baseline disclosures.
   - **Milestone 1 (Mid-Term)**: Milestone 0 features + Period 1 examination marks (`previous_exam_marks` / $G_1$ equivalent; 34 features).
   - **Milestone 2 (Continuous Assessment)**: Milestone 1 features + Period 2 continuous quiz scores (`quiz_scores` / $G_2$ equivalent; 35 features).
2. **Leakage Protection**:
   - $G_3$ (`final_exam_marks`, `academic_status`, `final_percentage`) is strictly excluded from all training and inference feature sets via `backend.data_engineering.leakage_guard.assert_no_leakage()`.
3. **Artifact Provenance**:
   - 13 serialized Scikit-learn pipelines in `ml_models/saved_models/` (12 Mathematics/Portuguese Milestone 0–2 regressors and classifiers plus `dropout_model.joblib`) alongside metadata manifests and reproducible training/evaluation notebooks (`notebooks/eda_academic_performance.ipynb`, `notebooks/02_model_training_and_evaluation.ipynb`).

---

## 7. Data Engineering & Big Data Infrastructure Specifications

1. **Operational Environment**:
   - In standard deployment, MongoDB 6.x serves as both the high-throughput transactional database and the primary operational store for students, subjects, allocations, and predictions.
2. **Big Data Lakehouse (Architectural Specification & Docker Stack)**:
   - EduPredict includes a containerized Apache Hadoop 3.x / WebHDFS lakehouse configuration (`analytics/hdfs/docker-compose-hdfs.yml`) and Apache Impala query definitions (`analytics/impala/lakehouse_analytical_queries.sql`).
   - The Python bridge class `backend.data_engineering.hdfs_lakehouse.HDFSLakehouseManager` interfaces with WebHDFS via REST API (`HDFS_ENABLED=true`), defaulting gracefully to disabled mode in local development.
   - R statistical verification scripts (`analytics/r_scripts/statistical_tests.R`) document foundational hypothesis testing across curriculum distributions.
