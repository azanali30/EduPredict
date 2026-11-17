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
