"""
EduPredict - Student Dropout REST API & RBAC Test Suite (Phase 8A)
Module: tests.test_dropout_api
Purpose: Verify authentication, role-based authorization, subject-scoped teacher access,
student self-only isolation, analyst N<5 cell suppression, input validation, and audit logging.
"""

import pytest
from bson import ObjectId
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService
from backend.services.dropout_service import DropoutService
from backend.models.academic_record_model import AcademicRecord


def test_unauthenticated_dropout_access_denied(client):
    """All dropout endpoints must reject unauthenticated requests with 401 Unauthorized."""
    endpoints = [
        ("GET", "/api/dropout/admin/overview"),
        ("GET", "/api/dropout/analyst/overview"),
        ("GET", "/api/dropout/teacher/roster"),
        ("GET", f"/api/dropout/student/{ObjectId()}"),
        ("GET", "/api/dropout/model-metadata"),
        ("POST", "/api/dropout/predict"),
    ]
    for method, path in endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={"student_id": str(ObjectId())})
        assert res.status_code == 401, f"{method} {path} should return 401 for anonymous caller."
        assert "authentication required" in res.get_json().get("message", "").lower()


def test_admin_overview_and_metadata(client, test_admin, clean_db):
    """Administrator can view institution-wide dropout metrics and full model metadata."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    res_overview = client.get("/api/dropout/admin/overview")
    assert res_overview.status_code == 200
    data = res_overview.get_json()
    assert "total_assessed" in data
    assert "risk_distribution" in data
    assert "recent_high_risk" in data
    assert "model_metadata" in data

    res_meta = client.get("/api/dropout/model-metadata")
    assert res_meta.status_code == 200
    meta = res_meta.get_json()["metadata"]
    assert "Dropout" in meta["model_version"]
    assert "test_metrics" in meta
    assert meta["test_metrics"]["roc_auc"] >= 0.85


def test_analyst_overview_privacy_and_suppression(client, test_analyst, test_admin, test_student, clean_db):
    """
    Analyst role:
    1. Accesses aggregate dropout overview with N < 5 cell suppression.
    2. Small counts (<5) must be suppressed with display '<5' and suppressed: True.
    3. Strictly denied from accessing individual student PII (403 Forbidden).
    """
    # Create a student assessment
    res_rec, _, _ = DropoutService.record_student_assessment(
        db=clean_db,
        student_id=test_student.id,
        features_input={
            "Tuition fees up to date": 0,
            "Curricular units 1st sem (approved)": 0,
            "Curricular units 2nd sem (approved)": 0,
            "Curricular units 1st sem (grade)": 0.0,
            "Curricular units 2nd sem (grade)": 0.0,
        },
        actor_user=test_admin,
    )
    assigned_tier = res_rec["risk_tier"]

    # Login as Analyst
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})

    # 1. Aggregate overview
    res_overview = client.get("/api/dropout/analyst/overview")
    assert res_overview.status_code == 200
    data = res_overview.get_json()
    assert "privacy_notice" in data
    assert "Statistical Disclosure Control" in data["privacy_notice"]
    assert "model_summary" in data

    # Since total count is 1 (< 5), partition suppression is active
    risk_dist = data["risk_distribution"]
    assert risk_dist[assigned_tier]["suppressed"] is True
    assert risk_dist[assigned_tier]["display"] == "<5"
    assert data["total_assessed"]["suppressed"] is True
    assert data["total_assessed"]["display"] == "<5"

    # 2. Individual student record lookup is strictly 403 Forbidden
    res_student = client.get(f"/api/dropout/student/{test_student.id}")
    assert res_student.status_code == 403
    assert "restricted from accessing individual student pii" in res_student.get_json().get("message", "").lower()


def test_student_access_scoping(client, test_student, test_admin, clean_db):
    """
    Student role:
    1. Can view own dropout assessment.
    2. Strictly denied from viewing another student's assessment (403).
    3. Strictly denied from admin/roster/predict endpoints (403).
    """
    other_student, _ = UserService.create_user(
        db=clean_db,
        email="other.student@edupredict.com",
        plain_password="StudentPassword123!",
        full_name="Bob Peer",
        role="student",
    )

    # Seed genuine academic record for test_student
    clean_db.academic_records.insert_one(
        AcademicRecord(
            student_id=test_student.id,
            term="2025-2026-T1",
            attendance_percentage=88.0,
            study_hours_per_week=14.0,
            assignment_completion_rate=85.0,
            quiz_average=74.0,
            previous_exam_marks=76.0,
        ).to_doc()
    )

    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})

    # 1. View self assessment
    res_self = client.get(f"/api/dropout/student/{test_student.id}")
    assert res_self.status_code == 200
    self_data = res_self.get_json()["assessment"]
    assert self_data["student_id"] == str(test_student.id)
    assert self_data["requires_human_review"] is True
    assert "disclaimer" in self_data

    # 2. View other student
    res_other = client.get(f"/api/dropout/student/{other_student.id}")
    assert res_other.status_code == 403
    assert "not authorized" in res_other.get_json().get("message", "").lower()

    # 3. Denied admin and predict endpoints
    assert client.get("/api/dropout/admin/overview").status_code == 403
    assert client.get("/api/dropout/teacher/roster").status_code == 403
    assert client.post("/api/dropout/predict", json={"student_id": str(test_student.id)}).status_code == 403


def test_teacher_subject_scoped_access(client, test_teacher, test_admin, test_student, clean_db):
    """
    Teacher role:
    1. Can view assigned student dropout assessment.
    2. Strictly denied from viewing unassigned student dropout assessment (403).
    3. Roster is scoped strictly to students enrolled in teacher's assigned subjects.
    4. Denied from admin endpoints (403).
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    term = "2025-2026-T1"

    # Assign teacher to Mathematics
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, term, test_admin.id)

    # Enroll test_student in Mathematics
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, term, test_admin.id)

    # Seed genuine academic record for test_student
    clean_db.academic_records.insert_one(
        AcademicRecord(
            student_id=test_student.id,
            term=term,
            attendance_percentage=90.0,
            study_hours_per_week=15.0,
            assignment_completion_rate=85.0,
            quiz_average=75.0,
            previous_exam_marks=78.0,
        ).to_doc()
    )

    # Create unassigned student B
    unassigned_student, _ = UserService.create_user(
        db=clean_db,
        email="unassigned.student@edupredict.com",
        plain_password="StudentPassword123!",
        full_name="Dave Unlinked",
        role="student",
    )

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # 1. Assigned student lookup -> 200 OK
    res_assigned = client.get(f"/api/dropout/student/{test_student.id}")
    assert res_assigned.status_code == 200
    assert res_assigned.get_json()["assessment"]["student_id"] == str(test_student.id)

    # 2. Unassigned student lookup -> 403 Forbidden
    res_unassigned = client.get(f"/api/dropout/student/{unassigned_student.id}")
    assert res_unassigned.status_code == 403
    assert "not authorized" in res_unassigned.get_json().get("message", "").lower()

    # 3. Teacher roster includes assigned student
    res_roster = client.get("/api/dropout/teacher/roster")
    assert res_roster.status_code == 200
    students_in_roster = res_roster.get_json()["students"]
    roster_ids = [s["student_id"] for s in students_in_roster]
    assert str(test_student.id) in roster_ids
    assert str(unassigned_student.id) not in roster_ids

    # 4. Denied admin overview
    assert client.get("/api/dropout/admin/overview").status_code == 403


