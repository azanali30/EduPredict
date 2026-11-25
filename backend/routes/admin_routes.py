"""
EduPredict - Administrative Routes
Protected endpoints for user management, role governance, assignments, and audit logs.
"""

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_login import current_user
from bson import ObjectId
from backend.extensions import mongo
from backend.services.user_service import UserService
from backend.services.assignment_service import AssignmentService
from backend.services.subject_service import SubjectService
from backend.services.enrollment_service import EnrollmentService
from backend.models.subject_model import Subject
from backend.models.teacher_subject_assignment_model import TeacherSubjectAssignment
from backend.models.student_subject_enrollment_model import StudentSubjectEnrollment
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
        organization_id=getattr(current_user, "organization_id", None),
    )
    return jsonify({
        "users": users,
        "count": len(users),
        "status_code": 200,
    }), 200


@admin_bp.route("/users", methods=["POST"])
@admin_required
def create_user():
    """
    Create a student or teacher user account with comprehensive profile data.
    """
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    role = data.get("role", "").strip().lower()
    is_active = data.get("is_active", True)
    student_id = data.get("student_id", "").strip() or None
    employee_id = data.get("employee_id", "").strip() or None
    department = data.get("department", "").strip() or None
    contact_number = data.get("contact_number", "").strip() or None
    avatar_url = data.get("avatar_url", "").strip() or None
    must_change_password = bool(data.get("must_change_password", False))

    personal_info = data.get("personal_info") or {}
    contact_info = data.get("contact_info") or {}
    guardian_info = data.get("guardian_info") or {}
    academic_info = data.get("academic_info") or {}
    professional_info = data.get("professional_info") or {}
    employment_info = data.get("employment_info") or {}
    documents = data.get("documents") or []

    if not full_name:
        return jsonify({
            "error": "Bad Request",
            "message": "Full name is required.",
            "status_code": 400,
        }), 400

    if not email:
        return jsonify({
            "error": "Bad Request",
            "message": "Email address is required.",
            "status_code": 400,
        }), 400

    if not password:
        return jsonify({
            "error": "Bad Request",
            "message": "Initial password is required.",
            "status_code": 400,
        }), 400

    if role not in ("student", "teacher"):
        return jsonify({
            "error": "Bad Request",
            "message": "Administrator account creation only permits 'student' or 'teacher' roles.",
            "status_code": 400,
        }), 400

    if role == "student" and not student_id:
        return jsonify({
            "error": "Bad Request",
            "message": "Student ID / Admission ID is required for student accounts.",
            "status_code": 400,
        }), 400

    if role == "teacher" and not employee_id:
        return jsonify({
            "error": "Bad Request",
            "message": "Teacher / Employee ID is required for teacher accounts.",
            "status_code": 400,
        }), 400

    user, err = UserService.create_user(
        db=mongo.db,
        email=email,
        plain_password=password,
        full_name=full_name,
        role=role,
        is_active=bool(is_active),
        student_id=student_id,
        employee_id=employee_id,
        contact_number=contact_number,
        department=department,
        avatar_url=avatar_url,
        must_change_password=must_change_password,
        personal_info=personal_info,
        contact_info=contact_info,
        guardian_info=guardian_info,
        academic_info=academic_info,
        professional_info=professional_info,
        employment_info=employment_info,
        documents=documents,
    )

    if err or not user:
        return jsonify({
            "error": "User Creation Failed",
            "message": err or "Failed to create user account.",
            "status_code": 400,
        }), 400

    return jsonify({
        "message": f"{role.capitalize()} account created successfully.",
        "user": user.to_dict(),
        "status_code": 201,
    }), 201


@admin_bp.route("/users/<user_id>", methods=["GET"])
@admin_required
def get_user_details(user_id):
    """
    Retrieve complete profile details for a user.
    """
    oid = to_object_id(user_id)
    if not oid:
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid user ID format.",
            "status_code": 400,
        }), 400

    user = UserService.get_by_id(mongo.db, oid)
    if not user:
        return jsonify({
            "error": "Not Found",
            "message": "User not found.",
            "status_code": 404,
        }), 404

    return jsonify({
        "user": user.to_dict(),
        "status_code": 200,
    }), 200


