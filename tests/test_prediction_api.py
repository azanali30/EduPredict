"""
EduPredict - Prediction API Integration & Security Tests
Module: tests.test_prediction_api
Tests prediction endpoints, RBAC, input validation, leakage prevention,
provenance tracking, and educational safety advisories.
"""

import pytest
from bson import ObjectId
from backend.services.user_service import UserService
from backend.services.assignment_service import AssignmentService

# Sample valid feature vectors
SAMPLE_M0_FEATURES = {
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
    "study_hours_per_week": 3.5,
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
    "attendance_percentage": 93.33,
    "assignment_completion_rate": 85.0,
}

SAMPLE_M1_FEATURES = dict(SAMPLE_M0_FEATURES)
SAMPLE_M1_FEATURES["previous_exam_marks"] = 65.0

SAMPLE_M2_FEATURES = dict(SAMPLE_M1_FEATURES)
SAMPLE_M2_FEATURES["quiz_scores"] = 70.0


def login_user(client, email, password):
    """Helper to authenticate a user."""
    return client.post("/auth/login", json={
        "email": email,
        "password": password,
    })


# ==============================================================================
# 1. Options Metadata Endpoint Tests
# ==============================================================================

def test_get_prediction_options_requires_auth(client):
    """Verify options endpoint rejects unauthenticated requests with 401."""
    res = client.get("/api/predictions/options")
    assert res.status_code == 401
    assert "Unauthorized" in res.get_json()["error"]


def test_get_prediction_options_success(client, test_student):
    """Verify options endpoint returns valid subjects, milestones, features, and target definitions."""
    login_user(client, test_student.email, "StudentPassword123!")

    res = client.get("/api/predictions/options")
    assert res.status_code == 200
    data = res.get_json()
    options = data["options"]

    assert len(options["supported_subjects"]) == 2
    subject_names = [s["name"] for s in options["supported_subjects"]]
    assert "Mathematics" in subject_names
    assert "Portuguese Language" in subject_names

    assert len(options["milestones"]) == 3
    assert options["milestones"][0]["feature_count"] == 33
    assert options["milestones"][1]["feature_count"] == 34
    assert options["milestones"][2]["feature_count"] == 35

    assert "assignment_completion_rate" in options["estimated_feature_labels"]
    assert "attendance_percentage" in options["estimated_feature_labels"]
    assert "study_hours_per_week" in options["estimated_feature_labels"]


# ==============================================================================
# 2. Prediction Generation & RBAC Tests
# ==============================================================================

def test_student_generate_prediction_milestone_0_success(client, clean_db, test_student):
    """Verify student can generate Milestone 0 prediction for themselves."""
    login_user(client, test_student.email, "StudentPassword123!")

    res = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })

    assert res.status_code == 201
    data = res.get_json()
    pred = data["prediction"]

    assert pred["student_id"] == str(test_student.id)
    assert pred["subject"] == "Mathematics"
    assert pred["milestone"] == 0
    assert 0.0 <= pred["predicted_marks"] <= 100.0
    assert pred["predicted_status"] in ["High Risk", "Moderate Risk", "Low Risk / On Track"]
    assert "confidence_scores" in pred
    assert pred["top_confidence"] > 0.0

    # Milestone 0 Early Warning Advisory must be present
    assert pred["early_warning_advisory"] is not None
    assert "advisory" in pred["early_warning_advisory"]["title"].lower()
    assert pred["early_warning_advisory"]["false_negative_rate_estimate_pct"] > 50.0

    # Verify MongoDB persistence
    saved_doc = clean_db.predictions.find_one({"_id": ObjectId(pred["id"])})
    assert saved_doc is not None
    assert saved_doc["student_id"] == test_student.id
    assert saved_doc["features_summary"]["assignment_completion_rate"]["is_estimated_proxy"] is True


