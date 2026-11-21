"""
EduPredict - Self-Service Profile & Forbidden-Field Security Tests (Phase 7B)
Verifies:
1. Permitted self-service profile updates for Students and Teachers.
2. Strict rejection (403 Forbidden) of privileged/forbidden fields:
   - role, student_id, employee_id, is_active, academic_info, email, password_hash
3. Strict rejection (400 Bad Request) of unauthorized or malformed fields.
4. Preservation of password hashing and Flask-Login authentication.
"""

import pytest
from bson import ObjectId
from backend.services.user_service import UserService


def test_student_self_service_update_permitted_fields(client, test_student):
    """Verify student can update personal, contact, guardian info and avatar."""
    # 1. Login as student
    login_res = client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })
    assert login_res.status_code == 200

    # 2. Patch permitted fields
    payload = {
        "full_name": "Alice Wonderland",
        "contact_number": "+1-555-0199",
        "avatar_url": "/api/uploads/avatars/avatar_alice.png",
        "personal_info": {
            "date_of_birth": "2004-05-15",
            "gender": "Female",
            "nationality": "American",
            "blood_group": "O+",
        },
        "contact_info": {
            "primary_phone": "+1-555-0199",
            "emergency_phone": "+1-555-0188",
            "residential_address": "123 Campus Way",
            "city": "Boston",
            "state": "MA",
            "postal_code": "02115",
            "country": "USA",
        },
        "guardian_info": {
            "guardian_name": "Robert Student",
            "relationship": "Father",
            "guardian_email": "robert.student@example.com",
            "guardian_phone": "+1-555-0177",
            "occupation": "Engineer",
            "address": "123 Family Rd",
        },
    }

    patch_res = client.patch("/api/me", json=payload)
    assert patch_res.status_code == 200
    data = patch_res.get_json()
    assert data["message"] == "Profile updated successfully."
    user = data["user"]
    assert user["full_name"] == "Alice Wonderland"
    assert user["contact_number"] == "+1-555-0199"
    assert user["avatar_url"] == "/api/uploads/avatars/avatar_alice.png"
    assert user["personal_info"]["blood_group"] == "O+"
    assert user["contact_info"]["city"] == "Boston"
    assert user["guardian_info"]["guardian_name"] == "Robert Student"


@pytest.mark.parametrize("forbidden_payload", [
    {"role": "admin"},
    {"student_id": "HACKED_STU_ID"},
    {"employee_id": "EMP-9999"},
    {"is_active": False},
    {"academic_info": {"gpa_score": 4.0, "academic_status": "Graduated"}},
    {"password_hash": "precomputed_hash"},
    {"password": "plain_password_override"},
    {"email": "attacker@pwned.com"},
    {"must_change_password": True},
])
def test_student_cannot_modify_forbidden_fields(client, test_student, forbidden_payload):
    """Verify non-admin student is strictly blocked with 403 when sending forbidden fields."""
    login_res = client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })
    assert login_res.status_code == 200

    patch_res = client.patch("/api/me", json=forbidden_payload)
    assert patch_res.status_code == 403
    data = patch_res.get_json()
    assert data["error"] == "Forbidden Field"
    assert "not permitted" in data["message"]


def test_teacher_self_service_update_permitted_fields(client, test_teacher):
    """Verify teacher can update personal, contact, professional info and office room."""
    # 1. Login as teacher
    login_res = client.post("/auth/login", json={
        "email": test_teacher.email,
        "password": "TeacherPassword123!",
    })
    assert login_res.status_code == 200

    # 2. Patch permitted fields
    payload = {
        "full_name": "Bob Instructor, Ph.D.",
        "contact_number": "+1-555-0822",
        "personal_info": {
            "gender": "Male",
            "nationality": "British",
        },
        "contact_info": {
            "primary_phone": "+1-555-0822",
            "city": "Cambridge",
            "state": "MA",
        },
        "professional_info": {
            "highest_qualification": "Ph.D. in Applied Mathematics",
            "institution_graduated": "MIT",
            "graduation_year": 2015,
            "specialization": "Statistical Learning",
            "total_experience_years": 9,
            "research_interests": "Predictive Educational Modeling",
        },
        "employment_info": {
            "office_room": "Science Hall 402",
        },
    }

    patch_res = client.patch("/api/me", json=payload)
    assert patch_res.status_code == 200
    data = patch_res.get_json()
    user = data["user"]
    assert user["full_name"] == "Bob Instructor, Ph.D."
    assert user["professional_info"]["highest_qualification"] == "Ph.D. in Applied Mathematics"
    assert user["employment_info"]["office_room"] == "Science Hall 402"


@pytest.mark.parametrize("forbidden_payload", [
    {"role": "admin"},
    {"employee_id": "FORGED_EMP_ID"},
    {"student_id": "STU-1234"},
    {"is_active": False},
    {"academic_info": {"program": "Ph.D."}},
    {"email": "new.email@edupredict.com"},
])
def test_teacher_cannot_modify_forbidden_fields(client, test_teacher, forbidden_payload):
    """Verify teacher is strictly blocked with 403 when sending forbidden fields."""
    login_res = client.post("/auth/login", json={
        "email": test_teacher.email,
        "password": "TeacherPassword123!",
    })
    assert login_res.status_code == 200

    patch_res = client.patch("/api/me", json=forbidden_payload)
    assert patch_res.status_code == 403
    data = patch_res.get_json()
    assert data["error"] == "Forbidden Field"


def test_unauthorized_fields_return_bad_request(client, test_student):
    """Verify unrecognized or role-incompatible fields return 400 Bad Request."""
    login_res = client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })
    assert login_res.status_code == 200

    # Students cannot send professional_info or arbitrary fields
    bad_payload = {"professional_info": {"highest_qualification": "Ph.D."}}
    patch_res = client.patch("/api/me", json=bad_payload)
    assert patch_res.status_code == 400
    assert "not an authorized editable profile attribute" in patch_res.get_json()["message"]

    arbitrary_payload = {"arbitrary_injected_column": "value"}
    patch_res2 = client.patch("/api/me", json=arbitrary_payload)
    assert patch_res2.status_code == 400


def test_legacy_put_full_name_still_works(client, test_student):
    """Verify backward compatibility for PUT /api/me with single full_name."""
    login_res = client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })
    assert login_res.status_code == 200

    put_res = client.put("/api/me", json={"full_name": "Alice Wonderland Doe"})
    assert put_res.status_code == 200
    assert put_res.get_json()["user"]["full_name"] == "Alice Wonderland Doe"