@admin_bp.route("/users/<user_id>", methods=["PUT"])
@admin_required
def update_user_profile(user_id):
    """
    Update a student or teacher's profile attributes as an administrator.
    """
    oid = to_object_id(user_id)
    if not oid:
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid user ID format.",
            "status_code": 400,
        }), 400

    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    updated_user, err = UserService.update_user_by_admin(
        db=mongo.db,
        target_user_id=oid,
        update_data=data,
        actor_admin_id=current_user.id,
        organization_id=getattr(current_user, "organization_id", None),
    )

    if err or not updated_user:
        err_l = (err or "").lower()
        status_code = 403 if "access denied" in err_l else 404 if "not found" in err_l else 400
        return jsonify({
            "error": "Update Failed",
            "message": err or "Failed to update user profile.",
            "status_code": status_code,
        }), status_code

    return jsonify({
        "message": "User profile successfully updated.",
        "user": updated_user.to_dict(),
        "status_code": 200,
    }), 200


@admin_bp.route("/users/<user_id>/status", methods=["PUT"])
@admin_required
def update_user_status(user_id):
    """
    Toggle a user's active status.
    Expects JSON: { "is_active": true | false }
    """
    data = request.get_json()
    if not data or "is_active" not in data:
        return jsonify({
            "error": "Bad Request",
            "message": "An 'is_active' boolean field is required.",
            "status_code": 400,
        }), 400

    is_active = bool(data.get("is_active"))
    updated_user, err = UserService.update_status(
        db=mongo.db,
        target_user_id=user_id,
        is_active=is_active,
        actor_admin_id=current_user.id,
        organization_id=getattr(current_user, "organization_id", None),
    )

    if err or not updated_user:
        err_l = (err or "").lower()
        status_code = 403 if "access denied" in err_l else 404 if "not found" in err_l else 400
        return jsonify({
            "error": "Status Update Failed",
            "message": err or "Failed to update user status.",
            "status_code": status_code,
        }), status_code

    return jsonify({
        "message": f"User status updated to {'active' if is_active else 'inactive'}.",
        "user": updated_user.to_dict(),
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
        organization_id=getattr(current_user, "organization_id", None),
    )

    if err or not updated_user:
        err_l = (err or "").lower()
        status_code = 403 if "access denied" in err_l else 404 if "not found" in err_l else 400
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


# =============================================================================
# Phase 6B: Subject Catalog & Course Allocation Administrative Endpoints
# =============================================================================

@admin_bp.route("/subjects", methods=["GET"])
@admin_required
def admin_list_subjects():
    """List all subjects in the institutional course catalog."""
    active_param = request.args.get("active_only")
    query = {}
    if active_param is not None and active_param.lower() in ("true", "1"):
        query["is_active"] = True

    cursor = mongo.db.subjects.find(query).sort("name", 1)
    subjects = [Subject.from_doc(doc).to_dict() for doc in cursor if doc]
    return jsonify({
        "subjects": subjects,
        "count": len(subjects),
        "status_code": 200,
    }), 200


@admin_bp.route("/subjects", methods=["POST"])
@admin_required
def admin_create_subject():
    """Register a new academic subject in the catalog."""
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be a valid JSON object.",
            "status_code": 400,
        }), 400

    code = data.get("code")
    name = data.get("name")
    canonical_key = data.get("canonical_key")

    if not code or not name or not canonical_key:
        return jsonify({
            "error": "Bad Request",
            "message": "'code', 'name', and 'canonical_key' are required fields.",
            "status_code": 400,
        }), 400

    subject, err = SubjectService.create_subject(
        db=mongo.db,
        code=code,
        name=name,
        canonical_key=canonical_key,
        department=data.get("department", ""),
        description=data.get("description", ""),
        target_scale=data.get("target_scale", "0 - 100"),
        admin_id=current_user.id,
    )

    if err or not subject:
        return jsonify({
            "error": "Subject Creation Failed",
            "message": err or "Failed to create subject.",
            "status_code": 400,
        }), 400

    return jsonify({
        "message": f"Subject '{subject['name']}' created successfully.",
        "subject": subject,
        "status_code": 201,
    }), 201


