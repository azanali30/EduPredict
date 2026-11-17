"""
EduPredict - Authentication Integration Tests
Tests /auth/register, /auth/login, /auth/logout, and /api/me endpoints.
"""


def test_student_registration_success(client, clean_db):
    """Verify successful student registration returns 201 and user info."""
    payload = {
        "email": "new.student@edupredict.com",
        "password": "Password123!",
        "full_name": "New Student",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert "user" in data
    assert data["user"]["email"] == "new.student@edupredict.com"
    assert data["user"]["role"] == "student"
    assert "password_hash" not in data["user"]


def test_registration_duplicate_email_rejected(client, test_student):
    """Verify that registering with an existing email returns 409 Conflict."""
    payload = {
        "email": test_student.email,
        "password": "AnotherPassword123!",
        "full_name": "Duplicate Student",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 409
    data = response.get_json()
    assert "already exists" in data.get("message", "").lower()


def test_registration_invalid_email_format(client, clean_db):
    """Verify that malformed emails are rejected with 400 Bad Request."""
    payload = {
        "email": "invalid-email-format",
        "password": "Password123!",
        "full_name": "Test Student",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "invalid email" in data.get("message", "").lower()


def test_registration_weak_password_rejected(client, clean_db):
    """Verify that passwords shorter than 8 chars or missing digits are rejected."""
    payload = {
        "email": "student.weak@edupredict.com",
        "password": "short",
        "full_name": "Short Password Student",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert "at least 8 characters" in data.get("message", "").lower()


def test_login_success(client, test_student):
    """Verify login with correct credentials returns 200 and sets session cookie."""
    payload = {
        "email": test_student.email,
        "password": "StudentPassword123!",
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["user"]["email"] == test_student.email
    assert data["user"]["role"] == "student"

    # Verify session cookie was set
    cookies = response.headers.getlist("Set-Cookie")
    assert any("session=" in c for c in cookies)


def test_login_invalid_password(client, test_student):
    """Verify login with incorrect password returns 401 Unauthorized."""
    payload = {
        "email": test_student.email,
        "password": "WrongPassword999!",
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 401
    data = response.get_json()
    assert "invalid email or password" in data.get("message", "").lower()


def test_login_unknown_email(client, clean_db):
    """Verify login with non-existent email returns 401 Unauthorized."""
    payload = {
        "email": "unknown.user@edupredict.com",
        "password": "SomePassword123!",
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 401


def test_logout(client, test_student):
    """Verify logout terminates session."""
    # Login first
    client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })
    # Logout
    logout_res = client.post("/auth/logout")
    assert logout_res.status_code == 200

    # Subsequent request to /api/me should be 401 Unauthorized
    me_res = client.get("/api/me")
    assert me_res.status_code == 401


def test_current_user_profile_and_update(client, test_student):
    """Verify viewing and updating current user profile."""
    # Unauthenticated request fails
    assert client.get("/api/me").status_code == 401

    # Login
    client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })

    # GET profile
    res = client.get("/api/me")
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["full_name"] == "Alice Student"

    # PUT profile
    update_res = client.put("/api/me", json={"full_name": "Alice Wonderland"})
    assert update_res.status_code == 200
    assert update_res.get_json()["user"]["full_name"] == "Alice Wonderland"


def test_password_change(client, test_student):
    """Verify user can change their password and log in with the new password."""
    client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })

    # Wrong current password fails
    fail_res = client.put("/api/me/password", json={
        "current_password": "IncorrectPassword123!",
        "new_password": "NewValidPassword456!",
    })
    assert fail_res.status_code == 400

    # Valid change succeeds
    ok_res = client.put("/api/me/password", json={
        "current_password": "StudentPassword123!",
        "new_password": "NewValidPassword456!",
    })
    assert ok_res.status_code == 200

    # Logout and log back in with new password
    client.post("/auth/logout")
    login_new = client.post("/auth/login", json={
        "email": test_student.email,
        "password": "NewValidPassword456!",
    })
    assert login_new.status_code == 200
