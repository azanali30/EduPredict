"""
Phase 7D — Academic Attrition Vulnerability Indicator API.
Returns cohort aggregates only; no pseudonymous source IDs or learner-level rows.
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from backend.extensions import mongo
from backend.services.attrition_service import AttritionAdvisoryService
from backend.services.assignment_service import AssignmentService
from backend.utils.decorators import role_required

attrition_bp = Blueprint("attrition", __name__, url_prefix="/api/attrition")


@attrition_bp.route("/advisory-summary", methods=["GET"])
@login_required
@role_required("admin", "teacher", "analyst")
def advisory_summary():
    raw_threshold = request.args.get("absence_threshold", "15")
    try:
        threshold = int(raw_threshold)
    except (TypeError, ValueError):
        return jsonify({
            "error": "Bad Request",
            "message": "absence_threshold must be an integer between 1 and 93.",
            "status_code": 400,
        }), 400

    if not 1 <= threshold <= 93:
        return jsonify({
            "error": "Bad Request",
            "message": "absence_threshold must be between 1 and 93.",
            "status_code": 400,
        }), 400

    allowed_subjects = None
    if current_user.role == "teacher":
        subjects = AssignmentService.get_subjects_for_teacher(mongo.db, current_user.id)
        allowed_subjects = [item.get("name") for item in subjects if item.get("name")]
        if not allowed_subjects:
            result = AttritionAdvisoryService.get_cohort_summary(
                mongo.db, allowed_subjects=[], high_absence_threshold=threshold,
                suppress_small_cells=True,
            )
            return jsonify({"status_code": 200, **result}), 200

    suppress = current_user.role in ("teacher", "analyst")
    try:
        result = AttritionAdvisoryService.get_cohort_summary(
            mongo.db,
            allowed_subjects=allowed_subjects,
            high_absence_threshold=threshold,
            suppress_small_cells=suppress,
        )
    except ValueError as exc:
        return jsonify({"error": "Invalid Request", "message": str(exc), "status_code": 400}), 400
    except Exception:
        return jsonify({
            "error": "Service Unavailable",
            "message": "Academic advisory data is currently unavailable.",
            "status_code": 503,
        }), 503

    return jsonify({"status_code": 200, **result}), 200
