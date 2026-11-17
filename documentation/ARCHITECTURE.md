# EduPredict – System Architecture & Technical Design

## 1. Architectural Philosophy
EduPredict is an AI/ML-driven Educational Performance Prediction and Analytics Platform designed using a **Decoupled Modular Architecture**. It combines a responsive web layer, a high-throughput operational NoSQL datastore (MongoDB 6.x), a scalable Big Data analytical lakehouse (HDFS / Impala), an enterprise BI bridge (Tableau), and an extensible machine learning inference engine.

```
                      +-------------------------------------------------------+
                      |                 Presentation & BI Tier                |
                      |  - Web UI: Student, Teacher, Admin (HTML5/Bootstrap5) |
                      |  - Interactive Analytics: Chart.js                    |
                      |  - Enterprise BI: Tableau Public / Desktop (.twb)     |
                      |  - Research Workbenches: Jupyter Notebook & RStudio   |
                      +---------------------------+---------------------------+
                                                  |
                                            HTTP / REST
                                                  v
                      +-------------------------------------------------------+
                      |              Web & Application Gateway                |
                      |  - Apache HTTP Server (Reverse Proxy & Static Cache)  |
                      |  - Flask WSGI Application (Waitress / Gunicorn)       |
                      |  - Authentication & RBAC Guard (@role_required)       |
                      |  - Real-Time Event Streamer (SSE / WebSockets)        |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |                Service Business Tier                  |
                      |  - AuthService & Role Enforcement                     |
                      |  - UserService (Profile, Passwords, Role Management)  |
                      |  - AssignmentService (Teacher-Student Links)          |
                      |  - SystemLogService (Audit Trail)                     |
                      |  - PredictionEngineService & RecommendationService    |
                      |  - ParallelBatchProcessor (Multiprocessing Engine)    |
                      |  - BigDataBridge (HDFS Adapter, Impala OLAP, Tableau) |
                      +-------------------+-------------------+---------------+
                                          |                   |
                        +-----------------+                   +-----------------+
                        v                                                       v
    +---------------------------------------+               +---------------------------------------+
    |         Operational Datastore         |               |          Big Data & ML Layer          |
    |  - MongoDB Server 6.0.29 (Native)     |               |  - HDFS Storage Lake (/user/...)      |
    |  - Collections: users, records,       |               |  - Apache Impala SQL OLAP Queries     |
    |    predictions, assignments, logs     |               |  - Serialized Scikit-Learn Models     |
    |  - Admin tools: mongosh & Compass     |               |  - Feature Scalers & Encoders         |
    +---------------------------------------+               +---------------------------------------+
```

---

## 2. Implemented Backend Modular Structure
```text
EduPredict/backend/
├── __init__.py               # Package root exporting create_app
├── app.py                    # Application factory, user_loader, error handlers
├── config.py                 # BaseConfig, DevelopmentConfig, TestingConfig, ProductionConfig
├── extensions.py             # csrf (CSRFProtect), login_manager (LoginManager), mongo (MongoManager)
├── commands/
│   ├── __init__.py
│   └── admin_commands.py     # Click CLI commands: create-admin, init-db
├── database/
│   ├── __init__.py
│   └── schema.py             # Index definitions and schema initialization for MongoDB 6
├── models/
│   ├── __init__.py
│   ├── user_model.py         # User domain entity implementing Flask-Login interface
│   ├── academic_record_model.py # AcademicRecord document mapping
│   ├── assignment_model.py   # TeacherStudentAssignment document mapping
│   └── system_log_model.py   # SystemLog audit trail mapping
├── routes/
│   ├── __init__.py
│   ├── health_routes.py      # /, /health, /api/health, /api/health/db
│   ├── auth_routes.py        # /auth/register, /auth/login, /auth/logout, /api/csrf-token
│   ├── user_routes.py        # /api/me, /api/me/password, /api/students/<id>, /api/teacher/students
│   └── admin_routes.py       # /api/admin/users, /api/admin/users/<id>/role, /api/admin/assignments, /api/admin/logs
├── services/
│   ├── __init__.py
│   ├── auth_service.py       # Registration, login authentication, credential checking
│   ├── user_service.py       # User CRUD, role updates, profile management
│   ├── assignment_service.py # Teacher-student linkage management
│   └── system_log_service.py # Centralized audit event logger
└── utils/
    ├── __init__.py
    ├── security.py           # Bcrypt password hashing, normalization, ObjectId safety
    └── decorators.py         # @role_required, @admin_required, @teacher_required, can_access_student_data
```

---

## 3. Database Schema Design (MongoDB 6.x)

MongoDB 6.x runs locally on port `27017` with database name `edupredict`.

