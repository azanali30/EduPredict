"""
EduPredict - Subject-Based Role-Based Access Control (RBAC) Security Tests
Phase 6B: Mandatory security test suite asserting strict server-side subject isolation,
cross-subject IDOR prevention, term boundaries, and administrative endpoint protections.
"""

import pytest
from datetime import datetime, timezone
from bson import ObjectId

from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService
from backend.utils.decorators import can_access_student_subject_data


# Minimal valid feature vectors for prediction generation
SAMPLE_FEATURES = {
    "school": "GP",
    "sex": "F",
    "age": 16,
    "address": "U",
    "famsize": "GT3",
    "Pstatus": "T",
    "Medu": 3,
    "Fedu": 3,
    "Mjob": "services",
    "Fjob": "other",
    "reason": "course",
    "guardian": "mother",
    "traveltime": 1,
    "studytime": 2,
    "study_hours_per_week": 14.0,
    "failures": 0,
    "schoolsup": "no",
    "famsup": "yes",
    "paid": "no",
    "activities": "yes",
    "nursery": "yes",
    "higher": "yes",
    "internet": "yes",
    "romantic": "no",
    "famrel": 4,
    "freetime": 3,
    "goout": 2,
    "Dalc": 1,
    "Walc": 1,
    "health": 4,
    "absences": 2,
    "attendance_percentage": 95.0,
    "assignment_completion_rate": 90.0,
}


def login_client(client, email: str, password: str = "Password123!"):
    """Helper to log in an actor user session."""
    return client.post("/auth/login", json={"email": email, "password": password})


# =============================================================================
# Mandatory Security Test 1 & 2: Cross-Subject Isolation
# =============================================================================

def test_math_teacher_cannot_access_portuguese_prediction(client, clean_db, test_student, test_admin):
    """
    Security Test 1:
    A Mathematics teacher cannot view or retrieve a student's Portuguese Language prediction.
    """
    # 1. Setup teachers
    math_teacher, _ = UserService.create_user(clean_db, "math.teacher@edupredict.com", "Password123!", "Math Prof", "teacher")
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # Assign teacher to Mathematics only
    AssignmentService.assign_teacher_to_subject(clean_db, math_teacher.id, math_subj.id, "2026-T1", admin_id=test_admin.id)
    # Student is enrolled in both Math and Portuguese
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1")
    EnrollmentService.enroll_student(clean_db, test_student.id, port_subj.id, "2026-T1")

    # Admin creates Portuguese prediction for student
    login_client(client, test_admin.email, "AdminPassword123!")
    res_port = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Portuguese Language",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_port.status_code == 201
    port_pred_id = res_port.get_json()["prediction"]["id"]

    # Math teacher logs in and attempts to access Portuguese prediction detail -> 403 Forbidden
    login_client(client, math_teacher.email, "Password123!")
    res_get = client.get(f"/api/predictions/{port_pred_id}")
    assert res_get.status_code == 403
    assert "not authorized" in res_get.get_json()["message"].lower()

    # Math teacher listing predictions for student -> returns 0 predictions because student has only Port prediction
    res_list = client.get(f"/api/predictions?student_id={test_student.id}")
    assert res_list.status_code == 200
    assert res_list.get_json()["total_count"] == 0
    assert res_list.get_json()["predictions"] == []


def test_portuguese_teacher_cannot_access_mathematics_prediction(client, clean_db, test_student, test_admin):
    """
    Security Test 2:
    A Portuguese Language teacher cannot view or retrieve a student's Mathematics prediction.
    """
    port_teacher, _ = UserService.create_user(clean_db, "port.teacher@edupredict.com", "Password123!", "Port Prof", "teacher")
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # Assign teacher to Portuguese Language only
    AssignmentService.assign_teacher_to_subject(clean_db, port_teacher.id, port_subj.id, "2026-T1", admin_id=test_admin.id)
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1")
    EnrollmentService.enroll_student(clean_db, test_student.id, port_subj.id, "2026-T1")

    # Admin creates Math prediction for student
    login_client(client, test_admin.email, "AdminPassword123!")
    res_math = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_math.status_code == 201
    math_pred_id = res_math.get_json()["prediction"]["id"]

    # Portuguese teacher logs in and attempts to access Math prediction -> 403 Forbidden
    login_client(client, port_teacher.email, "Password123!")
    res_get = client.get(f"/api/predictions/{math_pred_id}")
    assert res_get.status_code == 403


