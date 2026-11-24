"""
EduPredict - WebHDFS REST API Contract Verification Tests (Phase 7E.2)
Automated contract tests validating the HDFSLakehouseManager against mocked WebHDFS responses.
Covers connection probing, directory topology (MKDIRS), two-step file creation & redirect handling,
HTTP error codes (401, 403, 404, 500), connection timeouts, malformed server responses,
and security sanitization without requiring live Hadoop infrastructure.
"""

import os
import io
import json
import socket
import tempfile
import urllib.request
import urllib.error
from unittest.mock import patch, MagicMock
import pytest

from backend.data_engineering.hdfs_lakehouse import (
    HDFSLakehouseManager,
    HDFS_ROOT,
    HDFS_DIRS,
    sanitize_webhdfs_error,
)


# ==============================================================================
# Helper Mock HTTP Response
# ==============================================================================

class MockHTTPResponse:
    """Mock HTTP response matching urllib.request context manager interface."""

    def __init__(self, body: bytes = b"", status: int = 200, headers: dict = None):
        self._body = body
        self.status = status
        self.headers = headers or {}

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


# ==============================================================================
# 1. Initialization and Configuration Contract Tests
# ==============================================================================

def test_manager_initialization_defaults_and_env_overrides():
    """Verify default endpoints, users, and environment variable overrides."""
    # 1. Defaults
    with patch.dict(os.environ, {}, clear=True):
        mgr = HDFSLakehouseManager()
        assert mgr.namenode_url == "http://localhost:9870/webhdfs/v1"
        assert mgr.hdfs_user == "edupredict"
        assert mgr.enabled is False

    # 2. Custom environment variables
    custom_env = {
        "HDFS_NAMENODE_URL": "http://cluster-nn.internal:50070/webhdfs/v1",
        "HDFS_USER": "analytics_worker",
        "HDFS_ENABLED": "true",
    }
    with patch.dict(os.environ, custom_env, clear=True):
        mgr = HDFSLakehouseManager()
        assert mgr.namenode_url == "http://cluster-nn.internal:50070/webhdfs/v1"
        assert mgr.hdfs_user == "analytics_worker"
        assert mgr.enabled is True

    # 3. Explicit constructor overrides take precedence over env
    mgr_override = HDFSLakehouseManager(
        namenode_url="http://custom-host:9870/webhdfs/v1",
        hdfs_user="custom_user",
        enabled=False,
    )
    assert mgr_override.namenode_url == "http://custom-host:9870/webhdfs/v1"
    assert mgr_override.hdfs_user == "custom_user"
    assert mgr_override.enabled is False


def test_manager_architectural_blueprint_tiers():
    """Verify Lakehouse blueprint exposes Bronze, Silver, and Gold tiers with proper formats."""
    mgr = HDFSLakehouseManager()
    bp = mgr.get_architectural_blueprint()

    assert "/edupredict/raw/academic/" in bp
    assert bp["/edupredict/raw/academic/"]["tier"] == "Raw Ingestion (Bronze Layer)"
    assert "CSV" in bp["/edupredict/raw/academic/"]["format"]

    assert "/edupredict/processed/academic/" in bp
    assert bp["/edupredict/processed/academic/"]["tier"] == "Cleaned & Normalized (Silver Layer)"
    assert "Parquet" in bp["/edupredict/processed/academic/"]["format"]

    assert "/edupredict/analytics/subject_performance/" in bp
    assert bp["/edupredict/analytics/subject_performance/"]["tier"] == "Analytical Aggregates (Gold Layer)"
    assert "Partitioned by subject" in bp["/edupredict/analytics/subject_performance/"]["format"]


# ==============================================================================
# 2. Connection Probe Contract Tests
# ==============================================================================

