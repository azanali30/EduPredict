"""
EduPredict - Course Demand Forecasting REST API & Multi-Tenancy Tests (Phase 8B)
Module: tests.test_demand_api
Purpose: Verify authentication, RBAC, teacher subject scoping, analyst read-only PII protection,
organization isolation, untrusted client organization_id rejection, and insufficient-data handling.
"""

import pytest
from bson import ObjectId
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService


def test_unauthenticated_demand_access_denied(client):
    """Anonymous callers must receive 401 Unauthorized on all /api/demand/* endpoints."""
    assert client.get("/api/demand/overview").status_code == 401
    assert client.post("/api/demand/forecast", json={}).status_code == 401
    assert client.get("/api/demand/history").status_code == 401
    assert client.get(f"/api/demand/subject/{ObjectId()}").status_code == 401
    assert client.get("/api/demand/model-metadata").status_code == 401


def test_student_forbidden_from_demand_forecasting(client, test_student):
    """Students are strictly prohibited from accessing institutional demand forecasting (403)."""
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    assert client.get("/api/demand/overview").status_code == 403
    assert client.post("/api/demand/forecast", json={}).status_code == 403
    assert client.get("/api/demand/history").status_code == 403
    assert client.get("/api/demand/model-metadata").status_code == 403


def test_admin_forecast_generation_history_and_metadata(client, test_admin, test_student, clean_db):
    """Admin can compute live overview, generate/persist forecasts, and inspect history & metadata."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Enroll test_student across 4 terms to exercise real DB aggregation
    for term in ["2024-2025-T1", "2024-2025-T2", "2024-2025-T3", "2025-2026-T1"]:
        EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, term, test_admin.id)

    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    res_ov = client.get("/api/demand/overview?periods_ahead=1")
    assert res_ov.status_code == 200
    data = res_ov.get_json()
    assert data["summary"]["total_subjects_analyzed"] >= 2
    assert data["summary"]["overall_data_sufficiency"] == "sufficient"
    math_fc = next(f for f in data["forecasts"] if f["subject_id"] == str(math_subj.id))
    assert math_fc["terms_observed"] == 4
    assert math_fc["latest_actual_enrollment"] == 1
    assert "not confirmed registration" in data["disclaimer"].lower()

    # Persist forecast snapshot
    res_gen = client.post("/api/demand/forecast", json={"periods_ahead": 2})
    assert res_gen.status_code == 201
    assert len(res_gen.get_json()["forecasts"]) >= 2

    # Verify history and metadata endpoints
    res_hist = client.get("/api/demand/history")
    assert res_hist.status_code == 200
    assert res_hist.get_json()["total"] >= 2

    res_meta = client.get("/api/demand/model-metadata")
    assert res_meta.status_code == 200
    assert res_meta.get_json()["latest_run"]["subjects_forecasted"] >= 2


def test_insufficient_historical_data_handled_honestly(client, test_admin, clean_db):
    """When zero enrollments exist, overview must report insufficient data without fabricating counts."""
    SubjectService.ensure_canonical_subjects(clean_db)
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    res = client.get("/api/demand/overview")
    assert res.status_code == 200
    data = res.get_json()
    assert data["summary"]["overall_data_sufficiency"] == "insufficient"
    assert data["summary"]["total_latest_actual_enrollment"] == 0
    assert data["summary"]["total_predicted_enrollment"] == 0


def test_teacher_subject_scoping_and_forbidden_actions(client, test_teacher, test_admin, clean_db):
    """Teacher can only view demand forecasts for assigned subjects and cannot generate snapshots."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # Overview includes only Mathematics
    res_ov = client.get("/api/demand/overview")
    assert res_ov.status_code == 200
    subj_ids = [f["subject_id"] for f in res_ov.get_json()["forecasts"]]
    assert str(math_subj.id) in subj_ids
    assert str(port_subj.id) not in subj_ids

    # Assigned subject detail -> 200 OK
    assert client.get(f"/api/demand/subject/{math_subj.id}").status_code == 200

    # Unassigned subject detail -> 403 Forbidden
    assert client.get(f"/api/demand/subject/{port_subj.id}").status_code == 403

    # Teacher cannot trigger forecast snapshot or view admin history -> 403
    assert client.post("/api/demand/forecast", json={}).status_code == 403
    assert client.get("/api/demand/history").status_code == 403


