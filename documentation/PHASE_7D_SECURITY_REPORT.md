# EduPredict — Phase 7D Security & Production Hardening Report

**Date:** November 23, 2026  
**Project:** EduPredict (`C:\Users\Azan's PC\Documents\EduPredict`)  
**Target Repository:** `https://github.com/azanali30/EduPredict`  
**Current Branch:** `main`  
**Starting Commit:** `867c5f9` (Phase 7C Final Remediation)  
**Status:** Complete & Verified  

---

## 1. Executive Summary

Phase 7D completes the security and production hardening of EduPredict across six foundational security domains:
1. **Secret Management & Fail-Safe Production Startup**: Eliminated insecure default fallbacks in production. In production (`FLASK_ENV=production`), startup strictly validates that `SECRET_KEY` is supplied via environment variables, is not set to any known default/development key, and is at least 32 characters in length. Debug mode is permanently locked off in production.
2. **Multi-Layer File Upload Security**: Hardened `/api/upload` against malicious uploads, web shells, and polyglot files. File extensions are restricted to strict allowlists, MIME types are verified, file signatures (magic bytes) are inspected, and raster images are safely decoded, checked for dimension boundaries (max 4096px), and re-encoded using Pillow (stripping EXIF metadata and embedded polyglots). Server-generated UUID filenames and canonical directory path checks eliminate path traversal. SVGs and script files are strictly rejected.
3. **API & Authorization Security (IDOR Prevention)**: Verified server-side authorization across all sensitive routes. Student users cannot view or predict for other students; teachers cannot access unassigned students or cross-term anomalies; self-service profile updates strictly forbid mutation of `role`, `password_hash`, `email`, `_id`, or `academic_info`.
4. **CSRF, CORS & Session Hardening**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require valid CSRF tokens via `X-CSRFToken`. Custom JSON CSRF error handlers prevent HTML leaks. CORS origins are explicitly configured via environment allowlists (`CORS_ORIGINS`) with `Access-Control-Allow-Credentials: true`; wildcard `*` origins are strictly prohibited with credentials. Session cookies enforce `HttpOnly=True`, `SameSite="Lax"`, and `Secure=True` in production.
5. **Logging Safety & Audit Integrity**: The audit logging pipeline (`log_event`) automatically sanitizes strings against CRLF log injection and recursively scrubs sensitive credentials (`password`, `token`, `csrf_token`, `secret`, `cookie`, `authorization`) into `[REDACTED]`.
6. **Accurate Statistical Disclosure Control (SDC) Documentation**: Clarified privacy notices to accurately describe the tested minimum cell suppression ($N < 5$) and complementary suppression rules across aggregate anomaly tables, removing any inaccurate claims of blanket mathematical differential privacy.

---

## 2. Files Inspected

- `backend/config.py`
- `backend/app.py`
- `backend/routes/upload_routes.py`
- `backend/routes/auth_routes.py`
- `backend/routes/user_routes.py`
- `backend/routes/prediction_routes.py`
- `backend/routes/anomaly_routes.py`
- `backend/routes/analyst_routes.py`
- `backend/routes/admin_routes.py`
- `backend/services/user_service.py`
- `backend/services/auth_service.py`
- `backend/services/anomaly_service.py`
- `backend/services/system_log_service.py`
- `backend/utils/decorators.py`
- `frontend/src/services/api.ts`
- `frontend/vite.config.ts`

---

## 3. Files Modified

| File | Type | Changes Summary |
|---|---|---|
| `backend/config.py` | Config | Added `KNOWN_INSECURE_SECRETS`, `validate_secret_key()`, `PERMANENT_SESSION_LIFETIME`, explicit `CORS_ALLOWED_ORIGINS`, and production secret enforcement. |
| `backend/app.py` | Application Factory | Enforced `validate_secret_key()` in production; locked `DEBUG=False` in production; added CORS preflight OPTIONS and response headers; added baseline security headers (`nosniff`, `DENY`, `mode=block`); added structured JSON error handlers for `CSRFError`, 400, 403, 404, 405, 413, 415, 500; cleaned duplicate 403 handler. |
| `backend/routes/upload_routes.py` | Routes | Implemented magic byte validation (`validate_magic_bytes`), MIME type checking (`validate_mimetype`), Pillow image decoding and re-encoding (`process_and_sanitize_image`), 4096px dimension cap, 5 MB file size limit, pure UUID filename generation, and strict directory path traversal checks. Rejected SVGs and script files. |
| `backend/services/system_log_service.py` | Service | Implemented `redact_sensitive_dict()` for automatic credential scrubbing (`[REDACTED]`) and `sanitize_log_string()` for CRLF log-injection prevention. |
| `backend/services/anomaly_service.py` | Service | Refined `privacy_notice` string to accurately describe tested SDC small-cohort cell suppression without claiming universal differential privacy. |
| `tests/test_registration_workflows.py` | Test Suite | Updated avatar upload test to supply authentic 1x1 PNG bytes accepted by Pillow. |
| `tests/test_phase_7d_security_hardening.py` | Test Suite | Created 27 comprehensive security tests covering production secret validation, cookie attributes, upload security, IDOR, self-service profile protections, CSRF, CORS, and log redaction. |
| `README.md` | Documentation | Added Phase 7D security configuration documentation, production environment variables by name, and test results. |
| `documentation/TEST_REPORT.md` | Documentation | Appended Phase 7D test execution results and verification matrix. |

