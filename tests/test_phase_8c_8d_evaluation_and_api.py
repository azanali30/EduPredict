"""
EduPredict - Phase 8C & 8D Model Evaluation, Registry, and Integrated Prediction API Tests
Module: tests.test_phase_8c_8d_evaluation_and_api
Purpose: Verify classification evaluation metrics/curves/ECE, demand walk-forward evaluation,
model registry governance & organization isolation, bulk dropout predictions, prediction history/detail,
admin record filtering, analyst SDC-protected trends, and rate limiting.
"""

from bson import ObjectId
from backend.services.user_service import UserService
from backend.models.academic_record_model import AcademicRecord
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService
from backend.utils.rate_limiter import reset_rate_limits


def _set_org(db, user, org_id: str):
    db.users.update_one({"_id": user.id}, {"$set": {"organization_id": org_id}})
    user.organization_id = org_id


def test_evaluation_endpoints_rbac_and_metrics(client, test_admin, test_analyst, test_teacher, test_student, clean_db):
    """Admin and Analyst can access /api/models/*; Teacher and Student receive 403; unauthenticated gets 401."""
    assert client.get("/api/models/evaluation/dropout").status_code == 401
    assert client.get("/api/models/evaluation/demand").status_code == 401
    assert client.get("/api/models/registry").status_code == 401

    _set_org(clean_db, test_admin, "org-eval-a")
    _set_org(clean_db, test_analyst, "org-eval-a")
    _set_org(clean_db, test_teacher, "org-eval-a")
    _set_org(clean_db, test_student, "org-eval-a")

    # Student -> 403
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    assert client.get("/api/models/evaluation/dropout").status_code == 403
    assert client.get("/api/models/registry").status_code == 403

    # Teacher -> 403
    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})
    assert client.get("/api/models/evaluation/dropout").status_code == 403
    assert client.get("/api/models/evaluation/demand").status_code == 403

    # Analyst -> 200 on evaluation & registry, 403 on activate/deactivate
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})
    drop_res = client.get("/api/models/evaluation/dropout")
    assert drop_res.status_code == 200
    drop_data = drop_res.get_json()
    assert drop_data["domain"] == "dropout_classification"
    assert drop_data["local_institutional_validation"] is False
    assert "roc_curve" in drop_data and len(drop_data["roc_curve"]) > 2
    assert "pr_curve" in drop_data and len(drop_data["pr_curve"]) > 2
    assert "calibration_curve" in drop_data and len(drop_data["calibration_curve"]) > 0
    assert "expected_calibration_error" in drop_data
    assert "confusion_matrix" in drop_data["calibrated_champion_metrics"]
    assert len(drop_data["candidate_comparison"]) >= 1

    dem_res = client.get("/api/models/evaluation/demand")
    assert dem_res.status_code == 200
    dem_data = dem_res.get_json()
    assert dem_data["domain"] == "course_demand_forecasting"
    assert dem_data["organization_id"] == "org-eval-a"
    assert dem_data["overall_status"] in {"Insufficient Data", "insufficient_data", "baseline_only", "walk_forward_evaluated"}

    reg_res = client.get("/api/models/registry")
    assert reg_res.status_code == 200
    reg_models = reg_res.get_json()["models"]
    assert len(reg_models) >= 2
    assert client.post(
        f"/api/models/registry/{reg_models[0]['id']}/activate",
        json={"approval_notes": "Analyst should be blocked"},
    ).status_code == 403


