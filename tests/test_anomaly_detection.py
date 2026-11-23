"""
EduPredict - Anomaly Detection & Monitoring Test Suite (Phase 7C)
Tests:
- Strict feature allowlist and target leakage rejection
- Synthetic proxy rejection (collinear features)
- Missing and unexpected value handling
- Deterministic repeatability
- Separate Math and Portuguese pipelines
- Synthetic anomaly vs normal record classification
- Idempotent MongoDB persistence
- Role-Based Access Control (Admin, Teacher assigned/unassigned, Student, Analyst)
- Human review status workflow and audit logging
- Analyst aggregate reporting with N < 5 cell suppression
- Performance and inference latency benchmarks
"""

import time
import pytest
from bson import ObjectId
from backend.ml.anomaly_detector import (
    AnomalyModelBundle,
    APPROVED_BASELINE_FEATURES,
    APPROVED_NUMERICAL_FEATURES,
    APPROVED_CATEGORICAL_FEATURES,
    STRICTLY_EXCLUDED_FEATURES,
    build_anomaly_pipeline,
    train_subject_anomaly_model,
)
from backend.ml.anomaly_loader import get_anomaly_model, score_student_features
from backend.models.anomaly_record_model import AnomalyRecord, VALID_REVIEW_STATUSES
from backend.services.anomaly_service import AnomalyService
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService


@pytest.fixture
def sample_valid_features():
    """Valid Milestone 0 student feature dictionary containing only approved features."""
    return {
        "school": "GP",
        "sex": "F",
        "age": 17,
        "address": "U",
        "famsize": "GT3",
        "Pstatus": "T",
        "Medu": 3,
        "Fedu": 3,
        "Mjob": "services",
        "Fjob": "other",
        "reason": "course",
        "guardian": "mother",
        "traveltime": 1,
        "studytime": 2,
        "failures": 0,
        "schoolsup": "no",
        "famsup": "yes",
        "paid": "no",
        "activities": "yes",
        "nursery": "yes",
        "higher": "yes",
        "internet": "yes",
        "romantic": "no",
        "famrel": 4,
        "freetime": 3,
        "goout": 3,
        "Dalc": 1,
        "Walc": 2,
        "health": 4,
        "absences": 4,
    }


@pytest.fixture
def sample_extreme_anomaly_features():
    """Extreme synthetic outlier fixture (high absences, repeated failures, high alcohol)."""
    return {
        "school": "MS",
        "sex": "M",
        "age": 22,
        "address": "R",
        "famsize": "LE3",
        "Pstatus": "A",
        "Medu": 0,
        "Fedu": 0,
        "Mjob": "at_home",
        "Fjob": "at_home",
        "reason": "other",
        "guardian": "other",
        "traveltime": 4,
        "studytime": 1,
        "failures": 3,
        "schoolsup": "yes",
        "famsup": "no",
        "paid": "yes",
        "activities": "no",
        "nursery": "no",
        "higher": "no",
        "internet": "no",
        "romantic": "yes",
        "famrel": 1,
        "freetime": 5,
        "goout": 5,
        "Dalc": 5,
        "Walc": 5,
        "health": 1,
        "absences": 68,
    }


# ==============================================================================
# 1. Feature Selection & Target Leakage Guard Tests
# ==============================================================================

def test_feature_allowlist_completeness():
    """Verify that the baseline feature list contains exactly 30 approved attributes."""
    assert len(APPROVED_BASELINE_FEATURES) == 30
    assert len(APPROVED_CATEGORICAL_FEATURES) == 17
    assert len(APPROVED_NUMERICAL_FEATURES) == 13
    assert len(set(APPROVED_BASELINE_FEATURES)) == 30


@pytest.mark.parametrize("leaked_feature", [
    "G3",
    "final_exam_marks",
    "academic_status",
    "pass_status",
    "assignment_completion_rate",
    "attendance_percentage",
    "study_hours_per_week",
    "previous_exam_marks",
    "quiz_scores",
])
def test_target_leakage_and_synthetic_proxy_rejection(sample_valid_features, leaked_feature):
    """
    Verify that passing any terminal outcome or synthetic collinear proxy
    raises a ValueError target leakage violation.
    """
    model = get_anomaly_model("Mathematics")
    assert model is not None

    tainted_features = dict(sample_valid_features)
    tainted_features[leaked_feature] = 50.0

    with pytest.raises(ValueError, match="Target leakage violation"):
        model.score_single_record(tainted_features)


