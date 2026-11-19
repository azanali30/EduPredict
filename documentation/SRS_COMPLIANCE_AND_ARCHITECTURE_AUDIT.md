# EduPredict — SRS Compliance Audit & Product Architecture Assessment

**Project**: EduPredict  
**Workspace**: `C:\Users\Azan's PC\Documents\EduPredict`  
**Specification Baseline**: Aptech eProject Big Data / EduPredict SRS  
**Audit Type**: Comprehensive Read-Only System Audit & Architecture Assessment  
**Audit Author**: Senior Software Architect & Educational Data Analytics Specialist  
**Execution Timestamp**: 2026-11-19  
**Status**: AUDIT COMPLETE — AWAITING STAKEHOLDER APPROVAL  

---

## 1. Executive Summary

This audit delivers an exhaustive, evidence-based architectural assessment of the **EduPredict** platform against the original 20 requirements specified in the Aptech eProject Big Data curriculum. Every assertion in this report is grounded in direct inspection of actual source code, database collections, serialized machine learning artifacts, automated test suites, and frontend components.

### 1.1 Key Audit Verdict
EduPredict has successfully evolved into a **academically rigorous, mathematically sound, and secure predictive intelligence platform** for educational performance. The core application—comprising a modern React 18 + TypeScript frontend, Flask REST backend, MongoDB 6.x datastore, Scikit-learn multi-milestone inference pipelines, and Subject-Based Role-Based Access Control (RBAC)—is **100% operational, fully tested (121 backend pytest tests and 15 frontend Vitest tests passing), and stable**.

However, when evaluated strictly against the expansive, enterprise-scale Aptech eProject SRS, significant functional divergences, architectural boundaries, and unfulfilled requirements emerge:
1. **Core Predictive Intelligence vs. Big Data Infrastructure**: The operational application is centered on MongoDB 6.x and Scikit-learn. The mandated Big Data components (Apache Hadoop/HDFS, Apache Impala) exist as **architectural specifications, container configurations, and script bridges with graceful offline fallbacks**, rather than continuously running distributed cluster daemons. This decoupled design was intentionally adopted due to the 8 GB RAM / 2-core physical workstation constraints.
2. **Predictive Model Scope**: Student academic mark regression and risk tier classification across three academic milestones (M0, M1, M2) are fully implemented for Mathematics and Portuguese Language. However, **Student Dropout Prediction (attrition/survival analysis), Course Demand Prediction (enrollment volume forecasting), and ML-based Anomaly Detection remain completely unimplemented**.
3. **Role Architecture**: Roles are constrained to `student`, `teacher`, and `admin`. The SRS-mandated `analyst` role is **missing**.
4. **Single-Tenant Foundation**: The database schema and authorization architecture are currently designed for a **single institution**. Moving to a Multi-Institution SaaS platform is technically feasible but requires fundamental tenant-context decoupling, compound index re-architecting, and platform governance before any commercial onboarding can occur.

---

## 2. Complete SRS Requirement Compliance Matrix

The 20 core requirements from the original Aptech Big Data-EduPredict SRS have been classified into four explicit implementation categories:
- **Implemented (Operational & Verified)**: Live in production source code, backed by functional endpoints, interfaces, models, and automated tests.
- **Partially Implemented**: Present in design, static queries, or foundational services, but lacking complete end-to-end operational automation.
- **Missing**: No source code, models, or endpoints exist in the repository.
- **Unverified (Environment-Dependent)**: Code or specifications exist, but runtime execution depends on external, unprovisioned distributed cluster hardware (e.g. active JVM HDFS/Impala daemons).

