"""
EduPredict - Institutional Academic Records REST Routes (Workstream A / Phase 13)
Module: backend.routes.academic_record_routes
Purpose: Exposes CSRF-protected, RBAC-enforced endpoints for academic coursework
record creation, updating, listing, and validated CSV bulk ingestion.
"""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.services.academic_record_service import AcademicRecordService
from backend.utils.decorators import role_required

academic_records_bp = Blueprint("academic_records", __name__, url_prefix="/api/academic-records")


@academic_records_bp.route("", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def list_academic_records():
    """List persisted coursework records scoped to caller's role and authorization."""
    res, err, status = AcademicRecordService.list_records(
        mongo.db,
        actor_user=current_user,
        student_id=request.args.get("student_id"),
        subject=request.args.get("subject"),
        subject_id=request.args.get("subject_id"),
        term=request.args.get("term"),
        page=request.args.get("page", 1),
        limit=request.args.get("limit", 50),
    )
    if err or res is None:
        return jsonify({"error": "Academic Records Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@academic_records_bp.route("/<record_id>", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def get_academic_record(record_id: str):
    """Retrieve a single academic record enforcing self/subject-enrollment RBAC."""
    res, err, status = AcademicRecordService.get_record_by_id(
        mongo.db, record_id=record_id, actor_user=current_user
    )
    if err or res is None:
        return jsonify({"error": "Academic Records Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@academic_records_bp.route("", methods=["POST"])
@login_required
@role_required("admin", "teacher")
def create_academic_record():
    """Create a validated academic coursework record (teacher subject-scoped or admin)."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    res, err, status = AcademicRecordService.create_record(mongo.db, actor_user=current_user, data=data)
    if err or res is None:
        return jsonify({"error": "Academic Records Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 201, **res}), 201


@academic_records_bp.route("/<record_id>", methods=["PUT", "PATCH"])
@login_required
@role_required("admin", "teacher")
def update_academic_record(record_id: str):
    """Update numeric scores/metrics of an existing academic record within caller's authorization."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    res, err, status = AcademicRecordService.update_record(
        mongo.db, record_id=record_id, actor_user=current_user, data=data
    )
    if err or res is None:
        return jsonify({"error": "Academic Records Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@academic_records_bp.route("/import-csv", methods=["POST"])
@login_required
@role_required("admin", "teacher")
def import_academic_records_csv():
    """Bulk import academic records from multipart CSV file or JSON csv_content payload."""
    default_subject_id = None
    default_term = None
    csv_bytes = b""

    if "file" in request.files:
        upload = request.files["file"]
        filename = (upload.filename or "").lower()
        if filename and not filename.endswith(".csv"):
            return jsonify({
                "error": "Bad Request",
                "message": "Uploaded file must have a .csv extension.",
                "status_code": 400,
            }), 400
        csv_bytes = upload.read()
        default_subject_id = request.form.get("subject_id") or None
        default_term = request.form.get("term") or request.form.get("academic_term") or None
    else:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict) or not isinstance(data.get("csv_content"), str):
            return jsonify({
                "error": "Bad Request",
                "message": "Provide a multipart 'file' (.csv) or JSON 'csv_content' string.",
                "status_code": 400,
            }), 400
        csv_bytes = data["csv_content"].encode("utf-8")
        default_subject_id = data.get("subject_id")
        default_term = data.get("term") or data.get("academic_term")

    res, err, status = AcademicRecordService.import_csv(
        mongo.db,
        actor_user=current_user,
        csv_bytes=csv_bytes,
        default_subject_id=default_subject_id,
        default_term=default_term,
    )
    if err or res is None:
        return jsonify({"error": "CSV Import Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200