@admin_bp.route("/subjects/<subject_id>/status", methods=["PUT"])
@admin_required
def admin_update_subject_status(subject_id):
    """Toggle or update active status of a subject."""
    s_oid = to_object_id(subject_id)
    if not s_oid:
        return jsonify({"error": "Bad Request", "message": "Invalid subject ID format.", "status_code": 400}), 400

    data = request.get_json() or {}
    if "is_active" not in data:
        return jsonify({"error": "Bad Request", "message": "'is_active' boolean is required.", "status_code": 400}), 400

    is_active = bool(data.get("is_active"))
    res = mongo.db.subjects.update_one(
        {"_id": s_oid},
        {"$set": {"is_active": is_active, "updated_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        return jsonify({"error": "Not Found", "message": "Subject not found.", "status_code": 404}), 404

    updated_doc = mongo.db.subjects.find_one({"_id": s_oid})
    return jsonify({
        "message": f"Subject status updated to {'active' if is_active else 'inactive'}.",
        "subject": Subject.from_doc(updated_doc).to_dict(),
        "status_code": 200,
    }), 200


@admin_bp.route("/teacher-subjects", methods=["POST"])
@admin_required
def admin_assign_teacher_subject():
    """Assign an instructor to an academic subject for a specified term."""
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Bad Request", "message": "Request body must be a valid JSON object.", "status_code": 400}), 400

    teacher_id = data.get("teacher_id")
    subject_id = data.get("subject_id")
    academic_term = data.get("academic_term")

    if not teacher_id or not subject_id or not academic_term:
        return jsonify({
            "error": "Bad Request",
            "message": "'teacher_id', 'subject_id', and 'academic_term' are all required.",
            "status_code": 400,
        }), 400

    assignment, err = AssignmentService.assign_teacher_to_subject(
        db=mongo.db,
        teacher_id=teacher_id,
        subject_id=subject_id,
        academic_term=academic_term,
        admin_id=current_user.id,
    )

    if err or not assignment:
        return jsonify({
            "error": "Assignment Failed",
            "message": err or "Failed to assign teacher to subject.",
            "status_code": 400,
        }), 400

    return jsonify({
        "message": "Instructor successfully assigned to subject.",
        "assignment": assignment,
        "status_code": 201,
    }), 201


@admin_bp.route("/teacher-subjects", methods=["GET"])
@admin_required
def admin_list_teacher_subjects():
    """List teacher-subject allocations with optional filters."""
    query = {}
    teacher_id = request.args.get("teacher_id")
    subject_id = request.args.get("subject_id")
    academic_term = request.args.get("academic_term")
    status = request.args.get("status")

    if teacher_id:
        t_oid = to_object_id(teacher_id)
        if t_oid:
            query["teacher_id"] = t_oid
    if subject_id:
        s_oid = to_object_id(subject_id)
        if s_oid:
            query["subject_id"] = s_oid
    if academic_term:
        query["academic_term"] = academic_term.strip()
    if status:
        query["status"] = status.strip().lower()

    cursor = mongo.db.teacher_subject_assignments.find(query).sort("assigned_at", -1)
    assignments = []
    for doc in cursor:
        model = TeacherSubjectAssignment.from_doc(doc)
        if model:
            d = model.to_dict()
            # Attach teacher and subject details
            t_user = mongo.db.users.find_one({"_id": model.teacher_id}, {"full_name": 1, "email": 1})
            s_subj = mongo.db.subjects.find_one({"_id": model.subject_id}, {"name": 1, "code": 1})
            d["teacher_name"] = t_user.get("full_name", "") if t_user else ""
            d["teacher_email"] = t_user.get("email", "") if t_user else ""
            d["subject_name"] = s_subj.get("name", "") if s_subj else ""
            d["subject_code"] = s_subj.get("code", "") if s_subj else ""
            assignments.append(d)

    return jsonify({
        "assignments": assignments,
        "count": len(assignments),
        "status_code": 200,
    }), 200


@admin_bp.route("/teacher-subjects/<assignment_id>/status", methods=["PUT"])
@admin_required
def admin_update_teacher_subject_status(assignment_id):
    """Update status of a teacher subject assignment ('active' | 'inactive')."""
    a_oid = to_object_id(assignment_id)
    if not a_oid:
        return jsonify({"error": "Bad Request", "message": "Invalid assignment ID format.", "status_code": 400}), 400

    data = request.get_json() or {}
    new_status = data.get("status", "").strip().lower()
    if new_status not in ("active", "inactive"):
        return jsonify({"error": "Bad Request", "message": "status must be 'active' or 'inactive'.", "status_code": 400}), 400

    res = mongo.db.teacher_subject_assignments.update_one(
        {"_id": a_oid},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        return jsonify({"error": "Not Found", "message": "Assignment not found.", "status_code": 404}), 404

    updated_doc = mongo.db.teacher_subject_assignments.find_one({"_id": a_oid})
    return jsonify({
        "message": f"Assignment status updated to '{new_status}'.",
        "assignment": TeacherSubjectAssignment.from_doc(updated_doc).to_dict(),
        "status_code": 200,
    }), 200


@admin_bp.route("/student-enrollments", methods=["POST"])
@admin_required
def admin_enroll_student():
    """Enroll a student in an academic subject for a given term."""
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Bad Request", "message": "Request body must be a valid JSON object.", "status_code": 400}), 400

    student_id = data.get("student_id")
    subject_id = data.get("subject_id")
    academic_term = data.get("academic_term")

    if not student_id or not subject_id or not academic_term:
        return jsonify({
            "error": "Bad Request",
            "message": "'student_id', 'subject_id', and 'academic_term' are all required.",
            "status_code": 400,
        }), 400

    enrollment, err = EnrollmentService.enroll_student(
        db=mongo.db,
        student_id=student_id,
        subject_id=subject_id,
        academic_term=academic_term,
        enrolled_by=current_user.id,
    )

    if err or not enrollment:
        return jsonify({
            "error": "Enrollment Failed",
            "message": err or "Failed to enroll student in subject.",
            "status_code": 400,
        }), 400

    return jsonify({
        "message": "Student successfully enrolled in subject.",
        "enrollment": enrollment,
        "status_code": 201,
    }), 201


@admin_bp.route("/student-enrollments", methods=["GET"])
@admin_required
def admin_list_student_enrollments():
    """List student course enrollments with optional filters."""
    query = {}
    student_id = request.args.get("student_id")
    subject_id = request.args.get("subject_id")
    academic_term = request.args.get("academic_term")
    status = request.args.get("status")

    if student_id:
        s_oid = to_object_id(student_id)
        if s_oid:
            query["student_id"] = s_oid
    if subject_id:
        subj_oid = to_object_id(subject_id)
        if subj_oid:
            query["subject_id"] = subj_oid
    if academic_term:
        query["academic_term"] = academic_term.strip()
    if status:
        query["status"] = status.strip().lower()

    cursor = mongo.db.student_subject_enrollments.find(query).sort("enrolled_at", -1)
    enrollments = []
    for doc in cursor:
        model = StudentSubjectEnrollment.from_doc(doc)
        if model:
            d = model.to_dict()
            s_user = mongo.db.users.find_one({"_id": model.student_id}, {"full_name": 1, "email": 1})
            s_subj = mongo.db.subjects.find_one({"_id": model.subject_id}, {"name": 1, "code": 1})
            d["student_name"] = s_user.get("full_name", "") if s_user else ""
            d["student_email"] = s_user.get("email", "") if s_user else ""
            d["subject_name"] = s_subj.get("name", "") if s_subj else ""
            d["subject_code"] = s_subj.get("code", "") if s_subj else ""
            enrollments.append(d)

    return jsonify({
        "enrollments": enrollments,
        "count": len(enrollments),
        "status_code": 200,
    }), 200


@admin_bp.route("/student-enrollments/<enrollment_id>/status", methods=["PUT"])
@admin_required
def admin_update_student_enrollment_status(enrollment_id):
    """Update status of a student course enrollment ('active' | 'dropped' | 'completed')."""
    e_oid = to_object_id(enrollment_id)
    if not e_oid:
        return jsonify({"error": "Bad Request", "message": "Invalid enrollment ID format.", "status_code": 400}), 400

    data = request.get_json() or {}
    new_status = data.get("status", "").strip().lower()
    if new_status not in ("active", "dropped", "completed"):
        return jsonify({
            "error": "Bad Request",
            "message": "status must be one of: 'active', 'dropped', 'completed'.",
            "status_code": 400,
        }), 400

    res = mongo.db.student_subject_enrollments.update_one(
        {"_id": e_oid},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        return jsonify({"error": "Not Found", "message": "Enrollment record not found.", "status_code": 404}), 404

    updated_doc = mongo.db.student_subject_enrollments.find_one({"_id": e_oid})
    return jsonify({
        "message": f"Enrollment status updated to '{new_status}'.",
        "enrollment": StudentSubjectEnrollment.from_doc(updated_doc).to_dict(),
        "status_code": 200,
    }), 200