| # | SRS Requirement | Audit Status | Code References & Primary Artifacts | Summary Findings & Evidence |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Authentication & Authorization** (`Admin`, `Teacher`, `Student`, `Analyst`) | **Partially Implemented** | `backend/models/user_model.py:10`<br>`backend/utils/decorators.py:15-115`<br>`backend/routes/auth_routes.py` | `student`, `teacher`, and `admin` roles are fully implemented with Flask-Login, bcrypt, and subject-level RBAC. The **`analyst` role is completely missing** (`VALID_ROLES = {"student", "teacher", "admin"}`). |
| **2** | **Educational Data Ingestion** (Academic, Demographics, LMS, Attendance) | **Partially Implemented** | `backend/data_engineering/clean_dataset.py`<br>`backend/data_engineering/ingest_mongodb.py`<br>`data/raw/student-mat.csv` | Ingestion from UCI dataset (33 attributes: demographics, family, grades) into MongoDB is operational. **Live LMS integration (Canvas, Moodle LTI) is absent**; attendance is an estimated absence-derived proxy. |
| **3** | **Hadoop Distributed File System (HDFS)** | **Unverified / Spec Only** | `backend/data_engineering/hdfs_lakehouse.py`<br>`analytics/hdfs/docker-compose-hdfs.yml` | WebHDFS REST client class and Docker Compose stack exist. Live HDFS cluster is offline locally; graceful offline handling verified in `test_data_pipeline.py`. |
| **4** | **Data Partitioning & Storage Organization** | **Implemented** | `analytics/impala/01_create_academic_lakehouse_tables.sql`<br>`backend/database/schema.py` | External Impala DDL partitions by `academic_year` and `subject`. MongoDB features 8 collections with compound unique indexes (`(teacher_id, subject_id, academic_term)`). |
| **5** | **Parallel Data Processing** | **Partially Implemented** | `backend/data_engineering/ingest_mongodb.py:134`<br>`backend/ml/train_models.py` | Chunked batch writes (`batch_size=500`) and Scikit-learn multiprocessing (`n_jobs=-1`) exist. Dedicated multiprocessing worker services (`ProcessPoolExecutor` service) are not deployed. |
| **6** | **Pattern, Anomaly & Correlation Analysis** | **Partially Implemented** | `analytics/r/statistical_validation.R`<br>`analytics/impala/02_analytical_queries.sql:128` | Pearson/Spearman correlation matrices, Welch t-tests, and ANOVA exist in R scripts. Anomaly detection is a static SQL `CASE` rule; **ML anomaly detection is missing**. |
| **7** | **Missing Data Handling** | **Implemented** | `backend/ml/pipeline_builder.py:65-88`<br>`backend/data_engineering/clean_dataset.py` | `SimpleImputer` (median for numericals, most-frequent for categoricals) within Scikit-learn pipelines. Dataset cleaning enforces zero-null invariants. |
| **8** | **Real-Time Data Streaming & Batch Processing** | **Partially Implemented** | `backend/data_engineering/ingest_mongodb.py`<br>`documentation/BIG_DATA_IMPLEMENTATION_PLAN.md` | Batch database ingestion is operational. **Real-time event streaming (`/api/stream/events`, SSE, WebSockets, Kafka) is completely missing** in actual backend code. |
| **9** | **Student Performance Prediction** | **Implemented** | `backend/services/prediction_service.py`<br>`backend/ml/model_loader.py`<br>`ml_models/saved_models/` | 12 trained pipelines (HistGradientBoosting, Random Forest) predict continuous 0–100 final exam marks and 3-tier risk across Milestones 0, 1, and 2. Fully verified. |
| **10** | **Student Dropout Prediction** | **Missing** | `backend/ml/train_models.py`<br>`backend/data_engineering/leakage_guard.py` | Academic risk classification ($G_3 < 50\%$) is implemented, but **no specific student attrition / dropout survival-analysis model exists**. |
| **11** | **Course Demand Prediction** | **Missing** | `backend/services/` | **Completely missing**. No models, database collections, or API endpoints exist to forecast institutional course demand or elective registration volumes. |
| **12** | **Anomaly Detection & Trend Prediction** | **Partially Implemented** | `backend/services/prediction_service.py`<br>`analytics/impala/02_analytical_queries.sql` | Milestone trajectories ($G_1 \rightarrow G_2 \rightarrow G_3$) are modeled. Dedicated time-series forecasting (ARIMA/Prophet) and ML outlier detection are missing. |
| **13** | **Interactive Dashboards** | **Implemented** | `frontend/src/pages/student/`<br>`frontend/src/pages/teacher/`<br>`frontend/src/pages/admin/` | High-fidelity React 18 + Recharts dashboards across 14 routes for Student, Teacher (8 pages), and Admin workspaces. Tableau `.twb` workbook provided. |
| **14** | **Notifications & Alerts** | **Partially Implemented** | `frontend/src/pages/teacher/TeacherAtRisk.tsx`<br>`frontend/src/components/common/ErrorAlert.tsx` | Visual UI alert badges, at-risk triage queues, and M0 diagnostic warnings exist. **Centralized notification engine (email/SMS/in-app bell) is missing**. |
| **15** | **Feedback & Support** | **Partially Implemented** | `frontend/src/pages/teacher/TeacherAtRisk.tsx:210`<br>`frontend/src/components/predictions/PredictionForm.tsx` | Rule-based academic intervention suggestions and `mailto:` instructor check-in links exist. Dedicated ticketing/support portal is missing. |
| **16** | **Security & Encryption** | **Implemented** | `backend/utils/security.py`<br>`backend/utils/decorators.py`<br>`apache/httpd-edupredict.conf` | Bcrypt password hashing, Flask-WTF session CSRF tokens, HTTP-only secure cookies, and strict multi-subject RBAC with cross-subject IDOR prevention. |
| **17** | **Data Integrity & Backup** | **Partially Implemented** | `backend/database/schema.py`<br>`scripts/database_integrity_audit.py` | Enforced via compound unique MongoDB indexes and dry-run audit scripts. **Automated scheduled database dump/cold backup pipelines are missing**. |
| **18** | **Scalability & Load Balancing** | **Partially Implemented** | `apache/httpd-edupredict.conf`<br>`wsgi.py` | Stateless REST APIs, PyMongo connection pooling, and Apache reverse proxy config. Multi-instance cluster orchestration (Kubernetes/Swarm) is not deployed. |
| **19** | **Performance Monitoring** | **Partially Implemented** | `backend/routes/health_routes.py`<br>`backend/models/system_log_model.py` | Health probes (`/health`, `/api/health`, `/api/health/db`), ping latency tracking, and audit logs. Enterprise APM (Prometheus/Grafana) is not integrated. |
| **20** | **User & Developer Documentation** | **Implemented** | `documentation/*` (25+ reports)<br>`DATA_DICTIONARY.md`<br>`ARCHITECTURE.md` | Comprehensive architectural documentation, data dictionaries, API contracts, deployment instructions, and test logs. |