def test_model_registry_admin_lifecycle_and_org_isolation(client, test_admin, clean_db):
    """
    Admin can activate (with mandatory approval notes) and deactivate models within their org only.
    Cross-org and global (organization_id=None) registry mutations must be rejected with 403.
    """
    _set_org(clean_db, test_admin, "org-reg-a")
    other_res = UserService.create_user(
        clean_db, "other.admin@test.com", "AdminPass123!", "Other Admin", "admin"
    )
    other_admin = other_res[0] if isinstance(other_res, tuple) else other_res
    _set_org(clean_db, other_admin, "org-reg-b")

    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    reg_res = client.get("/api/models/registry")
    assert reg_res.status_code == 200
    models = reg_res.get_json()["models"]
    org_a_model = next(m for m in models if m.get("organization_id") == "org-reg-a")
    global_model = next(m for m in models if m.get("organization_id") is None)

    # Organization Admin cannot mutate a global (organization_id=None) model -> 403
    assert client.post(
        f"/api/models/registry/{global_model['id']}/activate",
        json={"approval_notes": "Attempt global mutate"},
    ).status_code == 403
    assert client.post(f"/api/models/registry/{global_model['id']}/deactivate").status_code == 403

    # Missing approval_notes -> 400
    bad_act = client.post(f"/api/models/registry/{org_a_model['id']}/activate", json={"approval_notes": "  "})
    assert bad_act.status_code == 400

    # Valid activation on own org's model -> 200
    ok_act = client.post(
        f"/api/models/registry/{org_a_model['id']}/activate",
        json={"approval_notes": "Approved after UCI holdout & calibration review."},
    )
    assert ok_act.status_code == 200
    assert ok_act.get_json()["model"]["is_active"] is True

    # Cross-org admin (Org B) cannot activate or deactivate Org A's model -> 403
    client.post("/auth/login", json={"email": other_admin.email, "password": "AdminPass123!"})
    assert client.post(
        f"/api/models/registry/{org_a_model['id']}/activate",
        json={"approval_notes": "Cross-tenant hijack"},
    ).status_code == 403
    assert client.post(f"/api/models/registry/{org_a_model['id']}/deactivate").status_code == 403

    # Owning admin (Org A) can deactivate own org's model -> 200
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    ok_deact = client.post(f"/api/models/registry/{org_a_model['id']}/deactivate")
    assert ok_deact.status_code == 200
    assert ok_deact.get_json()["model"]["is_active"] is False


def test_phase_8d_bulk_predict_history_detail_admin_records_and_analyst_trends(
    client, test_admin, test_teacher, test_student, test_analyst, clean_db
):
    """Verify Phase 8D integrated endpoints: bulk predict, history, detail, admin records, and analyst trends."""
    _set_org(clean_db, test_admin, "org-8d")
    _set_org(clean_db, test_teacher, "org-8d")
    _set_org(clean_db, test_student, "org-8d")
    _set_org(clean_db, test_analyst, "org-8d")

    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2026-Fall", test_admin.id)
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-Fall", test_admin.id)

    ac_rec = AcademicRecord(
        student_id=test_student.id,
        term="2026-Fall",
        attendance_percentage=88.0,
        study_hours_per_week=6.0,
        assignment_completion_rate=90.0,
        quiz_average=78.0,
        previous_exam_marks=80.0,
        subject_scores={"Mathematics": 80.0},
    )
    clean_db.academic_records.insert_one(ac_rec.to_doc())

    # Admin bulk predict
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    bulk_res = client.post(
        "/api/dropout/predict/bulk",
        json={"student_ids": [str(test_student.id), str(ObjectId())], "academic_term": "2026-Fall"},
    )
    assert bulk_res.status_code == 200
    bulk_data = bulk_res.get_json()
    assert bulk_data["total_requested"] == 2
    assert bulk_data["succeeded"] == 1
    assert bulk_data["failed"] == 1

    # Admin filterable records
    rec_res = client.get("/api/dropout/admin/records?academic_term=2026-Fall")
    assert rec_res.status_code == 200
    records = rec_res.get_json()["records"]
    assert len(records) >= 1
    pred_id = records[0]["id"]

    # Student history & detail
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    hist_res = client.get(f"/api/dropout/student/{test_student.id}/history")
    assert hist_res.status_code == 200
    assert hist_res.get_json()["total"] >= 1

    det_res = client.get(f"/api/dropout/prediction/{pred_id}")
    assert det_res.status_code == 200
    assert det_res.get_json()["assessment"]["student_id"] == str(test_student.id)

    # Analyst cannot view individual history or detail (403), but CAN view SDC trends (200)
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})
    assert client.get(f"/api/dropout/student/{test_student.id}/history").status_code == 403
    assert client.get(f"/api/dropout/prediction/{pred_id}").status_code == 403

    trends_res = client.get("/api/dropout/analyst/trends")
    assert trends_res.status_code == 200
    trends_data = trends_res.get_json()
    assert len(trends_data["trends"]) == 1
    # Only 1 student assessed -> N < 5 must be suppressed
    assert trends_data["trends"][0]["total_assessed"]["suppressed"] is True
    assert trends_data["trends"][0]["total_assessed"]["display"] == "<5"