def test_probe_connection_success_contract():
    """Verify contract for successful NameNode WebHDFS probe (HTTP 200 with valid JSON)."""
    mgr = HDFSLakehouseManager(namenode_url="http://namenode:9870/webhdfs/v1", hdfs_user="testuser")
    mock_payload = {"FileStatuses": {"FileStatus": []}}
    mock_resp = MockHTTPResponse(
        body=json.dumps(mock_payload).encode("utf-8"),
        status=200,
    )

    captured_requests = []

    def mock_urlopen(req, timeout=None):
        captured_requests.append((req, timeout))
        return mock_resp

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        probe = mgr.probe_connection()

    assert probe["connected"] is True
    assert probe["status_code"] == 200
    assert probe["response"] == mock_payload
    assert probe["error"] is None

    # Verify request contract
    req, timeout = captured_requests[0]
    assert req.full_url == "http://namenode:9870/webhdfs/v1/?op=LISTSTATUS&user.name=testuser"
    assert req.headers.get("User-agent") == "EduPredict-HDFS-Client/1.0"
    assert timeout == 3.0


def test_probe_connection_url_error_connection_refused():
    """Verify contract when NameNode is offline or connection is refused."""
    mgr = HDFSLakehouseManager(namenode_url="http://localhost:9870/webhdfs/v1")
    refused_error = urllib.error.URLError(ConnectionRefusedError(10061, "Connect call failed"))

    with patch("urllib.request.urlopen", side_effect=refused_error):
        probe = mgr.probe_connection()

    assert probe["connected"] is False
    assert probe["status_code"] is None
    assert "HDFS NameNode Unreachable" in probe["error"]


def test_probe_connection_socket_timeout():
    """Verify contract when connection exceeds probe timeout."""
    mgr = HDFSLakehouseManager()
    timeout_error = urllib.error.URLError(socket.timeout("Operation timed out"))

    with patch("urllib.request.urlopen", side_effect=timeout_error):
        probe = mgr.probe_connection()

    assert probe["connected"] is False
    assert "Unreachable" in probe["error"]
    assert "timed out" in probe["error"]


@pytest.mark.parametrize("status_code, reason_phrase", [
    (401, "Authentication Required / Unauthorized"),
    (403, "Forbidden / Permission Denied"),
    (404, "Not Found"),
    (500, "Internal Server Error"),
])
def test_probe_connection_http_error_codes(status_code, reason_phrase):
    """Verify contract when NameNode returns HTTP errors (401, 403, 404, 500)."""
    mgr = HDFSLakehouseManager()
    http_err = urllib.error.HTTPError(
        url="http://localhost:9870/webhdfs/v1/?op=LISTSTATUS",
        code=status_code,
        msg=reason_phrase,
        hdrs={},
        fp=io.BytesIO(b'{"RemoteException":{"message":"HTTP Error"}}'),
    )

    with patch("urllib.request.urlopen", side_effect=http_err):
        probe = mgr.probe_connection()

    assert probe["connected"] is False
    assert str(status_code) in probe["error"] or reason_phrase in probe["error"]


def test_probe_connection_malformed_json_response():
    """Verify contract when NameNode returns HTTP 200 but response body is invalid JSON."""
    mgr = HDFSLakehouseManager()
    malformed_resp = MockHTTPResponse(
        body=b"<html><head><title>502 Bad Gateway</title></head><body>Proxy Error</body></html>",
        status=200,
    )

    with patch("urllib.request.urlopen", return_value=malformed_resp):
        probe = mgr.probe_connection()

    assert probe["connected"] is False
    assert "JSON" in probe["error"] or "Expecting value" in probe["error"]


# ==============================================================================
# 3. Directory Topology (MKDIRS) Contract Tests
# ==============================================================================

def test_ensure_lakehouse_directories_offline_graceful_bailout():
    """Verify that directory creation bails out gracefully when probe indicates HDFS is offline."""
    mgr = HDFSLakehouseManager()

    with patch.object(mgr, "probe_connection", return_value={"connected": False, "error": "Offline test daemon"}):
        res = mgr.ensure_lakehouse_directories()

    assert res["success"] is False
    assert res["reason"] == "Offline test daemon"
    assert res["planned_directories"] == HDFS_DIRS


