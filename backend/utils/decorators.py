"""
EduPredict - Role-Based Access Control (RBAC) Decorators
Enforces server-side authentication and role-based permissions.
"""

from functools import wraps
from flask import jsonify
from flask_login import current_user
from backend.utils.security import to_object_id


def role_required(*allowed_roles):
    """
    Decorator to restrict route access to specific roles.
    Returns:
    - 401 Unauthorized if user is not authenticated
    - 403 Forbidden if user role is not in allowed_roles
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "Authentication required. Please log in.",
                    "status_code": 401,
                }), 401

            user_role = getattr(current_user, "role", None)
            if user_role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden",
                    "message": f"Access denied. Requires one of roles: {', '.join(allowed_roles)}.",
                    "status_code": 403,
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def admin_required(f):
    """Decorator requiring administrator role."""
    return role_required("admin")(f)


def teacher_required(f):
    """Decorator requiring teacher role (or admin)."""
    return role_required("teacher", "admin")(f)


def can_access_student_data(actor_user, student_id, db) -> bool:
    """
    Authorization rule evaluating whether actor_user can access student_id's data.
    - Admin: Always allowed
    - Student: Allowed only if accessing their own record (actor_user.id == student_id)
    - Teacher: Allowed only if student is assigned to this teacher in teacher_student_assignments
    """
    if not actor_user or not actor_user.is_authenticated:
        return False

    actor_role = getattr(actor_user, "role", "")
    target_oid = to_object_id(student_id)
    if not target_oid:
        return False

    # 1. Administrator has system-wide access
    if actor_role == "admin":
        return True

    # 2. Student can only access their own private record
    if actor_role == "student":
        return str(actor_user.id) == str(target_oid)

    # 3. Teacher can only access students assigned to them
    if actor_role == "teacher":
        if db is None:
            return False
        teacher_oid = to_object_id(actor_user.id)
        assignment = db.teacher_student_assignments.find_one({
            "teacher_id": teacher_oid,
            "student_id": target_oid,
            "status": "active",
        })
        return assignment is not None

    return False
