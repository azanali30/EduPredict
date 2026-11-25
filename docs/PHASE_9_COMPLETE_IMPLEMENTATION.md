# EduPredict — Phase 9 Complete Implementation: Multi-Institution SaaS Transformation

**Baseline Commit:** `01ad6d7a7967b51f7e2f2af1f61f8e38bc6334dc`  
**Phase Scope:** 9A (Platform Foundation), 9B (Tenant Resolver & Isolation), 9C (Onboarding, Billing & Feature Gates), 9D (Platform & Billing Workspaces), 9E (Testing & Security Verification).

---

## 1. Architecture & Canonical Tenant Identity
- **Canonical Discriminator:** `organization_id` is used uniformly across all tenant-scoped collections (`users`, `subjects`, `teacher_subject_assignments`, `student_subject_enrollments`, `predictions`, `academic_records`, `anomaly_records`, `dropout_records`, `dropout_prediction_history`, `demand_forecasts`, `model_registry`, `subscriptions`).
- **Contextual Variables:** `g.tenant_id` and `g.institution` are bound per request by `resolve_tenant_request()` in `backend/utils/tenant_context.py`.

## 2. Data Models (Phase 9A)
- **Institution (`backend/models/institution_model.py`, `institutions`):** `id`, `name`, `slug` (unique normalized), `organization_id` (unique canonical), `status` (`pending | trial | active | suspended | cancelled`), `plan_tier`, `contact_email`, `settings`, `created_by`, `created_at`, `updated_at`.
- **Subscription (`backend/models/subscription_model.py`, `subscriptions`):** `id`, `organization_id` (unique), `plan_tier`, `billing_status` (`trialing | active | past_due | cancelled | expired | suspended`), `seat_limit`, `prediction_quota_monthly`, `predictions_used`, `current_period_start`, `current_period_end`, `stripe_customer_id`, `stripe_subscription_id`.
- **Platform Super Admin (`backend/models/user_model.py`):** Added `platform_super_admin` to `VALID_ROLES` and `super_admin_required` decorator in `backend/utils/decorators.py`. Initial provisioning uses `flask create-super-admin` (`backend/commands/admin_commands.py`) with interactive password prompting and no hardcoded defaults.
- **Global Audit Logs (`backend/services/global_audit_service.py`, `global_audit_logs`):** Records scrubbed metadata (redacting passwords, secrets, tokens, card numbers) for onboarding, status changes, billing updates, and super-admin provisioning.

## 3. Tenant Resolver & Fail-Closed Rules (Phase 9B)
- `backend/utils/tenant_context.py` runs as `@app.before_request`:
  - Validates `Host` against `TRUSTED_TENANT_DOMAINS` (blocks Host header spoofing with `403`).
  - Extracts subdomain slug (`<slug>.edupredict.com`) and/or `X-Institution-ID` header, rejecting unknown, conflicting, or suspended/cancelled institutions with `403`.
  - Verifies authenticated non-super-admin user's `organization_id` matches the resolved tenant (`403` on mismatch).
  - `platform_super_admin` is restricted to `/api/platform/*` and rejected from ordinary tenant APIs.

## 4. Index Migrations & Rollback (Phase 9B)
- `backend/database/schema.py` safely migrates legacy single-tenant unique indexes (`idx_subjects_code_unique`, `idx_subjects_canonical_unique`, `idx_teacher_subj_term_unique`, `idx_student_subj_term_unique`) to compound `(organization_id, ...)` unique indexes via `_drop_legacy_index_if_present()`.
- **Rollback:** Recreate single-field unique indexes only after confirming no duplicate codes exist across organizations.
- `users.email` remains globally unique (`idx_users_email_unique`) to preserve unambiguous email-based login.

## 5. Onboarding, Billing, Quotas & Feature Gates (Phase 9C)
- **Onboarding (`backend/services/institution_service.py`):** `onboard_institution()` creates the `Institution`, initial `admin` user, canonical subjects, and 14-day trial `Subscription` with compensating rollback on failure.
- **Billing & Stripe Webhook (`backend/services/billing_service.py`, `POST /api/platform/billing/webhook`):**
  - Verifies HMAC-SHA256 `Stripe-Signature` (`t=...,v1=...`) against `STRIPE_WEBHOOK_SECRET`.
  - Enforces event-ID idempotency via `processed_billing_events` unique index (`event_id`).
- **Quotas & Feature Gates:**
  - Seat quota enforced in `UserService.create_user()` via `BillingService.check_seat_quota()`.
  - Monthly prediction quota enforced atomically in `BillingService.consume_prediction_quota()` using MongoDB `find_one_and_update` with `$expr: {$lte: [{$add: ["$predictions_used", count]}, "$prediction_quota_monthly"]}`.
  - Centralized feature gates (`dropout_analytics`, `bulk_prediction`, `advanced_forecasting`, `model_evaluation`, `advanced_analyst_dashboards`) enforced on backend services.

## 6. API Endpoints & Frontend Routes (Phase 9C / 9D)
- **Platform APIs (`/api/platform/*`):** `GET /overview`, `GET/POST /institutions`, `POST /onboarding/register`, `GET /institutions/<id>`, `POST /institutions/<id>/{activate,suspend,reactivate}`, `GET /plans`, `GET /subscriptions`, `GET /audit-logs`, `GET /billing/my-subscription`, `POST /billing/{change-plan,cancel}`, `POST /billing/webhook`.
- **Frontend Routes:** `/platform/overview`, `/platform/institutions`, `/platform/institutions/:id`, `/platform/onboarding`, `/platform/subscriptions`, `/platform/audit-logs`, and `/admin/billing`.

## 7. Environment Variables, Production Deployment & Known Limitations
- **Required Env Vars:** `SECRET_KEY`, `MONGO_URI`, `CORS_ORIGINS`, `TRUSTED_TENANT_DOMAINS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Gateway:** `deployment/httpd.conf` (Apache SSL reverse proxy) and `deployment/wsgi.py` (Waitress WSGI).
- **Known Limitations & Future Scalability:**
  - `backend/utils/rate_limiter.py` is process-local in-memory and does not share state across multiple WSGI workers; production horizontal scaling should migrate rate limiting to Redis.
  - Heavy multi-tenant ML batch jobs should be offloaded to an async task queue (Celery + Redis) in future scaling.
  - Live Stripe API keys are not provisioned in local dev; webhook verification and sandbox lifecycle are verified in test mode.

## 8. Security Remediation Summary
- **Privilege Escalation Prevention:** `UserService.update_role()` and `PUT /api/admin/users/<id>/role` strictly block Institution Admins from assigning `platform_super_admin` (`403 Forbidden`).
- **Tenant-Isolated User Management:** `UserService.list_users()`, `update_user_by_admin()`, `update_role()`, and `update_status()` enforce `organization_id` matching and include `organization_id` directly in MongoDB update filters.
- **CLI Hardening:** `flask create-super-admin` refuses duplicate `platform_super_admin` provisioning unless `--force` is explicitly supplied, while preserving email/password validation and audit logging.
- **Demand Forecasting Billing Controls:** `DemandForecastService.generate_and_save_forecasts()` enforces the `advanced_forecasting` feature gate and atomically consumes prediction quota only when valid forecast snapshots are persisted.
