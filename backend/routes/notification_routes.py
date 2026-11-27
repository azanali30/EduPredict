"""
EduPredict - Notification REST Routes (Phase 12A / 12B)
Module: backend.routes.notification_routes
Purpose: Exposes CSRF-protected, RBAC-enforced endpoints for user notification feeds,
unread counts, read-state updates, and Admin institutional broadcasts.
"""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.services.notification_service import NotificationService
from backend.utils.decorators import role_required

notification_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notification_bp.route("", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def list_notifications():
    """List paginated notifications belonging strictly to current_user."""
    res, err, status = NotificationService.list_notifications(
        mongo.db,
        actor_user=current_user,
        page=request.args.get("page", 1),
        limit=request.args.get("limit", 20),
        category=request.args.get("category"),
        severity=request.args.get("severity"),
        is_read=request.args.get("is_read"),
        subject_id=request.args.get("subject_id"),
    )
    if err or res is None:
        return jsonify({"error": "Notification Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@notification_bp.route("/unread-count", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def get_unread_count():
    """Return unread notification count strictly for current_user."""
    res, err, status = NotificationService.get_unread_count(mongo.db, actor_user=current_user)
    if err or res is None:
        return jsonify({"error": "Notification Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@notification_bp.route("/<notification_id>/read", methods=["PATCH"])
@login_required
@role_required("admin", "teacher", "student")
def mark_notification_read(notification_id: str):
    """Mark one notification as read strictly if owned by current_user."""
    res, err, status = NotificationService.mark_as_read(
        mongo.db, notification_id=notification_id, actor_user=current_user
    )
    if err or res is None:
        return jsonify({"error": "Notification Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@notification_bp.route("/read-all", methods=["PATCH"])
@login_required
@role_required("admin", "teacher", "student")
def mark_all_notifications_read():
    """Mark all unread notifications owned by current_user as read."""
    res, err, status = NotificationService.mark_all_as_read(mongo.db, actor_user=current_user)
    if err or res is None:
        return jsonify({"error": "Notification Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@notification_bp.route("/broadcast", methods=["POST"])
@login_required
@role_required("admin")
def send_broadcast_notification():
    """Admin-only institutional broadcast persisted across target user inboxes."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Bad Request", "message": "Request body must be valid JSON.", "status_code": 400}), 400

    res, err, status = NotificationService.broadcast_notification(mongo.db, data=data, actor_user=current_user)
    if err or res is None:
        return jsonify({"error": "Broadcast Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 201, **res}), 201
