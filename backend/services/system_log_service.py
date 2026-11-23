"""
EduPredict - System Log Service
Provides logging for security, authentication, and administrative actions.
Includes automatic redaction of credentials and secrets, and CRLF log-injection protection.
"""

import re
import logging
from typing import Any
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


def is_sensitive_key(key_str: str) -> bool:
    """Check if key contains any sensitive credential or secret term."""
    clean = key_str.lower()
    return any(sens in clean for sens in SENSITIVE_FIELD_NAMES)


def sanitize_and_redact(val: Any) -> Any:
    """
    Recursively redact sensitive credential keys and sanitize CRLF characters
    across dictionaries, lists, tuples, sets, strings, and mixed nested structures.
    Guarantees non-mutation of input objects; returns clean, safe new structures.
    Safely handles unexpected types.
    """
    if isinstance(val, dict):
        result = {}
        for k, v in val.items():
            clean_k = sanitize_log_string(str(k))
            if is_sensitive_key(clean_k):
                result[clean_k] = "[REDACTED]"
            else:
                result[clean_k] = sanitize_and_redact(v)
        return result
    elif isinstance(val, (list, tuple)):
        sanitized_items = [sanitize_and_redact(item) for item in val]
        return sanitized_items if isinstance(val, list) else tuple(sanitized_items)
    elif isinstance(val, (set, frozenset)):
        sanitized_items = [sanitize_and_redact(item) for item in val]
        return set(sanitized_items) if isinstance(val, set) else frozenset(sanitized_items)
    elif isinstance(val, str):
        return sanitize_log_string(val)
    elif isinstance(val, (int, float, bool)) or val is None:
        return val
    else:
        # Fallback for unexpected or custom types (e.g. ObjectId, custom class)
        try:
            return sanitize_log_string(str(val))
        except Exception:
            return "[UNREPRESENTABLE]"


def redact_sensitive_dict(d: Any) -> Any:
    """
    Backward-compatible entry point for recursive credential redaction and CRLF sanitization.
    Accepts arbitrary structures (dicts, lists, primitives).
    """
    return sanitize_and_redact(d)


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
