"""
EduPredict - Role-Based Access Control (RBAC) Decorators
Enforces server-side authentication and role-based permissions.
"""

from typing import Optional
from functools import wraps
from flask import jsonify
from flask_login import current_user
from bson import ObjectId
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


def analyst_required(f):
    """
    Decorator requiring strictly analyst role.
    Rejects other roles (admin, teacher, student).
    """
    return role_required("analyst")(f)


def can_access_student_data(actor_user, student_id, db) -> bool:
    """
    Generic student-profile authorization rule:
    Evaluates whether actor_user can access student_id's general profile.
    - Admin: Always allowed.
    - Student: Allowed only if accessing their own record (actor_user.id == student_id).
    - Teacher: Allowed if student is actively enrolled in at least one subject assigned
      to this teacher, or has an active legacy teacher-student mapping.
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

    # 3. Teacher can access generic student profile ONLY if linked by active subject assignment and enrollment
    if actor_role == "teacher":
        if db is None:
            return False
        teacher_oid = to_object_id(actor_user.id)

        # Subject-based link check: teacher must hold active assignment in a subject the student is actively enrolled in
        t_subjs = list(db.teacher_subject_assignments.find({"teacher_id": teacher_oid, "status": "active"}))
        if not t_subjs:
            return False

        term_conditions = []
        for a in t_subjs:
            s_id = a.get("subject_id")
            term = a.get("academic_term")
            if s_id:
                cond: Dict[str, Any] = {
                    "student_id": target_oid,
                    "subject_id": s_id,
                    "status": "active",
                }
                if term:
                    cond["academic_term"] = term
                term_conditions.append(cond)

        if not term_conditions:
            return False

        if len(term_conditions) == 1:
            enroll_q = term_conditions[0]
        else:
            enroll_q = {"$or": term_conditions}

        has_enrollment = db.student_subject_enrollments.find_one(enroll_q)
        return has_enrollment is not None

    return False


def can_access_student_subject_data(
    actor_user,
    student_id: ObjectId | str,
    subject: ObjectId | str,
    db,
    academic_term: Optional[str] = None,
    require_term: bool = False,
) -> bool:
    """
    Subject-Specific Academic Authorization Rule (Phase 6B):
    Evaluates whether actor_user can access, predict, or view academic data for a specific student and subject.

    Mandatory Rules:
    - Admin: Always authorized.
    - Student: Authorized only for their own records (actor_user.id == student_id)
      and only for subjects in which they hold an active or historical enrollment.
    - Teacher: Authorized ONLY if BOTH conditions are met:
        1. Teacher holds an active assignment for that subject.
        2. Student holds an active enrollment for that subject.
        3. If academic_term is provided, both teacher and student must match that exact term;
           if omitted, teacher and student must share at least one active academic term.
    - Legacy teacher_student_assignments NEVER grants subject-level access.
    """
    if not actor_user or not actor_user.is_authenticated:
        return False

    actor_role = getattr(actor_user, "role", "")
    target_student_oid = to_object_id(student_id)
    if not target_student_oid or db is None:
        return False

    # 1. Administrator has system-wide access
    if actor_role == "admin":
        return True

    # Resolve target subject document
    subj_doc = None
    subj_oid = to_object_id(subject)
    if subj_oid:
        subj_doc = db.subjects.find_one({"_id": subj_oid})

    if not subj_doc and isinstance(subject, str) and subject.strip():
        clean_subj = subject.strip()
        subj_doc = db.subjects.find_one({
            "$or": [
                {"canonical_key": clean_subj.lower()},
                {"name": clean_subj},
                {"code": clean_subj.upper()},
            ]
        })

    # Auto-seed canonical subjects if database subjects collection is unpopulated
    if not subj_doc:
        from backend.services.subject_service import SubjectService
        SubjectService.ensure_canonical_subjects(db)
        if subj_oid:
            subj_doc = db.subjects.find_one({"_id": subj_oid})
        if not subj_doc and isinstance(subject, str) and subject.strip():
            clean_subj = subject.strip()
            subj_doc = db.subjects.find_one({
                "$or": [
                    {"canonical_key": clean_subj.lower()},
                    {"name": clean_subj},
                    {"code": clean_subj.upper()},
                ]
            })

    if not subj_doc or not subj_doc.get("is_active", True):
        return False

    canonical_subject_oid = subj_doc["_id"]

    # 2. Student: Authorized only for self and enrolled/historical subjects
    if actor_role == "student":
        if str(actor_user.id) != str(target_student_oid):
            return False

        # Verify student is/was enrolled in this subject
        enroll_query = {
            "student_id": target_student_oid,
            "subject_id": canonical_subject_oid,
        }
        if academic_term:
            enroll_query["academic_term"] = academic_term.strip()

        # If student has enrollments on file, must match
        enrollment_count = db.student_subject_enrollments.count_documents({"student_id": target_student_oid})
        if enrollment_count > 0:
            student_enrollment = db.student_subject_enrollments.find_one(enroll_query)
            return student_enrollment is not None

        # If student has no enrollments on file at all (e.g. self-onboarding / demo baseline), allow own subject prediction
        return True

    # 3. Teacher: Subject Assignment + Student Enrollment + Term Alignment
    if actor_role == "teacher":
        teacher_oid = to_object_id(actor_user.id)
        if not teacher_oid:
            return False

        # Fail closed for missing/empty academic term when require_term=True
        if require_term and (not academic_term or not isinstance(academic_term, str) or not academic_term.strip()):
            return False

        clean_term = academic_term.strip() if academic_term and isinstance(academic_term, str) and academic_term.strip() else None

        # Condition 1: Teacher has active assignment for this subject
        t_query = {
            "teacher_id": teacher_oid,
            "subject_id": canonical_subject_oid,
            "status": "active",
        }
        if clean_term:
            t_query["academic_term"] = clean_term

        t_assignments = list(db.teacher_subject_assignments.find(t_query))
        if not t_assignments:
            # Teacher is NOT assigned to this subject
            return False

        # Condition 2: Student has active enrollment in this subject
        s_query = {
            "student_id": target_student_oid,
            "subject_id": canonical_subject_oid,
            "status": "active",
        }
        if clean_term:
            s_query["academic_term"] = clean_term

        s_enrollments = list(db.student_subject_enrollments.find(s_query))
        if not s_enrollments:
            # Student is NOT enrolled in this subject
            return False

        # Condition 3: Academic Term Alignment
        if clean_term:
            # Both queries already matched the exact specified term
            return True

        if require_term:
            return False

        # Term not specified: verify teacher and student share at least one active term
        t_terms = {a.get("academic_term") for a in t_assignments if a.get("academic_term")}
        s_terms = {e.get("academic_term") for e in s_enrollments if e.get("academic_term")}
        shared_terms = t_terms.intersection(s_terms)
        return len(shared_terms) > 0

    return False