def test_ensure_lakehouse_directories_success_all_tiers():
    """Verify contract for successful creation of all 5 Lakehouse logical directories."""
    mgr = HDFSLakehouseManager(namenode_url="http://namenode:9870/webhdfs/v1", hdfs_user="edupredict")

    captured_requests = []

    def mock_urlopen(req, timeout=None):
        captured_requests.append((req, timeout))
        return MockHTTPResponse(body=b'{"boolean":true}', status=200)

    with patch.object(mgr, "probe_connection", return_value={"connected": True, "error": None}):
        with patch("urllib.request.urlopen", side_effect=mock_urlopen):
            res = mgr.ensure_lakehouse_directories()

    assert res["success"] is True
    assert len(res["created_directories"]) == len(HDFS_DIRS)
    for expected_dir in HDFS_DIRS:
        assert expected_dir in res["created_directories"]

    # Verify request contracts for MKDIRS
    assert len(captured_requests) == len(HDFS_DIRS)
    for req, timeout in captured_requests:
        assert req.get_method() == "PUT"
        assert "op=MKDIRS" in req.full_url
        assert "user.name=edupredict" in req.full_url
        assert "permission=755" in req.full_url
        assert timeout == 5.0


def test_ensure_lakehouse_directories_partial_http_error():
    """Verify behavior if one directory creation fails with an HTTP error."""
    mgr = HDFSLakehouseManager()

    call_count = 0

    def mock_urlopen_partial(req, timeout=None):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise urllib.error.HTTPError(req.full_url, 403, "Permission Denied", {}, io.BytesIO(b""))
        return MockHTTPResponse(body=b'{"boolean":true}', status=200)

    with patch.object(mgr, "probe_connection", return_value={"connected": True, "error": None}):
        with patch("urllib.request.urlopen", side_effect=mock_urlopen_partial):
            with pytest.raises(urllib.error.HTTPError):
                mgr.ensure_lakehouse_directories()


# ==============================================================================
# 4. File Upload (Two-Step Creation Protocol) Contract Tests
# ==============================================================================

def test_upload_file_local_not_found_raises():
    """Verify that uploading a nonexistent local file raises FileNotFoundError immediately."""
    mgr = HDFSLakehouseManager()
    with pytest.raises(FileNotFoundError) as exc_info:
        mgr.upload_file("nonexistent_file_path_12345.csv", "/edupredict/raw/test.csv")
    assert "Local file not found" in str(exc_info.value)


def test_upload_file_offline_probe_bailout():
    """Verify that upload_file returns failure diagnostic when HDFS probe is offline."""
    mgr = HDFSLakehouseManager()

    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.write(b"sample academic data")
        temp_name = tf.name

    try:
        with patch.object(mgr, "probe_connection", return_value={"connected": False, "error": "NameNode unreachable"}):
            res = mgr.upload_file(temp_name, "/edupredict/raw/test.csv")

        assert res["success"] is False
        assert "HDFS Unavailable" in res["error"]
        assert res["local_path"] == temp_name
        assert res["hdfs_path"] == "/edupredict/raw/test.csv"
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)


def test_upload_file_two_step_creation_and_redirect_success():
    """
    Verify complete WebHDFS two-step creation protocol:
    Step 1: PUT to NameNode with op=CREATE receives 307 redirect with Location header.
    Step 2: PUT with payload to DataNode location.
    """
    mgr = HDFSLakehouseManager(namenode_url="http://namenode:9870/webhdfs/v1", hdfs_user="edupredict")
    payload = b"student_code,subject,final_exam_marks\nSTU_001,Mathematics,85.0\n"

    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.write(payload)
        temp_name = tf.name

    try:
        datanode_target_url = "http://datanode01:9864/webhdfs/v1/edupredict/raw/data.csv?op=CREATE&user.name=edupredict&data=true"
        step1_resp = MockHTTPResponse(
            body=b"",
            status=307,
            headers={"Location": datanode_target_url},
        )
        step2_resp = MockHTTPResponse(
            body=b"",
            status=201,
        )

        calls = []

        def mock_urlopen_two_step(req, timeout=None):
            calls.append((req, timeout))
            if len(calls) == 1:
                return step1_resp
            return step2_resp

        with patch.object(mgr, "probe_connection", return_value={"connected": True, "error": None}):
            with patch("urllib.request.urlopen", side_effect=mock_urlopen_two_step):
                upload_res = mgr.upload_file(temp_name, "/edupredict/raw/data.csv", overwrite=True)

        assert upload_res["success"] is True
        assert upload_res["hdfs_path"] == "/edupredict/raw/data.csv"
        assert upload_res["size_bytes"] == len(payload)
        assert upload_res["error"] is None
        assert "md5_checksum" in upload_res

        # Verify exact two-step call sequence
        assert len(calls) == 2
        # Call 1 (NameNode):
        req1, timeout1 = calls[0]
        assert req1.get_method() == "PUT"
        assert "op=CREATE" in req1.full_url
        assert "overwrite=true" in req1.full_url
        assert timeout1 == 5.0

        # Call 2 (DataNode):
        req2, timeout2 = calls[1]
        assert req2.get_method() == "PUT"
        assert req2.full_url == datanode_target_url
        assert req2.data == payload
        assert req2.headers.get("Content-type") == "application/octet-stream"
        assert timeout2 == 30.0

    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)


