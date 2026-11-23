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
from backend.services.anomaly_service import AnomalyService, apply_complementary_partition_suppression
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
    por_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

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

    # In a 2-element partition, Total Anomalies is also suppressed to prevent interval bounding / subtraction
    assert data["total_anomalies"]["suppressed"] is True
    assert data["total_anomalies"]["count"] is None
    assert data["total_anomalies"]["display"] == "<5"

    assert data["total_evaluated_records"]["suppressed"] is True
    assert data["total_evaluated_records"]["count"] is None
    assert data["total_evaluated_records"]["display"] == "<5"


def test_analyst_cross_dimension_disclosure_safeguards(client, test_analyst, test_admin, clean_db, sample_valid_features):
    """
    Test realistic multi-distribution cross-dimension disclosure scenarios:
    - Case A: Overall institution records N < 5 (all dimensions suppressed)
    - Case B: High anomaly & moderate anomaly suppressed when total anomalies is suppressed
    - Case C: Zero-valued companion cells in multi-element partitions
    """
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})

    # Case A: Tiny cohort of N = 3 records
    clean_db.anomaly_records.delete_many({})
    for i in range(3):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"STU-TINY-{i}"
        )

    res_tiny = client.get("/api/analyst/anomalies/stats")
    assert res_tiny.status_code == 200
    data_tiny = res_tiny.get_json()

    # Total evaluated records must be suppressed (<5)
    assert data_tiny["total_evaluated_records"]["suppressed"] is True
    assert data_tiny["total_evaluated_records"]["display"] == "<5"
    assert data_tiny["total_anomalies"]["suppressed"] is True

    # Case B: Cross-dimension coupling (Total anomalies suppressed -> High/Moderate severity suppressed)
    clean_db.anomaly_records.delete_many({})
    # Insert 2 anomalies and 20 normal records in Mathematics
    for i in range(2):
        rec, _ = AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"STU-ANOM-{i}"
        )
        clean_db.anomaly_records.update_one({"_id": rec.id}, {"$set": {"is_anomaly": True, "anomaly_severity": "High Anomaly"}})

    for i in range(20):
        rec, _ = AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"STU-NORM-{i}"
        )
        clean_db.anomaly_records.update_one({"_id": rec.id}, {"$set": {"is_anomaly": False, "anomaly_severity": "Low / Typical"}})

    res_cross = client.get("/api/analyst/anomalies/stats")
    assert res_cross.status_code == 200
    data_cross = res_cross.get_json()

    # Total anomalies is 2 (<5), so it must be suppressed
    assert data_cross["total_anomalies"]["suppressed"] is True
    assert data_cross["total_anomalies"]["display"] == "<5"

    # Cross-dimension safeguard: High Anomaly MUST be suppressed even though evaluated against 22 records
    assert data_cross["severity_breakdown"]["High Anomaly"]["suppressed"] is True
    assert data_cross["severity_breakdown"]["High Anomaly"]["display"] == "<5"