def test_predict_endpoint_validation_and_leakage(client, test_admin, test_student, clean_db):
    """POST /api/dropout/predict enforces payload validation, leakage guard, and persistence."""
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    # Missing student_id
    res_missing = client.post("/api/dropout/predict", json={})
    assert res_missing.status_code == 400
    assert "'student_id' is required" in res_missing.get_json().get("message", "")

    # Target leakage attempt
    res_leakage = client.post("/api/dropout/predict", json={
        "student_id": str(test_student.id),
        "features": {
            "Admission grade": 140.0,
            "Target": "Dropout",  # Target column injected
        }
    })
    assert res_leakage.status_code == 400
    assert "target leakage detected" in res_leakage.get_json().get("message", "").lower()

    # Valid evaluation
    res_valid = client.post("/api/dropout/predict", json={
        "student_id": str(test_student.id),
        "features": {
            "Admission grade": 145.0,
            "Tuition fees up to date": 1,
            "Curricular units 1st sem (approved)": 6,
            "Curricular units 1st sem (grade)": 15.0,
        },
        "academic_term": "2025-2026-T1",
    })
    assert res_valid.status_code == 201
    assessment = res_valid.get_json()["assessment"]
    assert assessment["risk_tier"] == "Low"
    assert assessment["requires_human_review"] is True
    assert len(assessment["recommendations"]) > 0

    # Verify persisted in database
    saved_doc = clean_db.dropout_records.find_one({"student_id": test_student.id})
    assert saved_doc is not None
    assert saved_doc["risk_tier"] == "Low"