---

## 3. Detailed Audit by Implementation Category

### 3.1 Implemented Functionality (Operational & Verified)
1. **Subject-Based Role-Based Access Control (RBAC)**:
   - Evaluated by `can_access_student_subject_data()` in `backend/utils/decorators.py:118-256`.
   - Strict triple-condition enforcement: (1) teacher assigned to subject, (2) student enrolled in subject, (3) academic term alignment.
   - Prevents cross-subject IDOR: A teacher assigned only to Mathematics cannot retrieve Portuguese Language marks or predictions for a dual-enrolled student (`tests/test_subject_rbac.py:349`).
2. **First-Class Subject Catalog & Allocations**:
   - `SubjectService` (`backend/services/subject_service.py`), `AssignmentService` (`backend/services/assignment_service.py`), and `EnrollmentService` (`backend/services/enrollment_service.py`).
   - Admin 3-tab allocation workspace in `frontend/src/pages/admin/TeacherAssignments.tsx`.
3. **Multi-Milestone Machine Learning Inference**:
   - Implemented in `backend/services/prediction_service.py` and `backend/ml/model_loader.py`.
   - Supports Milestone 0 (Registration), Milestone 1 (Mid-Term), and Milestone 2 (Continuous Assessment) with 12 Scikit-learn pipelines in `ml_models/saved_models/`.
4. **Target Leakage Protection**:
   - `backend/data_engineering/leakage_guard.py:125` enforces `assert_no_leakage()`, guaranteeing $G_3$ final marks never contaminate feature matrices.
5. **Interactive Workspaces**:
   - Complete 8-route Teacher Workspace (`/teacher/*`), Student Multi-Course Workspace (`/student/*`), and Admin Workspace (`/admin/*`).

### 3.2 Partially Implemented Functionality
1. **Analyst Role & Workflow**:
   - `backend/models/user_model.py:10` restricts roles to `{"student", "teacher", "admin"}`.
   - Institutional analytics are partially accessible to administrators, but no dedicated `/analyst` dashboard or non-administrative data analysis persona exists.
2. **Big Data Analytical OLAP (Impala & HDFS)**:
   - Impala DDL (`analytics/impala/01_create_academic_lakehouse_tables.sql`) and 7 window analytical queries (`02_analytical_queries.sql`) are syntactically valid and tested via fallback runners, but no continuous live Impala daemon is active on the host.