def test_upload_file_step1_namenode_http_403_failure():
    """Verify handling when NameNode rejects upload request (e.g. 403 Forbidden)."""
    mgr = HDFSLakehouseManager()
    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.write(b"data")
        temp_name = tf.name

    try:
        http_err = urllib.error.HTTPError(
            url="http://namenode:9870/webhdfs/v1/edupredict/test?op=CREATE",
            code=403,
            msg="Permission denied for user",
            hdrs={},
            fp=io.BytesIO(b""),
        )

        with patch.object(mgr, "probe_connection", return_value={"connected": True, "error": None}):
            with patch("urllib.request.urlopen", side_effect=http_err):
                res = mgr.upload_file(temp_name, "/edupredict/test.csv")

        assert res["success"] is False
        assert "403" in res["error"] or "Permission denied" in res["error"]
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)


def test_upload_file_step2_datanode_http_500_failure():
    """Verify handling when Step 1 succeeds with redirect, but Step 2 (DataNode stream) fails."""
    mgr = HDFSLakehouseManager()
    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.write(b"data payload")
        temp_name = tf.name

    try:
        step1_resp = MockHTTPResponse(
            body=b"",
            status=307,
            headers={"Location": "http://datanode01:9864/webhdfs/v1/..."}
        )
        step2_err = urllib.error.HTTPError(
            url="http://datanode01:9864/webhdfs/v1/...",
            code=500,
            msg="DataNode disk full",
            hdrs={},
            fp=io.BytesIO(b""),
        )

        calls = []

        def mock_two_step_fail(req, timeout=None):
            calls.append(req)
            if len(calls) == 1:
                return step1_resp
            raise step2_err

        with patch.object(mgr, "probe_connection", return_value={"connected": True, "error": None}):
            with patch("urllib.request.urlopen", side_effect=mock_two_step_fail):
                res = mgr.upload_file(temp_name, "/edupredict/test.csv")

        assert res["success"] is False
        assert "500" in res["error"] or "disk full" in res["error"]
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)


def test_upload_file_step2_datanode_timeout():
    """Verify handling when Step 2 DataNode upload times out."""
    mgr = HDFSLakehouseManager()
    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.write(b"data payload")
        temp_name = tf.name

    try:
        step1_resp = MockHTTPResponse(
            body=b"",
            status=307,
            headers={"Location": "http://datanode01:9864/webhdfs/v1/..."}
        )
        step2_timeout = urllib.error.URLError(socket.timeout("Upload payload stream timed out"))

        calls = []

        def mock_two_step_timeout(req, timeout=None):
            calls.append(req)
            if len(calls) == 1:
                return step1_resp
            raise step2_timeout

        with patch.object(mgr, "probe_connection", return_value={"connected": True, "error": None}):
            with patch("urllib.request.urlopen", side_effect=mock_two_step_timeout):
                res = mgr.upload_file(temp_name, "/edupredict/test.csv")

        assert res["success"] is False
        assert "timed out" in res["error"]
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)


# ==============================================================================
# 5. Reliability, Security & Diagnostic Sanitization Tests
# ==============================================================================

def test_credentials_not_leaked_in_exceptions_or_diagnostics():
    """Verify that credentials or secrets are not exposed in probe or upload outputs."""
    sensitive_user = "edupredict_svc_secret"
    mgr = HDFSLakehouseManager(
        namenode_url="http://namenode:9870/webhdfs/v1",
        hdfs_user=sensitive_user,
    )

    with patch("urllib.request.urlopen", side_effect=Exception("Generic internal socket connection error")):
        probe = mgr.probe_connection()

    # The error message should be clean without dump of credentials
    assert "Generic internal socket connection error" in probe["error"]
    assert "password" not in str(probe).lower()
    assert "secret_key" not in str(probe).lower()


