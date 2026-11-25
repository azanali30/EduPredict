"""
EduPredict - Course Demand Forecasting REST API & Multi-Tenancy Tests (Phase 8B)
Module: tests.test_demand_api
Purpose: Verify authentication, fail-closed organization context enforcement, RBAC,
teacher subject scoping, analyst read-only PII protection, pagination bounds, and input validation.
"""

import pytest
from bson import ObjectId
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService


def _set_org(db, user, org_id: str):
    db.users.update_one({"_id": user.id}, {"$set": {"organization_id": org_id}})
    user.organization_id = org_id


def test_unauthenticated_demand_access_denied(client):
    """Anonymous callers must receive 401 Unauthorized on all /api/demand/* endpoints."""
    assert client.get("/api/demand/overview").status_code == 401
    assert client.post("/api/demand/forecast", json={}).status_code == 401
    assert client.get("/api/demand/history").status_code == 401
    assert client.get(f"/api/demand/subject/{ObjectId()}").status_code == 401
    assert client.get("/api/demand/model-metadata").status_code == 401


def test_missing_organization_context_fails_closed(client, test_admin, test_analyst, test_teacher, clean_db):
    """
    Admin, Analyst, and Teacher without a valid organization_id must be rejected (403 Forbidden)
    and must NEVER gain unrestricted cross-organization access.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Admin without organization_id
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    assert client.get("/api/demand/overview").status_code == 403
    assert client.post("/api/demand/forecast", json={}).status_code == 403
    assert client.get("/api/demand/history").status_code == 403
    assert client.get(f"/api/demand/subject/{math_subj.id}").status_code == 403
    assert client.get("/api/demand/model-metadata").status_code == 403

    # Analyst without organization_id
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})
    assert client.get("/api/demand/overview").status_code == 403
    assert client.get("/api/demand/history").status_code == 403
    assert client.get("/api/demand/model-metadata").status_code == 403

    # Teacher without organization_id
    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})
    assert client.get("/api/demand/overview").status_code == 403
    assert client.get(f"/api/demand/subject/{math_subj.id}").status_code == 403


def test_student_forbidden_from_demand_forecasting(client, test_student):
    """Students are strictly prohibited from accessing institutional demand forecasting (403)."""
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    assert client.get("/api/demand/overview").status_code == 403
    assert client.post("/api/demand/forecast", json={}).status_code == 403
    assert client.get("/api/demand/history").status_code == 403
    assert client.get("/api/demand/model-metadata").status_code == 403


def test_admin_forecast_generation_history_and_metadata(client, test_admin, test_student, clean_db):
    """Org-scoped Admin can compute overview, generate/persist forecasts, and inspect history & metadata."""
    _set_org(clean_db, test_admin, "org-alpha")
    _set_org(clean_db, test_student, "org-alpha")

    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    for term in ["2024-2025-T1", "2024-2025-T2", "2024-2025-T3", "2025-2026-T1"]:
        EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, term, test_admin.id)

    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    res_ov = client.get("/api/demand/overview?periods_ahead=1")
    assert res_ov.status_code == 200
    data = res_ov.get_json()
    assert data["summary"]["organization_id"] == "org-alpha"
    assert data["summary"]["total_subjects_analyzed"] >= 2
    assert data["summary"]["overall_data_sufficiency"] == "sufficient"
    math_fc = next(f for f in data["forecasts"] if f["subject_id"] == str(math_subj.id))
    assert math_fc["terms_observed"] == 4
    assert math_fc["validation_status"] == "experimental"
    assert math_fc["demand_tier"] == "Unclassified"  # No capacity configured
    assert math_fc["is_calibrated_confidence_interval"] is False

    res_gen = client.post("/api/demand/forecast", json={"periods_ahead": 2})
    assert res_gen.status_code == 201
    assert len(res_gen.get_json()["forecasts"]) >= 2

    res_hist = client.get("/api/demand/history")
    assert res_hist.status_code == 200
    assert res_hist.get_json()["total"] >= 2

    res_meta = client.get("/api/demand/model-metadata")
    assert res_meta.status_code == 200
    assert res_meta.get_json()["organization_id"] == "org-alpha"
    assert res_meta.get_json()["latest_run"]["subjects_forecasted"] >= 2


def test_insufficient_historical_data_handled_honestly(client, test_admin, clean_db):
    """When zero enrollments exist, overview reports insufficient data without fabricating counts."""
    _set_org(clean_db, test_admin, "org-alpha")
    SubjectService.ensure_canonical_subjects(clean_db)
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    res = client.get("/api/demand/overview")
    assert res.status_code == 200
    data = res.get_json()
    assert data["summary"]["overall_data_sufficiency"] == "insufficient"
    assert data["summary"]["total_latest_actual_enrollment"] == 0
    assert data["summary"]["total_predicted_enrollment"] == 0


def test_teacher_subject_scoping_and_forbidden_actions(client, test_teacher, test_admin, clean_db):
    """Org-scoped Teacher sees only assigned subjects and cannot generate snapshots."""
    _set_org(clean_db, test_teacher, "org-alpha")
    _set_org(clean_db, test_admin, "org-alpha")

    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    res_ov = client.get("/api/demand/overview")
    assert res_ov.status_code == 200
    subj_ids = [f["subject_id"] for f in res_ov.get_json()["forecasts"]]
    assert str(math_subj.id) in subj_ids
    assert str(port_subj.id) not in subj_ids

    assert client.get(f"/api/demand/subject/{math_subj.id}").status_code == 200
    assert client.get(f"/api/demand/subject/{port_subj.id}").status_code == 403
    assert client.post("/api/demand/forecast", json={}).status_code == 403
    assert client.get("/api/demand/history").status_code == 403


def test_analyst_read_only_and_no_pii(client, test_analyst, test_admin, test_student, clean_db):
    """Org-scoped Analyst gets aggregate forecasts with zero PII and cannot mutate."""
    _set_org(clean_db, test_analyst, "org-alpha")
    _set_org(clean_db, test_admin, "org-alpha")
    _set_org(clean_db, test_student, "org-alpha")

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
    assert client.post("/api/demand/forecast", json={}).status_code == 403


def test_cross_organization_isolation_metadata_history_and_enrollments(client, clean_db):
    """
    Organization Alpha Admin/Analyst must NEVER access Organization Beta's:
    - enrollment records
    - forecast history
    - model metadata
    and client-supplied organization_id in POST /api/demand/forecast must be ignored.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    admin_a, _ = UserService.create_user(
        db=clean_db, email="admin.a@edupredict.com", plain_password="AdminPassword123!",
        full_name="Admin A", role="admin",
    )
    _set_org(clean_db, admin_a, "org-alpha")

    analyst_a, _ = UserService.create_user(
        db=clean_db, email="analyst.a@edupredict.com", plain_password="AnalystPassword123!",
        full_name="Analyst A", role="analyst",
    )
    _set_org(clean_db, analyst_a, "org-alpha")

    stud_b, _ = UserService.create_user(
        db=clean_db, email="stud.b@edupredict.com", plain_password="StudentPassword123!",
        full_name="Student B", role="student",
    )
    _set_org(clean_db, stud_b, "org-beta")

    EnrollmentService.enroll_student(clean_db, stud_b.id, math_subj.id, "2025-2026-T1", admin_a.id)

    # Seed Org Beta forecast history & model metadata directly
    clean_db.demand_forecasts.insert_one({
        "_id": ObjectId(),
        "subject_id": math_subj.id,
        "subject_code": "MAT",
        "subject_name": "Mathematics",
        "forecast_period": "2025-2026-T2",
        "predicted_enrollment": 99.0,
        "organization_id": "org-beta",
    })
    clean_db.demand_model_metadata.insert_one({
        "_id": ObjectId(),
        "organization_id": "org-beta",
        "subjects_forecasted": 12,
        "average_mae": 1.23,
    })

    # Login as Admin Alpha
    client.post("/auth/login", json={"email": "admin.a@edupredict.com", "password": "AdminPassword123!"})

    res_ov = client.get("/api/demand/overview")
    assert res_ov.status_code == 200
    assert res_ov.get_json()["summary"]["total_latest_actual_enrollment"] == 0

    res_hist = client.get("/api/demand/history")
    assert res_hist.status_code == 200
    assert res_hist.get_json()["total"] == 0

    res_meta = client.get("/api/demand/model-metadata")
    assert res_meta.status_code == 200
    assert res_meta.get_json()["latest_run"]["subjects_forecasted"] == 0

    # Spoof attempt on POST /api/demand/forecast
    res_gen = client.post("/api/demand/forecast", json={"periods_ahead": 1, "organization_id": "org-beta"})
    assert res_gen.status_code == 201
    for fc in res_gen.get_json()["forecasts"]:
        assert fc["organization_id"] == "org-alpha"
        assert fc["latest_actual_enrollment"] is None  # Org Beta student not counted!


def test_pagination_and_input_validation(client, test_admin, clean_db):
    """Pagination bounds, invalid subject_id, periods_ahead, and forecast_period overrides return 400."""
    _set_org(clean_db, test_admin, "org-alpha")
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    assert client.get("/api/demand/overview?periods_ahead=0").status_code == 400
    assert client.get("/api/demand/overview?periods_ahead=10").status_code == 400
    assert client.get("/api/demand/overview?periods_ahead=abc").status_code == 400
    assert client.get("/api/demand/overview?forecast_period=" + "X" * 70).status_code == 400
    assert client.post("/api/demand/forecast", json={"periods_ahead": 99}).status_code == 400
    assert client.get("/api/demand/subject/not-an-objectid").status_code == 400
    assert client.get("/api/demand/history?page=0").status_code == 400
    assert client.get("/api/demand/history?limit=0").status_code == 400
    assert client.get("/api/demand/history?limit=500").status_code == 400
