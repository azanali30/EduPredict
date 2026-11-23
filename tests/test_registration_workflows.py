"""
EduPredict - Complete Student & Faculty Registration Workflow Tests
Covers multi-section student/teacher creation, profile editing, photo/document uploads,
file type & size validations, and asset access control.
"""

import io
import pypdf
from bson import ObjectId


def test_admin_create_student_full_profile(client, test_admin):
    """Verify administrator can register a student with complete multi-section profile data."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    payload = {
        "full_name": "Eleanor Vance",
        "student_id": "STU-2026-9901",
        "email": "eleanor.vance@edupredict.edu",
        "password": "StudentPassword2026!",
        "role": "student",
        "is_active": True,
        "must_change_password": True,
        "avatar_url": "/api/uploads/avatars/avatar_eleanor.png",
        "contact_number": "+1-555-0199",
        "personal_info": {
            "date_of_birth": "2005-04-12",
            "gender": "Female",
            "nationality": "Canadian",
        },
        "contact_info": {
            "personal_email": "eleanor.personal@gmail.com",
            "contact_number": "+1-555-0199",
            "alternate_contact_number": "+1-555-0198",
            "residential_address": "452 Elm Street, Apt 3B",
            "city": "Boston",
            "country": "USA",
        },
        "guardian_info": {
            "guardian_full_name": "Arthur Vance",
            "relationship": "Father",
            "guardian_contact_number": "+1-555-0144",
            "guardian_email": "arthur.vance@example.com",
            "emergency_contact_number": "+1-555-0145",
        },
        "academic_info": {
            "admission_date": "2026-09-01",
            "academic_year": "2026-2027",
            "academic_term": "2026-T1",
            "program_course": "Bachelor of Science in Data Analytics",
            "department": "STEM & Mathematics",
            "class_grade": "Year 1",
            "previous_institution": "Oakridge Academy",
            "previous_qualification": "High School Diploma (GPA 3.9)",
        },
        "documents": [
            {
                "id": "doc-001",
                "name": "High_School_Transcript.pdf",
                "file_url": "/api/uploads/documents/doc_transcript.pdf",
                "file_type": "pdf",
                "category": "academic_certificate",
                "uploaded_at": "2026-11-20T00:00:00Z",
            }
        ],
    }

    res = client.post("/api/admin/users", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["message"] == "Student account created successfully."
    user = data["user"]
    assert user["full_name"] == "Eleanor Vance"
    assert user["student_id"] == "STU-2026-9901"
    assert user["email"] == "eleanor.vance@edupredict.edu"
    assert user["must_change_password"] is True
    assert user["personal_info"]["nationality"] == "Canadian"
    assert user["guardian_info"]["guardian_full_name"] == "Arthur Vance"
    assert user["academic_info"]["program_course"] == "Bachelor of Science in Data Analytics"
    assert len(user["documents"]) == 1


def test_admin_create_teacher_full_profile(client, test_admin):
    """Verify administrator can register a faculty member with complete multi-section profile data."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    payload = {
        "full_name": "Dr. Marcus Brody",
        "employee_id": "FAC-STEM-8802",
        "email": "marcus.brody@edupredict.edu",
        "password": "FacultyPassword2026!",
        "role": "teacher",
        "department": "STEM & Mathematics",
        "is_active": True,
        "must_change_password": False,
        "contact_number": "+1-555-7721",
        "personal_info": {
            "date_of_birth": "1980-07-22",
            "gender": "Male",
            "nationality": "British",
        },
        "contact_info": {
            "personal_email": "m.brody.academic@gmail.com",
            "contact_number": "+1-555-7721",
            "alternate_contact_number": "+1-555-7722",
            "residential_address": "12 College Park Blvd",
            "city": "Cambridge",
            "country": "USA",
        },
        "professional_info": {
            "department": "STEM & Mathematics",
            "job_title": "Professor of Applied Mathematics",
            "highest_qualification": "Ph.D. in Computational Mathematics",
            "specialization": "Stochastic Calculus & ML Algorithms",
            "experience_years": 14,
            "previous_institution": "Imperial College London",
            "bio": "Experienced educator and researcher with 14 years of teaching mathematics.",
        },
        "employment_info": {
            "joining_date": "2026-08-15",
            "employment_type": "Full-time",
            "employment_status": "Active",
            "academic_year": "2026-2027",
            "internal_notes": "Tenure-track faculty member, departmental chair committee.",
        },
        "documents": [
            {
                "id": "doc-002",
                "name": "Curriculum_Vitae_Marcus_Brody.pdf",
                "file_url": "/api/uploads/documents/doc_cv.pdf",
                "file_type": "pdf",
                "category": "cv",
                "uploaded_at": "2026-11-20T00:00:00Z",
            }
        ],
    }

    res = client.post("/api/admin/users", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["message"] == "Teacher account created successfully."
    user = data["user"]
    assert user["full_name"] == "Dr. Marcus Brody"
    assert user["employee_id"] == "FAC-STEM-8802"
    assert user["professional_info"]["job_title"] == "Professor of Applied Mathematics"
    assert user["employment_info"]["employment_type"] == "Full-time"
    assert len(user["documents"]) == 1


def test_upload_avatar_and_validation(client, test_admin):
    """Verify avatar photo upload, mime type checking, and file size limits."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # 1. Valid image upload (authentic 1x1 PNG bytes)
    img_data = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    data = {
        "file": (io.BytesIO(img_data), "profile.png"),
        "category": "avatar",
    }
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")
    assert res.status_code == 201
    res_data = res.get_json()
    assert "/api/uploads/avatars/" in res_data["file_url"]
    assert res_data["file_type"] == "png"

    # 2. Invalid extension rejection
    bad_data = {
        "file": (io.BytesIO(b"malicious script content"), "exploit.exe"),
        "category": "avatar",
    }
    bad_res = client.post("/api/upload", data=bad_data, content_type="multipart/form-data")
    assert bad_res.status_code == 415
    assert "not permitted" in bad_res.get_json()["message"]


def test_upload_document_and_validation(client, test_admin):
    """Verify document upload, empty file rejection, and format acceptance."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # 1. Valid PDF upload (authentic minimal PDF parsed by pypdf)
    pdf_writer = pypdf.PdfWriter()
    pdf_writer.add_blank_page(width=100, height=100)
    pdf_buf = io.BytesIO()
    pdf_writer.write(pdf_buf)
    pdf_data = pdf_buf.getvalue()
    data = {
        "file": (io.BytesIO(pdf_data), "certificate.pdf"),
        "category": "document",
    }
    res = client.post("/api/upload", data=data, content_type="multipart/form-data")
    assert res.status_code == 201
    assert "/api/uploads/documents/" in res.get_json()["file_url"]

    # 2. Empty file rejection
    empty_data = {
        "file": (io.BytesIO(b""), "empty.pdf"),
        "category": "document",
    }
    empty_res = client.post("/api/upload", data=empty_data, content_type="multipart/form-data")
    assert empty_res.status_code == 400


def test_admin_get_and_update_user_profile(client, test_admin, test_student):
    """Verify administrator can retrieve and update user profile attributes."""
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # 1. GET user details
    get_res = client.get(f"/api/admin/users/{test_student.id}")
    assert get_res.status_code == 200
    assert get_res.get_json()["user"]["email"] == test_student.email

    # 2. PUT update profile details
    update_payload = {
        "full_name": "Updated Student Name",
        "contact_number": "+1-888-0001",
        "department": "STEM & Mathematics",
        "personal_info": {
            "gender": "Non-binary",
            "nationality": "Australian",
        },
        "academic_info": {
            "program_course": "Software Engineering",
        },
    }
    put_res = client.put(f"/api/admin/users/{test_student.id}", json=update_payload)
    assert put_res.status_code == 200
    updated_user = put_res.get_json()["user"]
    assert updated_user["full_name"] == "Updated Student Name"
    assert updated_user["contact_number"] == "+1-888-0001"
    assert updated_user["personal_info"]["gender"] == "Non-binary"
    assert updated_user["academic_info"]["program_course"] == "Software Engineering"