# =============================================================================
# Mandatory Security Test 3: Legacy Assignment Isolation
# =============================================================================

def test_legacy_student_assignment_alone_does_not_grant_subject_access(client, clean_db, test_teacher, test_student, test_admin):
    """
    Security Test 3:
    An existing legacy teacher_student_assignments document alone must NEVER grant subject-level
    prediction creation or retrieval access.
    """
    # Create ONLY legacy assignment (no teacher_subject_assignment or student_subject_enrollment)
    AssignmentService.assign_teacher_to_student(clean_db, test_teacher.id, test_student.id, admin_id=test_admin.id)

    # Admin creates a prediction for the student
    login_client(client, test_admin.email, "AdminPassword123!")
    res_admin = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    pred_id = res_admin.get_json()["prediction"]["id"]

    # Teacher logs in
    login_client(client, test_teacher.email, "TeacherPassword123!")

    # 1. Attempting to view prediction detail -> 403 Forbidden
    res_detail = client.get(f"/api/predictions/{pred_id}")
    assert res_detail.status_code == 403

    # 2. Attempting to generate a prediction -> 403 Forbidden
    res_create = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_create.status_code == 403
    assert "not authorized" in res_create.get_json()["message"].lower()

    # 3. Direct service authorization assertion
    auth_res = can_access_student_subject_data(test_teacher, test_student.id, "Mathematics", clean_db)
    assert auth_res is False


# =============================================================================
# Mandatory Security Test 4 & 5: Missing Subject Assignment or Enrollment
# =============================================================================

def test_teacher_without_subject_assignment_receives_403(client, clean_db, test_teacher, test_student):
    """
    Security Test 4:
    A teacher who has NOT been assigned to any subject receives 403 Forbidden when attempting
    to generate or retrieve predictions for a student.
    """
    login_client(client, test_teacher.email, "TeacherPassword123!")
    res = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
    })
    assert res.status_code == 403
    assert "not authorized" in res.get_json()["message"].lower()


