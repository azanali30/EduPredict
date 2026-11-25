"""
EduPredict - Course Demand Forecasting Routes (Phase 8B)
Module: backend.routes.demand_routes
Purpose: Exposes secure REST APIs for course & subject enrollment demand forecasting,
forecast snapshot generation, history retrieval, and model metadata.
"""

import logging
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.extensions import mongo
from backend.services.demand_forecast_service import DemandForecastService
from backend.utils.decorators import role_required, admin_required

logger = logging.getLogger(__name__)

demand_bp = Blueprint("demand", __name__, url_prefix="/api/demand")


@demand_bp.route("/overview", methods=["GET"])
@login_required
@role_required("admin", "analyst", "teacher")
def get_demand_overview():
    """
    Retrieve course/subject enrollment demand overview and forecasts.
    - Admin / Analyst: Organization-scoped institutional overview (no student PII).
    - Teacher: Strictly scoped to actively assigned subjects.
    - Student: 403 Forbidden.
    """
    try:
        periods_ahead = int(request.args.get("periods_ahead", 1))
    except ValueError:
        return jsonify({
            "error": "Bad Request",
            "message": "periods_ahead must be an integer between 1 and 4.",
            "status_code": 400,
        }), 400

    forecast_period = request.args.get("forecast_period")
    department = request.args.get("department")

    data, err, status_code = DemandForecastService.get_demand_overview(
        db=mongo.db,
        actor_user=current_user,
        periods_ahead=periods_ahead,
        forecast_period_override=forecast_period,
        department=department,
    )
    if err:
        return jsonify({
            "error": "Forbidden" if status_code == 403 else "Bad Request" if status_code == 400 else "Error",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({"status_code": 200, **data}), 200


@demand_bp.route("/forecast", methods=["POST"])
@login_required
@admin_required
def generate_forecast():
    """
    Generate and persist course demand forecast snapshots for the admin's organization.
    Admin only. Ignores any client-supplied organization_id.
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Payload must be a JSON object.",
            "status_code": 400,
        }), 400

    try:
        periods_ahead = int(data.get("periods_ahead", 1))
    except (ValueError, TypeError):
        return jsonify({
            "error": "Bad Request",
            "message": "periods_ahead must be an integer between 1 and 4.",
            "status_code": 400,
        }), 400

    forecast_period = data.get("forecast_period")
    subject_ids = data.get("subject_ids")
    if subject_ids is not None and not isinstance(subject_ids, list):
        return jsonify({
            "error": "Bad Request",
            "message": "subject_ids must be a list of valid subject IDs.",
            "status_code": 400,
        }), 400

    res, err, status_code = DemandForecastService.generate_and_save_forecasts(
        db=mongo.db,
        admin_user=current_user,
        periods_ahead=periods_ahead,
        forecast_period_override=forecast_period,
        subject_ids=subject_ids,
    )
    if err:
        return jsonify({
            "error": "Forbidden" if status_code == 403 else "Bad Request" if status_code == 400 else "Error",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({"status_code": status_code, **res}), status_code


@demand_bp.route("/history", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def get_forecast_history():
    """
    Retrieve paginated persisted forecast snapshots scoped to organization.
    """
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
    except ValueError:
        return jsonify({
            "error": "Bad Request",
            "message": "page and limit must be integers.",
            "status_code": 400,
        }), 400

    res, err, status_code = DemandForecastService.get_forecast_history(
        db=mongo.db,
        actor_user=current_user,
        page=page,
        limit=limit,
    )
    if err:
        error_label = "Forbidden" if status_code == 403 else "Bad Request" if status_code == 400 else "Error"
        return jsonify({"error": error_label, "message": err, "status_code": status_code}), status_code

    return jsonify({"status_code": 200, **res}), 200


@demand_bp.route("/subject/<subject_id>", methods=["GET"])
@login_required
@role_required("admin", "analyst", "teacher")
def get_subject_forecast(subject_id: str):
    """
    Retrieve detailed historical trend and demand forecast for a single subject.
    Teacher: strictly scoped to assigned subjects.
    """
    try:
        periods_ahead = int(request.args.get("periods_ahead", 1))
    except ValueError:
        return jsonify({
            "error": "Bad Request",
            "message": "periods_ahead must be an integer between 1 and 4.",
            "status_code": 400,
        }), 400

    res, err, status_code = DemandForecastService.get_subject_forecast(
        db=mongo.db,
        actor_user=current_user,
        subject_id=subject_id,
        periods_ahead=periods_ahead,
    )
    if err:
        error_label = (
            "Forbidden" if status_code == 403
            else "Bad Request" if status_code == 400
            else "Not Found" if status_code == 404
            else "Error"
        )
        return jsonify({
            "error": error_label,
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({"status_code": 200, "forecast": res}), 200


@demand_bp.route("/model-metadata", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def get_model_metadata():
    """Retrieve forecasting engine methodology and latest evaluation metadata."""
    res, err, status_code = DemandForecastService.get_model_metadata(
        db=mongo.db,
        actor_user=current_user,
    )
    if err:
        error_label = "Forbidden" if status_code == 403 else "Bad Request" if status_code == 400 else "Error"
        return jsonify({"error": error_label, "message": err, "status_code": status_code}), status_code

    return jsonify({"status_code": 200, **res}), 200