3. **Notifications & Alerts**:
   - UI surfaces high-risk warnings and early-diagnostic advisories (`TeacherAtRisk.tsx`), but there is no notification service (email dispatch, push notifications, webhook alerts).
4. **Data Backup Automation**:
   - MongoDB database schemas and unique indexes ensure integrity; however, automated background backup scripts (`mongodump` automation or S3 archiving) are not implemented.

### 3.3 Missing Functionality
1. **Real-Time Campus Event Streaming**:
   - The planned Server-Sent Events (SSE) `/api/stream/events` and Kafka event emitter in `BIG_DATA_IMPLEMENTATION_PLAN.md` do not exist in the codebase.
2. **Student Dropout Prediction**:
   - No dedicated attrition or dropout prediction model exists; only academic risk ($G_3 < 50\%$) is modeled.
3. **Course Demand Prediction**:
   - No forecasting models exist to predict elective demand, registration volumes, or departmental capacity.
4. **ML-Based Anomaly Detection**:
   - Anomaly detection is limited to a single static SQL `CASE` statement in `analytics/impala/02_analytical_queries.sql:128`. No Isolation Forest or unsupervised clustering models are deployed.
5. **Dedicated Support Ticketing**:
   - No in-app communication channel between students and instructors exists beyond basic `mailto:` hyperlinks.

### 3.4 Unverified / Environment-Dependent Functionality
1. **Apache Hadoop Distributed File System (HDFS)**:
   - `backend/data_engineering/hdfs_lakehouse.py` contains a WebHDFS client. Due to the 8 GB RAM limitation, the NameNode is not running locally. Verified to fail gracefully with offline diagnostics (`tests/test_data_pipeline.py:112`).
2. **Apache Impala Daemon Query Execution**:
   - Port 21050 is not listening locally; verified graceful offline behavior via `impala_query_runner.py`.

---

## 4. Existing Architecture Assessment

### 4.1 Architecture Diagram (Current Implementation)

```
+----------------------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER (VITE + REACT 18 SPA)                        |
|                                                                                                    |
|  +---------------------------+  +-------------------------------------+  +----------------------+  |
|  |     STUDENT WORKSPACE     |  |          TEACHER WORKSPACE          |  |   ADMIN WORKSPACE    |  |
|  |  - Enrolled Course Cards  |  |  - Global TeacherSubjectSelector    |  |  - User Management   |  |
|  |  - Prediction Form        |  |  - 8 Scoped Workspace Views         |  |  - 3-Tab Allocation  |  |
|  |  - Course History Filter  |  |  - Stale Data Clearing on Switch    |  |  - System Audit Logs |  |
|  +-------------+-------------+  +------------------+------------------+  +----------+-----------+  |
+----------------|-----------------------------------|--------------------------------|--------------+
                 |                                   |                                |
                 |                         HTTP Requests (JSON, CSRF)                 |
                 +-----------------------------------+--------------------------------+
                                                     |
                                                     v
+----------------------------------------------------------------------------------------------------+
|                                      WEB & API LAYER (FLASK WSGI)                                  |
|                                                                                                    |
|  - Flask-Login Session Authentication                                                              |
|  - CSRF Token Validation via Flask-WTF                                                             |
|  - Role-Based Access Control (@role_required("admin", "teacher", "student"))                       |
|  - Subject Authorization Guard: can_access_student_subject_data()                                   |
|  - Blueprints: auth_bp, user_bp, admin_bp, prediction_bp, health_bp                                |
+----------------------------------------------------+-----------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------------------------------------------------------+
|                                    BUSINESS & SERVICE LAYER (PYTHON)                               |
|                                                                                                    |
|  +-------------------------+  +--------------------------+  +-----------------------------------+  |
|  |      UserService        |  |      SubjectService      |  |         PredictionService         |  |
|  +-------------------------+  +--------------------------+  |  - Scikit-Learn Model Loader      |  |
|  +-------------------------+  +--------------------------+  |  - Feature Normalization          |  |
|  |    AssignmentService    |  |    EnrollmentService     |  |  - Target Leakage Guards          |  |
|  +-------------------------+  +--------------------------+  +-----------------+-----------------+  |
+-------------------------------------------------------------------------------|--------------------+
                                                     |                          |
                         +---------------------------+                          v
                         v                                      +------------------------------------+
+--------------------------------------------------+            |       SERIALIZED ML ARTIFACTS      |
|           OPERATIONAL DATASTORE (MONGODB 6.X)    |            |                                    |
|                                                  |            |  ml_models/saved_models/           |
|  - users                                         |            |  - 12 HistGradBoost & RF Pipelines |
|  - subjects                                      |            |  - Math & Portuguese Models        |
|  - teacher_subject_assignments (Compound Unique) |            |  - Milestones 0, 1, 2              |
|  - student_subject_enrollments (Compound Unique) |            +------------------------------------+
|  - predictions (Feature snapshots & provenance)  |
|  - analytical_academic_records                   |
|  - system_logs                                   |
|  - teacher_student_assignments (Legacy Archive)  |
+--------------------------------------------------+
```

