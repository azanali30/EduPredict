"""
EduPredict - Prediction Routes Blueprint
Module: backend.routes.prediction_routes
Exposes secure REST APIs for generating predictions, retrieving prediction history,
and inspecting prediction options.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.extensions import mongo
from backend.services.prediction_service import PredictionService
from backend.utils.security import to_object_id

prediction_bp = Blueprint("predictions", __name__, url_prefix="/api/predictions")


@prediction_bp.route("/options", methods=["GET"])
@login_required
def get_prediction_options():
    """
    Retrieve available prediction subjects, milestones, required feature schemas,
    and target definitions.
    """
    options = PredictionService.get_options_metadata()
    return jsonify({
        "options": options,
        "status_code": 200,
    }), 200


@prediction_bp.route("", methods=["POST"])
@login_required
def create_prediction():
    """
    Generate an academic performance and risk prediction for an authorized student.
    Enforces strict server-side RBAC, schema validation, and target leakage prevention.
    """
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request payload must be a valid JSON object.",
            "status_code": 400,
        }), 400

    subject = data.get("subject")
    milestone = data.get("milestone")
    features = data.get("features")
    academic_term = data.get("academic_term")

    if subject is None:
        return jsonify({
            "error": "Bad Request",
            "message": "'subject' is required (e.g., 'Mathematics' or 'Portuguese Language').",
            "status_code": 400,
        }), 400

    if milestone is None:
        return jsonify({
            "error": "Bad Request",
            "message": "'milestone' is required (0, 1, or 2).",
            "status_code": 400,
        }), 400

    if not features or not isinstance(features, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "'features' dictionary is required.",
            "status_code": 400,
        }), 400

    # Determine target student ID
    # If actor is student, default to self. If student specifies a student_id, it must match self.
    actor_role = getattr(current_user, "role", "")
    target_student_id = data.get("student_id")

    if actor_role == "student":
        if target_student_id and str(target_student_id) != str(current_user.id):
            return jsonify({
                "error": "Forbidden",
                "message": "Students are strictly prohibited from generating predictions for other students.",
                "status_code": 403,
            }), 403
        target_student_id = current_user.id
    else:
        if not target_student_id:
            return jsonify({
                "error": "Bad Request",
                "message": "'student_id' is required when generating predictions as teacher or admin.",
                "status_code": 400,
            }), 400

    prediction, err, status_code = PredictionService.create_prediction(
        db=mongo.db,
        student_id=target_student_id,
        actor_user=current_user,
        subject=subject,
        milestone=milestone,
        features=features,
        academic_term=academic_term,
    )

    if err or not prediction:
        return jsonify({
            "error": "Prediction Failed",
            "message": err or "Failed to generate prediction.",
            "status_code": status_code,
        }), status_code

    return jsonify({
        "message": "Prediction generated and recorded successfully.",
        "prediction": prediction.to_dict(),
        "status_code": 201,
    }), 201


@prediction_bp.route("", methods=["GET"])
@login_required
def list_predictions():
    """
    Retrieve prediction history with role-based access scoping:
    - Student: view only their own predictions.
    - Teacher: view predictions only for assigned students.
    - Admin: view all predictions.
    """
    student_id = request.args.get("student_id")
    subject = request.args.get("subject")
    milestone_arg = request.args.get("milestone")

    try:
        limit = int(request.args.get("limit", 50))
    except ValueError:
        limit = 50

    try:
        skip = int(request.args.get("skip", 0))
    except ValueError:
        skip = 0

    milestone = None
    if milestone_arg is not None:
        try:
            milestone = int(milestone_arg)
        except ValueError:
            return jsonify({
                "error": "Bad Request",
                "message": "Invalid 'milestone' query parameter.",
                "status_code": 400,
            }), 400

    records, total_count, err, status_code = PredictionService.list_predictions(
        db=mongo.db,
        actor_user=current_user,
        student_id=student_id,
        subject=subject,
        milestone=milestone,
        limit=limit,
        skip=skip,
    )

    if err:
        return jsonify({
            "error": "Access Denied",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "predictions": records,
        "total_count": total_count,
        "limit": limit,
        "skip": skip,
        "status_code": 200,
    }), 200


@prediction_bp.route("/<prediction_id>", methods=["GET"])
@login_required
def get_prediction_detail(prediction_id):
    """
    Retrieve details of a single prediction document.
    Enforces authorization to ensure the caller has access to the target student's records.
    """
    prediction, err, status_code = PredictionService.get_prediction_by_id(
        db=mongo.db,
        prediction_id=prediction_id,
        actor_user=current_user,
    )

    if err or not prediction:
        return jsonify({
            "error": "Retrieval Failed",
            "message": err or "Prediction record not found.",
            "status_code": status_code,
        }), status_code

    return jsonify({
        "prediction": prediction.to_dict(),
        "status_code": 200,
    }), 200
