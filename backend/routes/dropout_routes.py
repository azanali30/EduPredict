"""
EduPredict - Student Dropout Prediction Routes (Phase 8A)
Module: backend.routes.dropout_routes
Purpose: Exposes secure REST APIs for dropout prediction, roster monitoring,
and role-based analytics under strict server-side RBAC.
"""

import logging
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.extensions import mongo
from backend.services.dropout_service import DropoutService, load_cached_dropout_metadata
from backend.utils.decorators import role_required, admin_required, teacher_required

logger = logging.getLogger(__name__)

dropout_bp = Blueprint("dropout", __name__, url_prefix="/api/dropout")


@dropout_bp.route("/predict", methods=["POST"])
@login_required
@role_required("admin", "teacher")
def predict_and_record():
    """
    Generate and persist a dropout risk assessment for an authorized student.
    Admin: Any student.
    Teacher: Strictly scoped to students enrolled in teacher's assigned subjects.
    Student/Analyst: 403 Forbidden.
    """
    data = request.get_json()
    if data is None or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Payload must be a valid JSON object.",
            "status_code": 400,
        }), 400

    student_id = data.get("student_id")
    if not student_id:
        return jsonify({
            "error": "Bad Request",
            "message": "'student_id' is required.",
            "status_code": 400,
        }), 400

    features = data.get("features", {})
    academic_term = data.get("academic_term")
    student_name = data.get("student_name")

    res, err, status_code = DropoutService.record_student_assessment(
        db=mongo.db,
        student_id=student_id,
        features_input=features,
        actor_user=current_user,
        academic_term=academic_term,
        student_name=student_name,
    )

    if err:
        return jsonify({
            "error": "Forbidden" if status_code == 403 else "Error",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "status_code": status_code,
        "assessment": res,
    }), status_code


@dropout_bp.route("/student/<student_id>", methods=["GET"])
@login_required
def get_student_assessment(student_id: str):
    """
    Retrieve dropout assessment for a specific student.
    Student: Can only access self.
    Teacher: Can access assigned students only.
    Admin: Can access any student.
    Analyst: 403 Forbidden.
    """
    # Reject Analyst from viewing individual student records
    if getattr(current_user, "role", "") == "analyst":
        return jsonify({
            "error": "Forbidden",
            "message": "Analyst role is restricted from accessing individual student PII.",
            "status_code": 403,
        }), 403

    res, err, status_code = DropoutService.get_student_assessment(
        db=mongo.db,
        actor_user=current_user,
        student_id=student_id,
    )

    if err:
        return jsonify({
            "error": "Forbidden" if status_code == 403 else "Error",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "status_code": 200,
        "assessment": res,
    }), 200


@dropout_bp.route("/teacher/roster", methods=["GET"])
@login_required
@role_required("teacher", "admin")
def get_teacher_roster():
    """
    Retrieve dropout risk assessments for all students enrolled in teacher's assigned subjects.
    """
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))
    except ValueError:
        return jsonify({
            "error": "Bad Request",
            "message": "page and limit must be valid integers.",
            "status_code": 400,
        }), 400

    res, err, status_code = DropoutService.get_teacher_roster_dropout(
        db=mongo.db,
        teacher_user=current_user,
        page=page,
        limit=limit,
    )

    if err:
        return jsonify({
            "error": "Error",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "status_code": 200,
        **res,
    }), 200


@dropout_bp.route("/admin/overview", methods=["GET"])
@login_required
@admin_required
def get_admin_overview():
    """
    Retrieve institution-wide dropout overview, distributions, and model performance.
    """
    res, err, status_code = DropoutService.get_admin_overview(
        db=mongo.db,
        admin_user=current_user,
    )

    if err:
        return jsonify({
            "error": "Error",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "status_code": 200,
        **res,
    }), 200


@dropout_bp.route("/analyst/overview", methods=["GET"])
@login_required
@role_required("analyst", "admin")
def get_analyst_overview():
    """
    Retrieve privacy-preserving aggregate dropout insights with N<5 cell suppression.
    """
    res, err, status_code = DropoutService.get_analyst_overview(
        db=mongo.db,
        analyst_user=current_user,
        threshold=5,
    )

    if err:
        return jsonify({
            "error": "Error",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "status_code": 200,
        **res,
    }), 200


@dropout_bp.route("/model-metadata", methods=["GET"])
@login_required
@admin_required
def get_model_metadata():
    """
    Retrieve model version, evaluation metrics, and feature lists.
    Admin only.
    """
    meta = load_cached_dropout_metadata()
    if not meta:
        return jsonify({
            "error": "Not Found",
            "message": "Dropout model metadata is unavailable.",
            "status_code": 404,
        }), 404

    return jsonify({
        "status_code": 200,
        "metadata": meta,
    }), 200