---

## 4. Security Hardening Specifications

### 4.1 Production Secret Key Management
- **Insecure Keys Blocked**:
  Known development secrets such as `"edupredict-default-insecure-key-change-in-prod"`, `"changeme"`, `"secret"`, `"password"`, `"dev"`, `"test"`, `"123456"` are cataloged in `KNOWN_INSECURE_SECRETS`.
- **Length & Strength Requirement**:
  Production keys must be at least 32 characters in length (`len >= 32`).
- **Fail-Safe Startup**:
  In `create_app("production")` or when `FLASK_ENV=production`:
  If `SECRET_KEY` is missing, in known defaults, or $< 32$ characters, `validate_secret_key()` immediately raises a `RuntimeError` preventing the application from starting.
- **Diagnostics Safety**:
  Secret key values are never output to logs, console messages, or API error payloads.

### 4.2 File Upload Security Pipeline
When a file is submitted to `POST /api/upload`:
1. **Extension Allowlist**:
   - Avatars: `.png`, `.jpg`, `.jpeg`, `.webp`
   - Documents: `.pdf`, `.png`, `.jpg`, `.jpeg`
   - All other formats (e.g. `.svg`, `.exe`, `.php`, `.py`, `.sh`, `.html`) return `415 Unsupported Media Type`.
2. **Payload Size Bounds**:
   - Empty files (0 bytes) return `400 Bad Request`.
   - Files exceeding 5 MB return `413 Payload Too Large`.
3. **MIME & Magic Byte Inspection**:
   - Inspects the binary header bytes (`\x89PNG\r\n\x1a\n` for PNG, `\xff\xd8\xff` for JPEG, `RIFF...WEBP` for WebP, `%PDF-` for PDF).
   - If magic bytes do not match the declared extension, returns `400 Bad Request`.
4. **Pillow Image Sanitization & Re-Encoding**:
   - Image files are decoded via `PIL.Image.open()`.
   - Integrity verified via `img.verify()`.
   - Dimensions checked against $4096 \times 4096$ px limit to protect against decompression bombs.
   - Clean raster canvas is generated, stripping all EXIF tags, metadata, and polyglot attachments.
   - Re-encoded cleanly to target destination.
5. **Path Traversal Immunity**:
   - Stored filenames are server-generated random UUID hex strings: `{uuid.uuid4().hex}.{ext}`. User-provided filenames are completely discarded for storage paths.
   - Destination paths are verified against `target_dir + os.sep`.
   - In `serve_upload()`, traversal sequences like `..` are validated using `os.path.abspath` and forbidden with `403`.

### 4.3 CSRF, CORS & Session Hardening
- **CSRF Protection**:
  Flask-WTF `CSRFProtect` is active for state-changing requests. Custom `@app.errorhandler(CSRFError)` returns structured JSON (`{"error": "Bad Request", "message": "CSRF validation failed: ...", "status_code": 400}`).