### 4.2 Architectural Strengths
1. **Strict Data Isolation**: Subject-based RBAC guarantees that teachers only see students enrolled in their assigned subjects and terms.
2. **Client-Side Responsiveness**: React state clearing patterns prevent stale data from lingering when switching subjects.
3. **Deterministic Feature Pipeline**: Scikit-learn pipelines serialize preprocessing, encoding, and imputation together with estimators.

### 4.3 Architectural Limitations
1. **Single-Tenant Tight Coupling**: All collections lack tenant identifiers (`institution_id`). Subject codes (`MATH-101`) have global unique indexes, preventing multiple schools from sharing code conventions.
2. **Synchronous ML Inference**: Model execution runs directly in the Flask request thread. While sub-20ms for single predictions, bulk scoring of an entire grade cohort blocks the WSGI worker.
3. **Absence of Background Task Queue**: Heavy operations (batch imports, report generation) run synchronously due to the lack of Celery/Redis.
4. **Decoupled Big Data Layer**: HDFS and Impala are not live components in the operational loop; MongoDB handles both OLTP and analytical queries.

---

## 5. Multi-Institution SaaS Feasibility Assessment

Transforming EduPredict from its current single-institution model into a multi-tenant SaaS platform is architecturally feasible. However, it requires a structured evolution across database, authorization, and platform governance layers.

### 5.1 Proposed Multi-Institution SaaS Architecture Diagram

```
                                  MULTI-INSTITUTION CLIENT REQUESTS
                       (e.g., harvard.edupredict.com, oxford.edupredict.com)
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|                                    GATEWAY & TENANT ROUTING LAYER                                  |
|                                                                                                    |
|  - Reverse Proxy (NGINX / Apache HTTP Server)                                                      |
|  - Tenant Resolver Middleware: Extracts institution slug from Subdomain / X-Institution-ID Header  |
|  - Rate Limiting & SSL/TLS Termination per Tenant Domain                                           |
+------------------------------------------------+---------------------------------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|                                    APPLICATION TIER (MULTI-TENANT WSGI)                            |
|                                                                                                    |
|  - Global Context: g.tenant_id, g.institution                                                      |
|  - Role Hierarchy:                                                                                 |
|    * Platform Super Admin: Global platform oversight, billing, tenant lifecycle                    |
|    * Institution Admin: Manages institution-specific teachers, students, subjects, terms          |
|    * Instructor: Scoped strictly to institution-specific subject assignments                       |
|    * Learner: Scoped strictly to institution-specific enrollments                                  |
|    * Institutional Analyst: Institutional cohort reporting and curriculum analytics               |
+------------------------------------------------+---------------------------------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|                                      TENANT-AWARE DATA ACCESS LAYER                                |
|                                                                                                    |
|  Option A (Recommended for High Scale): Database-per-Tenant (Isolated MongoDB DB per institution)  |
|  Option B (Cost-Effective SaaS): Shared DB, Shared Collection with Discriminator (institution_id)  |
+------------------------------------------------+---------------------------------------------------+
                                                 |
                         +-----------------------+-----------------------+
                         v                                               v
+--------------------------------------------------+   +---------------------------------------------+
|         PLATFORM CONTROL STORE (GLOBAL)          |   |          TENANT OPERATIONAL STORES          |
|                                                  |   |                                             |
|  - institutions (ID, Name, Slug, Plan, Status)   |   |  - users (institution_id scoped)            |
|  - subscriptions (Tier, Quotas, Billing Status)  |   |  - subjects (Compound: institution_id, code)|
|  - platform_super_admins                         |   |  - teacher_subject_assignments              |
|  - global_audit_logs                             |   |  - student_subject_enrollments              |
+--------------------------------------------------+   |  - predictions                              |
                                                       +---------------------------------------------+
```

