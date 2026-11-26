# EduPredict — Phase 11 Implementation Report
## Backup, Recovery, Monitoring, Reliability & Scalability

**Project:** EduPredict  
**Branch:** `main`  
**Starting Commit:** `51e09961540327a9eaf6c65fb758e710224558d4`  
**Phase Scope:** SRS Requirements #17 (Automated Backups & Disaster Recovery), #18 (Horizontal Scalability & Load Balancing), #19 (Performance & System Resource Monitoring), and Phase 10 Reliability Hardening.

---

## 1. Implemented Components

- **Portable Backup & Restore Service (`backend/services/backup_service.py`):**
  - `BackupService.create_backup()` — non-blocking collection-by-collection BSON snapshot (`bson.encode`), gzip `.tar.gz` compression, `manifest.json` + `.meta.json` with SHA-256 checksums, atomic staging (`os.replace`), retention pruning (`prune_backups()`), and `system_logs` auditing (`BACKUP_CREATED`, `BACKUP_FAILED`, `BACKUP_PRUNED`).
  - `BackupService.verify_backup()` — validates path traversal, archive SHA-256, tar member safety, `format_version`, per-collection BSON checksums, and document counts.
  - `BackupService.restore_backup()` — defaults to `dry_run=True`, requires `confirm_destructive=True` for `replace_existing=True`, creates a pre-restore safety backup (`safety-pre-restore-*`) with automatic rollback on failure, rebuilds indexes via `init_db_indexes()`, and runs `run_db_integrity_check()`.
- **CLI Commands (`backend/commands/admin_commands.py`):**
  - `flask backup-db`, `flask verify-backup <backup_id>`, `flask list-backups`, `flask restore-db <backup_id> [--apply] [--replace] [--yes] [--target-db]`.
  - Non-zero exit codes on failure; zero credentials in output/logs.
- **Operational Monitoring (`backend/routes/monitoring_routes.py`):**
  - `GET /api/monitoring/overview` (Admin & Analyst; zero student PII, zero secrets/paths).
  - `GET /api/monitoring/backups`, `POST /api/monitoring/backups`, `POST /api/monitoring/backups/<backup_id>/verify` (Admin-only; no one-click destructive restore exposed).
- **Streaming Reliability (`backend/services/event_streamer.py`, `backend/routes/stream_routes.py`):**
  - Atomic conditional timestamp guard in `EventStreamer._sync_academic_state()` preventing concurrent out-of-order overwrites.
  - Bounded `EventStreamer.retry_failed_events()` and `EventStreamer.recover_stale_pending_events()` with `find_one_and_update` atomic claiming, retry limits, per-event failure isolation, and `system_logs` auditing (`POST /api/stream/retry-failed`, `POST /api/stream/recover-stale`).
- **Scalability & Deployment (`deployment/httpd.conf`, `deployment/wsgi.py`, `backend/utils/rate_limiter.py`):**
  - Removed Phase 9 `*.edupredict.com` wildcard subdomains; added SSE `flushpackets=on` and `ProxyTimeout 300`.
  - Documented single-process multi-threaded Waitress (`--threads=8`) behavior and process-local `SSEBroadcaster` / `rate_limiter` constraints.
- **Admin UI (`frontend/src/pages/admin/AdminDataManagement.tsx`, `frontend/src/services/api.ts`):**
  - Displays live MongoDB version/ping/indexes, stream/batch reconciliation status, latest verified backup, and Admin-only Create Backup / Verify Backup actions.

---

## 2. Security Safeguards

- Backup directory (`backups/`) is gitignored and never exposed via static routes.
- Strict regex (`^[a-zA-Z0-9_.-]+$`) and `Path.resolve()` checks prevent path traversal in backup IDs and tar members.
- Destructive restore requires explicit `confirm_destructive=True` (`--yes` / prompt in CLI) and creates a safety backup before replacing collections.
- Monitoring endpoints enforce `@role_required("admin", "analyst")` and strip filesystem paths, connection URIs, and all student PII.

---

## 3. Scheduling Instructions

- **Windows Task Scheduler:** Run `C:\Users\Azan's PC\Documents\EduPredict\.venv\Scripts\flask.exe --app backend.app backup-db` daily.
- **Linux Cron:** `0 2 * * * cd /opt/edupredict && FLASK_APP=backend.app .venv/bin/flask backup-db >> /var/log/edupredict_backup.log 2>&1`.

---

## 4. Environmental Limitations & Remaining Risks

- **Consistency Model:** Collection-by-collection BSON export is non-blocking and preserves exact BSON types, but is not a cluster-wide oplog point-in-time snapshot.
- **`mongodump` / `mongorestore`:** Not installed on the local Windows workstation; portable `pymongo-bson` engine is used by default.
- **Multi-Worker Horizontal Scaling:** `SSEBroadcaster` and `rate_limiter` remain process-local in-memory (intended for single-process Waitress `--threads=8`); multi-process WSGI scaling would require a shared pub/sub and rate-limit store in a future phase.

---

## 5. Verification Results

- **Full Backend (`.\.venv\Scripts\pytest.exe -q`):** `366 passed` in 250.84s (0 failed, including `test_inference_latency_budget` passing in 1.90s in isolation and `12 passed` in `tests/test_phase_11_reliability.py`).
- **Phase 11 Tests (`tests/test_phase_11_reliability.py`):** `12 passed` in 25.67s.
- **Frontend (`vitest run`, `tsc -b`, `npm run build`):** `7 test files, 38 passed`; `tsc -b` 0 errors; `vite build` succeeded cleanly.

---

## 6. Independent Audit Remediation Summary

- **Protected System Databases (`backend/services/backup_service.py`, `backend/commands/admin_commands.py`):** `restore_backup()` and `restore-db` CLI reject `admin`, `config`, and `local` (case-insensitive) prior to any safety backup or database operation.
- **Manifest/Metadata Cross-Validation (`backend/services/backup_service.py`):** `_verify_archive_paths()` cross-validates `backup_id`, `format_version`, `total_documents`, `collection_count`, and ensures no unverified `collections/*.bson` entries exist.
- **Restore Verification Completeness (`backend/services/backup_service.py`):** `run_db_integrity_check()` now covers `dropout_records` and `stream_events`; `restore_backup()` verifies restored `_id` sets alongside counts; capabilities explicitly note that validators, views, and ad-hoc indexes outside `schema.py` are not serialized.
- **Concurrent Initial Insert Race (`backend/database/schema.py`, `backend/services/event_streamer.py`):** Added duplicate pre-check + partial unique index `idx_records_student_subject_term_unique` on `academic_records` and `DuplicateKeyError` retry fallback in `_sync_academic_state()`.
- **Retry Backoff & Monitoring Efficiency (`backend/services/event_streamer.py`, `backend/routes/monitoring_routes.py`):** Added `cooldown_seconds` backoff (`last_retry_at`) to `retry_failed_events()` and switched monitoring collection totals to `estimated_document_count()`.
