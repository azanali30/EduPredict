"""
EduPredict - Phase 12 Persistent Notifications, Early-Warning Alerts & Feedback/Support Tests
Module: tests.test_phase_12_notifications_feedback
"""

import logging
from bson import ObjectId

from backend.models.academic_record_model import AcademicRecord
from backend.services.anomaly_service import AnomalyService
from backend.services.assignment_service import AssignmentService
from backend.services.dropout_service import DropoutService
from backend.services.enrollment_service import EnrollmentService
from backend.services.event_streamer import EventStreamer
from backend.services.notification_service import NotificationService
from backend.services.prediction_service import PredictionService
from backend.services.subject_service import SubjectService
from backend.services.user_service import UserService


def _login(client, email: str, password: str):
    return client.post("/auth/login", json={"email": email, "password": password})


def _high_risk_prediction_features():
    return {
        "school": "GP",
        "sex": "M",
        "age": 19,
        "address": "R",
        "famsize": "GT3",
        "Pstatus": "T",
        "Medu": 1,
        "Fedu": 1,
        "Mjob": "at_home",
        "Fjob": "other",
        "reason": "course",
        "guardian": "other",
        "traveltime": 3,
        "studytime": 1,
        "study_hours_per_week": 1.5,
        "failures": 3,
        "schoolsup": "no",
        "famsup": "no",
        "paid": "no",
        "activities": "no",
        "nursery": "no",
        "higher": "no",
        "internet": "no",
        "romantic": "yes",
        "famrel": 2,
        "freetime": 4,
        "goout": 5,
        "Dalc": 4,
        "Walc": 5,
        "health": 2,
        "absences": 28,
        "attendance_percentage": 53.33,
        "assignment_completion_rate": 25.0,
        "previous_exam_marks": 20.0,
        "quiz_scores": 20.0,
    }


def _low_risk_prediction_features():
    return {
        "school": "GP",
        "sex": "F",
        "age": 17,
        "address": "U",
        "famsize": "GT3",
        "Pstatus": "T",
        "Medu": 4,
        "Fedu": 4,
        "Mjob": "teacher",
        "Fjob": "services",
        "reason": "reputation",
        "guardian": "mother",
        "traveltime": 1,
        "studytime": 4,
        "study_hours_per_week": 12.0,
        "failures": 0,
        "schoolsup": "no",
        "famsup": "yes",
        "paid": "yes",
        "activities": "yes",
        "nursery": "yes",
        "higher": "yes",
        "internet": "yes",
        "romantic": "no",
        "famrel": 5,
        "freetime": 2,
        "goout": 2,
        "Dalc": 1,
        "Walc": 1,
        "health": 5,
        "absences": 0,
        "attendance_percentage": 100.0,
        "assignment_completion_rate": 95.0,
        "previous_exam_marks": 85.0,
        "quiz_scores": 88.0,
    }