def test_missing_and_unexpected_values_handled_safely(sample_valid_features):
    """Verify that missing or unparseable values are imputed without crashing."""
    model = get_anomaly_model("Mathematics")
    assert model is not None

    incomplete_features = dict(sample_valid_features)
    incomplete_features["age"] = None
    incomplete_features["absences"] = "corrupted_text"
    incomplete_features["school"] = None
    incomplete_features["Mjob"] = "unseen_rare_job_category"

    res = model.score_single_record(incomplete_features)
    assert "raw_decision_score" in res
    assert "normalized_anomaly_score" in res
    assert "cohort_percentile" in res
    assert res["anomaly_severity"] in ("High Anomaly", "Moderate Anomaly", "Low / Typical")


def test_deterministic_repeatability(sample_valid_features):
    """Verify that identical inputs produce bitwise reproducible anomaly scores."""
    model = get_anomaly_model("Mathematics")
    assert model is not None

    res1 = model.score_single_record(sample_valid_features)
    res2 = model.score_single_record(sample_valid_features)

    assert res1["raw_decision_score"] == res2["raw_decision_score"]
    assert res1["normalized_anomaly_score"] == res2["normalized_anomaly_score"]
    assert res1["cohort_percentile"] == res2["cohort_percentile"]
    assert res1["anomaly_severity"] == res2["anomaly_severity"]


def test_separate_math_and_portuguese_models(sample_valid_features):
    """Verify that Mathematics and Portuguese models load separately and have distinct subject metadata."""
    math_model = get_anomaly_model("Mathematics")
    por_model = get_anomaly_model("Portuguese Language")

    assert math_model is not None
    assert por_model is not None
    assert math_model.subject == "Mathematics"
    assert por_model.subject == "Portuguese Language"
    assert math_model.sample_count == 395
    assert por_model.sample_count == 649


def test_synthetic_anomaly_detection_sensitivity(sample_valid_features, sample_extreme_anomaly_features):
    """
    Verify that an extreme synthetic outlier receives a higher anomaly score
    and higher percentile rank than a typical normal student.
    """
    model = get_anomaly_model("Mathematics")
    assert model is not None

    normal_res = model.score_single_record(sample_valid_features)
    outlier_res = model.score_single_record(sample_extreme_anomaly_features)

    assert outlier_res["normalized_anomaly_score"] > normal_res["normalized_anomaly_score"]
    assert outlier_res["cohort_percentile"] > normal_res["cohort_percentile"]
    assert outlier_res["anomaly_severity"] == "High Anomaly"
    assert len(outlier_res["supporting_deviations"]) > 0

    # Verify deviation structure
    top_dev = outlier_res["supporting_deviations"][0]
    assert "feature" in top_dev
    assert "student_value" in top_dev
    assert "cohort_mean" in top_dev
    assert "z_score" in top_dev
    assert top_dev["disclaimer"] == "Supporting Statistical Deviation only. Does not denote causality."


# ==============================================================================
# 2. Database Persistence & Idempotency Tests
# ==============================================================================

def test_anomaly_record_persistence_and_idempotency(clean_db, test_admin, sample_valid_features):
    """Verify that evaluating the same source record twice performs an idempotent upsert without duplication."""
    rec1, err1 = AnomalyService.evaluate_and_store_record(
        db=clean_db,
        record_data=sample_valid_features,
        subject="Mathematics",
        actor_user=test_admin,
        source_record_id="STU-MAT-UNITTEST-001",
    )
    assert err1 is None
    assert rec1 is not None

    count1 = clean_db.anomaly_records.count_documents({"source_record_id": "STU-MAT-UNITTEST-001"})
    assert count1 == 1

    # Second evaluation of the same record
    rec2, err2 = AnomalyService.evaluate_and_store_record(
        db=clean_db,
        record_data=sample_valid_features,
        subject="Mathematics",
        actor_user=test_admin,
        source_record_id="STU-MAT-UNITTEST-001",
    )
    assert err2 is None
    assert rec2 is not None

    count2 = clean_db.anomaly_records.count_documents({"source_record_id": "STU-MAT-UNITTEST-001"})
    assert count2 == 1  # No duplicate record created


