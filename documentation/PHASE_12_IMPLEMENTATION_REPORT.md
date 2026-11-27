# EduPredict — Phase 12 Implementation Report
## Persistent Notifications, Automated Early-Warning Alerts & Feedback/Support Workflows

**Project:** EduPredict  
**Branch:** `main`  
**Baseline Commit:** `8f4ab77b7b21ddc87d92c4ed4040f3afc987be8a`  
**Approved Scope:** Phase 12 Option A — SRS Requirement #14 (Automated Notifications & Alerts) and SRS Requirement #15 (Feedback, Interventions & Support Workflow) within the existing single-institution 4-role (`admin`, `teacher`, `student`, `analyst`) architecture.

---

## 1. Phase 12 Scope Summary

Phase 12 replaces prior static/mock notification feeds and feedback forms with MongoDB-backed persistence, REST endpoints, failure-isolated automated early-warning triggers across academic risk pipelines, strict role/ownership access control, and full frontend integration:

- **No Scope Creep:** Preserved single-institution architecture; no multi-tenancy, organizations, SaaS billing, external SMTP/SMS/Twilio delivery, or Phase 13 features were added.
- **No Unrelated Destructive Changes:** Kept all existing Phase 1–11 pipelines, ML models, RBAC rules, backup guarantees, and regression suites intact.
- **Backup Inclusion (`backend/services/backup_service.py`):** Added `"notifications"` and `"feedback_tickets"` to `DEFAULT_BACKUP_COLLECTIONS` so portable BSON backups include Phase 12 data.

---

## 2. Persistent Notifications Architecture

- **Domain Model (`backend/models/notification_model.py`):**
  - `Notification` entity with `VALID_NOTIFICATION_CATEGORIES` (`early_warning`, `dropout_risk`, `anomaly_alert`, `broadcast`, `academic_calendar`, `system`, `feedback_update`), `VALID_NOTIFICATION_SEVERITIES` (`info`, `warning`, `critical`, `success`), `VALID_BROADCAST_TARGET_ROLES` (`student`, `teacher`, `admin`), `dedup_key`, `provenance`, `is_read`, `read_at`, `subject_id`, `subject`, `academic_term`, `created_at`, and `updated_at`.
- **MongoDB Collection & Indexes (`backend/database/schema.py`):**
  - `notifications` collection with 4 indexes:
    - `idx_notif_recipient_created` on `(recipient_id, created_at DESC)`
    - `idx_notif_recipient_read_created` on `(recipient_id, is_read, created_at DESC)`
    - `idx_notif_recipient_filters` on `(recipient_id, category, severity, created_at DESC)`
    - `idx_notif_recipient_dedup_unique` (unique partial index on `(recipient_id, dedup_key)` with `partialFilterExpression={"dedup_key": {"$type": "string"}}`)
- **Service & REST Endpoints (`backend/services/notification_service.py`, `backend/routes/notification_routes.py`):**
  - `GET /api/notifications` (`admin`, `teacher`, `student`): paginated self-scoped feed supporting `page`, `limit` (`1..100`), `category`, `severity`, `is_read` (`true`/`false`), and `subject_id` filters.
  - `GET /api/notifications/unread-count` (`admin`, `teacher`, `student`): returns recipient-scoped unread badge count.
  - `PATCH /api/notifications/<notification_id>/read` (`admin`, `teacher`, `student`): owner-only read transition returning the updated notification.
  - `PATCH /api/notifications/read-all` (`admin`, `teacher`, `student`): marks all unread notifications for the caller as read (`modified_count`).
  - `POST /api/notifications/broadcast` (`admin` only): publishes sanitized institutional announcements across targeted active accounts (`student`, `teacher`, `admin`) and explicitly rejects `analyst` as a target (`400`).

---

## 3. Automated Early-Warning Alert Pipelines

All early-warning dispatch methods in `NotificationService` are failure-isolated (`try/except` with `sanitize_exception_message()`), deduplicated via deterministic `dedup_key` + unique index (`DuplicateKeyError` suppressed), and record `provenance`:

