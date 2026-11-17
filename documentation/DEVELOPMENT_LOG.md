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
- **Status**: Completed & Tested (41/41 Tests Passing)
- **Actions Executed**:
  1. **Dependency Installation**: Installed `bcrypt (5.0.0)` for salted password hashing. Updated `requirements.txt`.
  2. **MongoDB 6.x Database Schema & Indexes**:
     - Configured 5 collections: `users`, `academic_records`, `predictions`, `teacher_student_assignments`, `system_logs`.
     - Created `backend/database/schema.py`:
       - `users`: Unique index on `email`, index on `role`, index on `created_at`.
       - `academic_records`: Index on `student_id`, compound index on `student_id` + `term`.
       - `predictions`: Indexes on `student_id`, `academic_record_id`, `risk_level`, `created_at`.
       - `teacher_student_assignments`: Unique compound index on `teacher_id` + `student_id`, indexes on `teacher_id`, `student_id`, `status`.
       - `system_logs`: Indexes on `timestamp`, `event_type`, `user_id`.
  3. **Domain Models**:
     - `backend/models/user_model.py`: Implements Flask-Login `User` with bcrypt verification, UTC timestamps, and leak-proof serialization (`to_dict(include_sensitive=False)`).
     - `backend/models/academic_record_model.py`: Academic metrics schema representation.
     - `backend/models/assignment_model.py`: Teacher-student assignment entity.
     - `backend/models/system_log_model.py`: Audit trail entity.
  4. **Security Utilities & RBAC Decorators**:
     - `backend/utils/security.py`: `hash_password`, `check_password`, `normalize_email`, email/password format validators, safe `to_object_id`.
     - `backend/utils/decorators.py`: `@role_required(*allowed_roles)`, `@admin_required`, `@teacher_required`, `can_access_student_data` preventing IDOR attacks.
  5. **Business Services**:
     - `backend/services/user_service.py`: User lookup, creation, profile updates, password change, user directory, role update with self-demotion prevention.
     - `backend/services/assignment_service.py`: Instructor-student linkage creation and queries with role validation.
     - `backend/services/auth_service.py`: Registration with role='student' enforcement, login authentication, and security audit event logging.
     - `backend/services/system_log_service.py`: Centralized audit logging.
  6. **API Routes & Blueprints**:
     - `backend/routes/auth_routes.py`: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /api/csrf-token`.
     - `backend/routes/user_routes.py`: `GET /api/me`, `PUT /api/me`, `PUT /api/me/password`, `GET /api/students/<student_id>`, `GET /api/teacher/students`.
     - `backend/routes/admin_routes.py`: `GET /api/admin/users`, `PUT /api/admin/users/<user_id>/role`, `POST /api/admin/assignments`, `GET /api/admin/logs`.
  7. **Administrative CLI Commands**:
     - `backend/commands/admin_commands.py`: `flask create-admin` (interactive prompt, avoids hardcoded secrets) and `flask init-db` (creates indexes).
  8. **Automated Testing Suite**:
     - Added `tests/test_models.py`, `tests/test_auth.py`, `tests/test_rbac.py`, `tests/test_admin.py`.
     - Executed full test suite: **41 passed in 20.57s (100% pass rate)**.