def test_analyst_read_only_and_no_pii(client, test_analyst, test_admin, test_student, clean_db):
    """Analyst can inspect aggregate forecasts and history, cannot mutate, and receives zero PII."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2025-2026-T1", test_admin.id)

    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})

    res_ov = client.get("/api/demand/overview")
    assert res_ov.status_code == 200
    raw_text = str(res_ov.get_json())
    assert test_student.email not in raw_text
    assert test_student.full_name not in raw_text
    assert str(test_student.id) not in raw_text

    # Analyst cannot generate/save forecasts
    assert client.post("/api/demand/forecast", json={}).status_code == 403


def test_cross_organization_isolation_and_untrusted_client_org_id(client, clean_db):
    """
    Organization Alpha Admin/Analyst must NEVER see Organization Beta enrollments or forecast history,
    and client-supplied organization_id in POST /api/demand/forecast must be ignored.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    admin_a, _ = UserService.create_user(
        db=clean_db, email="admin.a@edupredict.com", plain_password="AdminPassword123!",
        full_name="Admin A", role="admin",
    )
    clean_db.users.update_one({"_id": admin_a.id}, {"$set": {"organization_id": "org-alpha"}})

    stud_b, _ = UserService.create_user(
        db=clean_db, email="stud.b@edupredict.com", plain_password="StudentPassword123!",
        full_name="Student B", role="student",
    )
    clean_db.users.update_one({"_id": stud_b.id}, {"$set": {"organization_id": "org-beta"}})

    # Enroll Org Beta student in Mathematics
    EnrollmentService.enroll_student(clean_db, stud_b.id, math_subj.id, "2025-2026-T1", admin_a.id)

    # Seed Org Beta forecast history directly
    clean_db.demand_forecasts.insert_one({
        "_id": ObjectId(),
        "subject_id": math_subj.id,
        "subject_code": "MAT",
        "subject_name": "Mathematics",
        "forecast_period": "2025-2026-T2",
        "predicted_enrollment": 99.0,
        "organization_id": "org-beta",
    })

    # Login as Admin Alpha
    client.post("/auth/login", json={"email": "admin.a@edupredict.com", "password": "AdminPassword123!"})

    # Overview must show 0 enrollments (Org Beta student excluded)
    res_ov = client.get("/api/demand/overview")
    assert res_ov.status_code == 200
    assert res_ov.get_json()["summary"]["total_latest_actual_enrollment"] == 0

    # History must NOT expose Org Beta's forecast
    res_hist = client.get("/api/demand/history")
    assert res_hist.status_code == 200
    assert res_hist.get_json()["total"] == 0

    # Attempt to spoof organization_id="org-beta" in POST /api/demand/forecast
    res_gen = client.post("/api/demand/forecast", json={"periods_ahead": 1, "organization_id": "org-beta"})
    assert res_gen.status_code == 201
    for fc in res_gen.get_json()["forecasts"]:
        assert fc["organization_id"] == "org-alpha"


def test_invalid_inputs_rejected(client, test_admin):
    """Invalid periods_ahead or subject_ids must return 400 Bad Request."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    assert client.get("/api/demand/overview?periods_ahead=0").status_code == 400
    assert client.get("/api/demand/overview?periods_ahead=10").status_code == 400
    assert client.get("/api/demand/overview?periods_ahead=abc").status_code == 400
    assert client.post("/api/demand/forecast", json={"periods_ahead": 99}).status_code == 400
