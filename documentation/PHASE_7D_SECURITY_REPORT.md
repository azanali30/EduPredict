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
| `backend/config.py` | Config | Added `KNOWN_INSECURE_SECRETS`, `validate_secret_key()`, `validate_cors_origins()`, `PERMANENT_SESSION_LIFETIME`, and production secret & CORS fail-safe enforcement. |
| `backend/app.py` | Application Factory | Enforced `validate_secret_key()` and `validate_cors_origins()` in production; locked `DEBUG=False` in production; added CORS preflight OPTIONS and response headers (never returning wildcard `*` with credentials); added baseline security headers (`nosniff`, `DENY`, `mode=block`); added structured JSON error handlers for `CSRFError`, 400, 403, 404, 405, 413, 415, 500; cleaned duplicate 403 handler. |
| `backend/routes/upload_routes.py` | Routes | Implemented magic byte validation (`validate_magic_bytes`), MIME type checking (`validate_mimetype`), PDF structural integrity verification (`validate_pdf_structure`), Pillow image decoding and re-encoding (`process_and_sanitize_image`), 4096px dimension cap, 5 MB file size limit, pure UUID filename generation, strict directory path traversal checks, and safe document serving with `Content-Disposition: attachment` and `nosniff`. Rejected SVGs, scripts, and forged PDFs. |
| `backend/services/system_log_service.py` | Service | Implemented pure non-mutating recursive sanitizer `sanitize_and_redact()` for automatic credential scrubbing (`[REDACTED]`) and `sanitize_log_string()` for CRLF log-injection prevention across arbitrary dict/list nesting and unexpected data types. |
| `backend/services/anomaly_service.py` | Service | Refined `privacy_notice` string to accurately describe tested SDC small-cohort cell suppression without claiming universal differential privacy. |
| `tests/test_registration_workflows.py` | Test Suite | Updated avatar upload test to supply authentic 1x1 PNG bytes accepted by Pillow. |
| `tests/test_phase_7d_security_hardening.py` | Test Suite | Created 36 comprehensive security tests covering production secret validation, cookie attributes, upload security (PNG/JPEG/WebP/PDF), forged PDF rejection, script action rejection, attachment serving headers, IDOR, self-service profile protections, CSRF, strict CORS origin parsing and wildcard rejection, and deep recursive log redaction. |
| `README.md` | Documentation | Added Phase 7D security configuration documentation, production environment variables by name, and test results. |
| `documentation/TEST_REPORT.md` | Documentation | Appended Phase 7D test execution results and verification matrix. |

---

## 4. Security Hardening Specifications (Implemented in Code)

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

### 4.2 File Upload & Document Serving Pipeline
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
4. **Raster Image Sanitization & Re-Encoding (Pillow)**:
   - Image files are decoded via `PIL.Image.open()`.
   - Integrity verified via `img.verify()`.
   - Dimensions checked against $4096 \times 4096$ px limit to protect against decompression bombs.
   - Clean raster canvas is generated, stripping all EXIF tags, metadata, and polyglot attachments.
   - Re-encoded cleanly to target destination.
5. **PDF Structural Integrity & Active Content Verification**:
   - Verified via `validate_pdf_structure()`.
   - Requires valid `%PDF-` header and version format (`%PDF-1.x`).
   - Requires standard `%%EOF` marker in the trailing 1024 bytes.
   - Validates existence of objects (`obj`), cross-reference structure (`xref` or `startxref` or `/XRef`), and trailer.
   - Forged files (e.g. prepending `%PDF-` to arbitrary binary payloads) are detected and rejected with `400 Bad Request`.
   - Active executable script triggers (`/(?:JavaScript|JS|Launch)`) are detected and rejected.
   - **Boundary Note**: EduPredict does not claim universal semantic PDF sanitization or rendering sandboxing; instead, active script triggers are blocked and documents are safely served with attachment headers.
6. **Safe Document Serving**:
   - Private documents are served with explicit headers:
     - `Content-Disposition: attachment; filename="{safe_download_name}"` (prevents browser inline rendering or script execution)
     - `Content-Type: application/pdf` (or corresponding MIME type)
     - `X-Content-Type-Options: nosniff`
7. **Path Traversal Immunity**:
   - Stored filenames are server-generated random UUID hex strings: `{uuid.uuid4().hex}.{ext}`. User-provided filenames are completely discarded for storage paths.
   - Destination paths are verified against `target_dir + os.sep`.
   - In `serve_upload()`, traversal sequences like `..` are validated using `os.path.abspath` and forbidden with `403`.

### 4.3 CSRF, CORS & Session Hardening
- **CSRF Protection**:
  Flask-WTF `CSRFProtect` is active for state-changing requests. Custom `@app.errorhandler(CSRFError)` returns structured JSON (`{"error": "Bad Request", "message": "CSRF validation failed: ...", "status_code": 400}`).