def test_rate_limiter_enforces_429_when_enabled(app, client, test_admin, test_student, clean_db):
    """Verify sliding-window rate limiter returns 429 Too Many Requests when threshold is exceeded."""
    _set_org(clean_db, test_admin, "org-rl")
    _set_org(clean_db, test_student, "org-rl")
    reset_rate_limits()
    app.config["ENFORCE_RATE_LIMIT_IN_TESTS"] = True
    try:
        client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
        # /api/dropout/predict/bulk allows 20 requests/min
        for _ in range(20):
            res = client.post("/api/dropout/predict/bulk", json={"student_ids": []})
            assert res.status_code == 400  # Validated after passing rate limiter
        blocked = client.post("/api/dropout/predict/bulk", json={"student_ids": []})
        assert blocked.status_code == 429
    finally:
        app.config["ENFORCE_RATE_LIMIT_IN_TESTS"] = False
        reset_rate_limits()


def test_fail_closed_org_isolation_and_regex_escaping(client, test_admin, test_analyst, clean_db):
    """
    Verify fail-closed 403 when organization_id is missing on Admin/Analyst, cross-org isolation,
    and safe re.escape() handling of special/invalid regex characters in search.
    """
    # 1. Admin without organization_id -> 403
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    assert client.get("/api/dropout/admin/records").status_code == 403

    # 2. Analyst without organization_id -> 403
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})
    assert client.get("/api/dropout/analyst/trends").status_code == 403

    # Seed records in org-iso-a and org-iso-b
    _set_org(clean_db, test_admin, "org-iso-a")
    _set_org(clean_db, test_analyst, "org-iso-a")
    clean_db.dropout_records.insert_many([
        {
            "_id": ObjectId(),
            "student_id": ObjectId(),
            "student_name": "Alice [Special.*]",
            "risk_probability": 0.25,
            "risk_tier": "Low",
            "model_version": "v1",
            "academic_term": "2026-Fall",
            "organization_id": "org-iso-a",
        },
        {
            "_id": ObjectId(),
            "student_id": ObjectId(),
            "student_name": "Bob OrgB",
            "risk_probability": 0.85,
            "risk_tier": "High",
            "model_version": "v1",
            "academic_term": "2026-Fall",
            "organization_id": "org-iso-b",
        },
    ])

    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    # Admin A sees only org-iso-a records
    res_all = client.get("/api/dropout/admin/records")
    assert res_all.status_code == 200
    assert res_all.get_json()["total"] == 1
    assert res_all.get_json()["records"][0]["student_name"] == "Alice [Special.*]"

    # Special regex '.*' must NOT match 'Alice' unless literal '.*' is in the name;
    # Test with '.*+' which is NOT in Alice's name -> 0 results (proving no regex injection)
    res_rx = client.get("/api/dropout/admin/records?search=.*%2B")
    assert res_rx.status_code == 200
    assert res_rx.get_json()["total"] == 0

    # Invalid-looking unclosed regex '[' must not crash MongoDB -> matches literal '[' in Alice's name
    res_unclosed = client.get("/api/dropout/admin/records?search=[Special")
    assert res_unclosed.status_code == 200
    assert res_unclosed.get_json()["total"] == 1

    # Normal literal search & empty search
    assert client.get("/api/dropout/admin/records?search=Alice").get_json()["total"] == 1
    assert client.get("/api/dropout/admin/records?search=").get_json()["total"] == 1


