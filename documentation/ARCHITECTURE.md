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
│       └── subject_workspace.test.tsx # 15 automated integration tests for multi-subject workflows
```

---

## 3. Frontend-Backend Security & Authentication Flow

1. **CSRF Protection via Session Secret**:
   - On application load or prior to mutating requests, `api.ts` invokes `GET /api/csrf-token`.
   - Flask-WTF generates a signed CSRF token bound to the active session.
   - For all `POST`, `PUT`, `DELETE` requests, `api.ts` automatically attaches the token in the `X-CSRFToken` request header.
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

The operational database runs on MongoDB 6.x on port `27017` with the following first-class collections and index configurations:

### 4.1 First-Class Collections
1. **`users`**:
   - Stores user authentication and profile data (Admin, Teacher, Student).
   - Indexes: Unique `email`, Single `role`, Compound `(role, is_active)`.
2. **`subjects`**:
   - Curriculum catalog entities (e.g. Mathematics `MATH-101`, Portuguese Language `PORT-101`).
   - Indexes: Unique `code` (case-insensitive), Unique `canonical_key`, Single `name`, Single `is_active`.
3. **`teacher_subject_assignments`**:
   - Institutional allocations linking teachers to subjects and academic terms.
   - Indexes: Compound Unique `(teacher_id, subject_id, academic_term)`, Single `teacher_id`, Single `subject_id`, Single `status`.
4. **`student_subject_enrollments`**:
   - Course registrations linking students to subjects and academic terms.
   - Indexes: Compound Unique `(student_id, subject_id, academic_term)`, Single `student_id`, Single `subject_id`, Single `status`.
5. **`predictions`**:
   - Multi-milestone ML inference records and feature provenance.
   - Fields: `student_id`, `subject` (canonical string), `subject_id` (ObjectId reference), `academic_term`, `milestone`, `predicted_score`, `risk_level`, `model_type`, `feature_snapshot`.
   - Indexes: Compound `(student_id, created_at)`, Single `subject_id`, Single `risk_level`, Single `milestone`.
6. **`academic_records`**:
   - Historical student academic and demographic observations.
   - Indexes: Unique `student_code`, Single `academic_status`.
7. **`system_logs`**:
   - Security and administrative audit trail.
   - Indexes: Single `timestamp`, Single `event_type`.
8. **`teacher_student_assignments` (Preserved Legacy Collection)**:
   - Preserved for backward auditability. Completely superseded by `teacher_subject_assignments` and `student_subject_enrollments`. Legacy assignments never grant subject-level access.

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
   - **Milestone 0 (Term Registration)**: 30 demographic, parental, and behavioral indicators. Zero exam marks. Serves as early diagnostic with explicit false negative disclosures.
   - **Milestone 1 (Mid-Term)**: Milestone 0 features + Period 1 examination marks ($G_1$ / `previous_exam_marks`).
   - **Milestone 2 (Continuous Assessment)**: Milestone 1 features + Period 2 continuous quiz scores ($G_2$ / `quiz_scores`).
2. **Leakage Protection**:
   - $G_3$ (`final_exam_marks`, `academic_status`, `final_percentage`) is strictly excluded from all training and inference feature sets via `backend.data_engineering.leakage_guard.assert_no_leakage()`.
3. **Artifact Provenance**:
   - 12 serialized Scikit-learn pipelines in `ml_models/saved_models/` (HistGradientBoosting and Random Forest) partitioned by discipline (`math_*`, `portuguese_*`) and milestone (0, 1, 2) alongside metadata manifests.

---

## 7. Data Engineering & Big Data Infrastructure Specifications

1. **Operational Environment**:
   - In standard deployment, MongoDB 6.x serves as both the high-throughput transactional database and the primary operational store for students, subjects, allocations, and predictions.
2. **Big Data Lakehouse (Architectural Specification & Docker Stack)**:
   - EduPredict includes a containerized Apache Hadoop 3.x / WebHDFS lakehouse configuration (`analytics/hdfs/docker-compose-hdfs.yml`) and Apache Impala query definitions (`analytics/impala/lakehouse_analytical_queries.sql`).
   - The Python bridge class `backend.data_engineering.hdfs_lakehouse.HDFSLakehouseManager` interfaces with WebHDFS via REST API (`HDFS_ENABLED=true`), defaulting gracefully to disabled mode in local development.
   - R statistical verification scripts (`analytics/r_scripts/statistical_tests.R`) document foundational hypothesis testing across curriculum distributions.