def test_human_review_status_workflow(clean_db, test_admin, sample_valid_features):
    """Verify updating review status from Pending Review to Confirmed and Dismissed."""
    rec, _ = AnomalyService.evaluate_and_store_record(
        db=clean_db,
        record_data=sample_valid_features,
        subject="Mathematics",
        actor_user=test_admin,
        source_record_id="STU-MAT-TRIAGE-001",
    )
    assert rec.review_status == "Pending Review"

    # Confirm Anomaly
    updated, err, code = AnomalyService.update_review_status(
        db=clean_db,
        anomaly_id=str(rec.id),
        new_status="Confirmed Anomaly",
        review_notes="Student confirmed experiencing personal circumstances.",
        actor_user=test_admin,
    )
    assert code == 200
    assert updated["review_status"] == "Confirmed Anomaly"
    assert updated["reviewed_by"] == str(test_admin.id)
    assert updated["review_notes"] == "Student confirmed experiencing personal circumstances."

    # Dismiss Anomaly
    dismissed, err_d, code_d = AnomalyService.update_review_status(
        db=clean_db,
        anomaly_id=str(rec.id),
        new_status="Dismissed (Benign)",
        review_notes="Verified as benign divergence due to sanctioned athletic travel.",
        actor_user=test_admin,
    )
    assert code_d == 200
    assert dismissed["review_status"] == "Dismissed (Benign)"

    # Reject invalid status
    _, err_bad, code_bad = AnomalyService.update_review_status(
        db=clean_db,
        anomaly_id=str(rec.id),
        new_status="Guilty of Cheating",
        review_notes=None,
        actor_user=test_admin,
    )
    assert code_bad == 400


# ==============================================================================
# 3. Role-Based Access Control (RBAC) Tests
# ==============================================================================

def test_admin_can_access_anomaly_endpoints(client, test_admin, clean_db, sample_valid_features):
    """Admin can query and list anomalies across subjects."""
    AnomalyService.evaluate_and_store_record(clean_db, sample_valid_features, "Mathematics", test_admin, "STU-ADMIN-TEST-1")

    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    res = client.get("/api/anomalies?subject=Mathematics")
    assert res.status_code == 200
    data = res.get_json()
    assert "anomalies" in data
    assert data["total_count"] >= 1


def test_teacher_subject_authorization_enforced(client, test_teacher, test_student, test_admin, clean_db, sample_valid_features):
    """
    Teacher assigned to Mathematics can access anomalies for their enrolled students in Mathematics.
    Teacher NOT assigned to Portuguese Language is denied (403 Forbidden).
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    por_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese_language")

    # Assign teacher strictly to Mathematics
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)
    # Enroll student in Mathematics with matching term
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2025-2026-T1", test_admin.id)

    # Populate records: one enrolled student in Math, one benchmark in Math, one in Portuguese
    AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "STU-MATH-ENROLLED",
        student_id=test_student.id, academic_term="2025-2026-T1"
    )
    AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "MAT-BENCH-1",
        is_benchmark=True
    )
    AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Portuguese Language", test_admin, "STU-POR-TCH-1",
        student_id=test_student.id, academic_term="2025-2026-T1"
    )

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # Permitted subject returns only enrolled student (benchmark is excluded)
    res_math = client.get("/api/anomalies?subject=Mathematics")
    assert res_math.status_code == 200
    math_data = res_math.get_json()
    assert math_data["total_count"] == 1
    assert math_data["anomalies"][0]["student_id"] == str(test_student.id)

    # Forbidden unauthorized subject
    res_por = client.get("/api/anomalies?subject=Portuguese Language")
    assert res_por.status_code == 403
    assert "not authorized" in res_por.get_json().get("message", "").lower()


def test_teacher_student_level_authorization_and_isolation(client, test_teacher, test_student, test_admin, clean_db, sample_valid_features):
    """
    Teacher A cannot view or review anomaly records of an unrelated student
    who is enrolled with a different teacher or not enrolled in Teacher A's roster.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Teacher A assigned to Mathematics for 2025-2026-T1
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)
    # Student A is enrolled with Teacher A
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2025-2026-T1", test_admin.id)

    # Create a second student (Student B) who is NOT enrolled in Mathematics for Teacher A
    other_student, _ = UserService.create_user(
        clean_db, email="other.student@edupredict.edu", plain_password="OtherPassword123!",
        full_name="Other Student", role="student"
    )

    # Store anomaly for enrolled Student A
    rec_a, _ = AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "STU-A-MATH",
        student_id=test_student.id, academic_term="2025-2026-T1"
    )
    # Store anomaly for unassigned Student B
    rec_b, _ = AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "STU-B-MATH",
        student_id=other_student.id, academic_term="2025-2026-T1"
    )

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # 1. List endpoint isolates Student B out of the result
    res_list = client.get("/api/anomalies?subject=Mathematics")
    assert res_list.status_code == 200
    ids_returned = [a["id"] for a in res_list.get_json()["anomalies"]]
    assert str(rec_a.id) in ids_returned
    assert str(rec_b.id) not in ids_returned

    # 2. Detail endpoint fails closed for Student B
    res_detail = client.get(f"/api/anomalies/{rec_b.id}")
    assert res_detail.status_code == 403
    assert "not have authorization" in res_detail.get_json().get("message", "").lower()

    # 3. Status update fails closed for Student B
    res_review = client.patch(
        f"/api/anomalies/{rec_b.id}/status",
        json={"review_status": "Confirmed Anomaly", "review_notes": "Attempted unauthorized review"}
    )
    assert res_review.status_code == 403
    assert "not have authorization" in res_review.get_json().get("message", "").lower()


