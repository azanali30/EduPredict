"""
EduPredict - Educational Analyst Routes Blueprint
Module: backend.routes.analyst_routes
Exposes secure REST APIs for institutional aggregate reporting, curriculum telemetry,
and analytical metrics. Enforces strict least-privilege role boundaries and
Statistical Disclosure Control (SDC) / minimum cell suppression safeguards.
"""

from typing import Dict, Any
from flask import Blueprint, jsonify
from flask_login import current_user
from backend.extensions import mongo
from backend.utils.decorators import role_required, analyst_required

analyst_bp = Blueprint("analyst", __name__, url_prefix="/api/analyst")

CELL_SUPPRESSION_THRESHOLD = 5


def apply_cell_suppression(count: int, threshold: int = CELL_SUPPRESSION_THRESHOLD) -> Dict[str, Any]:
    """
    Applies minimum cell suppression (k-anonymity threshold) to protect small cohorts.

    Rules:
    - count == 0: Exactly 0, display "0", suppressed False.
      (Zero indicates absence of cohort/records and does not single out individuals).
    - 1 <= count < threshold (default 5): Suppressed. Returns value None, display "<5", suppressed True.
      (Prevents re-identification of individuals in small cohorts).
    - count >= threshold: Returns exact count, string display, suppressed False.
    """
    if count == 0:
        return {
            "value": 0,
            "display": "0",
            "suppressed": False,
        }
    if 1 <= count < threshold:
        return {
            "value": None,
            "display": f"<{threshold}",
            "suppressed": True,
        }
    return {
        "value": count,
        "display": str(count),
        "suppressed": False,
    }


@analyst_bp.route("/overview", methods=["GET"])
@role_required("analyst", "admin")
def get_analyst_overview():
    """
    Retrieve institutional aggregate telemetry with small-cohort suppression.
    Permitted for Analyst and Admin roles.
    Returns zero student PII (purely aggregated metrics).
    Enforces minimum cell suppression and complementary suppression against
    single-cell subtraction disclosure.
    """
    db = mongo.db
    if db is None:
        return jsonify({
            "error": "Database Unavailable",
            "message": "Database service is offline.",
            "status_code": 503,
        }), 503

    total_students = db.users.count_documents({"role": "student"})
    total_teachers = db.users.count_documents({"role": "teacher"})
    total_subjects = db.subjects.count_documents({"is_active": True})
    total_predictions = db.predictions.count_documents({})
    total_enrollments = db.student_subject_enrollments.count_documents({"status": "active"})

    # Check for complementary suppression risk from curriculum subjects
    active_subjects = list(db.subjects.find({"is_active": True}))
    suppressed_subject_enrollments = 0
    for s in active_subjects:
        s_enrolled = db.student_subject_enrollments.count_documents({
            "subject_id": s["_id"],
            "status": "active",
        })
        if 1 <= s_enrolled < CELL_SUPPRESSION_THRESHOLD:
            suppressed_subject_enrollments += 1

    # Apply cell suppression to institutional metrics
    students_metric = apply_cell_suppression(total_students)
    teachers_metric = apply_cell_suppression(total_teachers)
    predictions_metric = apply_cell_suppression(total_predictions)

    # If exactly 1 subject is suppressed in curriculum-stats, releasing exact total_enrollments
    # allows an observer to compute the suppressed cell via: Total - Sum(unsuppressed) = Suppressed.
    # Complementary suppression is applied to the marginal total to close this vulnerability.
    if total_enrollments < CELL_SUPPRESSION_THRESHOLD:
        enrollments_metric = apply_cell_suppression(total_enrollments)
    elif suppressed_subject_enrollments == 1:
        enrollments_metric = {
            "value": None,
            "display": "Suppressed (Complementary)",
            "suppressed": True,
            "suppression_reason": "Complementary suppression applied to prevent single-cell residual subtraction disclosure.",
        }
    else:
        enrollments_metric = apply_cell_suppression(total_enrollments)

    return jsonify({
        "status": "operational",
        "scope": "institutional_aggregate",
        "privacy_policy": {
            "cell_suppression_threshold": CELL_SUPPRESSION_THRESHOLD,
            "rule": "Counts 1-4 are suppressed to protect small cohorts; 0 is unsuppressed.",
        },
        "metrics": {
            "total_students": students_metric["value"],
            "total_students_display": students_metric["display"],
            "total_students_suppressed": students_metric["suppressed"],
            "total_teachers": teachers_metric["value"],
            "total_teachers_display": teachers_metric["display"],
            "total_teachers_suppressed": teachers_metric["suppressed"],
            "total_active_subjects": total_subjects,
            "total_predictions": predictions_metric["value"],
            "total_predictions_display": predictions_metric["display"],
            "total_predictions_suppressed": predictions_metric["suppressed"],
            "total_active_enrollments": enrollments_metric["value"],
            "total_active_enrollments_display": enrollments_metric["display"],
            "total_active_enrollments_suppressed": enrollments_metric["suppressed"],
        },
        "status_code": 200,
    }), 200


