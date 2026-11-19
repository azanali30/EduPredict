"""
EduPredict - Role-Based Access Control (RBAC) & Authorization Tests
Tests role restrictions, cross-student privacy, and teacher assignment boundaries.
"""

from bson import ObjectId
from backend.services.user_service import UserService
from backend.services.assignment_service import AssignmentService
from backend.services.subject_service import SubjectService
from backend.services.enrollment_service import EnrollmentService


def test_student_cannot_access_other_student_record(client, clean_db, test_student):
    """Verify that a student attempting to view another student's data receives 403 Forbidden."""
    # Create second student
    student2, _ = UserService.create_user(
        clean_db,
        "other.student@edupredict.com",
        "Password123!",
        "Second Student",
        "student",
    )

    # Login as student 1
    client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })

    # Student 1 accessing student 1's own record -> allowed
    res_own = client.get(f"/api/students/{test_student.id}")
    assert res_own.status_code == 200

    # Student 1 attempting to access student 2's record -> 403 Forbidden
    res_other = client.get(f"/api/students/{student2.id}")
    assert res_other.status_code == 403
    data = res_other.get_json()
    assert "not authorized" in data.get("message", "").lower()


def test_teacher_can_only_access_assigned_students(client, clean_db, test_teacher, test_student):
    """Verify teacher can only access students enrolled in their assigned subject."""
    # Ensure subjects
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Create second unassigned student
    unassigned_student, _ = UserService.create_user(
        clean_db,
        "unassigned.student@edupredict.com",
        "Password123!",
        "Unassigned Student",
        "student",
    )

    # Assign teacher to Mathematics and enroll test_student in Mathematics
    AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        admin_id=ObjectId(),
    )
    EnrollmentService.enroll_student(
        clean_db,
        student_id=test_student.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
    )

    # Login as teacher
    client.post("/auth/login", json={
        "email": test_teacher.email,
        "password": "TeacherPassword123!",
    })

    # Teacher accesses assigned student -> 200 OK
    res_assigned = client.get(f"/api/students/{test_student.id}")
    assert res_assigned.status_code == 200

    # Teacher accesses unassigned student -> 403 Forbidden
    res_unassigned = client.get(f"/api/students/{unassigned_student.id}")
    assert res_unassigned.status_code == 403

    # Teacher lists their assigned students
    res_list = client.get("/api/teacher/students")
    assert res_list.status_code == 200
    list_data = res_list.get_json()
    assert list_data["count"] == 1
    assert list_data["students"][0]["id"] == str(test_student.id)


def test_unmigrated_teacher_with_legacy_assignment_alone_denied_access(client, clean_db, test_student):
    """
    Verify that an unmigrated teacher with ONLY legacy teacher_student_assignments:
    1. Receives an empty roster with a non-sensitive status message on GET /api/teacher/students.
    2. Receives 403 Forbidden on GET /api/students/<student_id> (no profile fields exposed).
    3. Receives empty list and 0 total_count on GET /api/predictions.
    """
    unmigrated_teacher, _ = UserService.create_user(
        clean_db,
        "unmigrated.teacher@edupredict.com",
        "TeacherPassword123!",
        "Unmigrated Teacher",
        "teacher",
    )

    # Create ONLY a legacy assignment
    AssignmentService.assign_teacher_to_student(
        db=clean_db,
        teacher_id=unmigrated_teacher.id,
        student_id=test_student.id,
        admin_id=ObjectId(),
    )

    client.post("/auth/login", json={
        "email": unmigrated_teacher.email,
        "password": "TeacherPassword123!",
    })

    # 1. Roster access must be empty with clear migration message
    res_roster = client.get("/api/teacher/students")
    assert res_roster.status_code == 200
    roster_data = res_roster.get_json()
    assert roster_data["count"] == 0
    assert roster_data["students"] == []
    assert "no active subject assignments" in roster_data.get("message", "").lower()

    # 2. Profile access must be rejected with 403 Forbidden (no student data disclosure)
    res_profile = client.get(f"/api/students/{test_student.id}")
    assert res_profile.status_code == 403
    profile_data = res_profile.get_json()
    assert "student" not in profile_data
    assert "not authorized" in profile_data.get("message", "").lower()

    # 3. Prediction history must be empty
    res_preds = client.get("/api/predictions")
    assert res_preds.status_code == 200
    preds_data = res_preds.get_json()
    assert preds_data["total_count"] == 0
    assert preds_data["predictions"] == []


def test_teacher_cross_term_roster_isolation(client, clean_db, test_teacher, test_admin):
    """
    Verify that a teacher assigned to a subject in Term 1 cannot see students
    enrolled in Term 2 within the roster endpoint GET /api/teacher/students.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Student 1 in 2026-T1 (aligned)
    s1, _ = UserService.create_user(clean_db, "term1.student@edupredict.com", "Password123!", "Term1 Student", "student")
    EnrollmentService.enroll_student(clean_db, s1.id, math_subj.id, "2026-T1")

    # Student 2 in 2026-T2 (unaligned)
    s2, _ = UserService.create_user(clean_db, "term2.student@edupredict.com", "Password123!", "Term2 Student", "student")
    EnrollmentService.enroll_student(clean_db, s2.id, math_subj.id, "2026-T2")

    # Teacher assigned ONLY to 2026-T1
    AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        admin_id=test_admin.id,
    )

    client.post("/auth/login", json={
        "email": test_teacher.email,
        "password": "TeacherPassword123!",
    })

    # Query roster without term filter -> returns ONLY 2026-T1 student
    res_roster = client.get("/api/teacher/students")
    assert res_roster.status_code == 200
    data = res_roster.get_json()
    assert data["count"] == 1
    assert data["students"][0]["id"] == str(s1.id)

    # Attempting to query student 2's profile -> 403 Forbidden
    res_s2_prof = client.get(f"/api/students/{s2.id}")
    assert res_s2_prof.status_code == 403


def test_student_cannot_access_teacher_or_admin_endpoints(client, test_student):
    """Verify student is forbidden from instructor and administrative endpoints."""
    client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })

    # Student accessing teacher endpoint -> 403
    assert client.get("/api/teacher/students").status_code == 403

    # Student accessing admin endpoint -> 403
    assert client.get("/api/admin/users").status_code == 403


def test_admin_can_access_any_student(client, test_admin, test_student):
    """Verify system administrator can view any student profile."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    res = client.get(f"/api/students/{test_student.id}")
    assert res.status_code == 200
    assert res.get_json()["student"]["email"] == test_student.email


def test_invalid_student_id_format(client, test_admin):
    """Verify invalid ObjectId strings return 400 Bad Request."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    res = client.get("/api/students/invalid-non-hex-id")
    assert res.status_code == 400


def test_nonexistent_student_returns_404(client, test_admin):
    """Verify non-existent student ObjectId returns 404 Not Found."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    non_existent = ObjectId()
    res = client.get(f"/api/students/{non_existent}")
    assert res.status_code == 404