def test_phase12_indexes_and_notification_lifecycle(clean_db, client, test_admin, test_teacher, test_student):
    """Verify MongoDB indexes, broadcasts, filtering, pagination, unread count, read transitions, and ownership IDOR."""
    assert "idx_notif_recipient_dedup_unique" in clean_db.notifications.index_information()
    assert "idx_feedback_sender_created" in clean_db.feedback_tickets.index_information()

    other_student, _ = UserService.create_user(
        clean_db, "student2@edupredict.com", "StudentPass123!", "Second Student", "student"
    )

    # Broadcast restricted to Admin
    _login(client, test_student.email, "StudentPassword123!")
    assert client.post("/api/notifications/broadcast", json={"title": "Test", "message": "Blocked"}).status_code == 403

    _login(client, test_teacher.email, "TeacherPassword123!")
    assert client.post("/api/notifications/broadcast", json={"title": "Test", "message": "Blocked"}).status_code == 403

    # Admin cannot target analyst in broadcasts
    _login(client, test_admin.email, "AdminPassword123!")
    bad_b = client.post(
        "/api/notifications/broadcast",
        json={"title": "Invalid Target", "message": "No analyst target", "target_roles": ["analyst"]},
    )
    assert bad_b.status_code == 400

    # Admin publishes sanitized broadcast to students and teachers
    b_res = client.post(
        "/api/notifications/broadcast",
        json={
            "title": "Term Notice <script>alert(1)</script>",
            "message": "Milestone 1 review opens Monday <img src=x onerror=alert(1)>.",
            "severity": "info",
            "target_roles": ["student", "teacher"],
        },
    )
    assert b_res.status_code == 201
    assert b_res.get_json()["recipient_count"] == 3  # 2 students + 1 teacher
    assert "<script>" not in b_res.get_json()["title"]

    # Extra notification for test_student to test filters & pagination
    NotificationService.create_notification(
        clean_db,
        recipient_id=test_student.id,
        recipient_role="student",
        category="early_warning",
        severity="critical",
        title="Warning Alert",
        message="Follow-up recommended.",
    )

    # Student checks unread count, filter, pagination, and read states
    _login(client, test_student.email, "StudentPassword123!")
    uc = client.get("/api/notifications/unread-count")
    assert uc.status_code == 200 and uc.get_json()["unread_count"] == 2

    filt = client.get("/api/notifications?category=early_warning&severity=critical&is_read=false&page=1&limit=1")
    assert filt.status_code == 200
    f_data = filt.get_json()
    assert f_data["total"] == 1
    assert f_data["notifications"][0]["title"] == "Warning Alert"

    student_notif_id = f_data["notifications"][0]["id"]

    # Student 2 cannot mark Student 1's notification read (IDOR -> 403)
    _login(client, other_student.email, "StudentPass123!")
    assert client.patch(f"/api/notifications/{student_notif_id}/read").status_code == 403
    # Student 2 list returns only their 1 broadcast, not Student 1's early_warning
    s2_list = client.get("/api/notifications")
    assert s2_list.status_code == 200 and s2_list.get_json()["total"] == 1

    # Student 1 marks 1 read, then remaining read-all
    _login(client, test_student.email, "StudentPassword123!")
    r_one = client.patch(f"/api/notifications/{student_notif_id}/read")
    assert r_one.status_code == 200 and r_one.get_json()["notification"]["is_read"] is True
    assert client.get("/api/notifications/unread-count").get_json()["unread_count"] == 1

    r_all = client.patch("/api/notifications/read-all")
    assert r_all.status_code == 200 and r_all.get_json()["modified_count"] == 1
    assert client.get("/api/notifications/unread-count").get_json()["unread_count"] == 0