def test_student_generate_prediction_milestone_1_and_2(client, clean_db, test_student):
    """Verify student can generate Milestone 1 and Milestone 2 predictions."""
    login_user(client, test_student.email, "StudentPassword123!")

    # Milestone 1
    res1 = client.post("/api/predictions", json={
        "subject": "Portuguese Language",
        "milestone": 1,
        "features": SAMPLE_M1_FEATURES,
    })
    assert res1.status_code == 201
    data1 = res1.get_json()["prediction"]
    assert data1["milestone"] == 1
    assert data1["early_warning_advisory"] is None

    # Milestone 2
    res2 = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 2,
        "features": SAMPLE_M2_FEATURES,
    })
    assert res2.status_code == 201
    data2 = res2.get_json()["prediction"]
    assert data2["milestone"] == 2
    assert data2["early_warning_advisory"] is None


def test_student_cannot_generate_prediction_for_other_student(client, clean_db, test_student):
    """Verify student cannot generate predictions on behalf of another student (IDOR protection)."""
    other_student, _ = UserService.create_user(
        clean_db, "other.student@edupredict.com", "Password123!", "Other Student", "student"
    )

    login_user(client, test_student.email, "StudentPassword123!")

    res = client.post("/api/predictions", json={
        "student_id": str(other_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })

    assert res.status_code == 403
    assert "strictly prohibited" in res.get_json()["message"].lower()


def test_teacher_predict_assigned_vs_unassigned_student(client, clean_db, test_teacher, test_student):
    """Verify teacher can predict only for assigned students, and receives 403 on unassigned students."""
    unassigned_student, _ = UserService.create_user(
        clean_db, "unassigned@edupredict.com", "Password123!", "Unassigned Student", "student"
    )

    # Assign test_student to test_teacher
    AssignmentService.assign_teacher_to_student(
        db=clean_db,
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        admin_id=ObjectId(),
    )

    login_user(client, test_teacher.email, "TeacherPassword123!")

    # 1. Assigned student -> 201 Created
    res_assigned = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })
    assert res_assigned.status_code == 201

    # 2. Unassigned student -> 403 Forbidden
    res_unassigned = client.post("/api/predictions", json={
        "student_id": str(unassigned_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })
    assert res_unassigned.status_code == 403
    assert "not authorized" in res_unassigned.get_json()["message"].lower()


def test_admin_can_predict_for_any_student(client, clean_db, test_admin, test_student):
    """Verify administrator has system-wide authorization to generate predictions."""
    login_user(client, test_admin.email, "AdminPassword123!")

    res = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Portuguese Language",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })
    assert res.status_code == 201
    assert res.get_json()["prediction"]["student_id"] == str(test_student.id)


# ==============================================================================
# 3. Input Validation & Leakage Prevention Tests
# ==============================================================================

def test_prediction_invalid_subject_and_milestone(client, test_student):
    """Verify invalid subjects or milestone integers are rejected with 400."""
    login_user(client, test_student.email, "StudentPassword123!")

    # Invalid subject
    res1 = client.post("/api/predictions", json={
        "subject": "Physics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })
    assert res1.status_code == 400
    assert "Invalid subject" in res1.get_json()["message"]

    # Invalid milestone
    res2 = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 5,
        "features": SAMPLE_M0_FEATURES,
    })
    assert res2.status_code == 400
    assert "Invalid milestone" in res2.get_json()["message"]


def test_prediction_missing_and_out_of_range_features(client, test_student):
    """Verify missing required features or out-of-range values are rejected with 400."""
    login_user(client, test_student.email, "StudentPassword123!")

    # Missing feature (e.g., freetime)
    bad_features = dict(SAMPLE_M0_FEATURES)
    bad_features.pop("freetime")
    res1 = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": bad_features,
    })
    assert res1.status_code == 400
    assert "Missing required features" in res1.get_json()["message"]

    # Out-of-range numeric (e.g., age = 99)
    bad_features2 = dict(SAMPLE_M0_FEATURES)
    bad_features2["age"] = 99
    res2 = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": bad_features2,
    })
    assert res2.status_code == 400
    assert "out of permitted range" in res2.get_json()["message"]

    # Invalid categorical (e.g., sex = 'X')
    bad_features3 = dict(SAMPLE_M0_FEATURES)
    bad_features3["sex"] = "X"
    res3 = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": bad_features3,
    })
    assert res3.status_code == 400
    assert "Invalid value 'X'" in res3.get_json()["message"]