def test_teacher_pagination_and_term_alignment(client, test_teacher, test_student, test_admin, clean_db, sample_valid_features):
    """
    Verify Teacher Pagination and Authorization Consistency:
    - Same student, same subject, different academic terms.
    - Teacher assigned to Math T1 and Portuguese T2.
    - Unauthorized Math T2 records for the same student MUST NOT contribute to total_count.
    - Pagination total_count, total_pages, and sliced results must be 100% consistent.
    """
    clean_db.anomaly_records.delete_many({})
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    por_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # Teacher assigned to Math in 2025-2026-T1
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)
    # Teacher assigned to Portuguese in 2025-2026-T2
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, por_subj.id, "2025-2026-T2", test_admin.id)

    # Student enrolled in Math T1
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2025-2026-T1", test_admin.id)
    # Student enrolled in Portuguese T2
    EnrollmentService.enroll_student(clean_db, test_student.id, por_subj.id, "2025-2026-T2", test_admin.id)

    # 1. Insert 15 Math T1 records (AUTHORIZED)
    for i in range(15):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"REC-M-T1-{i}",
            student_id=test_student.id, academic_term="2025-2026-T1"
        )

    # 2. Insert 10 Math T2 records (UNAUTHORIZED for this teacher because teacher only teaches Math in T1!)
    for i in range(10):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"REC-M-T2-{i}",
            student_id=test_student.id, academic_term="2025-2026-T2"
        )

    # 3. Insert 8 Portuguese T2 records (AUTHORIZED)
    for i in range(8):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Portuguese Language", test_admin, f"REC-P-T2-{i}",
            student_id=test_student.id, academic_term="2025-2026-T2"
        )

    # 4. Insert 5 records for an unrelated student (UNAUTHORIZED)
    other_student, _ = UserService.create_user(
        clean_db, email="unrelated.stu@edupredict.edu", plain_password="OtherPassword123!",
        full_name="Unrelated Student", role="student"
    )
    for i in range(5):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"REC-OTHER-{i}",
            student_id=other_student.id, academic_term="2025-2026-T1"
        )

    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # A. Subject Filter: Mathematics
    # Teacher is only authorized for Math in T1 (15 records). The 10 Math T2 and 5 Other records must NOT be counted!
    res_m_p1 = client.get("/api/anomalies?subject=Mathematics&page=1&limit=10")
    assert res_m_p1.status_code == 200
    data_m_p1 = res_m_p1.get_json()

    assert data_m_p1["total_count"] == 15, f"Expected total_count 15, got {data_m_p1['total_count']}"
    assert data_m_p1["total_pages"] == 2
    assert len(data_m_p1["anomalies"]) == 10
    for a in data_m_p1["anomalies"]:
        assert a["subject"] == "Mathematics"
        assert a["academic_term"] == "2025-2026-T1"
        assert a["student_id"] == str(test_student.id)

    res_m_p2 = client.get("/api/anomalies?subject=Mathematics&page=2&limit=10")
    assert res_m_p2.status_code == 200
    data_m_p2 = res_m_p2.get_json()
    assert len(data_m_p2["anomalies"]) == 5
    for a in data_m_p2["anomalies"]:
        assert a["subject"] == "Mathematics"
        assert a["academic_term"] == "2025-2026-T1"

    # B. Multi-Subject Scope (No subject filter)
    # Authorized records = 15 (Math T1) + 8 (Portuguese T2) = 23 total records
    res_all_p1 = client.get("/api/anomalies?page=1&limit=10")
    assert res_all_p1.status_code == 200
    data_all_p1 = res_all_p1.get_json()

    assert data_all_p1["total_count"] == 23, f"Expected total_count 23, got {data_all_p1['total_count']}"
    assert data_all_p1["total_pages"] == 3
    assert len(data_all_p1["anomalies"]) == 10

    res_all_p3 = client.get("/api/anomalies?page=3&limit=10")
    assert res_all_p3.status_code == 200
    data_all_p3 = res_all_p3.get_json()
    assert len(data_all_p3["anomalies"]) == 3


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


# ==============================================================================
# 5. Multi-Cell SDC Suppression & Legacy Term Authorization Tests (Remediation)
# ==============================================================================