### Collections and Indexes:
1. `users`:
   - `_id`: ObjectId
   - `email`: String (Normalized lowercase, stripped)
   - `password_hash`: String (bcrypt hash with salt)
   - `full_name`: String
   - `role`: Enum (`student`, `teacher`, `admin`), default `student`
   - `is_active`: Boolean, default `True`
   - `created_at`: DateTime (UTC)
   - `updated_at`: DateTime (UTC)
   - **Indexes**:
     - `idx_users_email_unique`: `[("email", 1)]`, unique=True
     - `idx_users_role`: `[("role", 1)]`
     - `idx_users_created_at`: `[("created_at", -1)]`

2. `academic_records`:
   - `_id`: ObjectId
   - `student_id`: ObjectId (References `users._id`)
   - `term`: String
   - `attendance_percentage`: Float (0-100)
   - `study_hours_per_week`: Float
   - `assignment_completion_rate`: Float (0-100)
   - `quiz_average`: Float (0-100)
   - `previous_exam_marks`: Float (0-100)
   - `subject_scores`: Object (e.g., `{"Mathematics": 82.0, "Science": 74.0}`)
   - `created_at`: DateTime (UTC)
   - `updated_at`: DateTime (UTC)
   - **Indexes**:
     - `idx_records_student_id`: `[("student_id", 1)]`
     - `idx_records_student_term`: `[("student_id", 1), ("term", 1)]`
     - `idx_records_created_at`: `[("created_at", -1)]`

3. `predictions`:
   - `_id`: ObjectId
   - `student_id`: ObjectId (References `users._id`)
   - `academic_record_id`: ObjectId (References `academic_records._id`)
   - `predicted_marks`: Float
   - `predicted_grade`: String (`A`, `B`, `C`, `D`, `F`)
   - `risk_level`: Enum (`LOW`, `MODERATE`, `HIGH`)
   - `risk_probability`: Float
   - `top_contributing_factors`: Array of `{ factor: String, impact: String, value: Any }`
   - `recommendations`: Array of String
   - `model_version`: String
   - `created_at`: DateTime (UTC)
   - **Indexes**:
     - `idx_preds_student_id`: `[("student_id", 1)]`
     - `idx_preds_academic_record_id`: `[("academic_record_id", 1)]`
     - `idx_preds_risk_level`: `[("risk_level", 1)]`
     - `idx_preds_created_at`: `[("created_at", -1)]`

4. `teacher_student_assignments`:
   - `_id`: ObjectId
   - `teacher_id`: ObjectId (References `users._id` with `role='teacher'`)
   - `student_id`: ObjectId (References `users._id` with `role='student'`)
   - `assigned_by`: ObjectId (References administrator `users._id`)
   - `status`: Enum (`active`, `inactive`), default `active`
   - `assigned_at`: DateTime (UTC)
   - **Indexes**:
     - `idx_assignments_teacher_student_unique`: `[("teacher_id", 1), ("student_id", 1)]`, unique=True
     - `idx_assignments_teacher_id`: `[("teacher_id", 1)]`
     - `idx_assignments_student_id`: `[("student_id", 1)]`
     - `idx_assignments_status`: `[("status", 1)]`

5. `system_logs`:
   - `_id`: ObjectId
   - `event_type`: String (`USER_CREATED`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `ROLE_MODIFIED`, `ASSIGNMENT_CREATED`, etc.)
   - `details`: Object
   - `user_id`: ObjectId (Target user, optional)
   - `actor_id`: ObjectId (Acting user, optional)
   - `ip_address`: String (optional)
   - `timestamp`: DateTime (UTC)
   - **Indexes**:
     - `idx_logs_timestamp`: `[("timestamp", -1)]`
     - `idx_logs_event_type`: `[("event_type", 1)]`
     - `idx_logs_user_id`: `[("user_id", 1)]`

---

## 4. Role-Based Access Control (RBAC) Matrix

| Endpoint | Method | Allowed Roles | Authorization Rules / Boundary Enforcement |
|---|---|---|---|
| `/auth/register` | `POST` | Public | Enforces `role='student'` strictly |
| `/auth/login` | `POST` | Public | Authenticates credentials, creates session |
| `/auth/logout` | `POST` | Authenticated | Terminates session via `logout_user()` |
| `/api/me` | `GET` | Authenticated | Returns profile of `current_user` |
| `/api/me` | `PUT` | Authenticated | Modifies only editable profile fields |
| `/api/me/password` | `PUT` | Authenticated | Verifies old password, updates bcrypt hash |
| `/api/students/<student_id>` | `GET` | `student`, `teacher`, `admin` | **IDOR Guard**: Student can only access self; Teacher can only access assigned students; Admin can access all |
| `/api/teacher/students` | `GET` | `teacher` | Returns active assigned students only |
| `/api/admin/users` | `GET` | `admin` | Directory listing with role filter |
| `/api/admin/users/<id>/role`| `PUT` | `admin` | Role assignment; blocks self-demotion |
| `/api/admin/assignments` | `POST` | `admin` | Maps student to teacher; validates roles |
| `/api/admin/logs` | `GET` | `admin` | View system audit trail |