- **Strict CORS Origin Validation**:
  - Validated via `validate_cors_origins()`.
  - Prohibits wildcard `*` anywhere in configuration when credentials are enabled (raises `RuntimeError` in production, `ValueError` in dev/test).
  - Prohibits wildcards even when mixed with valid origins (e.g. `https://trusted.example,*`).
  - Enforces explicit URL parsing: scheme must be `http` or `https`, host/netloc must be present, no path components (beyond empty or `/`), no query parameters, no fragments, and no user credentials.
  - Normalizes origins into canonical form `scheme://netloc`.
  - In production (`FLASK_ENV=production`), startup fails with `RuntimeError` if `CORS_ORIGINS` is missing, empty, or invalid.
  - Preflight `OPTIONS` and standard responses reflect only explicitly matched origins and never return `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`.
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

### 4.4 Fully Recursive Logging & Audit Safety
- `log_event()` applies `sanitize_and_redact()` across the entire log details payload.
- Traverses dictionaries, lists, tuples, and sets to arbitrary depth without mutating the input object.
- Replaces sensitive credential keys matching `password`, `token`, `secret`, `cookie`, `session`, `authorization`, `csrf_token`, `mongo_uri` with `[REDACTED]` at all depths.
- All strings at every depth are sanitized with `sanitize_log_string()` to strip carriage returns (`\r`) and line feeds (`\n`), preventing multiline CRLF log injection.
- Unexpected or custom types are handled safely without crashing.

---

## 5. Production Operational Deployment Checklist

> [!IMPORTANT]
> The following operational tasks must be performed and verified by the system administrator / DevOps operator in the production hosting environment. They cannot be automated in application code alone.

| Operational Step | Domain | Description | Verification Method | Status |
|---|---|---|---|---|
| **1. Cryptographic Secret Provisioning** | Environment | Generate a 64+ character random hex string and export as `SECRET_KEY` in production environment. | Verify `SECRET_KEY` is set and `len(SECRET_KEY) >= 32`. | **Operator Action Required** |
| **2. Production Mode Flag** | Environment | Export `FLASK_ENV=production` in the production container/process manager. | Verify startup logs state `Initializing EduPredict in 'production' mode`. | **Operator Action Required** |
| **3. Explicit CORS Domain Whitelist** | Environment | Export `CORS_ORIGINS` with explicit production domains (e.g. `https://edupredict.edu,https://admin.edupredict.edu`). No wildcards permitted. | Startup enforces non-empty list of valid HTTP/HTTPS origins. | **Operator Action Required** |
| **4. TLS Termination & Header Forwarding** | Reverse Proxy | Configure Nginx/Cloudflare reverse proxy with TLS 1.3 certificates and pass `X-Forwarded-Proto: https`, `X-Real-IP`, and `X-Forwarded-For`. | Verify HTTPS connection in browser; verify `Strict-Transport-Security` header. | **Operator Action Required** |
| **5. Upload Storage Directory Permissions** | Filesystem OS | Create `UPLOAD_FOLDER` outside the web root with non-executable permissions (`chmod 750`, owned by application user). | Run `ls -ld $UPLOAD_FOLDER` to verify permissions and ownership. | **Operator Action Required** |
| **6. MongoDB Network & Auth Security** | Database Host | Ensure MongoDB 6.x runs with authentication enabled (`--auth`), strong database credentials, and network binding restricted to private subnets/localhost. | Attempt connection without auth; verify connection is refused. | **Operator Action Required** |
| **7. Secret & Environment File Protection** | Repository / CI | Ensure `.env` and local secrets are excluded from git, CI/CD artifacts, and public docker images. | Run `git status` and verify `.gitignore` excludes `.env`. | **Operator Action Required** |

## 6. Verification & Test Execution Results

### 6.1 Backend Pytest Execution
- **Phase 7D Security Suite (`tests/test_phase_7d_security_hardening.py`)**:
  ```
  .venv\Scripts\pytest tests/test_phase_7d_security_hardening.py -v
  ============================= 36 passed in 18.63s =============================
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
  236 passed
  ```
  **100% Pass Rate across all 236 backend tests with 0 failures.**

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
4. **PDF Inspection & Sandboxing**: PDF uploads are structurally validated (valid header, %%EOF, object, xref/trailer markers) and checked for active script triggers (`/JavaScript`, `/JS`, `/Launch`), and documents are served with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` to prevent browser execution. However, PDF parsing is not an exhaustive antivirus or sandboxed PDF detonation chamber; enterprise deployments processing high untrusted volumes should integrate an external malware scanning pipeline (e.g. ClamAV).

---

## 8. Conclusion

Phase 7D is complete. All security requirements have been implemented, verified, and regression tested. Phase 7E has **NOT** been started.
