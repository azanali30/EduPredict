"""
EduPredict - Model Evaluation & Registry Routes (Phase 8C / 8D)
Module: backend.routes.evaluation_routes
Purpose: Exposes REST APIs for dropout & demand model evaluation reports,
ROC/PR/calibration curves, versioned Model Registry listing, and Admin activation controls.
"""

import logging
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.extensions import mongo
from backend.services.model_evaluation_service import ModelEvaluationService
from backend.utils.decorators import role_required, admin_required

logger = logging.getLogger(__name__)

evaluation_bp = Blueprint("evaluation", __name__, url_prefix="/api/models")


@evaluation_bp.route("/evaluation/dropout", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def get_dropout_evaluation():
    """Retrieve dropout classification model comparison, curves, and calibration metrics."""
    res, err, status = ModelEvaluationService.get_dropout_evaluation_report()
    if err:
        return jsonify({"error": "Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@evaluation_bp.route("/evaluation/demand", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def get_demand_evaluation():
    """Retrieve organization-scoped course demand forecasting model evaluation metrics."""
    res, err, status = ModelEvaluationService.get_demand_evaluation_report(
        db=mongo.db,
        actor_user=current_user,
    )
    if err:
        error_label = "Forbidden" if status == 403 else "Error"
        return jsonify({"error": error_label, "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@evaluation_bp.route("/registry", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def list_registry():
    """List versioned models in the Model Registry visible to the actor's organization."""
    model_type = request.args.get("model_type")
    res, err, status = ModelEvaluationService.list_registry_models(
        db=mongo.db,
        actor_user=current_user,
        model_type=model_type,
    )
    if err:
        error_label = "Forbidden" if status == 403 else "Error"
        return jsonify({"error": error_label, "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@evaluation_bp.route("/registry/<registry_id>/activate", methods=["POST"])
@login_required
@admin_required
def activate_registry_model(registry_id: str):
    """Activate a model version following evaluation & explicit approval notes. Admin only."""
    data = request.get_json(silent=True) or {}
    approval_notes = data.get("approval_notes") if isinstance(data, dict) else None
    res, err, status = ModelEvaluationService.activate_model(
        db=mongo.db,
        admin_user=current_user,
        registry_id=registry_id,
        approval_notes=approval_notes,
    )
    if err:
        error_label = (
            "Forbidden" if status == 403
            else "Bad Request" if status == 400
            else "Not Found" if status == 404
            else "Unprocessable Entity" if status == 422
            else "Error"
        )
        return jsonify({"error": error_label, "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@evaluation_bp.route("/registry/<registry_id>/deactivate", methods=["POST"])
@login_required
@admin_required
def deactivate_registry_model(registry_id: str):
    """Deactivate a registered model version. Admin only."""
    res, err, status = ModelEvaluationService.deactivate_model(
        db=mongo.db,
        admin_user=current_user,
        registry_id=registry_id,
    )
    if err:
        error_label = (
            "Forbidden" if status == 403
            else "Bad Request" if status == 400
            else "Not Found" if status == 404
            else "Error"
        )
        return jsonify({"error": error_label, "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200
