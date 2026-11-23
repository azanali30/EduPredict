"""
EduPredict - Phase 7D Security & Production Hardening Test Suite
Covers:
- Secret management and production startup validation (missing/weak/known default secrets)
- Debug mode production lock
- Session cookie attributes and session protection
- File upload security: extension allowlists, magic bytes, MIME verification,
  Pillow image decode & re-encode, size limits, path-traversal prevention, SVG/script rejection
- API & Authorization security: IDOR prevention, role boundaries, self-service profile field protection
- CSRF, CORS origin allowlists, credential safety (no wildcard with credentials), OPTIONS preflight
- Logging safety: credential redaction and CRLF injection prevention
"""

import io
import os
import pytest
from PIL import Image
from flask import Flask
from bson import ObjectId

from backend.config import (
    validate_secret_key,
    validate_cors_origins,
    KNOWN_INSECURE_SECRETS,
    BaseConfig,
    DevelopmentConfig,
    TestingConfig,
    ProductionConfig,
    get_config,
)
from backend.app import create_app
from backend.services.system_log_service import (
    log_event,
    redact_sensitive_dict,
    sanitize_log_string,
    sanitize_and_redact,
)
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService


# ==============================================================================
# Helper to generate minimal valid images in memory
# ==============================================================================

def create_valid_image_bytes(fmt: str = "PNG", size: tuple = (10, 10), color: str = "blue") -> bytes:
    """Generate in-memory binary bytes of a valid, structurally sound image."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


def create_valid_pdf_bytes() -> bytes:
    """Generate in-memory binary bytes of a minimal valid PDF-1.4 document."""
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n"
        b"<< /Type /Catalog /Pages 2 0 R >>\n"
        b"endobj\n"
        b"2 0 obj\n"
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"
        b"endobj\n"
        b"3 0 obj\n"
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\n"
        b"endobj\n"
        b"xref\n"
        b"0 4\n"
        b"0000000000 65535 f \n"
        b"0000000010 00000 n \n"
        b"0000000060 00000 n \n"
        b"0000000117 00000 n \n"
        b"trailer\n"
        b"<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n"
        b"190\n"
        b"%%EOF\n"
    )


# ==============================================================================
# 1. Secret Management & Production Startup Hardening Tests
# ==============================================================================

def test_production_fails_when_secret_key_missing():
    """Production startup must raise RuntimeError when SECRET_KEY is missing or empty."""
    with pytest.raises(RuntimeError, match="SECRET_KEY environment variable is missing"):
        validate_secret_key(None, is_production=True)

    with pytest.raises(RuntimeError, match="SECRET_KEY environment variable is missing"):
        validate_secret_key("", is_production=True)


def test_production_fails_when_secret_key_is_known_insecure_default():
    """Production startup must reject all known insecure or development default secrets."""
    for bad_key in KNOWN_INSECURE_SECRETS:
        with pytest.raises(RuntimeError, match="known insecure default"):
            validate_secret_key(bad_key, is_production=True)


def test_production_fails_when_secret_key_is_too_weak():
    """Production startup must reject secrets shorter than 32 characters."""
    weak_keys = [
        "short",
        "12345678901234567890",  # 20 chars
        "twenty-nine-chars-secret-key!",  # 29 chars
        "thirty-one-chars-secret-key-123",  # 31 chars
    ]
    for weak in weak_keys:
        with pytest.raises(RuntimeError, match="too weak"):
            validate_secret_key(weak, is_production=True)


def test_production_succeeds_with_strong_secret():
    """A strong 32+ character random secret must validate without error."""
    valid_key = "a8f3b2049e71c8902d34e56f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b"
    # Should not raise
    validate_secret_key(valid_key, is_production=True)


def test_create_app_in_production_fails_without_env_secret(monkeypatch):
    """create_app('production') must abort if no valid SECRET_KEY is in the environment."""
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        create_app("production")


def test_create_app_in_production_succeeds_with_valid_secret(monkeypatch):
    """create_app('production') must initialize safely and enforce production locks when valid key provided."""
    strong_key = "b9823476abcdf0123456789abcdef0123456789abcdef0123456789abcdef01"
    monkeypatch.setenv("SECRET_KEY", strong_key)
    monkeypatch.setenv("MONGO_URI", "mongodb://localhost:27017/edupredict_test")
    monkeypatch.setenv("CORS_ORIGINS", "https://edupredict.edu")

    app = create_app("production")
    assert app.config["DEBUG"] is False
    assert app.config["TESTING"] is False
    assert app.config["SESSION_COOKIE_SECURE"] is True
    assert app.config["SESSION_COOKIE_HTTPONLY"] is True
    assert app.config["SESSION_COOKIE_SAMESITE"] == "Lax"


def test_development_and_testing_startup_compatibility():
    """Development and testing modes must start cleanly with safe defaults."""
    app_test = create_app("testing")
    assert app_test.config["TESTING"] is True
    assert app_test.config["SESSION_COOKIE_HTTPONLY"] is True

    app_dev = create_app("development")
    assert app_dev.config["DEBUG"] is True


# ==============================================================================
# 2. File Upload Security Tests
# ==============================================================================

def test_upload_valid_png_image(client, test_admin):
    """Authentic PNG image is decoded, verified, and re-encoded without error."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    png_bytes = create_valid_image_bytes(fmt="PNG", size=(20, 20), color="green")
    data = {"file": (io.BytesIO(png_bytes), "avatar.png"), "category": "avatar"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 201
    payload = res.get_json()
    assert "/api/uploads/avatars/" in payload["file_url"]
    assert payload["file_type"] == "png"
    assert payload["size"] == len(png_bytes)


def test_upload_valid_jpeg_image(client, test_admin):
    """Authentic JPEG image is decoded and sanitized successfully."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    jpg_bytes = create_valid_image_bytes(fmt="JPEG", size=(30, 30), color="red")
    data = {"file": (io.BytesIO(jpg_bytes), "photo.jpg"), "category": "avatar"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 201
    payload = res.get_json()
    assert "/api/uploads/avatars/" in payload["file_url"]
    assert payload["file_type"] == "jpg"


def test_upload_valid_webp_image(client, test_admin):
    """Authentic WebP image is accepted and re-encoded."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    webp_bytes = create_valid_image_bytes(fmt="WEBP", size=(25, 25), color="yellow")
    data = {"file": (io.BytesIO(webp_bytes), "avatar.webp"), "category": "avatar"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 201
    payload = res.get_json()
    assert "/api/uploads/avatars/" in payload["file_url"]
    assert payload["file_type"] == "webp"


def test_upload_disguised_executable_rejected(client, test_admin):
    """An executable file renamed with a .png extension must be rejected via magic bytes check."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00WindowsPEExecutableMock"
    data = {"file": (io.BytesIO(fake_exe), "exploit.png"), "category": "avatar"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 400
    assert "magic bytes" in res.get_json()["message"].lower()


def test_upload_malformed_image_rejected(client, test_admin):
    """An image with valid PNG header but corrupted body must be rejected by Pillow re-encoding."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    corrupt_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\xff" * 50
    data = {"file": (io.BytesIO(corrupt_png), "corrupt.png"), "category": "avatar"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 400
    assert "malformed" in res.get_json()["message"].lower() or "failed" in res.get_json()["message"].lower()


def test_upload_svg_and_scripts_rejected(client, test_admin):
    """SVG and script files must be strictly rejected with 415 Unsupported Media Type."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    dangerous_files = [
        ("<svg><script>alert(1)</script></svg>".encode(), "vector.svg"),
        ("<?php echo 'bad'; ?>".encode(), "shell.php"),
        ("#!/bin/bash\necho bad".encode(), "script.sh"),
        ("import os; os.system('bad')".encode(), "exploit.py"),
    ]

    for content, fname in dangerous_files:
        data = {"file": (io.BytesIO(content), fname), "category": "avatar"}
        res = client.post("/api/upload", data=data, content_type="multipart/form-data")
        assert res.status_code == 415
        assert "not permitted" in res.get_json()["message"].lower()


def test_upload_oversized_file_rejected(client, test_admin):
    """Files exceeding 5 MB limit must be rejected with 413 Payload Too Large."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    oversized_data = b"%PDF-" + b"0" * (5 * 1024 * 1024 + 1024)
    data = {"file": (io.BytesIO(oversized_data), "huge.pdf"), "category": "document"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 413
    assert "limit" in res.get_json()["message"].lower()


def test_upload_empty_file_rejected(client, test_admin):
    """Zero-byte files must be rejected with 400 Bad Request."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    data = {"file": (io.BytesIO(b""), "empty.pdf"), "category": "document"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 400
    assert "empty" in res.get_json()["message"].lower()


def test_upload_filename_path_traversal_neutralized(client, test_admin):
    """Path traversal sequences in filename (e.g. ../../hack.png) must be neutralized into safe UUIDs."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    png_bytes = create_valid_image_bytes(fmt="PNG")
    data = {"file": (io.BytesIO(png_bytes), "../../../etc/passwd.png"), "category": "avatar"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 201
    stored_filename = res.get_json()["filename"]
    assert ".." not in stored_filename
    assert "/" not in stored_filename
    assert "\\" not in stored_filename


def test_serve_upload_path_traversal_blocked(client, test_admin):
    """Directory traversal attempts in /api/uploads/<folder>/<filename> must be rejected."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    res = client.get("/api/uploads/avatars/..%2f..%2fconfig.py")
    assert res.status_code in (403, 404)


# ==============================================================================
# 3. API, Authorization & IDOR Tests
# ==============================================================================

def test_student_cannot_access_other_student_details(client, test_student, clean_db):
    """Students must be strictly blocked from viewing other students' profile records (IDOR protection)."""
    other_student, _ = UserService.create_user(
        clean_db, email="target.student@edupredict.edu", plain_password="OtherPassword123!",
        full_name="Target Student", role="student"
    )

    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    res = client.get(f"/api/students/{other_student.id}")
    assert res.status_code == 403
    assert "not authorized" in res.get_json()["message"].lower()


def test_student_cannot_generate_prediction_for_other_student(client, test_student, clean_db):
    """Students are strictly forbidden from submitting predictions for any other student_id."""
    other_student, _ = UserService.create_user(
        clean_db, email="victim.student@edupredict.edu", plain_password="VictimPassword123!",
        full_name="Victim Student", role="student"
    )

    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    payload = {
        "student_id": str(other_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": {"age": 17, "school": "GP"},
    }
    res = client.post("/api/predictions", json=payload)
    assert res.status_code == 403
    assert "strictly prohibited" in res.get_json()["message"].lower()


def test_self_service_profile_update_blocks_privileged_fields(client, test_student):
    """Users cannot escalate privileges or mutate institutional/protected fields via self-service PATCH."""
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})

    privileged_payloads = [
        {"role": "admin"},
        {"student_id": "NEW-STU-999"},
        {"is_active": False},
        {"academic_info": {"gpa": 4.0}},
        {"password_hash": "hacked_hash"},
        {"email": "hacker@edupredict.edu"},
    ]

    for payload in privileged_payloads:
        res = client.patch("/api/me", json=payload)
        assert res.status_code == 403
        assert "not permitted" in res.get_json()["message"].lower()


def test_global_error_handlers_return_structured_json(client):
    """Global error handlers (404, 405, 400) must return uniform structured JSON, not raw HTML."""
    # 404
    res_404 = client.get("/api/nonexistent-endpoint-xyz")
    assert res_404.status_code == 404
    assert res_404.is_json
    assert res_404.get_json()["error"] == "Not Found"

    # 405
    res_405 = client.delete("/auth/login")
    assert res_405.status_code == 405
    assert res_405.is_json
    assert res_405.get_json()["error"] == "Method Not Allowed"


# ==============================================================================
# 4. CSRF, CORS & Session Security Tests
# ==============================================================================

def test_cors_preflight_and_headers_for_allowed_origin(client):
    """CORS preflight and response headers must be properly returned for explicitly allowed origins."""
    origin = "http://localhost:5173"

    # 1. Preflight OPTIONS request
    res_options = client.open(
        "/api/predictions/options",
        method="OPTIONS",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"}
    )
    assert res_options.status_code == 200
    assert res_options.headers.get("Access-Control-Allow-Origin") == origin
    assert res_options.headers.get("Access-Control-Allow-Credentials") == "true"
    assert "GET" in res_options.headers.get("Access-Control-Allow-Methods", "")

    # 2. Hardening headers on normal request
    res_get = client.get("/health", headers={"Origin": origin})
    assert res_get.headers.get("X-Content-Type-Options") == "nosniff"
    assert res_get.headers.get("X-Frame-Options") == "DENY"
    assert res_get.headers.get("X-XSS-Protection") == "1; mode=block"


def test_cors_rejects_untrusted_origin(client):
    """Untrusted origins must not receive Access-Control-Allow-Origin reflection."""
    res = client.get("/health", headers={"Origin": "http://malicious-attacker.com"})
    assert res.headers.get("Access-Control-Allow-Origin") is None


def test_cors_never_uses_wildcard_with_credentials(client):
    """Wildcard '*' must never be combined with Access-Control-Allow-Credentials: true."""
    for origin in ("http://localhost:5173", "http://127.0.0.1:5000", "*"):
        res = client.get("/health", headers={"Origin": origin})
        allow_origin = res.headers.get("Access-Control-Allow-Origin")
        credentials = res.headers.get("Access-Control-Allow-Credentials")
        if credentials == "true":
            assert allow_origin != "*", "CORS policy violation: Wildcard origin with credentials!"


def test_csrf_protection_lifecycle_and_token_validation(clean_db):
    """With CSRF enabled, state-changing requests require valid tokens; invalid tokens are rejected with 400."""
    # Spin up an app instance with CSRF strictly enabled
    class CsrfTestConfig(TestingConfig):
        WTF_CSRF_ENABLED = True
        SECRET_KEY = "test-csrf-secret-key-32chars-min-len!"

    app = Flask(__name__)
    app.config.from_object(CsrfTestConfig)
    from backend.extensions import csrf as ext_csrf
    ext_csrf.init_app(app)

    @app.route("/test-post", methods=["POST"])
    def test_post():
        return {"status": "ok"}, 200

    @app.route("/get-token", methods=["GET"])
    def get_token():
        from flask_wtf.csrf import generate_csrf
        return {"csrf_token": generate_csrf()}, 200

    csrf_client = app.test_client()

    # 1. Mutating POST without CSRF token -> Rejected (400)
    res_no_token = csrf_client.post("/test-post", json={"data": 123})
    assert res_no_token.status_code == 400

    # 2. Mutating POST with invalid token -> Rejected (400)
    res_bad_token = csrf_client.post(
        "/test-post",
        json={"data": 123},
        headers={"X-CSRFToken": "invalid_tampered_token"}
    )
    assert res_bad_token.status_code == 400

    # 3. Retrieve valid CSRF token and submit -> Accepted (200)
    tok_res = csrf_client.get("/get-token")
    valid_token = tok_res.get_json()["csrf_token"]

    res_good = csrf_client.post(
        "/test-post",
        json={"data": 123},
        headers={"X-CSRFToken": valid_token}
    )
    assert res_good.status_code == 200


# ==============================================================================
# 5. Logging and Audit Safety Tests
# ==============================================================================

def test_system_log_redacts_credentials_and_secrets(clean_db):
    """Audit logging must automatically scrub passwords, tokens, cookies, and secret keys."""
    details = {
        "email": "teacher@edupredict.edu",
        "password": "SuperSecretPassword!",
        "plain_password": "PlainPasswordToScrub",
        "csrf_token": "secret_csrf_token_value",
        "nested": {
            "token": "bearer_jwt_token",
            "safe_field": "visible_value",
        },
        "safe_action": "update_grades",
    }

    success = log_event(clean_db, "TEST_SECURITY_EVENT", details=details)
    assert success is True

    doc = clean_db.system_logs.find_one({"event_type": "TEST_SECURITY_EVENT"})
    assert doc is not None
    saved = doc["details"]

    assert saved["password"] == "[REDACTED]"
    assert saved["plain_password"] == "[REDACTED]"
    assert saved["csrf_token"] == "[REDACTED]"
    assert saved["nested"]["token"] == "[REDACTED]"
    assert saved["nested"]["safe_field"] == "visible_value"
    assert saved["safe_action"] == "update_grades"


def test_system_log_sanitizes_crlf_log_injection(clean_db):
    """Untrusted input containing carriage returns or newlines must be sanitized to prevent log forging."""
    malicious_event = "AUTH_LOGIN_FAILED\r\n[CRITICAL] Admin account breached!"
    malicious_ip = "127.0.0.1\r\nForged-Header: attack"
    malicious_note = "User input\r\nForged log line"

    log_event(
        clean_db,
        event_type=malicious_event,
        details={"note": malicious_note},
        ip_address=malicious_ip,
    )

    doc = clean_db.system_logs.find_one({"event_type": {"$regex": "AUTH_LOGIN_FAILED"}})
    assert doc is not None

    assert "\r" not in doc["event_type"]
    assert "\n" not in doc["event_type"]
    assert "\r" not in doc["ip_address"]
    assert "\n" not in doc["ip_address"]
    assert "\r" not in doc["details"]["note"]
    assert "\n" not in doc["details"]["note"]


# ==============================================================================
# 6. Phase 7D Remediation: Strict CORS, Hardened PDF & Recursive Sanitization
# ==============================================================================

def test_validate_cors_origins_rejects_wildcard():
    """Wildcard '*' must be rejected in both development and production when credentials are used."""
    # Lone wildcard
    with pytest.raises(ValueError, match="strictly prohibited"):
        validate_cors_origins("*", is_production=False)

    with pytest.raises(RuntimeError, match="strictly prohibited"):
        validate_cors_origins("*", is_production=True)

    # Wildcard mixed with valid origin
    mixed_origins = "https://trusted.edupredict.edu,*"
    with pytest.raises(ValueError, match="strictly prohibited"):
        validate_cors_origins(mixed_origins, is_production=False)

    with pytest.raises(RuntimeError, match="strictly prohibited"):
        validate_cors_origins(mixed_origins, is_production=True)


def test_validate_cors_origins_rejects_malformed_and_unexpected_components():
    """Origins with invalid schemes, paths, queries, fragments, or credentials must be rejected."""
    bad_origins = [
        "ftp://edupredict.edu",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "https://edupredict.edu/api/path",
        "https://edupredict.edu?token=secret",
        "https://edupredict.edu#fragment",
        "https://user:pass@edupredict.edu",
        "not-a-valid-url",
    ]
    for bad in bad_origins:
        with pytest.raises((ValueError, RuntimeError)):
            validate_cors_origins(bad, is_production=False)


def test_validate_cors_origins_normalizes_valid_entries():
    """Valid HTTP/HTTPS origins must be parsed, stripped of trailing slash, and returned cleanly."""
    valid_input = "http://localhost:5173, https://app.edupredict.edu/, http://127.0.0.1:5000"
    normalized = validate_cors_origins(valid_input, is_production=False)
    assert normalized == [
        "http://localhost:5173",
        "https://app.edupredict.edu",
        "http://127.0.0.1:5000",
    ]


def test_production_startup_fails_with_insecure_or_empty_cors(monkeypatch):
    """create_app('production') must abort with RuntimeError if CORS_ORIGINS is invalid or empty."""
    strong_key = "a" * 64
    monkeypatch.setenv("SECRET_KEY", strong_key)
    monkeypatch.setenv("MONGO_URI", "mongodb://localhost:27017/edupredict_test")

    # 1. Wildcard in production
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError, match="strictly prohibited"):
        create_app("production")

    # 2. Mixed wildcard in production
    monkeypatch.setenv("CORS_ORIGINS", "https://edupredict.edu,*")
    with pytest.raises(RuntimeError, match="strictly prohibited"):
        create_app("production")

    # 3. Empty CORS_ORIGINS in production
    monkeypatch.setenv("CORS_ORIGINS", "")
    with pytest.raises(RuntimeError, match="at least one valid explicit"):
        create_app("production")

    # 4. Valid production CORS_ORIGINS succeeds
    monkeypatch.setenv("CORS_ORIGINS", "https://edupredict.edu, https://admin.edupredict.edu")
    app = create_app("production")
    assert "https://edupredict.edu" in app.config["CORS_ALLOWED_ORIGINS"]
    assert "https://admin.edupredict.edu" in app.config["CORS_ALLOWED_ORIGINS"]


def test_upload_valid_pdf_document(client, test_admin):
    """A structurally valid PDF document is accepted and stored."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    pdf_bytes = create_valid_pdf_bytes()
    data = {"file": (io.BytesIO(pdf_bytes), "transcript.pdf"), "category": "document"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 201
    payload = res.get_json()
    assert "/api/uploads/documents/" in payload["file_url"]
    assert payload["file_type"] == "pdf"


def test_upload_forged_pdf_rejected(client, test_admin):
    """Files that start with %PDF- but lack valid EOF/xref/trailer structure must be rejected (400)."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    forged_pdf = b"%PDF-1.4\nMalicious executable content pretending to be a PDF without EOF or xref tables!"
    data = {"file": (io.BytesIO(forged_pdf), "fake.pdf"), "category": "document"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 400
    msg = res.get_json()["message"].lower()
    assert "malformed" in msg or "invalid" in msg or "missing" in msg


def test_upload_pdf_with_script_action_rejected(client, test_admin):
    """PDF containing active script actions (/JavaScript) must be rejected for security."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    active_script_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n"
        b"<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert('pwned')) >> >>\n"
        b"endobj\n"
        b"2 0 obj\n"
        b"<< /Type /Pages /Kids [] /Count 0 >>\n"
        b"endobj\n"
        b"xref\n"
        b"0 3\n"
        b"0000000000 65535 f \n"
        b"0000000010 00000 n \n"
        b"0000000120 00000 n \n"
        b"trailer\n"
        b"<< /Size 3 /Root 1 0 R >>\n"
        b"startxref\n"
        b"180\n"
        b"%%EOF\n"
    )
    data = {"file": (io.BytesIO(active_script_pdf), "scripted.pdf"), "category": "document"}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")

    assert res.status_code == 400
    assert "script" in res.get_json()["message"].lower()


def test_serve_document_sets_attachment_and_nosniff_headers(client, test_admin):
    """Serving documents must set Content-Disposition: attachment, Content-Type, and nosniff."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    pdf_bytes = create_valid_pdf_bytes()
    data = {"file": (io.BytesIO(pdf_bytes), "verified_certificate.pdf"), "category": "document"}
    upload_res = client.post("/api/upload", data=data, content_type="multipart/form-data")
    assert upload_res.status_code == 201
    file_url = upload_res.get_json()["file_url"]

    # Serve the uploaded document as admin
    serve_res = client.get(file_url)
    assert serve_res.status_code == 200
    assert "attachment" in serve_res.headers.get("Content-Disposition", "")
    assert serve_res.headers.get("Content-Type") == "application/pdf"
    assert serve_res.headers.get("X-Content-Type-Options") == "nosniff"


def test_system_log_deeply_recursive_redaction_and_crlf_sanitization():
    """
    Sanitizer must scrub sensitive keys at every depth across arbitrary combinations
    of dicts, lists, tuples, and strings without mutating the original input.
    """
    raw_input = {
        "user_email": "analyst@edupredict.edu\r\nInjected-Header: evil",
        "auth_block": {
            "token": "secret_jwt_token_here",
            "metadata": [
                {
                    "password": "NestedPassword123!",
                    "session_id": "sess-xyz-987",
                    "safe_list": [
                        "item1\nwith_newline",
                        {"secret_key": "deep_secret_key", "valid_field": "visible\rvalue"},
                    ],
                },
                ("tuple_string\r\n", {"mongo_uri": "mongodb://user:pass@host/db"}),
            ],
        },
        "count": 42,
        "is_active": True,
    }

    # Execute deep recursive sanitization
    sanitized = sanitize_and_redact(raw_input)

    # 1. Verify original input was NOT mutated
    assert raw_input["auth_block"]["token"] == "secret_jwt_token_here"
    assert raw_input["auth_block"]["metadata"][0]["password"] == "NestedPassword123!"
    assert "\r" in raw_input["user_email"]

    # 2. Verify sensitive fields were scrubbed at all depths
    assert sanitized["auth_block"]["token"] == "[REDACTED]"
    assert sanitized["auth_block"]["metadata"][0]["password"] == "[REDACTED]"
    assert sanitized["auth_block"]["metadata"][0]["session_id"] == "[REDACTED]"
    assert sanitized["auth_block"]["metadata"][0]["safe_list"][1]["secret_key"] == "[REDACTED]"
    assert sanitized["auth_block"]["metadata"][1][1]["mongo_uri"] == "[REDACTED]"

    # 3. Verify CRLF injection removed from all strings at all depths
    assert "\r" not in sanitized["user_email"]
    assert "\n" not in sanitized["user_email"]
    assert sanitized["user_email"] == "analyst@edupredict.edu Injected-Header: evil"

    safe_item1 = sanitized["auth_block"]["metadata"][0]["safe_list"][0]
    assert "\n" not in safe_item1
    assert safe_item1 == "item1 with_newline"

    tuple_str = sanitized["auth_block"]["metadata"][1][0]
    assert "\r" not in tuple_str
    assert "\n" not in tuple_str
    assert tuple_str == "tuple_string"

    # 4. Verify non-string primitives are preserved as-is
    assert sanitized["count"] == 42
    assert sanitized["is_active"] is True