def test_unavailable_academic_record_returns_422(client, test_student, test_admin, clean_db):
    """
    When a student has NO academic record and no explicit features are provided,
    both GET /api/dropout/student/<id> and POST /api/dropout/predict must return 422
    rather than silently fabricating a risk prediction from defaults.
    """
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    res_get = client.get(f"/api/dropout/student/{test_student.id}")
    assert res_get.status_code == 422
    assert "unavailable" in res_get.get_json().get("message", "").lower()

    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    res_post = client.post("/api/dropout/predict", json={"student_id": str(test_student.id)})
    assert res_post.status_code == 422
    assert "insufficient academic data" in res_post.get_json().get("message", "").lower()


def test_predict_uses_real_academic_record_and_stores_snapshot(client, test_admin, test_student, clean_db):
    """
    POST /api/dropout/predict without explicit features reads MongoDB academic_records,
    maps only defensible fields, and stores the exact snapshot used for inference.
    """
    clean_db.academic_records.insert_one(
        AcademicRecord(
            student_id=test_student.id,
            term="2025-2026-T1",
            attendance_percentage=40.0,
            study_hours_per_week=4.0,
            assignment_completion_rate=25.0,
            quiz_average=35.0,
            previous_exam_marks=30.0,
        ).to_doc()
    )

    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    res = client.post("/api/dropout/predict", json={
        "student_id": str(test_student.id),
        "academic_term": "2025-2026-T1",
    })
    assert res.status_code == 201
    assessment = res.get_json()["assessment"]
    assert assessment["feature_source"] == "academic_record_mapping"
    snapshot = assessment["features_snapshot"]
    # Mapped from previous_exam_marks=30.0 -> 6.0/20
    assert snapshot["Curricular units 1st sem (grade)"] == 6.0
    # Uncollected financial/demographic fields must remain None (not fabricated)
    assert snapshot["Tuition fees up to date"] is None
    assert snapshot["Debtor"] is None
    assert snapshot["Marital status"] is None


def test_teacher_term_mismatch_denied(client, test_teacher, test_admin, test_student, clean_db):
    """
    Teacher assigned to Mathematics in 2025-2026-T1 must NOT access or see a student
    who is only enrolled in Mathematics in 2024-2025-T2 (term mismatch).
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2024-2025-T2", test_admin.id)

    clean_db.academic_records.insert_one(
        AcademicRecord(
            student_id=test_student.id,
            term="2024-2025-T2",
            attendance_percentage=80.0,
            study_hours_per_week=10.0,
            assignment_completion_rate=75.0,
            quiz_average=70.0,
            previous_exam_marks=72.0,
        ).to_doc()
    )

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # Direct student lookup -> 403 Forbidden
    res_get = client.get(f"/api/dropout/student/{test_student.id}")
    assert res_get.status_code == 403

    # Predict with mismatched term -> 403 Forbidden
    res_post = client.post("/api/dropout/predict", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "academic_term": "2024-2025-T2",
    })
    assert res_post.status_code == 403

    # Teacher roster must NOT include student from different term
    res_roster = client.get("/api/dropout/teacher/roster")
    assert res_roster.status_code == 200
    assert res_roster.get_json()["students"] == []