def test_statistical_privacy_complementary_suppression(client, test_analyst, clean_db):
    """
    Verify N < 5 primary and complementary suppression across analyst overview & trends,
    and verify org-b records are excluded from org-a analyst totals.
    """
    _set_org(clean_db, test_analyst, "org-sdc-a")

    # Insert 6 Low, 5 Moderate, 1 High in org-sdc-a (total=12 >= 5; High=1 < 5 -> Moderate=5 also suppressed!)
    docs = [
        {
            "_id": ObjectId(),
            "student_id": ObjectId(),
            "student_name": f"Low Student {i}",
            "risk_probability": 0.1,
            "risk_tier": "Low",
            "model_version": "v1",
            "academic_term": "2026-Fall",
            "organization_id": "org-sdc-a",
        }
        for i in range(6)
    ]
    for i in range(5):
        docs.append({
            "_id": ObjectId(),
            "student_id": ObjectId(),
            "student_name": f"Mod Student {i}",
            "risk_probability": 0.45,
            "risk_tier": "Moderate",
            "model_version": "v1",
            "academic_term": "2026-Fall",
            "organization_id": "org-sdc-a",
        })
    docs.append({
        "_id": ObjectId(),
        "student_id": ObjectId(),
        "student_name": "High Student 1",
        "risk_probability": 0.85,
        "risk_tier": "High",
        "model_version": "v1",
        "academic_term": "2026-Fall",
        "organization_id": "org-sdc-a",
    })
    # Insert a 2026-Spring cohort where all cells >= 5 (total=15 in org-sdc-a) to verify org isolation on totals
    for tier in ["Low", "Moderate", "High"]:
        for i in range(5):
            docs.append({
                "_id": ObjectId(),
                "student_id": ObjectId(),
                "student_name": f"Spring {tier} {i}",
                "risk_probability": 0.2,
                "risk_tier": tier,
                "model_version": "v1",
                "academic_term": "2026-Spring",
                "organization_id": "org-sdc-a",
            })
    # Org B records in 2026-Spring (must never leak into org-sdc-a)
    for i in range(5):
        docs.append({
            "_id": ObjectId(),
            "student_id": ObjectId(),
            "student_name": f"OrgB Student {i}",
            "risk_probability": 0.9,
            "risk_tier": "High",
            "model_version": "v1",
            "academic_term": "2026-Spring",
            "organization_id": "org-sdc-b",
        })
    clean_db.dropout_records.insert_many(docs)

    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})

    # 1. Overview: total=27 (org-sdc-a only; org-sdc-b excluded), High=6, Moderate=10, Low=11 -> all >= 5
    ov_res = client.get("/api/dropout/analyst/overview")
    assert ov_res.status_code == 200
    ov = ov_res.get_json()
    assert ov["total_assessed"]["count"] == 27
    assert ov["total_assessed"]["suppressed"] is False

    # 2. Trends: 2026-Fall has High=1 (< 5) -> primary + conservative complementary suppression on all non-zero cells & total
    tr_res = client.get("/api/dropout/analyst/trends")
    assert tr_res.status_code == 200
    trends = {t["academic_term"]: t for t in tr_res.get_json()["trends"]}

    fall = trends["2026-Fall"]
    assert fall["total_assessed"]["suppressed"] is True
    assert fall["total_assessed"]["count"] is None
    assert fall["risk_distribution"]["High"]["suppressed"] is True
    assert fall["risk_distribution"]["Moderate"]["suppressed"] is True
    assert fall["risk_distribution"]["Low"]["suppressed"] is True

    # 2026-Spring has 5/5/5 (total=15, org-sdc-b excluded) -> unsuppressed
    spring = trends["2026-Spring"]
    assert spring["total_assessed"]["suppressed"] is False
    assert spring["total_assessed"]["count"] == 15