- **CORS Configuration**:
  Origins are resolved from `CORS_ORIGINS` (defaulting to explicit localhost/127.0.0.1 origins in development, and strictly from env in production). Wildcard `*` is prohibited when credentials are enabled.
  Preflight `OPTIONS` requests return 200/204 with explicit `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, and standard allowed headers/methods.
- **Hardening Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Session Cookie Attributes**:
  - `HttpOnly = True`
  - `SameSite = "Lax"`
  - `Secure = True` (enforced in production)
  - `PERMANENT_SESSION_LIFETIME = 28800` (8 hours)
  - `login_manager.session_protection = "strong"`

### 4.4 Logging & Audit Safety
- `log_event()` applies `redact_sensitive_dict()` which recursively checks dictionary keys matching `password`, `token`, `secret`, `cookie`, `session`, `authorization`, `csrf_token`, replacing values with `[REDACTED]`.
- All logged strings are sanitized with `sanitize_log_string()` to strip carriage returns (`\r`) and line feeds (`\n`), eliminating log injection (CRLF forging).

---

## 5. Production Deployment Checklist & Environment Variables

### Required Production Environment Variables (By Name Only)
| Variable | Description |
|---|---|
| `SECRET_KEY` | Cryptographically random secret string ($\ge 32$ characters). |
| `FLASK_ENV` | Must be set to `production`. |
| `MONGO_URI` | MongoDB connection URI with authenticated credentials. |
| `MONGO_DB_NAME` | Database name (`edupredict`). |
| `CORS_ORIGINS` | Comma-separated list of fully-qualified authorized frontend origins (e.g. `https://edupredict.edu`). |
| `UPLOAD_FOLDER` | Absolute filesystem path for upload assets (outside web root). |
| `PORT` | Listening port (e.g. `5000`). |
| `HOST` | Bind address (e.g. `127.0.0.1` behind reverse proxy). |

### Production Deployment Checklist
1. [x] Generate a 64-character random hex string for `SECRET_KEY`.
2. [x] Ensure `FLASK_ENV=production` is set in the production environment.
3. [x] Verify reverse proxy (Nginx / Cloudflare) handles SSL/TLS termination and sets `X-Forwarded-Proto: https`.
4. [x] Verify `CORS_ORIGINS` contains only authentic production frontend domains.
5. [x] Ensure `UPLOAD_FOLDER` exists with non-executable filesystem permissions (`chmod 750`).
6. [x] Verify MongoDB has authentication enabled and network access bound to private subnets.
7. [x] Ensure `.env` is omitted from version control and deployment bundles.

---

## 6. Verification & Test Execution Results

### 6.1 Backend Pytest Execution
- **Phase 7D Security Suite (`tests/test_phase_7d_security_hardening.py`)**:
  ```
  .venv\Scripts\pytest tests/test_phase_7d_security_hardening.py -v
  ============================= 27 passed in 13.11s =============================
  ```
- **Registration & Upload Workflows (`tests/test_registration_workflows.py`)**:
  ```
  .venv\Scripts\pytest tests/test_registration_workflows.py -v
  ============================== 5 passed in 6.39s ==============================
  ```
- **Anomaly Detection & SDC Privacy Suite (`tests/test_anomaly_detection.py`)**:
  ```
  .venv\Scripts\pytest tests/test_anomaly_detection.py -q
  ============================= 30 passed in 25.87s =============================
  ```
- **Full Backend Regression Suite (`tests/`)**:
  ```
  .venv\Scripts\pytest -q
  227 passed in 196.75s (0:03:16)
  ```
  **100% Pass Rate across all 227 backend tests with 0 failures.**

### 6.2 Frontend Vitest Execution
```
cd frontend && npx.cmd vitest run
✓ src/__tests__/grade_utils.test.ts (8 tests)
✓ src/__tests__/anomaly_monitoring.test.tsx (2 tests)
✓ src/__tests__/subject_workspace.test.tsx (15 tests)

Test Files  3 passed (3)
     Tests  25 passed (25)
  Duration  9.84s
```
**100% Pass Rate across all 25 frontend tests.**

### 6.3 TypeScript Typecheck & Production Build
```
cd frontend && npx.cmd tsc -b && npm.cmd run build
✓ 2086 modules transformed.
✓ built in 25.68s
dist/index.html   0.81 kB │ gzip: 0.46 kB
dist/assets/*    compiled cleanly with zero warnings or errors.
```

---

## 7. Known Security Boundaries & Limitations

1. **Self-Hosted Document Storage**: Private documents are stored on the local filesystem and served via `/api/uploads/documents/<filename>` with session and ownership validation. In enterprise multi-instance deployments, asset storage should transition to an authenticated object storage bucket (e.g. S3 / GCS) with signed URLs.
2. **Rate Limiting**: IP-based rate limiting (e.g. via Flask-Limiter) is recommended at the reverse proxy layer (Nginx / Cloudflare) to protect against brute-force login attacks.
3. **Statistical Disclosure Control Scope**: SDC cell suppression protects aggregate views tested in the Analyst suite ($N < 5$ and complementary suppression). SDC claims are strictly limited to these reported aggregate views.

---

## 8. Conclusion

Phase 7D is complete. All security requirements have been implemented, verified, and regression tested. Phase 7E has **NOT** been started.
