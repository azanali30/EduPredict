"""
EduPredict - Feedback & Support Routes (Phase 12C)
Module: backend.routes.feedback_routes
Purpose: Exposes CSRF-protected endpoints for persistent student/teacher feedback inquiries,
subject-scoped counseling review, and Admin response/status transitions.
"""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.services.feedback_service import FeedbackService
from backend.utils.decorators import role_required

feedback_bp = Blueprint("feedback", __name__, url_prefix="/api/feedback")


@feedback_bp.route("", methods=["POST"])
@login_required
@role_required("student", "teacher")
def submit_feedback_ticket():
    """Submit a new persistent feedback inquiry or academic counseling request."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Bad Request", "message": "Request body must be valid JSON.", "status_code": 400}), 400

    res, err, status = FeedbackService.submit_ticket(mongo.db, actor_user=current_user, data=data)
    if err or res is None:
        return jsonify({"error": "Feedback Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 201, **res}), 201


@feedback_bp.route("", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def list_feedback_tickets():
    """List paginated feedback tickets strictly scoped to the caller's permissions."""
    res, err, status = FeedbackService.list_tickets(
        mongo.db,
        actor_user=current_user,
        page=request.args.get("page", 1),
        limit=request.args.get("limit", 20),
        status=request.args.get("status"),
        category=request.args.get("category"),
        role_filter=request.args.get("role"),
        subject_id=request.args.get("subject_id"),
        search=request.args.get("search"),
    )
    if err or res is None:
        return jsonify({"error": "Feedback Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@feedback_bp.route("/<ticket_id>", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def get_feedback_ticket(ticket_id: str):
    """Retrieve a single feedback ticket with strict private ownership and counseling scoping."""
    res, err, status = FeedbackService.get_ticket_by_id(mongo.db, ticket_id=ticket_id, actor_user=current_user)
    if err or res is None:
        return jsonify({"error": "Feedback Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@feedback_bp.route("/<ticket_id>", methods=["PATCH"])
@login_required
@role_required("admin")
def review_feedback_ticket(ticket_id: str):
    """Admin-only review, response, intervention notes, and Open -> Reviewed -> Resolved lifecycle updates."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Bad Request", "message": "Request body must be valid JSON.", "status_code": 400}), 400

    res, err, status = FeedbackService.review_ticket(
        mongo.db, ticket_id=ticket_id, actor_user=current_user, data=data
    )
    if err or res is None:
        return jsonify({"error": "Feedback Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200