def test_probe_connection_credential_sanitization_injected_diagnostics_and_logs(caplog):
    """
    Deliberately inject configured hdfs_user and sensitive query parameters (token, password, delegation)
    into mocked NameNode exceptions and assert that neither the configured username nor the sensitive
    parameter values appear in returned diagnostics or captured application logs.
    """
    configured_user = "secret_audit_user_99"
    secret_token = "super_secret_token_abc123"
    secret_pass = "top_secret_pass_xyz789"
    secret_dt = "delegation_token_val_456"

    mgr = HDFSLakehouseManager(
        namenode_url="http://namenode:9870/webhdfs/v1",
        hdfs_user=configured_user,
    )

    # 1. HTTPError with injected URL containing credentials and user in message
    http_msg = (
        f"HTTP Error 401: Unauthorized for user {configured_user} at "
        f"http://namenode:9870/webhdfs/v1/?op=LISTSTATUS&user.name={configured_user}&token={secret_token}&password={secret_pass}"
    )
    mock_http_err = urllib.error.HTTPError(
        url=f"http://namenode:9870/webhdfs/v1/?op=LISTSTATUS&user.name={configured_user}&token={secret_token}&password={secret_pass}",
        code=401,
        msg=http_msg,
        hdrs={},
        fp=io.BytesIO(b'{"RemoteException":{"message":"Unauthorized"}}'),
    )

    with caplog.at_level("WARNING"):
        caplog.clear()
        with patch("urllib.request.urlopen", side_effect=mock_http_err):
            probe = mgr.probe_connection()

    assert probe["connected"] is False
    assert probe["error"] is not None
    # Verify useful error diagnostic is preserved
    assert "401" in probe["error"] or "Unauthorized" in probe["error"]
    # Verify strict sanitization: neither username nor secret values appear in error
    assert configured_user not in probe["error"]
    assert secret_token not in probe["error"]
    assert secret_pass not in probe["error"]
    assert "[REDACTED]" in probe["error"] or "[REDACTED_USER]" in probe["error"]
    # Verify captured application logs are also sanitized
    assert configured_user not in caplog.text
    assert secret_token not in caplog.text
    assert secret_pass not in caplog.text

    # 2. URLError with injected user and delegation token
    url_err_msg = (
        f"Connection refused: http://namenode:9870/?user.name={configured_user}&delegation={secret_dt} "
        f"for user {configured_user}"
    )
    mock_url_err = urllib.error.URLError(reason=url_err_msg)

    with caplog.at_level("WARNING"):
        caplog.clear()
        with patch("urllib.request.urlopen", side_effect=mock_url_err):
            probe2 = mgr.probe_connection()

    assert probe2["connected"] is False
    assert "Unreachable" in probe2["error"]
    assert configured_user not in probe2["error"]
    assert secret_dt not in probe2["error"]
    assert configured_user not in caplog.text
    assert secret_dt not in caplog.text

    # 3. Generic Exception with injected credentials
    gen_err = Exception(f"Socket timeout for {configured_user}: token={secret_token}")
    with caplog.at_level("WARNING"):
        caplog.clear()
        with patch("urllib.request.urlopen", side_effect=gen_err):
            probe3 = mgr.probe_connection()

    assert probe3["connected"] is False
    assert "Socket timeout" in probe3["error"]
    assert configured_user not in probe3["error"]
    assert secret_token not in probe3["error"]
    assert configured_user not in caplog.text
    assert secret_token not in caplog.text


