"""
EduPredict - System Log Service
Provides logging for security, authentication, and administrative actions.
Includes automatic redaction of credentials and secrets, and CRLF log-injection protection.
"""

import re
import logging
from pymongo.database import Database
from backend.models.system_log_model import SystemLog

logger = logging.getLogger(__name__)

SENSITIVE_FIELD_NAMES = {
    "password", "current_password", "new_password", "plain_password",
    "token", "csrf_token", "secret", "secret_key", "cookie",
    "session_id", "authorization", "mongo_uri", "database_password",
}


def sanitize_log_string(val: str) -> str:
    """Sanitize string values to prevent log injection (CRLF injection)."""
    if not isinstance(val, str):
        return val
    # Strip carriage returns and newlines to prevent multiline log forgery
    return re.sub(r"[\r\n]+", " ", val).strip()


def redact_sensitive_dict(d: dict) -> dict:
    """
    Recursively redact sensitive credential keys from log details.
    Sanitizes string inputs to eliminate multiline log injection vulnerabilities.
    """
    if not isinstance(d, dict):
        return d
    redacted = {}
    for k, v in d.items():
        clean_k = sanitize_log_string(str(k))
        if any(sens in clean_k.lower() for sens in SENSITIVE_FIELD_NAMES):
            redacted[clean_k] = "[REDACTED]"
        elif isinstance(v, dict):
            redacted[clean_k] = redact_sensitive_dict(v)
        elif isinstance(v, list):
            redacted[clean_k] = [
                redact_sensitive_dict(item) if isinstance(item, dict)
                else (sanitize_log_string(item) if isinstance(item, str) else item)
                for item in v
            ]
        elif isinstance(v, str):
            redacted[clean_k] = sanitize_log_string(v)
        else:
            redacted[clean_k] = v
    return redacted


def log_event(
    db: Database,
    event_type: str,
    details: dict | None = None,
    user_id=None,
    actor_id=None,
    ip_address: str | None = None,
) -> bool:
    """
    Record an audit log entry in MongoDB system_logs.
    Automatically scrubs passwords/tokens and prevents multiline log injection.
    """
    if db is None:
        logger.warning("Database not available for logging event: %s", sanitize_log_string(event_type))
        return False
    try:
        clean_event = sanitize_log_string(event_type)
        clean_ip = sanitize_log_string(ip_address) if ip_address else None
        clean_details = redact_sensitive_dict(details or {})

        log_entry = SystemLog(
            event_type=clean_event,
            details=clean_details,
            user_id=user_id,
            actor_id=actor_id,
            ip_address=clean_ip,
        )
        db.system_logs.insert_one(log_entry.to_doc())
        return True
    except Exception as e:
        logger.error("Failed to insert audit log: %s", str(e))
        return False