def test_teacher_without_matching_student_enrollment_receives_403(client, clean_db, test_teacher, test_admin):
    """
    Security Test 5:
    A teacher assigned to Mathematics receives 403 if the student is NOT enrolled in Mathematics.
    """
    # Create student with NO subject enrollments
    unenrolled_student, _ = UserService.create_user(clean_db, "unenrolled@edupredict.com", "Password123!", "Unenrolled", "student")

    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2026-T1", admin_id=test_admin.id)

    login_client(client, test_teacher.email, "TeacherPassword123!")
    res = client.post("/api/predictions", json={
        "student_id": str(unenrolled_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res.status_code == 403
    assert "not authorized" in res.get_json()["message"].lower()


# =============================================================================
# Mandatory Security Test 6 & 7: Student Boundaries & Forgery Prevention
# =============================================================================

def test_student_cannot_access_other_student_predictions(client, clean_db, test_student, test_admin):
    """
    Security Test 6:
    A student cannot retrieve another student's prediction record by ID or query parameters.
    """
    other_student, _ = UserService.create_user(clean_db, "other.student@edupredict.com", "Password123!", "Other", "student")
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    EnrollmentService.enroll_student(clean_db, other_student.id, math_subj.id, "2026-T1")

    # Admin creates prediction for other_student
    login_client(client, test_admin.email, "AdminPassword123!")
    res_other = client.post("/api/predictions", json={
        "student_id": str(other_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    other_pred_id = res_other.get_json()["prediction"]["id"]

    # Student A logs in and attempts to retrieve other_student's prediction
    login_client(client, test_student.email, "StudentPassword123!")
    res_detail = client.get(f"/api/predictions/{other_pred_id}")
    assert res_detail.status_code == 403

    # Student A queries predictions with student_id=other_student.id -> returned list is scoped strictly to self
    res_list = client.get(f"/api/predictions?student_id={other_student.id}")
    assert res_list.status_code == 200
    # Should only return predictions belonging to test_student (which is 0)
    for p in res_list.get_json()["predictions"]:
        assert p["student_id"] == str(test_student.id)


def test_student_cannot_forge_student_id_on_create(client, clean_db, test_student):
    """
    Security Test 7:
    A student cannot supply a different student_id in POST /api/predictions payload.
    """
    victim_student, _ = UserService.create_user(clean_db, "victim@edupredict.com", "Password123!", "Victim", "student")

    login_client(client, test_student.email, "StudentPassword123!")
    res = client.post("/api/predictions", json={
        "student_id": str(victim_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
    })
    assert res.status_code == 403
    assert "strictly prohibited" in res.get_json()["message"].lower()


# =============================================================================
# Mandatory Security Test 8 & 9: Unauthorized Detail & Pagination Scoping
# =============================================================================

def test_unauthorized_prediction_detail_does_not_disclose_data(client, clean_db, test_student, test_admin):
    """
    Security Test 8:
    An unauthorized request for a prediction detail yields 403 with a generic message and 0 data.
    """
    unrelated_teacher, _ = UserService.create_user(clean_db, "unrelated@edupredict.com", "Password123!", "Unrelated", "teacher")

    login_client(client, test_admin.email, "AdminPassword123!")
    res_pred = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
    })
    pred_id = res_pred.get_json()["prediction"]["id"]

    login_client(client, unrelated_teacher.email, "Password123!")
    res_view = client.get(f"/api/predictions/{pred_id}")
    assert res_view.status_code == 403
    data = res_view.get_json()
    assert "prediction" not in data
    assert "not authorized" in data["message"].lower()


def test_pagination_totals_strictly_exclude_unauthorized_records(client, clean_db, test_admin):
    """
    Security Test 9:
    Teacher's total_count KPI strictly calculates only authorized subject records.
    """
    math_teacher, _ = UserService.create_user(clean_db, "math.teacher2@edupredict.com", "Password123!", "Math T", "teacher")
    student_a, _ = UserService.create_user(clean_db, "student.a@edupredict.com", "Password123!", "Student A", "student")
    student_b, _ = UserService.create_user(clean_db, "student.b@edupredict.com", "Password123!", "Student B", "student")

    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # Math teacher teaches Math to Student A only
    AssignmentService.assign_teacher_to_subject(clean_db, math_teacher.id, math_subj.id, "2026-T1", admin_id=test_admin.id)
    EnrollmentService.enroll_student(clean_db, student_a.id, math_subj.id, "2026-T1")
    EnrollmentService.enroll_student(clean_db, student_a.id, port_subj.id, "2026-T1")
    EnrollmentService.enroll_student(clean_db, student_b.id, port_subj.id, "2026-T1")

    # Admin creates 2 Math predictions for Student A, 3 Portuguese predictions for Student A, and 4 Portuguese for Student B
    login_client(client, test_admin.email, "AdminPassword123!")
    for _ in range(2):
        client.post("/api/predictions", json={
            "student_id": str(student_a.id),
            "subject": "Mathematics",
            "milestone": 0,
            "features": SAMPLE_FEATURES,
            "academic_term": "2026-T1",
        })
    for _ in range(3):
        client.post("/api/predictions", json={
            "student_id": str(student_a.id),
            "subject": "Portuguese Language",
            "milestone": 0,
            "features": SAMPLE_FEATURES,
            "academic_term": "2026-T1",
        })
    for _ in range(4):
        client.post("/api/predictions", json={
            "student_id": str(student_b.id),
            "subject": "Portuguese Language",
            "milestone": 0,
            "features": SAMPLE_FEATURES,
            "academic_term": "2026-T1",
        })

    # Total predictions in DB = 9
    assert clean_db.predictions.count_documents({}) == 9

    # Math teacher queries /api/predictions
    login_client(client, math_teacher.email, "Password123!")
    res = client.get("/api/predictions?limit=10")
    assert res.status_code == 200
    data = res.get_json()
    # Math teacher must see strictly 2 predictions (Student A's Math predictions)
    assert data["total_count"] == 2
    assert len(data["predictions"]) == 2
    for p in data["predictions"]:
        assert p["subject"] == "Mathematics"
        assert p["student_id"] == str(student_a.id)


# =============================================================================
# Mandatory Security Test 10: Academic Roster Scope
# =============================================================================

def test_academic_roster_enforces_subject_scope(client, clean_db, test_admin):
    """
    Security Test 10:
    /api/teacher/students returns only students enrolled in subjects taught by that teacher.
    """
    math_teacher, _ = UserService.create_user(clean_db, "mt@edupredict.com", "Password123!", "Math T", "teacher")
    s_math, _ = UserService.create_user(clean_db, "s.math@edupredict.com", "Password123!", "Student Math", "student")
    s_port, _ = UserService.create_user(clean_db, "s.port@edupredict.com", "Password123!", "Student Port", "student")

    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    AssignmentService.assign_teacher_to_subject(clean_db, math_teacher.id, math_subj.id, "2026-T1", admin_id=test_admin.id)
    EnrollmentService.enroll_student(clean_db, s_math.id, math_subj.id, "2026-T1")
    EnrollmentService.enroll_student(clean_db, s_port.id, port_subj.id, "2026-T1")

    login_client(client, math_teacher.email, "Password123!")
    res = client.get("/api/teacher/students")
    assert res.status_code == 200
    students = res.get_json()["students"]
    assert len(students) == 1
    assert students[0]["id"] == str(s_math.id)

    # Filtering by unassigned subject returns empty roster
    res_port = client.get(f"/api/teacher/students?subject_id={port_subj.id}")
    assert res_port.status_code == 200
    assert res_port.get_json()["count"] == 0
    assert res_port.get_json()["students"] == []

    # Attempting to access Portuguese student profile -> 403 Forbidden
    res_prof = client.get(f"/api/students/{s_port.id}")
    assert res_prof.status_code == 403
    assert "student" not in res_prof.get_json()

    # Attempting to query predictions for Portuguese subject -> 403 Forbidden
    res_port_preds = client.get("/api/predictions?subject=Portuguese Language")
    assert res_port_preds.status_code == 403


# =============================================================================
# Mandatory Security Test 11: Admin Endpoints Role Validation
# =============================================================================

def test_admin_assignment_endpoints_reject_non_admins(client, test_student, test_teacher):
    """
    Security Test 11:
    Students and teachers attempting to perform assignment or catalog operations receive 403.
    """
    # Student attempt
    login_client(client, test_student.email, "StudentPassword123!")
    assert client.post("/api/admin/teacher-subjects", json={}).status_code == 403
    assert client.post("/api/admin/student-enrollments", json={}).status_code == 403
    assert client.post("/api/admin/subjects", json={}).status_code == 403

    # Teacher attempt
    login_client(client, test_teacher.email, "TeacherPassword123!")
    assert client.post("/api/admin/teacher-subjects", json={}).status_code == 403
    assert client.post("/api/admin/student-enrollments", json={}).status_code == 403
    assert client.post("/api/admin/subjects", json={}).status_code == 403


# =============================================================================
# Mandatory Security Test 12 & 13: Authorized Access Verification
# =============================================================================

def test_authorized_teacher_can_predict_and_access_records(client, clean_db, test_teacher, test_student, test_admin):
    """
    Security Test 12:
    An authorized teacher with matching subject assignment and student enrollment
    successfully generates and retrieves predictions.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2026-T1", admin_id=test_admin.id)
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1")

    login_client(client, test_teacher.email, "TeacherPassword123!")
    res_create = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_create.status_code == 201
    pred_data = res_create.get_json()["prediction"]
    pred_id = pred_data["id"]

    res_detail = client.get(f"/api/predictions/{pred_id}")
    assert res_detail.status_code == 200
    assert res_detail.get_json()["prediction"]["id"] == pred_id


def test_authorized_student_can_access_own_enrolled_records(client, clean_db, test_student):
    """
    Security Test 13:
    An authorized student can generate predictions for self and view their own history.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1")

    login_client(client, test_student.email, "StudentPassword123!")
    res_create = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_create.status_code == 201
    pred_id = res_create.get_json()["prediction"]["id"]

    res_history = client.get("/api/predictions")
    assert res_history.status_code == 200
    assert res_history.get_json()["total_count"] >= 1

    res_get = client.get(f"/api/predictions/{pred_id}")
    assert res_get.status_code == 200


# =============================================================================
# Mandatory Security Test 14: Historical Record Subject String Preservation
# =============================================================================

def test_historical_records_retain_original_subject_strings(client, clean_db, test_student):
    """
    Security Test 14:
    Predictions persist both canonical subject string and subject_id, never overwriting
    original subject names.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1")

    login_client(client, test_student.email, "StudentPassword123!")
    res = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res.status_code == 201
    pred = res.get_json()["prediction"]

    saved_doc = clean_db.predictions.find_one({"_id": ObjectId(pred["id"])})
    assert saved_doc is not None
    assert saved_doc["subject"] == "Mathematics"
    assert "subject_id" in saved_doc
    assert isinstance(saved_doc["subject_id"], ObjectId)


# =============================================================================
# Mandatory Security Test 15: Academic Term Boundaries
# =============================================================================

def test_academic_term_boundaries_strictly_enforced(client, clean_db, test_teacher, test_admin):
    """
    Security Test 15:
    A teacher assigned to Mathematics in Term 1 (2026-T1) CANNOT generate or access predictions
    for a student in Term 2 (2026-T2) if they are not assigned for Term 2.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Create student enrolled ONLY in 2026-T2
    term_student, _ = UserService.create_user(clean_db, "term.student@edupredict.com", "Password123!", "Term Student", "student")
    EnrollmentService.enroll_student(clean_db, term_student.id, math_subj.id, "2026-T2")

    # Teacher assigned ONLY for 2026-T1
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2026-T1", admin_id=test_admin.id)

    login_client(client, test_teacher.email, "TeacherPassword123!")

    # Attempting to generate prediction for student in 2026-T2 -> 403 Forbidden (Teacher not assigned for 2026-T2)
    res_t2 = client.post("/api/predictions", json={
        "student_id": str(term_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T2",
    })
    assert res_t2.status_code == 403

    # Attempting to generate prediction in 2026-T1 -> 403 Forbidden (Student not enrolled in 2026-T1)
    res_t1 = client.post("/api/predictions", json={
        "student_id": str(term_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_t1.status_code == 403

    # Attempting to generate prediction without term -> 403 Forbidden (No shared active academic term)
    res_no_term = client.post("/api/predictions", json={
        "student_id": str(term_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
    })
    assert res_no_term.status_code == 403


# =============================================================================
# Phase 6B Final Privacy Verification: Dual-Enrolled Student Cross-Subject Isolation
# =============================================================================

def test_phase_6b_dual_enrolled_student_privacy_isolation(client, clean_db, test_admin):
    """
    Focused Verification:
    - Student Ali enrolled in both Mathematics and Portuguese Language in 2026-T1.
    - Teacher A assigned only to Mathematics in 2026-T1.
    - Teacher B assigned only to Portuguese Language in 2026-T1.

    Asserts:
    1. Teacher A can access Ali's authorized Mathematics info only.
    2. Teacher A cannot retrieve Ali's Portuguese marks, predictions, or risk data.
    3. Teacher B can access Ali's authorized Portuguese info only.
    4. Neither teacher can retrieve the other subject by manipulating parameters or IDs.
    5. Generic profile fields are strictly separated from subject academic data.
    6. System administrator retains authorized access to both subjects.
    7. Student Ali retains access to both of their enrolled subjects.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # 1. Create Student Ali enrolled in both subjects
    ali, _ = UserService.create_user(
        clean_db, "ali@edupredict.com", "StudentPassword123!", "Student Ali", "student"
    )
    EnrollmentService.enroll_student(clean_db, ali.id, math_subj.id, "2026-T1")
    EnrollmentService.enroll_student(clean_db, ali.id, port_subj.id, "2026-T1")

    # 2. Create Teacher A (Mathematics only)
    teacher_a, _ = UserService.create_user(
        clean_db, "teacher.a@edupredict.com", "TeacherPass123!", "Teacher A", "teacher"
    )
    AssignmentService.assign_teacher_to_subject(
        clean_db, teacher_a.id, math_subj.id, "2026-T1", admin_id=test_admin.id
    )

    # 3. Create Teacher B (Portuguese Language only)
    teacher_b, _ = UserService.create_user(
        clean_db, "teacher.b@edupredict.com", "TeacherPass123!", "Teacher B", "teacher"
    )
    AssignmentService.assign_teacher_to_subject(
        clean_db, teacher_b.id, port_subj.id, "2026-T1", admin_id=test_admin.id
    )

    # 4. Generate baseline predictions for Ali in both subjects via Admin
    login_client(client, test_admin.email, "AdminPassword123!")

    # Math prediction
    res_math_pred = client.post("/api/predictions", json={
        "student_id": str(ali.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_math_pred.status_code == 201
    math_pred_id = res_math_pred.get_json()["prediction"]["id"]

    # Portuguese prediction
    res_port_pred = client.post("/api/predictions", json={
        "student_id": str(ali.id),
        "subject": "Portuguese Language",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_port_pred.status_code == 201
    port_pred_id = res_port_pred.get_json()["prediction"]["id"]

    # =========================================================================
    # ASSERTION 1 & 2: Teacher A (Mathematics Only)
    # =========================================================================
    login_client(client, teacher_a.email, "TeacherPass123!")

    # 1. Roster access: Ali is present, but enrolled_subjects_under_teacher has ONLY Mathematics
    res_a_roster = client.get("/api/teacher/students")
    assert res_a_roster.status_code == 200
    a_roster = res_a_roster.get_json()["students"]
    assert len(a_roster) == 1
    assert a_roster[0]["id"] == str(ali.id)
    assert a_roster[0]["enrolled_subjects_under_teacher"] == ["Mathematics"]
    assert "Portuguese Language" not in a_roster[0]["enrolled_subjects_under_teacher"]

    # 2. Prediction history: Returns Math prediction, excludes Portuguese prediction
    res_a_preds = client.get("/api/predictions")
    assert res_a_preds.status_code == 200
    a_pred_items = res_a_preds.get_json()["predictions"]
    assert len(a_pred_items) == 1
    assert a_pred_items[0]["id"] == math_pred_id
    assert a_pred_items[0]["subject"] == "Mathematics"

    # 3. Math prediction detail access -> 200 OK
    res_a_math_detail = client.get(f"/api/predictions/{math_pred_id}")
    assert res_a_math_detail.status_code == 200
    assert res_a_math_detail.get_json()["prediction"]["subject"] == "Mathematics"

    # 4. Portuguese prediction detail access -> 403 Forbidden (no Portuguese marks/risk leaked)
    res_a_port_detail = client.get(f"/api/predictions/{port_pred_id}")
    assert res_a_port_detail.status_code == 403
    assert "prediction" not in res_a_port_detail.get_json()

    # 5. Parameter manipulation: Querying Portuguese subject -> 403 Forbidden
    res_a_manip_subj = client.get("/api/predictions?subject=Portuguese Language")
    assert res_a_manip_subj.status_code == 403

    # 6. Parameter manipulation: Querying with student_id + Portuguese subject -> 403 Forbidden
    res_a_manip_both = client.get(f"/api/predictions?student_id={ali.id}&subject=Portuguese Language")
    assert res_a_manip_both.status_code == 403

    # 7. Creation manipulation: Teacher A cannot generate Portuguese prediction for Ali -> 403
    res_a_create_port = client.post("/api/predictions", json={
        "student_id": str(ali.id),
        "subject": "Portuguese Language",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_a_create_port.status_code == 403

    # =========================================================================
    # ASSERTION 3 & 4: Teacher B (Portuguese Language Only)
    # =========================================================================
    login_client(client, teacher_b.email, "TeacherPass123!")

    # 1. Roster access: Ali is present, but enrolled_subjects_under_teacher has ONLY Portuguese Language
    res_b_roster = client.get("/api/teacher/students")
    assert res_b_roster.status_code == 200
    b_roster = res_b_roster.get_json()["students"]
    assert len(b_roster) == 1
    assert b_roster[0]["id"] == str(ali.id)
    assert b_roster[0]["enrolled_subjects_under_teacher"] == ["Portuguese Language"]
    assert "Mathematics" not in b_roster[0]["enrolled_subjects_under_teacher"]

    # 2. Prediction history: Returns Portuguese prediction, excludes Mathematics prediction
    res_b_preds = client.get("/api/predictions")
    assert res_b_preds.status_code == 200
    b_pred_items = res_b_preds.get_json()["predictions"]
    assert len(b_pred_items) == 1
    assert b_pred_items[0]["id"] == port_pred_id
    assert b_pred_items[0]["subject"] == "Portuguese Language"

    # 3. Portuguese prediction detail access -> 200 OK
    res_b_port_detail = client.get(f"/api/predictions/{port_pred_id}")
    assert res_b_port_detail.status_code == 200
    assert res_b_port_detail.get_json()["prediction"]["subject"] == "Portuguese Language"

    # 4. Mathematics prediction detail access -> 403 Forbidden (no Math marks/risk leaked)
    res_b_math_detail = client.get(f"/api/predictions/{math_pred_id}")
    assert res_b_math_detail.status_code == 403
    assert "prediction" not in res_b_math_detail.get_json()

    # 5. Parameter manipulation: Querying Mathematics subject -> 403 Forbidden
    res_b_manip_subj = client.get("/api/predictions?subject=Mathematics")
    assert res_b_manip_subj.status_code == 403

    # 6. Creation manipulation: Teacher B cannot generate Mathematics prediction for Ali -> 403
    res_b_create_math = client.post("/api/predictions", json={
        "student_id": str(ali.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_b_create_math.status_code == 403

    # =========================================================================
    # ASSERTION 5: Generic Profile Separation
    # =========================================================================
    # Both Teacher A and Teacher B can view Ali's generic identity profile (because they teach Ali)
    # BUT profile response contains strictly standard demographic fields, 0 subject predictions/marks
    for t_email in [teacher_a.email, teacher_b.email]:
        login_client(client, t_email, "TeacherPass123!")
        res_prof = client.get(f"/api/students/{ali.id}")
        assert res_prof.status_code == 200
        prof_data = res_prof.get_json()["student"]
        assert prof_data["id"] == str(ali.id)
        assert prof_data["email"] == "ali@edupredict.com"
        assert prof_data["full_name"] == "Student Ali"
        assert prof_data["role"] == "student"
        # Verify no academic leakages in profile response
        assert "predicted_marks" not in prof_data
        assert "predicted_status" not in prof_data
        assert "confidence_scores" not in prof_data
        assert "predictions" not in prof_data
        assert "marks" not in prof_data

    # =========================================================================
    # ASSERTION 6: Administrator Retains Full Access
    # =========================================================================
    login_client(client, test_admin.email, "AdminPassword123!")

    # Admin lists predictions for Ali -> both Math and Portuguese returned
    res_admin_preds = client.get(f"/api/predictions?student_id={ali.id}")
    assert res_admin_preds.status_code == 200
    admin_preds = res_admin_preds.get_json()["predictions"]
    assert len(admin_preds) == 2
    admin_subjects = {p["subject"] for p in admin_preds}
    assert admin_subjects == {"Mathematics", "Portuguese Language"}

    # Admin accesses individual prediction details -> 200 OK for both
    assert client.get(f"/api/predictions/{math_pred_id}").status_code == 200
    assert client.get(f"/api/predictions/{port_pred_id}").status_code == 200

    # =========================================================================
    # ASSERTION 7: Student Ali Retains Access to Both Enrolled Subjects
    # =========================================================================
    login_client(client, ali.email, "StudentPassword123!")

    # Ali lists own predictions -> both Math and Portuguese returned
    res_ali_preds = client.get("/api/predictions")
    assert res_ali_preds.status_code == 200
    ali_preds = res_ali_preds.get_json()["predictions"]
    assert len(ali_preds) == 2
    ali_subjects = {p["subject"] for p in ali_preds}
    assert ali_subjects == {"Mathematics", "Portuguese Language"}

    # Ali accesses individual prediction details -> 200 OK for both
    assert client.get(f"/api/predictions/{math_pred_id}").status_code == 200
    assert client.get(f"/api/predictions/{port_pred_id}").status_code == 200

    # Ali generates predictions in both subjects -> 201 Created for both
    res_ali_new_math = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_ali_new_math.status_code == 201

    res_ali_new_port = client.post("/api/predictions", json={
        "subject": "Portuguese Language",
        "milestone": 0,
        "features": SAMPLE_FEATURES,
        "academic_term": "2026-T1",
    })
    assert res_ali_new_port.status_code == 201