def test_target_leakage_fields_rejected(client, test_student):
    """Verify attempts to pass G3, final_exam_marks, academic_status, or student_code are rejected."""
    login_user(client, test_student.email, "StudentPassword123!")

    for leak_col in ["G3", "final_exam_marks", "academic_status", "student_code"]:
        leaky_payload = dict(SAMPLE_M0_FEATURES)
        leaky_payload[leak_col] = 85.0
        res = client.post("/api/predictions", json={
            "subject": "Mathematics",
            "milestone": 0,
            "features": leaky_payload,
        })
        assert res.status_code == 400
        assert "LEAKAGE DETECTED" in res.get_json()["message"]


def test_temporal_milestone_leakage_rejected(client, test_student):
    """Verify Milestone 0 rejects G1/previous_exam_marks and Milestone 1 rejects G2/quiz_scores."""
    login_user(client, test_student.email, "StudentPassword123!")

    # Milestone 0 attempting to supply previous_exam_marks
    m0_leaky = dict(SAMPLE_M0_FEATURES)
    m0_leaky["previous_exam_marks"] = 75.0
    res0 = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": m0_leaky,
    })
    assert res0.status_code == 400
    assert "TEMPORAL LEAKAGE" in res0.get_json()["message"]

    # Milestone 1 attempting to supply quiz_scores
    m1_leaky = dict(SAMPLE_M1_FEATURES)
    m1_leaky["quiz_scores"] = 80.0
    res1 = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 1,
        "features": m1_leaky,
    })
    assert res1.status_code == 400
    assert "TEMPORAL LEAKAGE" in res1.get_json()["message"]


# ==============================================================================
# 4. Prediction History & Detail RBAC Tests
# ==============================================================================

def test_prediction_history_student_isolation(client, clean_db, test_student):
    """Verify student can list only their own predictions."""
    other_student, _ = UserService.create_user(
        clean_db, "other2@edupredict.com", "Password123!", "Other Student 2", "student"
    )

    # Insert prediction for other student directly
    clean_db.predictions.insert_one({
        "student_id": other_student.id,
        "subject": "Mathematics",
        "milestone": 0,
        "predicted_marks": 75.0,
        "predicted_status": "Low Risk / On Track",
        "confidence_scores": {},
        "top_confidence": 0.8,
    })

    # Login as test_student and generate own prediction
    login_user(client, test_student.email, "StudentPassword123!")
    client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })

    # Retrieve history
    res = client.get("/api/predictions")
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_count"] == 1
    assert data["predictions"][0]["student_id"] == str(test_student.id)


def test_prediction_history_teacher_scoping(client, clean_db, test_teacher, test_student):
    """Verify teacher history lists only assigned students and blocks unassigned queries."""
    unassigned_student, _ = UserService.create_user(
        clean_db, "unassigned2@edupredict.com", "Password123!", "Unassigned Student 2", "student"
    )

    # Assign test_student to test_teacher
    AssignmentService.assign_teacher_to_student(
        db=clean_db,
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        admin_id=ObjectId(),
    )

    # Generate prediction for assigned student
    login_user(client, test_teacher.email, "TeacherPassword123!")
    client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })

    # 1. Querying without filter -> returns test_student predictions
    res_all = client.get("/api/predictions")
    assert res_all.status_code == 200
    assert res_all.get_json()["total_count"] == 1

    # 2. Querying explicitly for assigned student -> returns predictions
    res_assigned = client.get(f"/api/predictions?student_id={test_student.id}")
    assert res_assigned.status_code == 200
    assert res_assigned.get_json()["total_count"] == 1

    # 3. Querying for unassigned student -> 403 Forbidden
    res_unassigned = client.get(f"/api/predictions?student_id={unassigned_student.id}")
    assert res_unassigned.status_code == 403