### 5.2 Tenancy Evaluation Matrix

| Capability | Current Single-Tenant State | Required Multi-Tenant State | Architectural Gap & Remediation |
| :--- | :--- | :--- | :--- |
| **Institution Onboarding** | None. Single database setup. | Self-service registration or Super Admin provisioning API. | Must build `Institution` model and provisioning service. |
| **Tenant Context** | Implicit (all records belong to one school). | Explicit context via subdomain or `X-Institution-ID` header. | Introduce Flask `before_request` hook binding `g.tenant_id`. |
| **Super Admin Persona** | `admin` has access to single institution. | `platform_super_admin` managing cross-tenant billing/quotas. | Extend `VALID_ROLES` to include `platform_super_admin`. |
| **Subject Catalog Isolation** | Unique index on `code` (`MATH-101`). | Compound unique index `(institution_id, code)`. | Rebuild MongoDB indexes to include tenant discriminator. |
| **Cross-Tenant Security** | No tenant check. | Strict filter injection on every database query. | Query wrapping or database-per-tenant isolation. |
| **Subscription & Billing** | None. Free academic prototype. | Stripe/Paddle integration, plan tiers, seat quotas. | Build subscription lifecycle and quota enforcement layer. |

---

## 6. Machine Learning Governance Assessment

### 6.1 Implemented vs. Missing Models

| Predictive Target | Algorithmic Approach | Implementation Status | Artifact File Location |
| :--- | :--- | :---: | :--- |
| **Exam Marks Regression** | HistGradientBoosting & Random Forest | **Operational** | `ml_models/saved_models/*_regressor.joblib` |
| **Academic Risk Classification** | HistGradientBoosting & Random Forest | **Operational** | `ml_models/saved_models/*_classifier.joblib` |
| **Student Dropout Prediction** | Survival Analysis / Attrition Classifier | **Missing** | Not implemented |
| **Course Demand Prediction** | Time-Series Forecasting / Volume Regressor| **Missing** | Not implemented |
| **Anomaly Detection** | Unsupervised Isolation Forest / One-Class SVM | **Missing** | Limited to static SQL rule in Impala query |

### 6.2 Empirical Evaluation Metrics & Provenance
Model evaluation reports are saved in `ml_models/reports/` and documented in metadata JSON manifests:
- **Mathematics Milestone 1 Regressor**: $R^2 = 0.83$, $\text{RMSE} = 1.83$ marks (on 0–20 scale), $\text{SMAPE} = 9.42\%$.
- **Portuguese Language Milestone 1 Regressor**: $R^2 = 0.85$, $\text{RMSE} = 1.25$ marks, $\text{SMAPE} = 7.18\%$.
- **Milestone 0 Early Warning Limitations**: At term registration (demographics only, zero marks), models suffer from high False Negative Rates (Math Holdout FNR: 61.54%; Portuguese Holdout FNR: 75.00%). These limitations are explicitly disclosed on the teacher at-risk triage dashboard.

### 6.3 Synthetic & Estimated Features Governance
- **`attendance_percentage`**: Disclosed in `DATA_DICTIONARY.md` as an estimated proxy derived from absence counts assuming a 60-session term baseline ($100 - (\min(\text{absences}, 60)/60 \times 100)$). It is **not** real-time IoT roll-call attendance.
- **`study_hours_per_week`**: Disclosed as an ordinal midpoint estimate derived from survey bands ($<2\text{h} \rightarrow 1.5$, $2\text{--}5\text{h} \rightarrow 3.5$, $5\text{--}10\text{h} \rightarrow 7.5$, $>10\text{h} \rightarrow 12.0$).

---

## 7. Security and Data-Isolation Risks

1. **Absence of Rate Limiting on Prediction APIs**:
   - `POST /api/predictions` has authentication and CSRF guards, but lacks IP or user-based rate limiting (e.g. Flask-Limiter). A malicious authenticated user could spam inference requests and cause CPU starvation.
