"""
EduPredict - User & Profile Routes
Endpoints for profile inspection, password modification, and role-authorized student access.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.extensions import mongo
from backend.services.user_service import UserService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService
from backend.utils.decorators import role_required, can_access_student_data
from backend.utils.security import to_object_id

user_bp = Blueprint("users", __name__)


@user_bp.route("/api/me", methods=["GET"])
@login_required
def get_current_user_profile():
    """Retrieve profile of the currently authenticated user."""
    return jsonify({
        "user": current_user.to_dict(),
        "status_code": 200,
    }), 200


@user_bp.route("/api/me", methods=["PUT", "PATCH"])
@login_required
def update_current_user_profile():
    """
    Update personal profile attributes.
    Supports both PUT and PATCH.
    Non-admin users can update allowed personal/contact/guardian/professional fields.
    Rejects forbidden/privileged institutional fields with 403 Forbidden.
    """
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be a valid JSON object.",
            "status_code": 400,
        }), 400

    # Backward compatibility: legacy call sending only full_name
    if len(data) == 1 and "full_name" in data:
        full_name = data.get("full_name")
        if not full_name or not isinstance(full_name, str) or not full_name.strip():
            return jsonify({
                "error": "Bad Request",
                "message": "full_name is required.",
                "status_code": 400,
            }), 400
        updated_user, err = UserService.update_profile(
            db=mongo.db,
            user_id=current_user.id,
            full_name=full_name,
        )
        if err or not updated_user:
            return jsonify({
                "error": "Update Failed",
                "message": err or "Failed to update profile.",
                "status_code": 400,
            }), 400
        return jsonify({
            "message": "Profile updated successfully.",
            "user": updated_user.to_dict(),
            "status_code": 200,
        }), 200

    # Comprehensive self-service profile update
    updated_user, err, status_code = UserService.update_self_service_profile(
        db=mongo.db,
        user_id=current_user.id,
        update_data=data,
        role=current_user.role,
    )

    if err or not updated_user:
        error_title = "Forbidden Field" if status_code == 403 else "Validation Error"
        return jsonify({
            "error": error_title,
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "message": "Profile updated successfully.",
        "user": updated_user.to_dict(),
        "status_code": 200,
    }), 200


@user_bp.route("/api/me/password", methods=["PUT"])
@login_required
def change_password():
    """
    Change password for the authenticated user.
    Requires current_password verification and new_password complexity check.
    """
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    current_pwd = data.get("current_password")
    new_pwd = data.get("new_password")

    if not current_pwd or not new_pwd:
        return jsonify({
            "error": "Bad Request",
            "message": "Both current_password and new_password are required.",
            "status_code": 400,
        }), 400

    success, msg = UserService.change_password(
        db=mongo.db,
        user_id=current_user.id,
        current_password=current_pwd,
        new_password=new_pwd,
    )

    if not success:
        return jsonify({
            "error": "Password Change Failed",
            "message": msg,
            "status_code": 400,
        }), 400

    return jsonify({
        "message": msg,
        "status_code": 200,
    }), 200


@user_bp.route("/api/students/<student_id>", methods=["GET"])
@login_required
def get_student_details(student_id):
    """
    Retrieve profile details for a specified student.
    Authorization Enforcement:
    - Student: can ONLY view their own profile.
    - Teacher: can ONLY view students assigned to them.
    - Admin: can view any student profile.
    Prevents Insecure Direct Object References (IDOR).
    """
    oid = to_object_id(student_id)
    if not oid:
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid student ID format.",
            "status_code": 400,
        }), 400

    student = UserService.get_by_id(mongo.db, oid)
    if not student or student.role != "student":
        return jsonify({
            "error": "Not Found",
            "message": "Student record not found.",
            "status_code": 404,
        }), 404

    # Enforce authorization
    if not can_access_student_data(current_user, oid, mongo.db):
        return jsonify({
            "error": "Forbidden",
            "message": "You are not authorized to view this student's records.",
            "status_code": 403,
        }), 403

    return jsonify({
        "student": student.to_dict(),
        "status_code": 200,
    }), 200


@user_bp.route("/api/teacher/subjects", methods=["GET"])
@role_required("teacher")
def get_teacher_subjects():
    """Retrieve list of subjects actively assigned to the authenticated teacher."""
    subjects = AssignmentService.get_subjects_for_teacher(mongo.db, current_user.id)
    return jsonify({
        "subjects": subjects,
        "count": len(subjects),
        "status_code": 200,
    }), 200


@user_bp.route("/api/student/subjects", methods=["GET"])
@role_required("student")
def get_student_subjects():
    """Retrieve list of subjects actively enrolled by the authenticated student."""
    subjects = EnrollmentService.get_student_enrolled_subjects(mongo.db, current_user.id)
    return jsonify({
        "subjects": subjects,
        "count": len(subjects),
        "status_code": 200,
    }), 200


@user_bp.route("/api/teacher/students", methods=["GET"])
@role_required("teacher")
def get_assigned_students():
    """
    Retrieve list of students assigned to the authenticated teacher.
    Strictly requires active subject-based teacher assignment and student enrollment.
    Legacy student-level assignments never grant roster access.
    """
    subject_id = request.args.get("subject_id")
    academic_term = request.args.get("academic_term")

    # Check if teacher has any active subject assignments
    has_subject_assignments = mongo.db.teacher_subject_assignments.count_documents({
        "teacher_id": current_user.id,
        "status": "active",
    }) > 0

    if not has_subject_assignments:
        return jsonify({
            "students": [],
            "count": 0,
            "message": "No active subject assignments. Please contact an administrator to configure subject assignments.",
            "status_code": 200,
        }), 200

    students = AssignmentService.get_students_for_teacher_by_subject(
        mongo.db,
        current_user.id,
        subject_id=subject_id,
        academic_term=academic_term,
    )

    return jsonify({
        "students": students,
        "count": len(students),
        "status_code": 200,
    }), 200