def test_prediction_detail_rbac(client, clean_db, test_student, test_teacher, test_admin):
    """Verify single prediction retrieval enforces RBAC."""
    login_user(client, test_student.email, "StudentPassword123!")
    create_res = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })
    pred_id = create_res.get_json()["prediction"]["id"]

    # Student can access own prediction
    res_own = client.get(f"/api/predictions/{pred_id}")
    assert res_own.status_code == 200

    # Unassigned teacher cannot access
    login_user(client, test_teacher.email, "TeacherPassword123!")
    res_teacher = client.get(f"/api/predictions/{pred_id}")
    assert res_teacher.status_code == 403

    # Admin can access
    login_user(client, test_admin.email, "AdminPassword123!")
    res_admin = client.get(f"/api/predictions/{pred_id}")
    assert res_admin.status_code == 200
    assert res_admin.get_json()["prediction"]["id"] == pred_id


# ==============================================================================
# 5. Phase 5C Remediation Regression Tests
# ==============================================================================

def test_milestone_0_advisory_canonical_keys_and_empirical_metrics(client, clean_db, test_student):
    """
    Verify canonical M0 advisory response keys and verify subject-specific
    false-negative rate estimates against Phase 5A holdout confusion matrices.
    """
    login_user(client, test_student.email, "StudentPassword123!")

    # 1. Mathematics M0 Prediction
    res_math = client.post("/api/predictions", json={
        "subject": "Mathematics",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })
    assert res_math.status_code == 201
    pred_math = res_math.get_json()["prediction"]
    adv_math = pred_math["early_warning_advisory"]
    assert adv_math is not None

    # Canonical backend keys
    assert "title" in adv_math
    assert "notice" in adv_math
    assert "false_negative_rate_estimate_pct" in adv_math
    assert "recommended_action" in adv_math

    # Mathematics: 16 false negatives out of 26 failing students (61.54%)
    assert adv_math["false_negative_rate_estimate_pct"] == 61.5

    # 2. Portuguese Language M0 Prediction
    res_port = client.post("/api/predictions", json={
        "subject": "Portuguese Language",
        "milestone": 0,
        "features": SAMPLE_M0_FEATURES,
    })
    assert res_port.status_code == 201
    pred_port = res_port.get_json()["prediction"]
    adv_port = pred_port["early_warning_advisory"]
    assert adv_port is not None

    # Canonical backend keys
    assert "title" in adv_port
    assert "notice" in adv_port
    assert "false_negative_rate_estimate_pct" in adv_port
    assert "recommended_action" in adv_port

    # Portuguese: 15 false negatives out of 20 failing students (75.00%)
    assert adv_port["false_negative_rate_estimate_pct"] == 75.0


def test_admin_list_predictions_pagination_total_count(client, clean_db, test_student, test_admin):
    """
    Verify Admin prediction listing returns accurate total_count even when
    the paginated limit is strictly smaller than the total record count.
    """
    login_user(client, test_student.email, "StudentPassword123!")

    # Create 3 predictions for test_student
    for _ in range(3):
        client.post("/api/predictions", json={
            "subject": "Mathematics",
            "milestone": 0,
            "features": SAMPLE_M0_FEATURES,
        })

    login_user(client, test_admin.email, "AdminPassword123!")

    # Request with limit=1
    res_page = client.get("/api/predictions?limit=1&skip=0")
    assert res_page.status_code == 200
    data = res_page.get_json()

    assert data["limit"] == 1
    assert len(data["predictions"]) == 1
    assert data["total_count"] == 3
    # Confirms total_count exceeds paginated record slice
    assert data["total_count"] > len(data["predictions"])

