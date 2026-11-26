"""
EduPredict - Operational Monitoring & Backup Management Routes (Phase 11)
Module: backend.routes.monitoring_routes
Purpose: Exposes aggregate operational telemetry (health, DB stats, streaming/batch health,
backup status, error summaries) with strict RBAC and zero student PII or secret exposure.
"""

import time
from datetime import datetime, timezone
from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.services.backup_service import BackupService
from backend.services.batch_processor import BatchProcessor
from backend.services.event_streamer import EventStreamer
from backend.utils.decorators import role_required

monitoring_bp = Blueprint("monitoring", __name__, url_prefix="/api/monitoring")
_APP_START_MONOTONIC = time.monotonic()


def _collect_db_metrics(db, include_collection_details: bool = True) -> dict:
    """Safely collect aggregate MongoDB metrics without exposing credentials or PII."""
    ping_info = mongo.ping()
    if db is None or not ping_info.get("connected"):
        return {
            "connected": False,
            "status": ping_info.get("status", "disconnected"),
            "latency_ms": ping_info.get("latency_ms"),
            "server_version": ping_info.get("version", "unknown"),
            "collection_counts": {},
            "total_indexes": 0,
            "storage_bytes": None,
        }

    counts = {}
    total_indexes = 0
    if include_collection_details:
        for coll_name in sorted(db.list_collection_names()):
            if coll_name.startswith("system."):
                continue
            try:
                counts[coll_name] = db[coll_name].estimated_document_count()
                total_indexes += len(db[coll_name].index_information())
            except Exception:
                continue

    storage_bytes = None
    try:
        db_stats = db.command("dbStats")
        storage_bytes = int(db_stats.get("storageSize", 0))
    except Exception:
        storage_bytes = None

    return {
        "connected": True,
        "status": ping_info.get("status", "connected"),
        "latency_ms": ping_info.get("latency_ms"),
        "server_version": ping_info.get("version", "unknown"),
        "collection_counts": counts,
        "total_indexes": total_indexes,
        "storage_bytes": storage_bytes,
    }


def _sanitize_backup_summary(item: dict) -> dict:
    """Strip any filesystem paths and return safe aggregate backup summary."""
    return {
        "backup_id": item.get("backup_id"),
        "created_at": item.get("created_at"),
        "format_version": item.get("format_version"),
        "archive_size": item.get("archive_size"),
        "total_documents": item.get("total_documents"),
        "collection_count": item.get("collection_count"),
        "verified": bool(item.get("verified", False)),
        "archive_exists": bool(item.get("archive_exists", False)),
    }


@monitoring_bp.route("/overview", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def get_monitoring_overview():
    """
    Aggregate operational monitoring endpoint.
    - Admin: full aggregate DB stats, index count, stream/batch health, error counts, backup status.
    - Analyst: approved aggregate non-sensitive operational metrics only.
    - Student / Teacher: 403 Forbidden.
    """
    role = getattr(current_user, "role", "")
    is_admin = role == "admin"

    db_metrics = _collect_db_metrics(mongo.db, include_collection_details=is_admin)
    stream_metrics = EventStreamer.get_monitoring_status(mongo.db)
    reconciliation = BatchProcessor.get_reconciliation_summary(mongo.db)

    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    backups = BackupService.list_backups(backup_dir)
    latest_backup = _sanitize_backup_summary(backups[0]) if backups else None

    error_summary = {"failed_stream_events": stream_metrics.get("events_failed", 0), "recent_system_errors": 0}
    if is_admin and mongo.db is not None:
        try:
            error_summary["recent_system_errors"] = mongo.db.system_logs.count_documents(
                {"event_type": {"$regex": "FAILED|ERROR", "$options": "i"}}
            )
        except Exception:
            pass

    return jsonify({
        "status_code": 200,
        "application": {
            "name": current_app.config.get("APP_NAME", "EduPredict"),
            "version": current_app.config.get("APP_VERSION", "1.0.0"),
            "environment": current_app.config.get("ENV", "development"),
            "status": "healthy" if db_metrics.get("connected") else "degraded",
            "uptime_seconds": round(time.monotonic() - _APP_START_MONOTONIC, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "database": db_metrics,
        "streaming": stream_metrics,
        "reconciliation": reconciliation,
        "backups": {
            "total_available": len(backups),
            "latest": latest_backup,
            "capabilities": BackupService.get_capabilities(),
        },
        "errors": error_summary,
    }), 200


@monitoring_bp.route("/backups", methods=["GET"])
@login_required
@role_required("admin")
def list_backups():
    """Admin-only list of available backup metadata (no filesystem paths exposed)."""
    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    items = [_sanitize_backup_summary(b) for b in BackupService.list_backups(backup_dir)]
    return jsonify({"status_code": 200, "backups": items, "total": len(items)}), 200


@monitoring_bp.route("/backups", methods=["POST"])
@login_required
@role_required("admin")
def trigger_backup():
    """Admin-only endpoint to create and verify a MongoDB backup snapshot."""
    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    retention = current_app.config.get("BACKUP_RETENTION_COUNT", 7)
    meta, err = BackupService.create_backup(
        mongo.db,
        backup_dir=backup_dir,
        actor_id=current_user.id,
        retention_count=retention,
    )
    if err or not meta:
        return jsonify({"error": "Backup Failed", "message": err or "Unknown backup error.", "status_code": 500}), 500
    return jsonify({"status_code": 201, "backup": _sanitize_backup_summary(meta)}), 201


@monitoring_bp.route("/backups/<backup_id>/verify", methods=["POST"])
@login_required
@role_required("admin")
def verify_backup(backup_id: str):
    """Admin-only endpoint to verify SHA-256 and BSON integrity of a backup."""
    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    ok, details, err = BackupService.verify_backup(
        backup_dir=backup_dir,
        backup_id=backup_id,
        db=mongo.db,
        actor_id=current_user.id,
    )
    if not ok:
        return jsonify({
            "status_code": 400,
            "verified": False,
            "backup_id": backup_id,
            "message": err or "Backup verification failed.",
        }), 400
    manifest = (details or {}).get("manifest", {})
    return jsonify({
        "status_code": 200,
        "verified": True,
        "backup_id": backup_id,
        "total_documents": manifest.get("total_documents", 0),
        "collection_count": len(manifest.get("collections", {})),
    }), 200