def test_teacher_cannot_trigger_batch_benchmark_scan(client, test_teacher, clean_db):
    """Teachers are strictly denied from triggering batch benchmark evaluations (403 Forbidden)."""
    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})
    res = client.post("/api/anomalies/batch-evaluate", json={"subject": "Mathematics"})
    assert res.status_code == 403


def test_unlinked_benchmark_records_isolated_from_teachers(client, test_teacher, test_admin, clean_db, sample_valid_features):
    """
    Unlinked benchmark records (from CSV / benchmark evaluations) must NEVER appear
    as classroom anomalies in a teacher's monitoring queue or detail lookups.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)

    # Store benchmark observation with student_code MAT_099 and no student_id
    bench_rec, _ = AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "MAT_099",
        is_benchmark=True, student_id=None
    )

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # Teacher list has 0 records
    res_list = client.get("/api/anomalies?subject=Mathematics")
    assert res_list.status_code == 200
    assert res_list.get_json()["total_count"] == 0

    # Teacher direct detail lookup returns 403
    res_detail = client.get(f"/api/anomalies/{bench_rec.id}")
    assert res_detail.status_code == 403
    assert "benchmark" in res_detail.get_json().get("message", "").lower()


def test_student_and_analyst_denied_row_level_anomalies(client, test_student, test_analyst):
    """Students and Analysts are strictly denied access to row-level anomaly endpoints (403)."""
    # Student
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    res_stu = client.get("/api/anomalies")
    assert res_stu.status_code == 403

    # Analyst
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})
    res_ana = client.get("/api/anomalies")
    assert res_ana.status_code == 403


def test_analyst_complementary_cell_suppression_prevents_subtraction(client, test_analyst, test_admin, clean_db, sample_valid_features):
    """
    Verify that when one subject has a suppressed count (1-4) and the other has >= 5,
    the unsuppressed subject is ALSO complementary-suppressed, preventing subtraction disclosure.
    """
    clean_db.anomaly_records.delete_many({})

    # Insert 2 anomalies in Mathematics (primary suppressed: 1 <= 2 < 5)
    for i in range(2):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"STU-DIFF-M-{i}"
        )
    # Insert 6 anomalies in Portuguese Language (normally >= 5)
    for i in range(6):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Portuguese Language", test_admin, f"STU-DIFF-P-{i}"
        )

    # Force is_anomaly=True on all inserted records
    clean_db.anomaly_records.update_many({}, {"$set": {"is_anomaly": True}})

    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})
    res = client.get("/api/analyst/anomalies/stats")
    assert res.status_code == 200
    data = res.get_json()

    math_anom = data["subject_breakdown"]["Mathematics"]["anomalies_count"]
    por_anom = data["subject_breakdown"]["Portuguese Language"]["anomalies_count"]

    # Mathematics is primary suppressed (<5)
    assert math_anom["suppressed"] is True
    assert math_anom["count"] is None
    assert math_anom["display"] == "<5"

    # Portuguese Language MUST BE complementary suppressed (<5) to prevent subtraction: Total (8) - Por (6) = 2
    assert por_anom["suppressed"] is True
    assert por_anom["count"] is None
    assert por_anom["display"] == "<5"

    # Total anomalies and evaluated records
    assert data["total_evaluated_records"]["suppressed"] is False
    assert data["total_evaluated_records"]["count"] == 8
    assert data["total_anomalies"]["suppressed"] is False
    assert data["total_anomalies"]["count"] == 8


def test_severity_values_consistent_across_models():
    """Verify that severity classifications strictly use High Anomaly, Moderate Anomaly, Low / Typical."""
    from backend.models.anomaly_record_model import VALID_SEVERITIES
    assert VALID_SEVERITIES == {"High Anomaly", "Moderate Anomaly", "Low / Typical"}
    assert "Critical" not in VALID_SEVERITIES


# ==============================================================================
# 4. Performance & Inference Latency Benchmark
# ==============================================================================

def test_inference_latency_budget(sample_valid_features):
    """Verify that single-record inference completes within 100 ms budget on i5-3360M."""
    model = get_anomaly_model("Mathematics")
    assert model is not None

    # Warm-up
    model.score_single_record(sample_valid_features)

    t0 = time.perf_counter()
    iterations = 20
    for _ in range(iterations):
        model.score_single_record(sample_valid_features)
    avg_latency_ms = ((time.perf_counter() - t0) / iterations) * 1000.0

    assert avg_latency_ms < 100.0, f"Average inference latency {avg_latency_ms:.2f} ms exceeded 100 ms limit."
