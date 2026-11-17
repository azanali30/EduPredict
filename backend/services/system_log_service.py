"""
EduPredict - System Log Service
Provides logging for security, authentication, and administrative actions.
"""

import logging
from pymongo.database import Database
from backend.models.system_log_model import SystemLog

logger = logging.getLogger(__name__)


def log_event(
    db: Database,
    event_type: str,
    details: dict | None = None,
    user_id=None,
    actor_id=None,
    ip_address: str | None = None,
) -> bool:
    """Record an audit log entry in MongoDB system_logs."""
    if db is None:
        logger.warning("Database not available for logging event: %s", event_type)
        return False
    try:
        log_entry = SystemLog(
            event_type=event_type,
            details=details or {},
            user_id=user_id,
            actor_id=actor_id,
            ip_address=ip_address,
        )
        db.system_logs.insert_one(log_entry.to_doc())
        return True
    except Exception as e:
        logger.error("Failed to insert audit log: %s", str(e))
        return False