def test_apply_complementary_partition_suppression_unit():
    """
    Unit test for conservative Statistical Disclosure Control (SDC) cell suppression:
    - Partition with two primary-suppressed cells (1 <= N < 5)
    - Partition with three primary-suppressed cells
    - Partition with one primary-suppressed cell and zero-valued companion cells
    - Safe partition with all cells >= 5
    - Empty partition with total 0
    """
    # 1. Two primary-suppressed cells in a 3-category partition
    counts_two_small = {"High": 2, "Moderate": 3, "Low": 15}
    res_two, tot_two = apply_complementary_partition_suppression(counts_two_small, 20, threshold=5)
    for k in ("High", "Moderate", "Low"):
        assert res_two[k]["suppressed"] is True
        assert res_two[k]["count"] is None
        assert res_two[k]["display"] == "<5"
    assert tot_two["suppressed"] is True
    assert tot_two["count"] is None
    assert tot_two["display"] == "<5"

    # 2. Three primary-suppressed cells
    counts_three_small = {"A": 1, "B": 2, "C": 3}
    res_three, tot_three = apply_complementary_partition_suppression(counts_three_small, 6, threshold=5)
    for k in ("A", "B", "C"):
        assert res_three[k]["suppressed"] is True
        assert res_three[k]["count"] is None
    assert tot_three["suppressed"] is True
    assert tot_three["count"] is None

    # 3. One primary-suppressed cell and zero-valued companion cells
    counts_one_with_zeros = {"A": 2, "B": 0, "C": 0}
    res_zeros, tot_zeros = apply_complementary_partition_suppression(counts_one_with_zeros, 2, threshold=5)
    assert res_zeros["A"]["suppressed"] is True
    assert res_zeros["A"]["count"] is None
    assert res_zeros["B"]["suppressed"] is False
    assert res_zeros["B"]["count"] == 0
    assert res_zeros["B"]["display"] == "0"
    assert res_zeros["C"]["suppressed"] is False
    assert res_zeros["C"]["count"] == 0
    assert tot_zeros["suppressed"] is True
    assert tot_zeros["count"] is None

    # 4. Safe partition (all cells >= 5)
    counts_safe = {"High": 10, "Moderate": 20, "Low": 30}
    res_safe, tot_safe = apply_complementary_partition_suppression(counts_safe, 60, threshold=5)
    for k in ("High", "Moderate", "Low"):
        assert res_safe[k]["suppressed"] is False
        assert res_safe[k]["count"] == counts_safe[k]
    assert tot_safe["suppressed"] is False
    assert tot_safe["count"] == 60
    assert tot_safe["display"] == "60"

    # 5. Zero total
    counts_empty = {"A": 0, "B": 0}
    res_empty, tot_empty = apply_complementary_partition_suppression(counts_empty, 0, threshold=5)
    assert res_empty["A"]["suppressed"] is False
    assert res_empty["A"]["count"] == 0
    assert tot_empty["suppressed"] is False
    assert tot_empty["count"] == 0


def test_analyst_multicell_sdc_suppression_endpoint(client, test_analyst, test_admin, clean_db, sample_valid_features):
    """
    Integration test verifying that partitions with multiple primary-suppressed cells
    conservatively suppress all non-zero cells and partition totals in the Analyst stats API.
    """
    clean_db.anomaly_records.delete_many({})

    # 2 High Anomaly, 3 Moderate Anomaly, 20 Low / Typical -> Total = 25, Total Anomalies = 5
    for i in range(2):
        rec, _ = AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"REC-HI-{i}"
        )
        clean_db.anomaly_records.update_one({"_id": rec.id}, {"$set": {"is_anomaly": True, "anomaly_severity": "High Anomaly"}})

    for i in range(3):
        rec, _ = AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Portuguese Language", test_admin, f"REC-MOD-{i}"
        )
        clean_db.anomaly_records.update_one({"_id": rec.id}, {"$set": {"is_anomaly": True, "anomaly_severity": "Moderate Anomaly"}})

    for i in range(20):
        rec, _ = AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"REC-LOW-{i}"
        )
        clean_db.anomaly_records.update_one({"_id": rec.id}, {"$set": {"is_anomaly": False, "anomaly_severity": "Low / Typical"}})

    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})
    res = client.get("/api/analyst/anomalies/stats")
    assert res.status_code == 200
    data = res.get_json()

    # Severity has two primary-suppressed cells (High=2, Moderate=3).
    # All non-zero severity categories must be conservatively suppressed!
    sev_breakdown = data["severity_breakdown"]
    for sev_name in ("High Anomaly", "Moderate Anomaly", "Low / Typical"):
        assert sev_breakdown[sev_name]["suppressed"] is True, f"{sev_name} should be suppressed"
        assert sev_breakdown[sev_name]["count"] is None
        assert sev_breakdown[sev_name]["display"] == "<5"

    # Total evaluated records partition total for severity was suppressed by conservative rule
    # Subject anomalies breakdown has Math=2, Por=3 -> both primary suppressed, total anomalies (5) suppressed
    assert data["subject_breakdown"]["Mathematics"]["anomalies_count"]["suppressed"] is True
    assert data["subject_breakdown"]["Portuguese Language"]["anomalies_count"]["suppressed"] is True
    assert data["total_anomalies"]["suppressed"] is True


