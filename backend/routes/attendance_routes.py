"""
EduPredict - Attendance Register REST Routes (Workstream A / Phase 13)
Module: backend.routes.attendance_routes
Purpose: Exposes CSRF-protected, RBAC-enforced endpoints for teacher roll-call session
management, student attendance histories, and institutional attendance summaries.
"""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.services.attendance_service import AttendanceService
from backend.utils.decorators import role_required

attendance_bp = Blueprint("attendance", __name__, url_prefix="/api/attendance")


@attendance_bp.route("/sessions", methods=["POST"])
@login_required
@role_required("teacher")
def create_attendance_session():
    """Teacher creates a new attendance roll-call session for an assigned subject and term."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    res, err, status = AttendanceService.create_session(mongo.db, actor_user=current_user, data=data)
    if err or res is None:
        return jsonify({"error": "Attendance Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 201, **res}), 201


@attendance_bp.route("/sessions", methods=["GET"])
@login_required
@role_required("admin", "teacher")
def list_attendance_sessions():
    """List attendance sessions scoped to teacher's assigned subjects or full institution for admin."""
    res, err, status = AttendanceService.list_sessions(
        mongo.db,
        actor_user=current_user,
        subject_id=request.args.get("subject_id"),
        academic_term=request.args.get("academic_term"),
        date_from=request.args.get("date_from"),
        date_to=request.args.get("date_to"),
        page=request.args.get("page", 1),
        limit=request.args.get("limit", 25),
    )
    if err or res is None:
        return jsonify({"error": "Attendance Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@attendance_bp.route("/sessions/<session_id>", methods=["GET"])
@login_required
@role_required("admin", "teacher")
def get_attendance_session_detail(session_id: str):
    """Retrieve one session along with its marked records and enrolled student roster."""
    res, err, status = AttendanceService.get_session_detail(
        mongo.db, session_id=session_id, actor_user=current_user
    )
    if err or res is None:
        return jsonify({"error": "Attendance Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@attendance_bp.route("/sessions/<session_id>/records", methods=["PUT", "POST"])
@login_required
@role_required("teacher")
def save_session_attendance_records(session_id: str):
    """Create or update roll-call marks for enrolled students in a permitted session."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    res, err, status = AttendanceService.mark_session_records(
        mongo.db, session_id=session_id, actor_user=current_user, data=data
    )
    if err or res is None:
        return jsonify({"error": "Attendance Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@attendance_bp.route("/student/my", methods=["GET"])
@login_required
@role_required("student")
def get_my_attendance():
    """Return authenticated student's verified institutional attendance summary and history."""
    res, err, status = AttendanceService.get_student_attendance_view(
        mongo.db,
        actor_user=current_user,
        subject_id=request.args.get("subject_id"),
        academic_term=request.args.get("academic_term"),
        page=request.args.get("page", 1),
        limit=request.args.get("limit", 50),
    )
    if err or res is None:
        return jsonify({"error": "Attendance Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@attendance_bp.route("/summary", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def get_attendance_summary():
    """Return institutional/subject/student roll-call summary within caller's authorization scope."""
    res, err, status = AttendanceService.get_summary(
        mongo.db,
        actor_user=current_user,
        student_id=request.args.get("student_id"),
        subject_id=request.args.get("subject_id"),
        academic_term=request.args.get("academic_term"),
    )
    if err or res is None:
        return jsonify({"error": "Attendance Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200