def test_prediction_high_risk_alerts_scoping_and_deduplication(clean_db, test_admin, test_teacher, test_student):
    """High-Risk predictions notify Student, assigned term-matched Teacher, and Admin without spam or cross-subject leaks."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    other_teacher, _ = UserService.create_user(
        clean_db, "port.teacher@edupredict.com", "TeacherPass123!", "Port Only Teacher", "teacher"
    )
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2026-T1", test_admin.id)
    AssignmentService.assign_teacher_to_subject(clean_db, other_teacher.id, port_subj.id, "2026-T1", test_admin.id)
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1", test_admin.id)

    # Low-risk prediction creates ZERO alerts
    low_rec, low_err, low_code = PredictionService.create_prediction(
        clean_db, test_student.id, test_teacher, "Mathematics", 2, _low_risk_prediction_features(), academic_term="2026-T1"
    )
    assert low_code == 201 and low_err is None
    assert clean_db.notifications.count_documents({}) == 0

    # High-risk M2 prediction notifies Student, Math Teacher, Admin — NOT Portuguese-only Teacher
    hi_rec, hi_err, hi_code = PredictionService.create_prediction(
        clean_db, test_student.id, test_teacher, "Mathematics", 2, _high_risk_prediction_features(), academic_term="2026-T1"
    )
    assert hi_code == 201 and hi_err is None
    assert hi_rec.predicted_status == "High Risk"

    assert clean_db.notifications.count_documents({"recipient_id": test_student.id, "category": "early_warning"}) == 1
    assert clean_db.notifications.count_documents({"recipient_id": test_teacher.id, "category": "early_warning"}) == 1
    assert clean_db.notifications.count_documents({"recipient_id": test_admin.id, "category": "early_warning"}) == 1
    assert clean_db.notifications.count_documents({"recipient_id": other_teacher.id}) == 0

    # Provenance traceable
    notif_doc = clean_db.notifications.find_one({"recipient_id": test_student.id})
    assert notif_doc["provenance"]["trigger_type"] == "prediction_high_risk"
    assert notif_doc["provenance"]["source_id"] == str(hi_rec.id)

    # Re-evaluating identical milestone & term must NOT duplicate notifications
    _, _, code2 = PredictionService.create_prediction(
        clean_db, test_student.id, test_teacher, "Mathematics", 2, _high_risk_prediction_features(), academic_term="2026-T1"
    )
    assert code2 == 201
    assert clean_db.notifications.count_documents({"recipient_id": test_student.id, "category": "early_warning"}) == 1
    assert clean_db.notifications.count_documents({"recipient_id": test_teacher.id, "category": "early_warning"}) == 1


def test_dropout_and_confirmed_anomaly_alerts_and_failure_isolation(
    clean_db, test_admin, test_teacher, test_student, monkeypatch, caplog
):
    """Verify Dropout High-Risk + Confirmed Anomaly alerts, deduplication, and fail-safe pipeline isolation."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2026-T1", test_admin.id)
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1", test_admin.id)

    high_dropout_features = {
        "Tuition fees up to date": 0,
        "Debtor": 1,
        "Scholarship holder": 0,
        "Curricular units 1st sem (enrolled)": 6,
        "Curricular units 1st sem (approved)": 0,
        "Curricular units 1st sem (grade)": 0.0,
        "Curricular units 2nd sem (enrolled)": 6,
        "Curricular units 2nd sem (approved)": 0,
        "Curricular units 2nd sem (grade)": 0.0,
    }
    res_d, err_d, code_d = DropoutService.record_student_assessment(
        clean_db, test_student.id, high_dropout_features, test_admin, academic_term="2026-T1", subject="Mathematics"
    )
    assert code_d == 201 and err_d is None and res_d["risk_tier"] == "High"
    assert clean_db.notifications.count_documents({"recipient_id": test_student.id, "category": "dropout_risk"}) == 1
    assert clean_db.notifications.count_documents({"recipient_id": test_teacher.id, "category": "dropout_risk"}) == 1

    # Repeated dropout assessment deduplicates
    res_d2, err_d2, code_d2 = DropoutService.record_student_assessment(
        clean_db, test_student.id, high_dropout_features, test_admin, academic_term="2026-T1", subject="Mathematics"
    )
    assert code_d2 == 201 and err_d2 is None and res_d2["risk_tier"] == "High"
    assert clean_db.notifications.count_documents({"recipient_id": test_student.id, "category": "dropout_risk"}) == 1

    # Confirmed institutional anomaly notifies Teacher & Admin, NOT Student
    anom_rec, a_err = AnomalyService.evaluate_and_store_record(
        db=clean_db,
        record_data={
            "school": "MS", "sex": "M", "age": 22, "address": "R", "famsize": "LE3", "Pstatus": "A",
            "Medu": 0, "Fedu": 0, "Mjob": "at_home", "Fjob": "at_home", "reason": "other", "guardian": "other",
            "traveltime": 4, "studytime": 1, "failures": 3, "schoolsup": "yes", "famsup": "no", "paid": "yes",
            "activities": "no", "nursery": "no", "higher": "no", "internet": "no", "romantic": "yes",
            "famrel": 1, "freetime": 5, "goout": 5, "Dalc": 5, "Walc": 5, "health": 1, "absences": 68,
        },
        subject="Mathematics",
        actor_user=test_teacher,
        source_record_id="ANOM-ALERT-1",
        student_id=test_student.id,
        is_benchmark=False,
        academic_term="2026-T1",
    )
    assert a_err is None and anom_rec is not None
    assert clean_db.notifications.count_documents({"category": "anomaly_alert"}) == 0

    upd, u_err, u_code = AnomalyService.update_review_status(
        clean_db, str(anom_rec.id), "Confirmed Anomaly", "Verified divergence.", test_teacher
    )
    assert u_code == 200 and u_err is None and upd["review_status"] == "Confirmed Anomaly"
    assert clean_db.notifications.count_documents({"recipient_id": test_teacher.id, "category": "anomaly_alert"}) == 1
    assert clean_db.notifications.count_documents({"recipient_id": test_admin.id, "category": "anomaly_alert"}) == 1
    assert clean_db.notifications.count_documents({"recipient_id": test_student.id, "category": "anomaly_alert"}) == 0

    # Benchmark anomaly confirmation emits zero alerts
    bench_rec, _ = AnomalyService.evaluate_and_store_record(
        db=clean_db,
        record_data={"studytime": 1, "absences": 50, "failures": 3, "school": "MS", "age": 22},
        subject="Mathematics",
        actor_user=test_admin,
        source_record_id="BENCH-1",
        is_benchmark=True,
    )
    AnomalyService.update_review_status(clean_db, str(bench_rec.id), "Confirmed Anomaly", "Benchmark check.", test_admin)
    assert clean_db.notifications.count_documents({"category": "anomaly_alert"}) == 2  # unchanged (teacher + admin)

    # Notification dispatch failure MUST NEVER break predictions, dropout, anomaly review, or stream ingestion, and logs no student PII
    import pymongo.collection

    orig_insert_one = pymongo.collection.Collection.insert_one

    def exploded_notif_insert(self, document, *args, **kwargs):
        if getattr(self, "name", "") == "notifications":
            raise RuntimeError("Simulated notification store outage")
        return orig_insert_one(self, document, *args, **kwargs)

    monkeypatch.setattr(pymongo.collection.Collection, "insert_one", exploded_notif_insert)
    caplog.set_level(logging.WARNING)

    pred_ok, pred_fail_err, pred_fail_code = PredictionService.create_prediction(
        clean_db, test_student.id, test_admin, "Mathematics", 2, _high_risk_prediction_features(), academic_term="2026-T2"
    )
    assert pred_fail_code == 201 and pred_fail_err is None and pred_ok is not None

    dropout_student2, _ = UserService.create_user(
        clean_db, "dropout.isolated@edupredict.com", "StudentPass123!", "Isolated Dropout Student", "student"
    )
    drop_ok, drop_fail_err, drop_fail_code = DropoutService.record_student_assessment(
        clean_db, dropout_student2.id, high_dropout_features, test_admin, academic_term="2026-T2", subject="Mathematics"
    )
    assert drop_fail_code == 201 and drop_fail_err is None and drop_ok is not None

    # Confirm an institutional anomaly while notifications collection is down -> still succeeds 200
    anom_rec2, _ = AnomalyService.evaluate_and_store_record(
        db=clean_db,
        record_data={
            "school": "MS", "sex": "M", "age": 22, "address": "R", "famsize": "LE3", "Pstatus": "A",
            "Medu": 0, "Fedu": 0, "Mjob": "at_home", "Fjob": "at_home", "reason": "other", "guardian": "other",
            "traveltime": 4, "studytime": 1, "failures": 3, "schoolsup": "yes", "famsup": "no", "paid": "yes",
            "activities": "no", "nursery": "no", "higher": "no", "internet": "no", "romantic": "yes",
            "famrel": 1, "freetime": 5, "goout": 5, "Dalc": 5, "Walc": 5, "health": 1, "absences": 68,
        },
        subject="Mathematics",
        actor_user=test_admin,
        source_record_id="ANOM-ALERT-OUTAGE",
        student_id=test_student.id,
        is_benchmark=False,
        academic_term="2026-T1",
    )
    upd2, u_err2, u_code2 = AnomalyService.update_review_status(
        clean_db, str(anom_rec2.id), "Confirmed Anomaly", "Outage resiliency test.", test_admin
    )
    assert u_code2 == 200 and u_err2 is None and upd2["review_status"] == "Confirmed Anomaly"

    stream_res, stream_err, stream_code = EventStreamer.ingest_event(
        clean_db,
        {
            "event_id": "evt-notif-fail-safe",
            "event_type": "assessment_result",
            "student_id": str(test_student.id),
            "subject": "Mathematics",
            "academic_term": "2026-T3",
            "payload": {
                "score": 15,
                "max_score": 100,
                "g1": 3,
                "g2": 3,
                "milestone": 2,
                "prediction_features": _high_risk_prediction_features(),
            },
        },
        actor_user=test_admin,
    )
    assert stream_code == 201 and stream_err is None and stream_res["status"] == "processed"
    assert stream_res["event"]["prediction_id"] is not None
    assert "alert dispatch failed safely" in caplog.text.lower()
    assert "prediction alert dispatch failed safely" in caplog.text.lower()
    assert "dropout alert dispatch failed safely" in caplog.text.lower()
    assert "confirmed anomaly alert dispatch failed safely" in caplog.text.lower()
    assert test_student.email not in caplog.text
    assert test_student.full_name not in caplog.text
    assert dropout_student2.email not in caplog.text
    assert dropout_student2.full_name not in caplog.text


