"""
EduPredict - Anomaly Detection & Monitoring Routes (Phase 7C)
Module: backend.routes.anomaly_routes
Purpose: Endpoints for anomaly detection listing, detail view, human review triage,
and batch evaluation under strict Subject-Based RBAC.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.extensions import mongo
from backend.services.anomaly_service import AnomalyService
from backend.utils.decorators import role_required

anomaly_bp = Blueprint("anomalies", __name__, url_prefix="/api/anomalies")


@anomaly_bp.route("", methods=["GET"])
@login_required
@role_required("admin", "teacher")
def list_anomalies():
    """
    List paginated anomaly records.
    Admin: Institution-wide.
    Teacher: Strictly scoped to verified assigned subjects.
    Student/Analyst: Prohibited (403).
    """
    subject = request.args.get("subject")
    severity = request.args.get("severity")
    review_status = request.args.get("review_status") or request.args.get("status")
    is_benchmark_param = request.args.get("is_benchmark")
    is_benchmark = None
    if is_benchmark_param is not None:
        is_benchmark = is_benchmark_param.lower() in ("true", "1", "yes")
    
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
    except ValueError:
        return jsonify({"error": "Bad Request", "message": "page and limit must be integers.", "status_code": 400}), 400

    data, err, status_code = AnomalyService.list_anomalies(
        db=mongo.db,
        actor_user=current_user,
        subject=subject,
        severity=severity,
        review_status=review_status,
        is_benchmark=is_benchmark,
        page=page,
        limit=limit,
    )

    if err:
        return jsonify({"error": "Forbidden" if status_code == 403 else "Query Error", "message": err, "status_code": status_code}), status_code

    return jsonify({
        "status_code": 200,
        **data,
    }), 200


@anomaly_bp.route("/<anomaly_id>", methods=["GET"])
@login_required
@role_required("admin", "teacher")
def get_anomaly_detail(anomaly_id: str):
    """Retrieve detailed anomaly record with feature deviations."""
    data, err, status_code = AnomalyService.get_anomaly_by_id(
        db=mongo.db,
        anomaly_id=anomaly_id,
        actor_user=current_user,
    )

    if err:
        return jsonify({"error": "Error", "message": err, "status_code": status_code}), status_code

    return jsonify({
        "status_code": 200,
        "anomaly": data,
    }), 200


@anomaly_bp.route("/<anomaly_id>/status", methods=["PATCH", "PUT"])
@login_required
@role_required("admin", "teacher")
def update_anomaly_status(anomaly_id: str):
    """
    Update human review status of an anomaly record.
    Supported states: 'Pending Review', 'Confirmed Anomaly', 'Dismissed (Benign)'.
    """
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Bad Request", "message": "Request body must be a JSON object.", "status_code": 400}), 400

    new_status = data.get("review_status")
    if not new_status:
        return jsonify({"error": "Bad Request", "message": "'review_status' is required.", "status_code": 400}), 400

    review_notes = data.get("review_notes")

    record, err, status_code = AnomalyService.update_review_status(
        db=mongo.db,
        anomaly_id=anomaly_id,
        new_status=new_status,
        review_notes=review_notes,
        actor_user=current_user,
    )

    if err:
        return jsonify({"error": "Update Failed", "message": err, "status_code": status_code}), status_code

    return jsonify({
        "status_code": 200,
        "message": f"Anomaly status updated to '{new_status}'.",
        "anomaly": record,
    }), 200


@anomaly_bp.route("/batch-evaluate", methods=["POST"])
@login_required
@role_required("admin")
def batch_evaluate():
    """Trigger batch evaluation of subject records."""
    data = request.get_json() or {}
    subject = data.get("subject", "Mathematics")

    res, err, status_code = AnomalyService.batch_evaluate_subject(
        db=mongo.db,
        subject=subject,
        actor_user=current_user,
    )

    if err:
        return jsonify({"error": "Evaluation Failed", "message": err, "status_code": status_code}), status_code

    return jsonify({
        "status_code": 200,
        **res,
    }), 200