def test_upload_file_credential_sanitization_injected_diagnostics_and_logs(caplog):
    """
    Deliberately inject configured hdfs_user and sensitive query parameters into
    upload exceptions (Step 1 and Step 2) and assert that neither the configured
    username nor the sensitive parameter values appear in returned diagnostics or logs.
    """
    configured_user = "upload_audit_agent"
    secret_key = "secret_api_key_8888"
    secret_token = "token_bearer_xyz999"

    mgr = HDFSLakehouseManager(
        namenode_url="http://namenode:9870/webhdfs/v1",
        hdfs_user=configured_user,
    )

    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.write(b"contract test data payload")
        temp_file = tf.name

    try:
        # Mock probe_connection to simulate healthy NameNode
        with patch.object(mgr, "probe_connection", return_value={"connected": True, "error": None}):
            # Simulate Step 1 failure with injected credentials in exception
            injected_exc = Exception(
                f"Failed to initiate upload for user {configured_user} at "
                f"http://namenode:9870/webhdfs/v1/edupredict/data.csv?op=CREATE&user.name={configured_user}&key={secret_key}&token={secret_token}"
            )

            with caplog.at_level("ERROR"):
                caplog.clear()
                with patch("urllib.request.urlopen", side_effect=injected_exc):
                    res = mgr.upload_file(temp_file, "/edupredict/data.csv")

            assert res["success"] is False
            assert res["error"] is not None
            assert res["hdfs_path"] == "/edupredict/data.csv"
            # Verify useful failure message preserved
            assert "Failed to initiate upload" in res["error"]
            # Assert credentials and username are redacted from returned diagnostic
            assert configured_user not in res["error"]
            assert secret_key not in res["error"]
            assert secret_token not in res["error"]
            assert "[REDACTED]" in res["error"] or "[REDACTED_USER]" in res["error"]
            # Assert credentials and username are redacted from application logs
            assert configured_user not in caplog.text
            assert secret_key not in caplog.text
            assert secret_token not in caplog.text

            # Simulate Step 2 failure with injected DataNode token
            step1_resp = MockHTTPResponse(
                body=b"",
                status=307,
                headers={"Location": f"http://datanode01:9864/webhdfs/v1/write?token={secret_token}"},
            )
            step2_exc = Exception(f"DataNode rejected transfer for {configured_user}: token={secret_token}")

            calls = []
            def mock_two_step(req, timeout=None):
                calls.append(req)
                if len(calls) == 1:
                    return step1_resp
                raise step2_exc

            with caplog.at_level("ERROR"):
                caplog.clear()
                with patch("urllib.request.urlopen", side_effect=mock_two_step):
                    res2 = mgr.upload_file(temp_file, "/edupredict/data.csv")

            assert res2["success"] is False
            assert "DataNode rejected transfer" in res2["error"]
            assert configured_user not in res2["error"]
            assert secret_token not in res2["error"]
            assert configured_user not in caplog.text
            assert secret_token not in caplog.text

    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def test_standalone_sanitize_webhdfs_error_parameter_matrix():
    """Verify that sanitize_webhdfs_error properly redacts all sensitive query parameters."""
    test_user = "audit_user_2026"
    test_matrix = [
        ("user.name=audit_user_2026", "user.name=[REDACTED]"),
        ("username=admin", "username=[REDACTED]"),
        ("password=SuperSecret123!", "password=[REDACTED]"),
        ("token=jwt_token_value_abc", "token=[REDACTED]"),
        ("delegation=dt_token_val", "delegation=[REDACTED]"),
        ("delegation_token=dt_token_val2", "delegation_token=[REDACTED]"),
        ("secret=s3cr3t_val", "secret=[REDACTED]"),
        ("key=api_key_val", "key=[REDACTED]"),
        ("api_key=api_key_val2", "api_key=[REDACTED]"),
        ("secret_key=secret_key_val", "secret_key=[REDACTED]"),
        ("access_token=bearer_123", "access_token=[REDACTED]"),
        ("refresh_token=refresh_123", "refresh_token=[REDACTED]"),
        ("bearer=bearer_token_abc", "bearer=[REDACTED]"),
    ]

    for param_pair, expected_replacement in test_matrix:
        raw_url = f"http://localhost:9870/webhdfs/v1/?op=OPEN&{param_pair}&other=safe_val"
        sanitized = sanitize_webhdfs_error(raw_url, hdfs_user=test_user)
        assert expected_replacement in sanitized
        assert "other=safe_val" in sanitized

    # Direct username appearance
    user_msg = f"User {test_user} failed authentication against NameNode"
    sanitized_user = sanitize_webhdfs_error(user_msg, hdfs_user=test_user)
    assert test_user not in sanitized_user
    assert "[REDACTED_USER]" in sanitized_user