1. **Prediction High-Risk Hook (`backend/services/prediction_service.py` -> `NotificationService.dispatch_prediction_high_risk_alert`):**
   - Triggered in `PredictionService.create_prediction()` when `predicted_status == "High Risk"`.
   - Deterministic `dedup_key`: `pred_high_risk:{student_id}:{subject}:{milestone}:{term_slug}`.
   - Notifies the enrolled student, active teachers matched by subject and academic term (`_resolve_authorized_teachers` via `student_subject_enrollments` + `teacher_subject_assignments`), and active Admins (`category="early_warning"`, `severity="critical"`).
2. **Dropout High-Risk Hook (`backend/services/dropout_service.py` -> `NotificationService.dispatch_dropout_high_risk_alert`):**
   - Triggered in `DropoutService.record_student_assessment()` when `risk_tier == "High"`.
   - Deterministic `dedup_key`: `dropout_high_risk:{student_id}:{clean_term}`.
   - Notifies the student, subject/term-authorized active teachers, and active Admins (`category="dropout_risk"`, `severity="critical"`).
   - Fixed repeated upsert in `DropoutService.record_student_assessment()` (`$set` excluding `_id` + `$setOnInsert: {"_id": doc_id}`) so repeat dropout assessments for the same student update cleanly (`201`) without triggering an immutable `_id` MongoDB error.
3. **Confirmed Institutional Anomaly Hook (`backend/services/anomaly_service.py` -> `NotificationService.dispatch_confirmed_anomaly_alert`):**
   - Triggered in `AnomalyService.update_review_status()` when `review_status == "Confirmed Anomaly"` and `is_benchmark` is `False`.
   - Deterministic `dedup_key`: `anomaly_confirmed:{anomaly_id}`.
   - Notifies subject/term-authorized active teachers and active Admins (`category="anomaly_alert"`, `severity="warning"`); synthetic benchmark rows and students are strictly excluded.

---

## 4. Feedback & Intervention Workflow Architecture

- **Domain Model (`backend/models/feedback_model.py`):**
  - `FeedbackTicket` entity enforcing `VALID_FEEDBACK_SENDER_ROLES` (`student`, `teacher`), `VALID_FEEDBACK_STATUSES` (`Open`, `Reviewed`, `Resolved`), forward lifecycle map `VALID_FEEDBACK_TRANSITIONS` (`Open -> Open|Reviewed|Resolved`, `Reviewed -> Reviewed|Resolved`, `Resolved -> Resolved`), `VALID_FEEDBACK_CATEGORIES`, `share_with_instructor`, `admin_response`, `intervention_notes`, `reviewed_by`, `reviewed_by_name`, and `reviewed_at`.
- **MongoDB Collection & Indexes (`backend/database/schema.py`):**
  - `feedback_tickets` collection with 4 indexes:
    - `idx_feedback_sender_created` on `(sender_id, created_at DESC)`
    - `idx_feedback_status_created` on `(status, created_at DESC)`
    - `idx_feedback_subject_category_created` on `(subject_id, category, created_at DESC)`
    - `idx_feedback_role_created` on `(sender_role, created_at DESC)`
- **Service & REST Endpoints (`backend/services/feedback_service.py`, `backend/routes/feedback_routes.py`):**
  - `POST /api/feedback` (`student`, `teacher` only): validates category/subject, sanitizes title/message/term, blocks tampered ownership/review fields, creates `status="Open"` ticket, and audits `FEEDBACK_SUBMITTED` in `system_logs`.
  - `GET /api/feedback` (`admin`, `teacher`, `student`): paginated listing with status/category/role/subject/search filters and scoped summary counts (`total`, `open`, `reviewed`, `resolved`).
  - `GET /api/feedback/<ticket_id>` (`admin`, `teacher`, `student`): enforces strict single-ticket access — Students only see their own tickets; Teachers only see their own tickets OR student `Academic Counseling` tickets with `share_with_instructor=True` verified via `can_access_student_subject_data()`; private student tickets return `403`.
  - `PATCH /api/feedback/<ticket_id>` (`admin` only): validates forward transitions (`Open -> Reviewed -> Resolved`), sanitizes `admin_response` and `intervention_notes`, audits `FEEDBACK_TICKET_UPDATED`, and calls `NotificationService.notify_feedback_status_update()` to notify the ticket owner (`category="feedback_update"`).

