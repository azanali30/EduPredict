"""
EduPredict - Administrative Routes
Protected endpoints for user management, role governance, assignments, and audit logs.
"""

from flask import Blueprint, request, jsonify
from flask_login import current_user
from backend.extensions import mongo
from backend.services.user_service import UserService
from backend.services.assignment_service import AssignmentService
from backend.utils.decorators import admin_required
from backend.utils.security import to_object_id

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_all_users():
    """List system users with optional role filtering."""
    role_filter = request.args.get("role")
    limit = min(int(request.args.get("limit", 50)), 100)
    skip = int(request.args.get("skip", 0))

    users = UserService.list_users(
        db=mongo.db,
        role=role_filter,
        limit=limit,
        skip=skip,
    )
    return jsonify({
        "users": users,
        "count": len(users),
        "status_code": 200,
    }), 200


@admin_bp.route("/users/<user_id>/role", methods=["PUT"])
@admin_required
def update_user_role(user_id):
    """
    Update a target user's role.
    Expects JSON: { "role": "teacher" | "student" | "admin" }
    """
    data = request.get_json()
    if not data or "role" not in data:
        return jsonify({
            "error": "Bad Request",
            "message": "A 'role' field is required.",
            "status_code": 400,
        }), 400

    new_role = data.get("role")
    updated_user, err = UserService.update_role(
        db=mongo.db,
        target_user_id=user_id,
        new_role=new_role,
        actor_admin_id=current_user.id,
    )

    if err or not updated_user:
        status_code = 404 if "not found" in (err or "").lower() else 400
        return jsonify({
            "error": "Role Update Failed",
            "message": err or "Failed to update role.",
            "status_code": status_code,
        }), status_code

    return jsonify({
        "message": f"User role updated to '{new_role}'.",
        "user": updated_user.to_dict(),
        "status_code": 200,
    }), 200


@admin_bp.route("/assignments", methods=["POST"])
@admin_required
def create_teacher_assignment():
    """
    Assign a student to a teacher.
    Expects JSON: { "teacher_id": "...", "student_id": "..." }
    """
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    teacher_id = data.get("teacher_id")
    student_id = data.get("student_id")

    if not teacher_id or not student_id:
        return jsonify({
            "error": "Bad Request",
            "message": "Both teacher_id and student_id are required.",
            "status_code": 400,
        }), 400

    assignment, err = AssignmentService.assign_teacher_to_student(
        db=mongo.db,
        teacher_id=teacher_id,
        student_id=student_id,
        admin_id=current_user.id,
    )

    if err or not assignment:
        return jsonify({
            "error": "Assignment Failed",
            "message": err or "Failed to create assignment.",
            "status_code": 400,
        }), 400

    return jsonify({
        "message": "Teacher successfully assigned to student.",
        "assignment": assignment,
        "status_code": 201,
    }), 201


@admin_bp.route("/logs", methods=["GET"])
@admin_required
def get_audit_logs():
    """Retrieve recent system audit logs."""
    limit = min(int(request.args.get("limit", 50)), 200)
    cursor = mongo.db.system_logs.find().sort("timestamp", -1).limit(limit)
    logs = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "user_id" in doc and doc["user_id"]:
            doc["user_id"] = str(doc["user_id"])
        if "actor_id" in doc and doc["actor_id"]:
            doc["actor_id"] = str(doc["actor_id"])
        if "timestamp" in doc and hasattr(doc["timestamp"], "isoformat"):
            doc["timestamp"] = doc["timestamp"].isoformat()
        logs.append(doc)

    return jsonify({
        "logs": logs,
        "count": len(logs),
        "status_code": 200,
    }), 200
