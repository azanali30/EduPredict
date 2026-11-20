"""
EduPredict - Administrative Management Tests
Tests /api/admin/users, /api/admin/users/<id>/role, /api/admin/assignments, and CLI commands.
"""

from bson import ObjectId
from backend.services.user_service import UserService


def test_admin_list_users(client, test_admin, test_student, test_teacher):
    """Verify administrator can retrieve the user directory."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    res = client.get("/api/admin/users")
    assert res.status_code == 200
    data = res.get_json()
    assert data["count"] >= 3
    emails = [u["email"] for u in data["users"]]
    assert test_student.email in emails
    assert test_teacher.email in emails
    assert test_admin.email in emails


def test_admin_update_user_role(client, test_admin, test_student):
    """Verify administrator can promote a student to a teacher."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # Update student to teacher
    res = client.put(f"/api/admin/users/{test_student.id}/role", json={"role": "teacher"})
    assert res.status_code == 200
    assert res.get_json()["user"]["role"] == "teacher"


def test_admin_cannot_demote_self(client, test_admin):
    """Verify administrator cannot remove their own admin role."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    res = client.put(f"/api/admin/users/{test_admin.id}/role", json={"role": "student"})
    assert res.status_code == 400
    assert "cannot remove their own administrator privileges" in res.get_json()["message"].lower()


def test_admin_create_assignment_success(client, test_admin, test_teacher, test_student):
    """Verify administrator can assign a teacher to a student."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    payload = {
        "teacher_id": str(test_teacher.id),
        "student_id": str(test_student.id),
    }
    res = client.post("/api/admin/assignments", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["assignment"]["teacher_id"] == str(test_teacher.id)
    assert data["assignment"]["student_id"] == str(test_student.id)


def test_admin_assignment_invalid_roles_rejected(client, test_admin, test_student):
    """Verify assigning non-teacher as teacher is rejected with 400 Bad Request."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # Student cannot be assigned as a teacher
    payload = {
        "teacher_id": str(test_student.id),
        "student_id": str(test_student.id),
    }
    res = client.post("/api/admin/assignments", json=payload)
    assert res.status_code == 400


def test_admin_audit_logs(client, test_admin):
    """Verify administrator can inspect the system audit logs."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    res = client.get("/api/admin/logs")
    assert res.status_code == 200
    data = res.get_json()
    assert "logs" in data
    assert len(data["logs"]) > 0


def test_cli_create_admin_and_init_db(runner, clean_db):
    """Verify Click CLI commands 'create-admin' and 'init-db' function correctly."""
    # Test create-admin CLI
    result = runner.invoke(
        args=[
            "create-admin",
            "--email", "cli.admin@edupredict.com",
            "--name", "CLI Administrator",
            "--password", "AdminPassword123!",
        ]
    )
    assert result.exit_code == 0
    assert "Administrator successfully created" in result.output

    # Verify user exists in database with role=admin
    created = UserService.get_by_email(clean_db, "cli.admin@edupredict.com")
    assert created is not None
    assert created.role == "admin"

    # Test init-db CLI
    db_result = runner.invoke(args=["init-db"])
    assert db_result.exit_code == 0
    assert "Database initialization complete" in db_result.output


def test_admin_create_student_success(client, test_admin, clean_db):
    """Verify administrator can register a new student account."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    payload = {
        "full_name": "Marcus Aurelius",
        "email": "marcus.aurelius@student.edupredict.com",
        "password": "SecureStudentPass123!",
        "role": "student",
        "student_id": "STU-2026-901",
        "contact_number": "+1-555-0199",
        "is_active": True,
    }
    res = client.post("/api/admin/users", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["user"]["full_name"] == "Marcus Aurelius"
    assert data["user"]["email"] == "marcus.aurelius@student.edupredict.com"
    assert data["user"]["role"] == "student"
    assert data["user"]["student_id"] == "STU-2026-901"
    assert "password_hash" not in data["user"]

    # Verify password authentication works for created student
    created_user = UserService.get_by_email(clean_db, payload["email"])
    assert created_user is not None
    assert created_user.verify_password("SecureStudentPass123!")


def test_admin_create_teacher_success(client, test_admin, clean_db):
    """Verify administrator can register a new teacher account."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    payload = {
        "full_name": "Dr. Ada Lovelace",
        "email": "ada.lovelace@faculty.edupredict.com",
        "password": "FacultyPass2026!#",
        "role": "teacher",
        "employee_id": "FAC-2026-042",
        "department": "STEM & Computing",
        "contact_number": "+1-555-0142",
    }
    res = client.post("/api/admin/users", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["user"]["full_name"] == "Dr. Ada Lovelace"
    assert data["user"]["role"] == "teacher"
    assert data["user"]["employee_id"] == "FAC-2026-042"
    assert data["user"]["department"] == "STEM & Computing"


def test_admin_create_user_duplicate_email_and_id_rejected(client, test_admin):
    """Verify duplicate email or duplicate institutional ID is rejected."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # Duplicate email (test_admin's email)
    res = client.post("/api/admin/users", json={
        "full_name": "Imposter Student",
        "email": test_admin.email,
        "password": "ValidPassword123!",
        "role": "student",
        "student_id": "STU-DUP-001",
    })
    assert res.status_code == 400
    assert "already exists" in res.get_json()["message"]

    # Create first student
    client.post("/api/admin/users", json={
        "full_name": "Original Student",
        "email": "original.student@edupredict.com",
        "password": "ValidPassword123!",
        "role": "student",
        "student_id": "STU-DUP-UNIQUE",
    })

    # Duplicate student_id
    res_dup_id = client.post("/api/admin/users", json={
        "full_name": "Second Student",
        "email": "second.student@edupredict.com",
        "password": "ValidPassword123!",
        "role": "student",
        "student_id": "STU-DUP-UNIQUE",
    })
    assert res_dup_id.status_code == 400
    assert "already exists" in res_dup_id.get_json()["message"]


def test_admin_create_user_role_and_field_validations(client, test_admin):
    """Verify role restriction and required field validations."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # Cannot create admin or analyst via this endpoint
    for forbidden_role in ("admin", "analyst", "superadmin"):
        res = client.post("/api/admin/users", json={
            "full_name": "Privileged User",
            "email": f"priv_{forbidden_role}@edupredict.com",
            "password": "ValidPassword123!",
            "role": forbidden_role,
        })
        assert res.status_code == 400

    # Missing student_id for student
    res = client.post("/api/admin/users", json={
        "full_name": "No ID Student",
        "email": "noid@edupredict.com",
        "password": "ValidPassword123!",
        "role": "student",
    })
    assert res.status_code == 400
    assert "Student ID" in res.get_json()["message"]

    # Missing employee_id for teacher
    res = client.post("/api/admin/users", json={
        "full_name": "No ID Teacher",
        "email": "noid_t@edupredict.com",
        "password": "ValidPassword123!",
        "role": "teacher",
    })
    assert res.status_code == 400
    assert "Employee ID" in res.get_json()["message"]


def test_non_admin_cannot_create_user(client, test_student):
    """Verify student and unauthenticated users receive 401/403."""
    # Unauthenticated
    res = client.post("/api/admin/users", json={
        "full_name": "Anonymous Creation",
        "email": "anon@edupredict.com",
        "password": "ValidPassword123!",
        "role": "student",
        "student_id": "STU-ANON-001",
    })
    assert res.status_code == 401

    # Student login
    client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })
    res_student = client.post("/api/admin/users", json={
        "full_name": "Student Created User",
        "email": "stu_created@edupredict.com",
        "password": "ValidPassword123!",
        "role": "student",
        "student_id": "STU-001",
    })
    assert res_student.status_code == 403


def test_admin_update_user_status_and_self_guard(client, test_admin, test_student):
    """Verify admin can activate/deactivate accounts, but cannot deactivate self."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # Deactivate student
    res = client.put(f"/api/admin/users/{test_student.id}/status", json={"is_active": False})
    assert res.status_code == 200
    assert res.get_json()["user"]["is_active"] is False

    # Reactivate student
    res_reactivate = client.put(f"/api/admin/users/{test_student.id}/status", json={"is_active": True})
    assert res_reactivate.status_code == 200
    assert res_reactivate.get_json()["user"]["is_active"] is True

    # Admin attempts to deactivate self
    res_self = client.put(f"/api/admin/users/{test_admin.id}/status", json={"is_active": False})
    assert res_self.status_code == 400
    assert "cannot deactivate their own account" in res_self.get_json()["message"]