---

## 5. Security, RBAC, IDOR & Privacy Protections

- **Analyst Role Isolation:** `@role_required` and service-layer checks return `403` for `analyst` across all `/api/notifications/*` and `/api/feedback/*` routes; institutional broadcasts reject `analyst` as a target role (`400`).
- **Ownership & IDOR Enforcement:** `mark_as_read` checks `recipient_id == current_user.id` (`403` otherwise); `get_ticket_by_id` and `list_tickets` prevent cross-student and unauthorized-teacher ticket access.
- **Anti-Tampering Validation:** `FeedbackService.submit_ticket()` rejects requests supplying `FORBIDDEN_SUBMIT_FIELDS` (`sender_id`, `sender_role`, `sender_name`, `admin_response`, `intervention_notes`, `reviewed_by`, `reviewed_by_name`, `reviewed_at`) or non-`Open` status (`403`).
- **XSS / Markup Sanitization (`backend/utils/security.py`):** Added `clean_and_validate_text()` stripping control characters, `<script>...</script>` blocks, HTML tags (`<[a-zA-Z!/][^>]*>`), and `javascript:` URIs while preserving plain mathematical comparisons such as `score < 50`.
- **CSRF & Log Privacy:** All `POST` and `PATCH` routes enforce Flask-WTF CSRF protection when enabled (`test_analyst_strictly_blocked_and_csrf_enforced`). Alert dispatch failure warnings log only `sanitize_exception_message(exc)` with zero student names or emails.
- **Test Hygiene (`tests/conftest.py`):** Added `notifications` and `feedback_tickets` cleanup to the `clean_db` fixture.

---

## 6. Frontend Integration Summary

- **API Client & Types:** Added `NotificationRecord`, `NotificationListResponse`, `FeedbackTicketRecord`, and `FeedbackListResponse` in `frontend/src/types/index.ts`, plus `notificationsApi` and `feedbackApi` in `frontend/src/services/api.ts`.
- **Navbar Live Feed (`frontend/src/components/common/Navbar.tsx`):** Replaced hardcoded placeholder notifications with live `notificationsApi.list({ limit: 5 })` loading (disabled for `analyst`), dynamic unread dot/count badge, and click-to-mark-read state synchronization.
- **Reusable Shared Workspaces (DRY):**
  - `frontend/src/components/common/NotificationCenterPanel.tsx`: KPI cards (unread count, matching alerts, critical alerts), category/severity/read filters, pagination, mark-read and mark-all-read actions, and optional side slot.
  - `frontend/src/components/common/FeedbackInquiryWorkspace.tsx`: shared Student & Teacher inquiry submission form, course-linked `share_with_instructor` counseling toggle (for Students), summary cards, status filters, pagination, and Admin response/intervention note thread rendering.
- **Connected Role Pages:**
  - `frontend/src/pages/admin/AdminNotifications.tsx`: wraps `NotificationCenterPanel` with live Admin Broadcast composer.
  - `frontend/src/pages/teacher/TeacherNotifications.tsx` & `frontend/src/pages/student/StudentNotifications.tsx`: real persisted inbox views.
  - `frontend/src/pages/admin/AdminFeedback.tsx`: institutional triage workspace with role/status/search filters and `Open -> Reviewed -> Resolved` review editor (`admin_response` + `intervention_notes`).
  - `frontend/src/pages/teacher/TeacherFeedback.tsx` & `frontend/src/pages/student/StudentFeedback.tsx`: connected via `FeedbackInquiryWorkspace` with real teacher subjects (`useTeacherSubject`) and student enrolled subjects (`api.getStudentSubjects()`).