def test_legacy_academic_term_fail_closed_authorization(client, test_teacher, test_student, test_admin, clean_db, sample_valid_features):
    """
    Verify Teacher Fail-Closed Authorization for Legacy Academic Terms:
    - Anomaly records without an academic term (None, empty string "", or missing field)
      must NEVER be accessible to teachers in list queries, detail GETs, or review updates.
    - Administrators retain full system-wide access to historical anomaly records.
    - Pagination counts and offsets for teachers must exclude legacy records with 100% precision.
    """
    clean_db.anomaly_records.delete_many({})
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Teacher assigned to Math in 2025-2026-T1
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2025-2026-T1", test_admin.id)
    # Student enrolled in Math in 2025-2026-T1
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2025-2026-T1", test_admin.id)

    # 1. Create a legacy record with academic_term = None
    rec_none, _ = AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "LEGACY-NONE-1",
        student_id=test_student.id, academic_term=None
    )

    # 2. Create a legacy record with academic_term = "" (empty string)
    rec_empty, _ = AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "LEGACY-EMPTY-1",
        student_id=test_student.id, academic_term=""
    )

    # 3. Create a legacy record with missing academic_term field
    rec_missing, _ = AnomalyService.evaluate_and_store_record(
        clean_db, sample_valid_features, "Mathematics", test_admin, "LEGACY-MISSING-1",
        student_id=test_student.id, academic_term=None
    )
    clean_db.anomaly_records.update_one({"_id": rec_missing.id}, {"$unset": {"academic_term": ""}})

    # --- TEACHER ACCESS VERIFICATION ---
    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})

    # Teacher list endpoint: None of the legacy records appear, total_count is 0
    res_list = client.get("/api/anomalies?subject=Mathematics")
    assert res_list.status_code == 200
    assert res_list.get_json()["total_count"] == 0
    assert len(res_list.get_json()["anomalies"]) == 0

    # Teacher detail endpoint: Fails closed with 403 Forbidden for each legacy record
    for rec_id in (rec_none.id, rec_empty.id, rec_missing.id):
        res_det = client.get(f"/api/anomalies/{rec_id}")
        assert res_det.status_code == 403
        assert "academic term" in res_det.get_json().get("message", "").lower()

        res_patch = client.patch(
            f"/api/anomalies/{rec_id}/status",
            json={"review_status": "Confirmed Anomaly", "review_notes": "Attempted teacher review"}
        )
        assert res_patch.status_code == 403
        assert "academic term" in res_patch.get_json().get("message", "").lower()

    # --- ADMIN ACCESS VERIFICATION ---
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})

    # Admin retains full historical access to records without academic term
    for rec_id in (rec_none.id, rec_empty.id, rec_missing.id):
        res_admin_det = client.get(f"/api/anomalies/{rec_id}")
        assert res_admin_det.status_code == 200
        assert res_admin_det.get_json()["anomaly"]["id"] == str(rec_id)

        res_admin_patch = client.patch(
            f"/api/anomalies/{rec_id}/status",
            json={"review_status": "Confirmed Anomaly", "review_notes": "Admin verified historical anomaly"}
        )
        assert res_admin_patch.status_code == 200
        assert res_admin_patch.get_json()["anomaly"]["review_status"] == "Confirmed Anomaly"

    # --- PAGINATION INTEGRITY VERIFICATION ---
    # Insert 10 valid records for 2025-2026-T1
    for i in range(10):
        AnomalyService.evaluate_and_store_record(
            clean_db, sample_valid_features, "Mathematics", test_admin, f"VALID-TERM-{i}",
            student_id=test_student.id, academic_term="2025-2026-T1"
        )

    # Now verify Teacher view: Total count must be EXACTLY 10 (the 3 legacy records are completely excluded)
    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})
    res_pag_p1 = client.get("/api/anomalies?subject=Mathematics&page=1&limit=5")
    assert res_pag_p1.status_code == 200
    data_pag_p1 = res_pag_p1.get_json()
    assert data_pag_p1["total_count"] == 10
    assert data_pag_p1["total_pages"] == 2
    assert len(data_pag_p1["anomalies"]) == 5
    for a in data_pag_p1["anomalies"]:
        assert a["academic_term"] == "2025-2026-T1"

    res_pag_p2 = client.get("/api/anomalies?subject=Mathematics&page=2&limit=5")
    assert res_pag_p2.status_code == 200
    data_pag_p2 = res_pag_p2.get_json()
    assert len(data_pag_p2["anomalies"]) == 5
    for a in data_pag_p2["anomalies"]:
        assert a["academic_term"] == "2025-2026-T1"
