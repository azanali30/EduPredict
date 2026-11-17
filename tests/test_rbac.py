"""
EduPredict - Role-Based Access Control (RBAC) & Authorization Tests
Tests role restrictions, cross-student privacy, and teacher assignment boundaries.
"""

from bson import ObjectId
from backend.services.user_service import UserService
from backend.services.assignment_service import AssignmentService


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
    """Verify teacher can only access students explicitly assigned to them."""
    # Create second unassigned student
    unassigned_student, _ = UserService.create_user(
        clean_db,
        "unassigned.student@edupredict.com",
        "Password123!",
        "Unassigned Student",
        "student",
    )

    # Assign test_student to test_teacher
    AssignmentService.assign_teacher_to_student(
        db=clean_db,
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        admin_id=ObjectId(),
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