---

## 7. Complete File Inventory

### Added Files
- `backend/models/notification_model.py`
- `backend/models/feedback_model.py`
- `backend/services/notification_service.py`
- `backend/services/feedback_service.py`
- `backend/routes/notification_routes.py`
- `backend/routes/feedback_routes.py`
- `frontend/src/components/common/NotificationCenterPanel.tsx`
- `frontend/src/components/common/FeedbackInquiryWorkspace.tsx`
- `tests/test_phase_12_notifications_feedback.py`
- `frontend/src/__tests__/phase12_notifications_feedback.test.tsx`
- `documentation/PHASE_12_IMPLEMENTATION_REPORT.md`

### Modified Files
- `backend/app.py`
- `backend/database/schema.py`
- `backend/models/__init__.py`
- `backend/routes/__init__.py`
- `backend/services/anomaly_service.py`
- `backend/services/backup_service.py`
- `backend/services/dropout_service.py`
- `backend/services/prediction_service.py`
- `backend/utils/security.py`
- `frontend/src/types/index.ts`
- `frontend/src/services/api.ts`
- `frontend/src/components/common/Navbar.tsx`
- `frontend/src/pages/admin/AdminNotifications.tsx`
- `frontend/src/pages/teacher/TeacherNotifications.tsx`
- `frontend/src/pages/student/StudentNotifications.tsx`
- `frontend/src/pages/admin/AdminFeedback.tsx`
- `frontend/src/pages/teacher/TeacherFeedback.tsx`
- `frontend/src/pages/student/StudentFeedback.tsx`
- `tests/conftest.py`

---

## 8. Observed Verification Results

All automated checks were executed sequentially against the final code state with zero failures, zero skipped assertions, and zero weakened test thresholds:

- **Phase 12 Backend Integration & Security Suite (`.\.venv\Scripts\pytest.exe -v tests/test_phase_12_notifications_feedback.py`):** `5 passed in 24.49s` (`test_phase12_indexes_and_notification_lifecycle`, `test_prediction_high_risk_alerts_scoping_and_deduplication`, `test_dropout_and_confirmed_anomaly_alerts_and_failure_isolation`, `test_feedback_workflow_rbac_idor_and_transitions`, `test_analyst_strictly_blocked_and_csrf_enforced`).
- **Key Backend Regression Suites (`.\.venv\Scripts\pytest.exe -q tests/test_prediction_api.py tests/test_dropout_api.py tests/test_anomaly_detection.py tests/test_phase_10_streaming.py tests/test_phase_11_reliability.py tests/test_phase_7d_security_hardening.py`):** `125 passed in 155.42s (0:02:35)`.
- **Full Backend Pytest Suite (`.\.venv\Scripts\pytest.exe -q`):** `374 passed in 393.57s (0:06:33)`.
- **Frontend Vitest Suite (`npx.cmd vitest run` in `frontend/`):** `Test Files 8 passed (8)`, `Tests 42 passed (42)` in `42.44s`.
- **Frontend TypeScript Check (`npx.cmd tsc -b` in `frontend/`):** Passed with exit code `0`.
- **Frontend Production Build (`npm.cmd run build` in `frontend/`):** `✓ built in 27.89s` (`2091 modules transformed`).

---

## 9. Remaining Limitations / Deferred Scope

- **Delivery Channel:** Notifications are persisted in MongoDB and fetched on navigation/action by REST clients; real-time push over SSE/WebSocket and external SMTP/SMS/Twilio channels remain outside Phase 12 scope.
- **Navbar Refresh Cadence:** `Navbar` refreshes unread count/preview on route transitions and read actions rather than background polling intervals.
- **Scale Testing Deferred:** The final institutional scale test (`100+ students`, `25+ teachers`, single admin) remains deferred until all 16 development phases are completed.
