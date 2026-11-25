"""
EduPredict - Global Platform Audit Log Service (Phase 9A)
Module: backend.services.global_audit_service
Purpose: Records tamper-evident platform-level governance, tenant lifecycle, and billing audit events.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from flask import has_request_context, request
from pymongo import DESCENDING
from pymongo.database import Database

_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "secret",
    "secret_key",
    "token",
    "api_key",
    "card_number",
    "cvv",
    "cvc",
    "authorization",
}


def _scrub_metadata(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        return {}
    cleaned: Dict[str, Any] = {}
    for k, v in data.items():
        if str(k).lower() in _SENSITIVE_KEYS:
            cleaned[k] = "[REDACTED]"
        elif isinstance(v, dict):
            cleaned[k] = _scrub_metadata(v)
        else:
            cleaned[k] = v
    return cleaned


def log_global_event(
    db: Optional[Database],
    action: str,
    actor_id: Optional[ObjectId | str] = None,
    actor_role: str = "system",
    target_institution: Optional[str] = None,
    resource_type: str = "platform",
    resource_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    outcome: str = "success",
) -> None:
    """Persist a platform-level audit event into `global_audit_logs`."""
    if db is None:
        return

    ip_addr = None
    if has_request_context():
        ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr)

    doc = {
        "_id": ObjectId(),
        "actor_id": str(actor_id) if actor_id else None,
        "actor_role": actor_role,
        "action": action,
        "target_institution": target_institution,
        "resource_type": resource_type,
        "resource_id": str(resource_id) if resource_id else None,
        "ip_address": ip_addr,
        "metadata": _scrub_metadata(metadata),
        "outcome": outcome,
        "timestamp": datetime.now(timezone.utc),
    }
    try:
        db.global_audit_logs.insert_one(doc)
    except Exception:
        pass


def list_global_events(
    db: Database,
    action: Optional[str] = None,
    target_institution: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> Dict[str, Any]:
    """Paginated global audit log query for Platform Super Admin."""
    if db is None:
        return {"logs": [], "total": 0, "page": 1, "limit": limit}

    query: Dict[str, Any] = {}
    if action and action.strip():
        query["action"] = action.strip()
    if target_institution and target_institution.strip():
        query["target_institution"] = target_institution.strip()

    page = max(1, page)
    limit = max(1, min(limit, 100))
    skip = (page - 1) * limit

    total = db.global_audit_logs.count_documents(query)
    cursor = db.global_audit_logs.find(query).sort("timestamp", DESCENDING).skip(skip).limit(limit)
    logs = []
    for d in cursor:
        logs.append({
            "id": str(d.get("_id")),
            "actor_id": d.get("actor_id"),
            "actor_role": d.get("actor_role"),
            "action": d.get("action"),
            "target_institution": d.get("target_institution"),
            "resource_type": d.get("resource_type"),
            "resource_id": d.get("resource_id"),
            "ip_address": d.get("ip_address"),
            "metadata": d.get("metadata", {}),
            "outcome": d.get("outcome", "success"),
            "timestamp": d["timestamp"].isoformat() if isinstance(d.get("timestamp"), datetime) else d.get("timestamp"),
        })
    return {"logs": logs, "total": total, "page": page, "limit": limit}