@analyst_bp.route("/curriculum-stats", methods=["GET"])
@role_required("analyst", "admin")
def get_curriculum_stats():
    """
    Retrieve subject-level enrollment and assignment aggregates.
    Permitted for Analyst and Admin roles.
    Enforces minimum cell suppression (N < 5) on student enrollments and teacher counts
    to prevent small-cohort re-identification.
    """
    db = mongo.db
    if db is None:
        return jsonify({
            "error": "Database Unavailable",
            "message": "Database service is offline.",
            "status_code": 503,
        }), 503

    subjects = list(db.subjects.find({"is_active": True}))
    stats = []
    for s in subjects:
        s_id = s["_id"]
        enrolled_count = db.student_subject_enrollments.count_documents({
            "subject_id": s_id,
            "status": "active",
        })
        teacher_count = db.teacher_subject_assignments.count_documents({
            "subject_id": s_id,
            "status": "active",
        })

        enrollment_metric = apply_cell_suppression(enrolled_count)
        teacher_metric = apply_cell_suppression(teacher_count)

        stats.append({
            "subject_id": str(s_id),
            "code": s.get("code"),
            "name": s.get("name"),
            "department": s.get("department", "General"),
            "active_enrollments": enrollment_metric["value"],
            "active_enrollments_display": enrollment_metric["display"],
            "active_enrollments_suppressed": enrollment_metric["suppressed"],
            "assigned_teachers": teacher_metric["value"],
            "assigned_teachers_display": teacher_metric["display"],
            "assigned_teachers_suppressed": teacher_metric["suppressed"],
        })

    return jsonify({
        "subjects": stats,
        "count": len(stats),
        "privacy_policy": {
            "cell_suppression_threshold": CELL_SUPPRESSION_THRESHOLD,
            "rule": "Counts 1-4 are suppressed to protect small cohorts; 0 is unsuppressed.",
        },
        "status_code": 200,
    }), 200


@analyst_bp.route("/diagnostics", methods=["GET"])
@analyst_required
def get_analyst_diagnostics():
    """
    Analyst-only diagnostic endpoint.
    Strictly restricted to users with the 'analyst' role.
    Rejects administrators, teachers, and students with 403 Forbidden.
    """
    return jsonify({
        "status": "active",
        "role": current_user.role,
        "message": "Analyst-specific diagnostic channel active.",
        "status_code": 200,
    }), 200


@analyst_bp.route("/anomalies/stats", methods=["GET"])
@role_required("analyst", "admin")
def get_analyst_anomaly_stats():
    """
    Retrieve aggregate anomaly detection statistics with N < 5 cell suppression.
    Provides subject-level trends and severity distributions without disclosing student identities.
    """
    from backend.services.anomaly_service import AnomalyService
    db = mongo.db
    if db is None:
        return jsonify({
            "error": "Database Unavailable",
            "message": "Database service is offline.",
            "status_code": 503,
        }), 503

    stats = AnomalyService.get_analyst_aggregate_stats(db)
    return jsonify({
        "status_code": 200,
        **stats,
    }), 200


@analyst_bp.route("/trends", methods=["GET"])
@analyst_required
def get_analyst_trends():
    """
    Retrieve real multi-term institutional trend aggregates strictly enforcing
    N < 5 Statistical Disclosure Control (SDC) and complementary suppression.
    """
    from backend.services.analyst_trends_service import get_analyst_trends_data

    db = mongo.db
    if db is None:
        return jsonify({
            "error": "Database Unavailable",
            "message": "Database service is offline.",
            "status_code": 503,
        }), 503

    payload = get_analyst_trends_data(db)
    return jsonify({
        "status_code": 200,
        **payload,
    }), 200