2. **Client-Side CSV Export of Sensitive Telemetry**:
   - `/teacher/reports` generates CSV exports in-browser. While records are strictly scoped to the teacher's authorized subject, client-side export leaves unencrypted academic records on end-user machines.
3. **Plaintext Local Database Connection**:
   - The default development connection string `mongodb://localhost:27017/edupredict` does not enforce TLS or database-level encryption at rest. Production deployments must enforce MongoDB SCRAM authentication and TLS encryption.

---

## 8. Big Data & Scalability Limitations

1. **Hardware Constraints on Windows Workstation**:
   - The audited host has 8 GB RAM and 2 physical CPU cores. Running a full Cloudera/Hadoop distributed stack (NameNode, DataNode, Impala, Hive Metastore, YARN) concurrently with MongoDB and Flask requires 24–32 GB RAM. Running these daemons locally would cause OS memory paging and complete system instability.
2. **Lack of Asynchronous Background Task Queue**:
   - Ingestion of large datasets and model retraining run synchronously. An asynchronous task worker (Celery + Redis) is necessary before ingesting multi-institution datasets.
3. **No Distributed Streaming Broker**:
   - Real-time campus telemetry (IoT RFID attendance, LMS clickstreams) cannot be ingested without a distributed message broker (Apache Kafka or AWS Kinesis).

---

## 9. Recommended Development Phases & Roadmap

```
+----------------------------------------------------------------------------------------------------+
|                                    RECOMMENDED DEVELOPMENT ROADMAP                                 |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  PHASE 7: ADVANCED PREDICTIVE INTELLIGENCE & ANALYST WORKSPACE (Current Platform Enhancement)       |
|  - Implement Analyst Role (`analyst`) and Institutional Curriculum Analytics Dashboard             |
|  - Implement Student Dropout Prediction (Attrition Classifier)                                     |
|  - Implement ML-Based Anomaly Detection (IsolationForest for academic velocity anomalies)          |
|  - Integrate Centralized Asynchronous Worker (Celery + Redis) for background batch scoring         |
|                                                                                                    |
|  PHASE 8: ENTERPRISE TELEMETRY & NOTIFICATION ENGINE                                               |
|  - Centralized Notification Dispatcher (Email, Webhooks, In-App Notification Bell)                 |
|  - Real-Time Event Ingestion Streamer (SSE / WebSockets for live campus grade events)              |
|  - Automated Database Backup & Archival Service (Scheduled S3 mongodump pipeline)                  |
|                                                                                                    |
|  PHASE 9: MULTI-INSTITUTION SAAS TRANSFORMATION (Commercial Evolution)                             |
|  - Institution Onboarding, Subdomain Tenant Resolver, and Platform Super Admin                    |
|  - Database Tenant Isolation (Database-per-Tenant or Compound Tenant Discriminator)                |
|  - Subscription, Tiered Feature Gates, and Stripe Billing Lifecycle                               |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 10. Strategic Recommendation

### 10.1 Proceed to Multi-Institution SaaS?
> [!IMPORTANT]
> **Recommendation**: **DO NOT immediately convert the codebase to a multi-institution SaaS architecture.**

### 10.2 Justification & Prerequisites
Proceeding directly to multi-tenancy at this stage would introduce substantial architectural overhead while several foundational SRS capabilities remain incomplete. 

Before embarking on multi-tenancy, the project must address the following **Priority 1 Prerequisites**:
1. **Implement the Analyst Role (`analyst`)**: Complete the 4-role authentication matrix mandated by the SRS so academic researchers and institutional evaluators have dedicated workspace capabilities.
2. **Implement Missing ML Capabilities**: Develop the Student Dropout Prediction model and ML Anomaly Detection model to fulfill the core educational data science mission.
3. **Introduce an Asynchronous Task Queue (Celery + Redis)**: Ensure batch scoring and report generation are decoupled from the WSGI web request thread.
4. **Deploy Dedicated Cloud Infrastructure**: Host the big data components (HDFS, Impala, or modern cloud data warehouses like Snowflake/BigQuery) on appropriate infrastructure (16 GB+ RAM) rather than a constrained local developer machine.

Once these educational intelligence pillars are solidified, the transition to Multi-Institution SaaS (Phase 9) can proceed on an unshakeable, enterprise-ready foundation.