def test_feedback_workflow_rbac_idor_and_transitions(clean_db, client, test_admin, test_teacher, test_student):
    """Verify Student/Teacher feedback submission, counseling sharing RBAC, IDOR isolation, and Admin transitions."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    other_student, _ = UserService.create_user(
        clean_db, "peer.student@edupredict.com", "StudentPass123!", "Peer Student", "student"
    )
    unassigned_teacher, _ = UserService.create_user(
        clean_db, "port.teacher2@edupredict.com", "TeacherPass123!", "Port Teacher Two", "teacher"
    )
    AssignmentService.assign_teacher_to_subject(clean_db, test_teacher.id, math_subj.id, "2026-T1", test_admin.id)
    AssignmentService.assign_teacher_to_subject(clean_db, unassigned_teacher.id, port_subj.id, "2026-T1", test_admin.id)
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1", test_admin.id)

    # 1. Student cannot tamper sender_id or initial status
    _login(client, test_student.email, "StudentPassword123!")
    tamper = client.post(
        "/api/feedback",
        json={
            "category": "Technical Issue",
            "title": "Tamper test",
            "message": "Should be blocked",
            "status": "Resolved",
        },
    )
    assert tamper.status_code == 403

    # 2. Student submits private technical ticket & shared Math Academic Counseling request
    priv_res = client.post(
        "/api/feedback",
        json={
            "category": "Technical Issue",
            "title": "Login Help <script>xss()</script>",
            "message": "Need help understanding score < 50 threshold.",
        },
    )
    assert priv_res.status_code == 201
    priv_ticket = priv_res.get_json()["ticket"]
    assert priv_ticket["status"] == "Open"
    assert "<script>" not in priv_ticket["title"]
    assert "score < 50" in priv_ticket["message"]

    couns_res = client.post(
        "/api/feedback",
        json={
            "category": "Academic Counseling",
            "subject_id": str(math_subj.id),
            "academic_term": "2026-T1",
            "share_with_instructor": True,
            "title": "Math Tutoring Request",
            "message": "Requesting extra Calculus practice sessions before Milestone 1.",
        },
    )
    assert couns_res.status_code == 201
    couns_id = couns_res.get_json()["ticket"]["id"]

    # 3. Other student cannot read either ticket (IDOR -> 403)
    _login(client, other_student.email, "StudentPass123!")
    assert client.get(f"/api/feedback/{priv_ticket['id']}").status_code == 403
    assert client.get(f"/api/feedback/{couns_id}").status_code == 403
    assert client.get("/api/feedback").get_json()["total"] == 0

    # 4. Authorized Math teacher can view shared Math counseling ticket, NEVER private ticket, and cannot PATCH status
    _login(client, test_teacher.email, "TeacherPassword123!")
    assert client.get(f"/api/feedback/{couns_id}").status_code == 200
    assert client.get(f"/api/feedback/{priv_ticket['id']}").status_code == 403
    assert client.patch(f"/api/feedback/{couns_id}", json={"status": "Resolved"}).status_code == 403

    # Teacher submits own inquiry
    t_sub = client.post(
        "/api/feedback",
        json={
            "category": "Curriculum & Grading",
            "subject_id": str(math_subj.id),
            "title": "Weighting Inquiry",
            "message": "Question on Milestone 1 weighting notes.",
        },
    )
    assert t_sub.status_code == 201
    t_ticket_id = t_sub.get_json()["ticket"]["id"]
    assert client.get("/api/feedback").get_json()["total"] == 2  # own + authorized math counseling

    # 5. Unassigned teacher cannot view student's Math counseling OR other teacher's ticket
    _login(client, unassigned_teacher.email, "TeacherPass123!")
    assert client.get(f"/api/feedback/{couns_id}").status_code == 403
    assert client.get(f"/api/feedback/{t_ticket_id}").status_code == 403

    # 6. Admin reviews and transitions Open -> Reviewed -> Resolved; backward transition Rejected
    _login(client, test_admin.email, "AdminPassword123!")
    adm_list = client.get("/api/feedback?status=Open")
    assert adm_list.status_code == 200 and adm_list.get_json()["total"] == 3

    r1 = client.patch(
        f"/api/feedback/{couns_id}",
        json={
            "status": "Reviewed",
            "admin_response": "Assigned to Wednesday peer tutoring group.",
            "intervention_notes": "Instructor notified for M1 follow-up.",
        },
    )
    assert r1.status_code == 200 and r1.get_json()["ticket"]["status"] == "Reviewed"

    r2 = client.patch(
        f"/api/feedback/{couns_id}",
        json={"status": "Resolved", "admin_response": "Tutoring session confirmed."},
    )
    assert r2.status_code == 200 and r2.get_json()["ticket"]["status"] == "Resolved"

    # Invalid status and backward transition rejected
    assert client.patch(f"/api/feedback/{couns_id}", json={"status": "Open"}).status_code == 400
    assert client.patch(f"/api/feedback/{couns_id}", json={"status": "ClosedInvalid"}).status_code == 400

    # Student received status notification & sees admin response
    _login(client, test_student.email, "StudentPassword123!")
    st_notifs = client.get("/api/notifications?category=feedback_update").get_json()
    assert st_notifs["total"] >= 1


def test_analyst_strictly_blocked_and_csrf_enforced(app, clean_db, client, test_analyst, test_student):
    """Verify Analyst 403 blocks across notifications/feedback and CSRF validation works on state-changing calls."""
    _login(client, test_analyst.email, "AnalystPassword123!")
    assert client.get("/api/notifications").status_code == 403
    assert client.get("/api/notifications/unread-count").status_code == 403
    assert client.patch("/api/notifications/read-all").status_code == 403
    assert client.post("/api/notifications/broadcast", json={"title": "x", "message": "y"}).status_code == 403
    assert client.get("/api/feedback").status_code == 403
    assert client.post("/api/feedback", json={"category": "Course Feedback", "title": "x", "message": "yyyyy"}).status_code == 403

    # Verify CSRF protection when WTF_CSRF_ENABLED is active
    prev_csrf = app.config.get("WTF_CSRF_ENABLED", False)
    app.config["WTF_CSRF_ENABLED"] = True
    try:
        csrf_client = app.test_client()
        token = csrf_client.get("/api/csrf-token").get_json()["csrf_token"]
        csrf_client.post(
            "/auth/login",
            json={"email": test_student.email, "password": "StudentPassword123!"},
            headers={"X-CSRFToken": token},
        )
        # Missing CSRF token -> 400 CSRF validation failed
        no_csrf = csrf_client.post(
            "/api/feedback",
            json={"category": "Course Feedback", "title": "No CSRF", "message": "Should fail CSRF validation."},
        )
        assert no_csrf.status_code == 400

        # Refresh token & pass header -> 201 Created
        token2 = csrf_client.get("/api/csrf-token").get_json()["csrf_token"]
        with_csrf = csrf_client.post(
            "/api/feedback",
            json={"category": "Course Feedback", "title": "Valid CSRF", "message": "Saved cleanly with CSRF header."},
            headers={"X-CSRFToken": token2},
        )
        assert with_csrf.status_code == 201
    finally:
        app.config["WTF_CSRF_ENABLED"] = prev_csrf
