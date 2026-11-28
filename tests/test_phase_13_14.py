"""
EduPredict - Combined Phase 13 + Phase 14 Verification Tests
Module: tests.test_phase_13_14
Covers Workstream A (Attendance Register, Academic Records, Truthful Dashboards / SDC)
and Workstream B (Tableau BI Exports/Workbook, Training Notebook, Parallel Benchmark).
"""

import io
from datetime import datetime, timedelta, timezone

from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService
from backend.services.prediction_service import PredictionService
from backend.services.subject_service import SubjectService
from backend.services.user_service import UserService


def _login(client, email: str, password: str):
    return client.post("/auth/login", json={"email": email, "password": password})


def _sample_prediction_features(absences: int = 12):
    return {
        "school": "GP",
        "sex": "F",
        "age": 17,
        "address": "U",
        "famsize": "GT3",
        "Pstatus": "T",
        "Medu": 4,
        "Fedu": 3,
        "Mjob": "teacher",
        "Fjob": "services",
        "reason": "course",
        "guardian": "mother",
        "traveltime": 1,
        "studytime": 3,
        "study_hours_per_week": 10.0,
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
        "goout": 2,
        "Dalc": 1,
        "Walc": 1,
        "health": 4,
        "absences": absences,
        "attendance_percentage": round(max(0.0, 100.0 - (absences / 60.0) * 100.0), 2),
        "assignment_completion_rate": 85.0,
        "previous_exam_marks": 75.0,
        "quiz_scores": 75.0,
    }


def _setup_math_and_portuguese(clean_db, admin_user, math_teacher, student):
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    AssignmentService.assign_teacher_to_subject(clean_db, math_teacher.id, math_subj.id, "2026-T1", admin_user.id)
    EnrollmentService.enroll_student(clean_db, student.id, math_subj.id, "2026-T1", admin_user.id)
    EnrollmentService.enroll_student(clean_db, student.id, port_subj.id, "2026-T1", admin_user.id)
    return math_subj, port_subj


# ---------------------------------------------------------------------------
# STAGE 2: REAL ATTENDANCE REGISTER TESTS
# ---------------------------------------------------------------------------

def test_attendance_register_lifecycle_counts_and_proxy_separation(
    client, clean_db, test_admin, test_teacher, test_student
):
    math_subj, port_subj = _setup_math_and_portuguese(clean_db, test_admin, test_teacher, test_student)
    student2, _ = UserService.create_user(
        clean_db, "student2.att@edupredict.com", "StudentPass123!", "Student Two", "student"
    )
    EnrollmentService.enroll_student(clean_db, student2.id, math_subj.id, "2026-T1", test_admin.id)

    # Create a prediction with absences=12 (Estimated ML Proxy = 80.0%) BEFORE attendance sessions
    pred, p_err, p_code = PredictionService.create_prediction(
        clean_db, test_student.id, test_teacher, "Mathematics", 2, _sample_prediction_features(absences=12), "2026-T1"
    )
    assert p_code == 201 and p_err is None
    orig_ml_absences = pred.features_summary["absences"]["value"]
    assert orig_ml_absences == 12

    # Student with 0 roll-call sessions gets null attendance_percentage (not 0 or fake 92)
    _login(client, test_student.email, "StudentPassword123!")
    r0 = client.get("/api/attendance/student/my")
    assert r0.status_code == 200
    d0 = r0.get_json()
    assert d0["verified_institutional_attendance"]["has_records"] is False
    assert d0["verified_institutional_attendance"]["overall_attendance_percentage"] is None
    assert d0["estimated_ml_proxy"]["absences"] == 12
    assert d0["estimated_ml_proxy"]["estimated_attendance_percentage"] == 80.0
    assert d0["estimated_ml_proxy"]["is_verified_roll_call"] is False

    # Teacher creates 4 valid past/today sessions for Mathematics
    today = datetime.now(timezone.utc).date()
    dates = [(today - timedelta(days=i)).isoformat() for i in range(4, 0, -1)]
    statuses = ["Present", "Present", "Late", "Absent"]

    _login(client, test_teacher.email, "TeacherPassword123!")
    created_session_ids = []
    for idx, (s_date, st_val) in enumerate(zip(dates, statuses), start=1):
        resp = client.post(
            "/api/attendance/sessions",
            json={
                "subject_id": str(math_subj.id),
                "academic_term": "2026-T1",
                "session_date": s_date,
                "session_title": f"Lecture {idx}",
                "notes": f"Topic {idx}",
                "records": [
                    {"student_id": str(test_student.id), "status": st_val, "remarks": "Note" if st_val == "Late" else ""},
                    {"student_id": str(student2.id), "status": "Present"},
                ],
            },
        )
        assert resp.status_code == 201
        payload = resp.get_json()
        created_session_ids.append(payload["session"]["id"])
        assert payload["session"]["attendance_source"] == "verified_institutional_register"

    # Update session 4 for test_student from Absent -> Excused, then verify recomputed counts & no duplicate rows
    r_upd = client.put(
        f"/api/attendance/sessions/{created_session_ids[-1]}/records",
        json={
            "notes": "Medical note submitted",
            "records": [
                {"student_id": str(test_student.id), "status": "Excused", "remarks": "Doctor letter"},
                {"student_id": str(student2.id), "status": "Present"},
            ],
        },
    )
    assert r_upd.status_code == 200
    assert r_upd.get_json()["session"]["excused_count"] == 1
    assert r_upd.get_json()["session"]["absent_count"] == 0
    assert clean_db.attendance_records.count_documents({"session_id": clean_db.attendance_sessions.find_one({"session_title": "Lecture 4"})["_id"]}) == 2

    # Change Lecture 4 back to Absent so test_student has 2 Present, 1 Late, 1 Absent => 3/4 = 75.0%
    client.put(
        f"/api/attendance/sessions/{created_session_ids[-1]}/records",
        json={
            "records": [
                {"student_id": str(test_student.id), "status": "Absent"},
                {"student_id": str(student2.id), "status": "Present"},
            ]
        },
    )

    # Verify Student private attendance view reflects real roll-call 75.0% while ML proxy stayed 80.0%
    _login(client, test_student.email, "StudentPassword123!")
    r_stu = client.get("/api/attendance/student/my")
    assert r_stu.status_code == 200
    d_stu = r_stu.get_json()
    ver = d_stu["verified_institutional_attendance"]
    assert ver["label"] == "Verified Institutional Attendance"
    assert ver["total_sessions"] == 4
    assert ver["present_count"] == 2
    assert ver["late_count"] == 1
    assert ver["absent_count"] == 1
    assert ver["excused_count"] == 0
    assert ver["overall_attendance_percentage"] == 75.0

    # Math should be 75.0%, Portuguese should show has_records=False & None
    subj_map = {s["subject_name"]: s for s in ver["subject_summaries"]}
    assert subj_map["Mathematics"]["attendance_percentage"] == 75.0
    assert subj_map[port_subj.name]["has_records"] is False
    assert subj_map[port_subj.name]["attendance_percentage"] is None

    # Confirm ML prediction document & Estimated ML Proxy were NOT modified
    reloaded_pred = clean_db.predictions.find_one({"_id": pred.id})
    assert reloaded_pred["features_summary"]["absences"]["value"] == 12
    assert d_stu["estimated_ml_proxy"]["estimated_attendance_percentage"] == 80.0


def test_attendance_validation_duplicates_and_rbac_idor(
    client, clean_db, test_admin, test_teacher, test_student, test_analyst
):
    math_subj, port_subj = _setup_math_and_portuguese(clean_db, test_admin, test_teacher, test_student)
    port_teacher, _ = UserService.create_user(
        clean_db, "port.teacher.att@edupredict.com", "TeacherPass123!", "Port Teacher", "teacher"
    )
    AssignmentService.assign_teacher_to_subject(clean_db, port_teacher.id, port_subj.id, "2026-T1", test_admin.id)

    other_student, _ = UserService.create_user(
        clean_db, "other.student.att@edupredict.com", "StudentPass123!", "Other Student", "student"
    )

    today_str = datetime.now(timezone.utc).date().isoformat()
    future_str = (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat()

    _login(client, test_teacher.email, "TeacherPassword123!")

    # Reject future date
    r_fut = client.post(
        "/api/attendance/sessions",
        json={"subject_id": str(math_subj.id), "academic_term": "2026-T1", "session_date": future_str},
    )
    assert r_fut.status_code == 400

    # Reject unassigned subject
    r_unassigned = client.post(
        "/api/attendance/sessions",
        json={"subject_id": str(port_subj.id), "academic_term": "2026-T1", "session_date": today_str},
    )
    assert r_unassigned.status_code == 403

    # Reject invalid status
    r_bad_status = client.post(
        "/api/attendance/sessions",
        json={
            "subject_id": str(math_subj.id),
            "academic_term": "2026-T1",
            "session_date": today_str,
            "records": [{"student_id": str(test_student.id), "status": "Skipped"}],
        },
    )
    assert r_bad_status.status_code == 400

    # Reject unenrolled student
    r_unenrolled = client.post(
        "/api/attendance/sessions",
        json={
            "subject_id": str(math_subj.id),
            "academic_term": "2026-T1",
            "session_date": today_str,
            "records": [{"student_id": str(other_student.id), "status": "Present"}],
        },
    )
    assert r_unenrolled.status_code == 403

    # Create valid Math session
    r_ok = client.post(
        "/api/attendance/sessions",
        json={
            "subject_id": str(math_subj.id),
            "academic_term": "2026-T1",
            "session_date": today_str,
            "session_title": "Morning Section",
            "records": [{"student_id": str(test_student.id), "status": "Present"}],
        },
    )
    assert r_ok.status_code == 201
    sess_id = r_ok.get_json()["session"]["id"]

    # Reject duplicate session for same subject + term + date + title
    r_dup = client.post(
        "/api/attendance/sessions",
        json={
            "subject_id": str(math_subj.id),
            "academic_term": "2026-T1",
            "session_date": today_str,
            "session_title": "Morning Section",
        },
    )
    assert r_dup.status_code == 409

    # Cross-teacher IDOR: port_teacher cannot inspect or update test_teacher's Math session
    _login(client, port_teacher.email, "TeacherPass123!")
    assert client.get(f"/api/attendance/sessions/{sess_id}").status_code == 403
    assert client.put(
        f"/api/attendance/sessions/{sess_id}/records",
        json={"records": [{"student_id": str(test_student.id), "status": "Absent"}]},
    ).status_code == 403
    assert client.get(f"/api/attendance/sessions?subject_id={math_subj.id}").status_code == 403

    # Student cross-student IDOR & session route restriction
    _login(client, other_student.email, "StudentPass123!")
    assert client.get(f"/api/attendance/summary?student_id={test_student.id}").status_code == 403
    assert client.get("/api/attendance/sessions").status_code == 403
    assert client.get(f"/api/attendance/sessions/{sess_id}").status_code == 403

    # Analyst blocked from individual/operational attendance routes
    _login(client, test_analyst.email, "AnalystPassword123!")
    assert client.get("/api/attendance/sessions").status_code == 403
    assert client.get("/api/attendance/student/my").status_code == 403
    assert client.get("/api/attendance/summary").status_code == 403


# ---------------------------------------------------------------------------
# STAGE 4: ACADEMIC RECORDS INGESTION, VALIDATION, CRUD & CSV IMPORT TESTS
# ---------------------------------------------------------------------------

def test_academic_records_crud_csv_import_and_rbac(
    client, clean_db, test_admin, test_teacher, test_student, test_analyst
):
    math_subj, port_subj = _setup_math_and_portuguese(clean_db, test_admin, test_teacher, test_student)
    student2, _ = UserService.create_user(
        clean_db, "student2.rec@edupredict.com", "StudentPass123!", "Student Rec Two", "student"
    )
    unenrolled_student, _ = UserService.create_user(
        clean_db, "student3.un@edupredict.com", "StudentPass123!", "Unenrolled Stu", "student"
    )
    EnrollmentService.enroll_student(clean_db, student2.id, math_subj.id, "2026-T1", test_admin.id)

    port_teacher, _ = UserService.create_user(
        clean_db, "port.rec.teacher@edupredict.com", "TeacherPass123!", "Port Rec Teacher", "teacher"
    )
    AssignmentService.assign_teacher_to_subject(clean_db, port_teacher.id, port_subj.id, "2026-T1", test_admin.id)

    # Teacher creates single academic record in Mathematics
    _login(client, test_teacher.email, "TeacherPassword123!")
    r_create = client.post(
        "/api/academic-records",
        json={
            "student_id": str(test_student.id),
            "subject_id": str(math_subj.id),
            "term": "2026-T1",
            "g1": 14,
            "g2": 15.5,
            "final_exam_marks": 16,
            "assignment_completion_rate": 90.0,
            "quiz_average": 84.5,
            "study_hours_per_week": 10.0,
            "notes": "Midterm verified <script>alert(1)</script> strong",
        },
    )
    assert r_create.status_code == 201
    rec_data = r_create.get_json()["record"]
    rec_id = rec_data["id"]
    assert "<script>" not in (rec_data["notes"] or "")
    assert rec_data["g1"] == 14.0 and rec_data["final_exam_marks"] == 16.0
    assert clean_db.predictions.count_documents({}) == 0
    assert clean_db.attendance_records.count_documents({}) == 0

    # Duplicate (student, subject, term) returns 409 Conflict
    r_dup = client.post(
        "/api/academic-records",
        json={
            "student_id": str(test_student.id),
            "subject_id": str(math_subj.id),
            "term": "2026-T1",
            "g1": 12,
        },
    )
    assert r_dup.status_code == 409

    # Range validation rejects invalid score > 20
    r_oob = client.post(
        "/api/academic-records",
        json={
            "student_id": str(student2.id),
            "subject_id": str(math_subj.id),
            "term": "2026-T1",
            "g1": 25.0,
        },
    )
    assert r_oob.status_code == 400

    # Update record via PUT
    r_upd = client.put(
        f"/api/academic-records/{rec_id}",
        json={"g2": 16.5, "quiz_average": 88.0},
    )
    assert r_upd.status_code == 200
    assert r_upd.get_json()["record"]["g2"] == 16.5

    # CSV Bulk import: 1 valid (student2), 1 duplicate (test_student), 1 unenrolled (rejected), 1 OOB (rejected)
    csv_payload = "\n".join([
        "student_email,subject,term,g1,g2,final_exam_marks,assignment_completion_rate,quiz_average,study_hours_per_week",
        f"{student2.email},Mathematics,2026-T1,13,14,14.5,88,80,9",
        f"{test_student.email},Mathematics,2026-T1,14,15,16,90,85,10",
        f"{unenrolled_student.email},Mathematics,2026-T1,12,13,13,75,70,8",
        f"{student2.email},Mathematics,2026-T2,29,14,14,80,80,9",
    ])
    r_csv = client.post(
        "/api/academic-records/import-csv",
        json={"csv_content": csv_payload},
    )
    assert r_csv.status_code == 200
    summary = r_csv.get_json()["summary"]
    assert summary["total_rows"] == 4
    assert summary["successful"] == 1
    assert summary["duplicate"] == 1
    assert summary["rejected"] == 2
    assert len(summary["errors"]) == 3

    # Cross-teacher IDOR: port_teacher cannot view or edit Math record
    _login(client, port_teacher.email, "TeacherPass123!")
    assert client.get(f"/api/academic-records/{rec_id}").status_code == 403
    assert client.put(f"/api/academic-records/{rec_id}", json={"g1": 5}).status_code == 403

    # Student can read own records, cannot read others or write/import
    _login(client, test_student.email, "StudentPassword123!")
    r_stu_list = client.get("/api/academic-records")
    assert r_stu_list.status_code == 200
    assert len(r_stu_list.get_json()["records"]) == 1
    assert r_stu_list.get_json()["records"][0]["student_id"] == str(test_student.id)
    assert client.get(f"/api/academic-records?student_id={student2.id}").status_code == 403
    assert client.post("/api/academic-records", json={"student_id": str(test_student.id)}).status_code == 403
    assert client.put(f"/api/academic-records/{rec_id}", json={"g1": 19}).status_code == 403
    assert client.post("/api/academic-records/import-csv", json={"csv_content": csv_payload}).status_code == 403

    # Analyst strictly blocked from operational academic-records endpoints
    _login(client, test_analyst.email, "AnalystPassword123!")
    assert client.get("/api/academic-records").status_code == 403
    assert client.post("/api/academic-records", json={}).status_code == 403


# ---------------------------------------------------------------------------
# STAGE 5: ANALYST TRENDS & N < 5 SDC SUPPRESSION TESTS
# ---------------------------------------------------------------------------

def test_analyst_trends_real_aggregation_and_sdc_suppression(
    client, clean_db, test_admin, test_teacher, test_student, test_analyst
):
    SubjectService.ensure_canonical_subjects(clean_db)
    # Non-analyst blocked
    _login(client, test_teacher.email, "TeacherPassword123!")
    assert client.get("/api/analyst/trends").status_code == 403

    _login(client, test_analyst.email, "AnalystPassword123!")
    r_empty = client.get("/api/analyst/trends")
    assert r_empty.status_code == 200
    d_empty = r_empty.get_json()
    assert d_empty["trend_available"] is False
    assert d_empty["institutional_suppressed"] is True
    assert d_empty["growth_delta_raw20"] is None
    assert "Not enough data" in d_empty["trend_message"]

    # Insert 3 distinct students in 2025-T1 (<5 -> MUST be suppressed)
    students_t1 = [test_student.id]
    for i in range(2):
        u, _ = UserService.create_user(clean_db, f"t1s{i}@edupredict.com", "PassWord123!", f"T1 Stu {i}", "student")
        students_t1.append(u.id)

    for sid in students_t1:
        clean_db.predictions.insert_one({
            "student_id": sid,
            "subject": "Mathematics",
            "academic_term": "2025-T1",
            "predicted_grade_raw20": 12.0,
            "predicted_marks": 60.0,
        })

    r_small = client.get("/api/analyst/trends")
    assert r_small.status_code == 200
    d_small = r_small.get_json()
    assert d_small["institutional_suppressed"] is True
    assert d_small["term_trends"][0]["suppressed"] is True
    assert d_small["term_trends"][0]["student_count"] is None
    assert d_small["term_trends"][0]["institutional_avg_raw20"] is None

    # Now add 5 distinct Math students in 2025-T2 (avg 13.0) and 5 in 2026-T1 (avg 15.0)
    students_5 = []
    for i in range(5):
        u, _ = UserService.create_user(clean_db, f"cohort5_{i}@edupredict.com", "PassWord123!", f"Cohort Stu {i}", "student")
        students_5.append(u.id)

    for sid in students_5:
        clean_db.predictions.insert_one({
            "student_id": sid,
            "subject": "Mathematics",
            "academic_term": "2025-T2",
            "predicted_grade_raw20": 13.0,
            "predicted_marks": 65.0,
        })
        clean_db.predictions.insert_one({
            "student_id": sid,
            "subject": "Mathematics",
            "academic_term": "2026-T1",
            "predicted_grade_raw20": 15.0,
            "predicted_marks": 75.0,
        })

    r_ok = client.get("/api/analyst/trends")
    assert r_ok.status_code == 200
    d_ok = r_ok.get_json()
    assert d_ok["institutional_suppressed"] is False
    assert d_ok["trend_available"] is True
    assert d_ok["growth_delta_raw20"] == 2.0  # 15.0 - 13.0
    by_term = {t["term"]: t for t in d_ok["term_trends"]}
    assert by_term["2025-T1"]["suppressed"] is True
    assert by_term["2025-T2"]["suppressed"] is False
    assert by_term["2025-T2"]["math_avg_raw20"] == 13.0
    assert by_term["2026-T1"]["math_avg_raw20"] == 15.0
    # Verify zero student PII appears anywhere in JSON payload
    raw_text = str(d_ok)
    assert "cohort5_" not in raw_text
    assert test_student.email not in raw_text


# ---------------------------------------------------------------------------
# STAGE 7 & 8: TABLEAU BI EXPORTS, SDC, FORMULA INJECTION & XML WORKBOOK TESTS
# ---------------------------------------------------------------------------

def test_tableau_exports_rbac_sdc_formula_safety_and_twb_xml(
    client, clean_db, test_admin, test_teacher, test_student, test_analyst
):
    import xml.etree.ElementTree as ET
    from pathlib import Path

    # 1. Validate Tableau XML Workbook parses cleanly and defines datasources + dashboard
    twb_path = Path("tableau") / "EduPredict_Analytics_Workbook.twb"
    assert twb_path.exists()
    root = ET.fromstring(twb_path.read_text(encoding="utf-8"))
    assert root.tag == "workbook"
    ds_names = [d.attrib.get("name", "") for d in root.findall("./datasources/datasource")]
    assert "federated.academic_performance" in ds_names
    assert "federated.attendance_summary" in ds_names
    assert len(root.findall("./worksheets/worksheet")) == 5
    assert len(root.findall("./dashboards/dashboard")) == 1

    # 2. Seed small cohort (<5) with dangerous formula-like string in academic_term/subject
    clean_db.predictions.insert_one({
        "student_id": test_student.id,
        "subject": "Mathematics",
        "academic_term": "=CMD|'/C calc'!A0",
        "milestone": 2,
        "predicted_status": "Moderate Risk",
        "predicted_grade_raw20": 11.5,
        "predicted_marks": 57.5,
    })

    # Student and Teacher must be blocked (403)
    _login(client, test_student.email, "StudentPassword123!")
    assert client.get("/api/tableau/datasets").status_code == 403
    assert client.get("/api/tableau/export/academic_performance").status_code == 403

    _login(client, test_teacher.email, "TeacherPassword123!")
    assert client.get("/api/tableau/datasets").status_code == 403
    assert client.get("/api/tableau/export/academic_performance?format=csv").status_code == 403

    # Analyst cannot disable N < 5 SDC even with ?apply_sdc=false, and receives zero PII
    _login(client, test_analyst.email, "AnalystPassword123!")
    r_cat = client.get("/api/tableau/datasets")
    assert r_cat.status_code == 200
    assert r_cat.get_json()["count"] == 6

    r_ana = client.get("/api/tableau/export/academic_performance?format=json&apply_sdc=false")
    assert r_ana.status_code == 200
    d_ana = r_ana.get_json()
    assert d_ana["metadata"]["sdc_enforced"] is True
    assert d_ana["metadata"]["contains_pii"] is False
    assert d_ana["rows"][0]["suppressed"] is True
    assert d_ana["rows"][0]["evaluation_count"] is None
    assert test_student.email not in str(d_ana)

    # Admin CSV export neutralizes formula prefix cleanly
    _login(client, test_admin.email, "AdminPassword123!")
    r_csv = client.get("/api/tableau/export/academic_performance?format=csv&apply_sdc=false")
    assert r_csv.status_code == 200
    csv_body = r_csv.get_data(as_text=True)
    assert "'=CMD" in csv_body
    assert test_student.email not in csv_body


# ---------------------------------------------------------------------------
# STAGE 9 & 10: TRAINING NOTEBOOK & PARALLEL BATCH BENCHMARK TESTS
# ---------------------------------------------------------------------------

def test_model_training_notebook_structure_and_non_overwrite():
    import json
    from pathlib import Path

    nb_path = Path("notebooks") / "02_model_training_and_evaluation.ipynb"
    assert nb_path.exists()
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    cells = nb.get("cells", [])
    code_cells = [c for c in cells if c.get("cell_type") == "code"]
    assert len(code_cells) >= 18
    joined_src = "\n".join("".join(c.get("source", [])) for c in code_cells)
    assert "assert_no_leakage" in joined_src
    assert "joblib.dump" not in joined_src  # Strictly read-only relative to production models
    for c in code_cells:
        assert c.get("execution_count") is not None
        assert not any(o.get("output_type") == "error" for o in c.get("outputs", []))


def test_parallel_batch_benchmark_safe_execution():
    from scripts.benchmark_batch_processing import run_benchmark

    report = run_benchmark(record_count=30, workers=2, workload_iters=50)
    assert report["configuration"]["mutates_production_db"] is False
    assert report["configuration"]["mutates_ml_artifacts"] is False
    modes = {r["mode"]: r for r in report["results"]}
    assert set(modes.keys()) == {"sequential", "thread", "process"}
    for m_res in modes.values():
        assert m_res["records_processed"] == 30
        assert m_res["error_count"] == 0
        assert m_res["elapsed_seconds"] > 0


# ---------------------------------------------------------------------------
# AUDIT REMEDIATION: REAL SCHEMA END-TO-END INTEGRATION TESTS
# ---------------------------------------------------------------------------

def test_real_model_schemas_in_analyst_trends_tableau_and_attendance_scope(
    client, clean_db, test_admin, test_teacher, test_student, test_analyst
):
    """
    Exercises /api/analyst/trends and Tableau exports against real PredictionRecord,
    DemandForecastRecord, and AnomalyRecord documents (not synthetic field overrides),
    plus verifies coursework SDC threshold and teacher attendance ML-proxy subject scoping.
    """
    from backend.models.anomaly_record_model import AnomalyRecord
    from backend.models.demand_forecast_model import DemandForecastRecord
    from backend.models.prediction_model import PredictionRecord

    math_subj, port_subj = _setup_math_and_portuguese(clean_db, test_admin, test_teacher, test_student)

    # Create a student prediction in Portuguese AND one in Mathematics via real PredictionRecord/PredictionService
    PredictionService.create_prediction(
        clean_db, test_student.id, test_admin, "Portuguese Language", 2, _sample_prediction_features(absences=18), "2026-T1"
    )
    PredictionService.create_prediction(
        clean_db, test_student.id, test_teacher, "Mathematics", 2, _sample_prediction_features(absences=6), "2026-T1"
    )

    # Teacher assigned ONLY to Mathematics inspecting /api/attendance/summary for test_student
    # must receive Mathematics proxy (absences=6 -> 90.0%), NOT Portuguese proxy (absences=18 -> 70.0%)
    _login(client, test_teacher.email, "TeacherPassword123!")
    r_teacher_sum = client.get(f"/api/attendance/summary?student_id={test_student.id}&subject_id={math_subj.id}")
    assert r_teacher_sum.status_code == 200
    proxy = r_teacher_sum.get_json()["estimated_ml_proxy"]
    assert proxy is not None
    assert proxy["subject"] == "Mathematics"
    assert proxy["absences"] == 6.0

    # Insert real PredictionRecord.to_doc() rows (which ONLY carry predicted_marks, no predicted_grade_raw20)
    # across 5 students in 2025-T2 (60.0% => 12.0/20) and 5 students in 2026-T2 (80.0% => 16.0/20),
    # while 2026-T1 only has test_student (N=1 -> suppressed!)
    cohort_ids = []
    for idx in range(5):
        u, _ = UserService.create_user(clean_db, f"real_c_{idx}@edupredict.com", "StudentPass123!", f"Real Stu {idx}", "student")
        cohort_ids.append(u.id)
        clean_db.predictions.insert_one(
            PredictionRecord(
                student_id=u.id,
                created_by=test_admin.id,
                subject="Mathematics",
                subject_id=math_subj.id,
                academic_term="2025-T2",
                milestone=2,
                predicted_marks=60.0,
                predicted_status="Moderate Risk",
                confidence_scores={"Moderate Risk": 0.75},
                top_confidence=0.75,
                features_summary={"absences": {"value": 4}},
                regressor_model="RandomForestRegressor",
                classifier_model="GradientBoostingClassifier",
            ).to_doc()
        )
        clean_db.predictions.insert_one(
            PredictionRecord(
                student_id=u.id,
                created_by=test_admin.id,
                subject="Mathematics",
                subject_id=math_subj.id,
                academic_term="2026-T2",
                milestone=2,
                predicted_marks=80.0,
                predicted_status="Low Risk / On Track",
                confidence_scores={"Low Risk / On Track": 0.90},
                top_confidence=0.90,
                features_summary={"absences": {"value": 1}},
                regressor_model="RandomForestRegressor",
                classifier_model="GradientBoostingClassifier",
            ).to_doc()
        )

    # Only 1 student has academic_records in 2026-T2 -> coursework_avg_raw20 MUST stay suppressed (<5)
    clean_db.academic_records.insert_one({
        "student_id": cohort_ids[0],
        "subject": "Mathematics",
        "term": "2026-T2",
        "final_exam_marks": 19.0,
    })

    # Insert real DemandForecastRecord and AnomalyRecord documents
    clean_db.demand_forecasts.insert_one(
        DemandForecastRecord(
            subject_id=math_subj.id,
            subject_code="MATH-101",
            subject_name="Mathematics",
            department="Science",
            forecast_period="2026-T2",
            periods_ahead=1,
            historical_series=[{"term": "2026-T1", "enrollment": 25}],
            latest_actual_enrollment=25,
            predicted_enrollment=32.5,
            confidence_lower=28.0,
            confidence_upper=37.0,
            confidence_level="95%",
            growth_rate_pct=30.0,
            trend_direction="increasing",
            demand_tier="High Demand",
        ).to_doc()
    )
    clean_db.anomaly_records.insert_one(
        AnomalyRecord(
            source_record_id="src-real-1",
            student_id=cohort_ids[0],
            student_name="Sensitive Name Should Not Export",
            subject="Mathematics",
            milestone=2,
            model_version="v1",
            raw_decision_score=-0.25,
            anomaly_score=0.92,
            cohort_percentile=99.0,
            anomaly_severity="High Anomaly",
            review_status="Confirmed Anomaly",
        ).to_doc()
    )

    _login(client, test_analyst.email, "AnalystPassword123!")
    r_trends = client.get("/api/analyst/trends")
    assert r_trends.status_code == 200
    t_json = r_trends.get_json()
    assert t_json["trend_available"] is True
    assert t_json["growth_delta_raw20"] == 4.0  # 16.0 - 12.0 derived from predicted_marks / 5.0
    t_by_term = {t["term"]: t for t in t_json["term_trends"]}
    assert t_by_term["2025-T2"]["math_avg_raw20"] == 12.0
    assert t_by_term["2026-T1"]["suppressed"] is True
    assert t_by_term["2026-T2"]["math_avg_raw20"] == 16.0
    assert t_by_term["2026-T2"]["coursework_avg_raw20"] is None  # Only 1 coursework student -> suppressed!

    # Verify Tableau real-schema exports as Analyst
    r_tab_perf = client.get("/api/tableau/export/academic_performance")
    assert r_tab_perf.status_code == 200
    perf_rows = r_tab_perf.get_json()["rows"]
    m2_2025 = next(r for r in perf_rows if r["academic_term"] == "2025-T2" and r["subject"] == "Mathematics")
    assert m2_2025["avg_predicted_raw20"] == 12.0
    assert m2_2025["avg_predicted_pct"] == 60.0

    r_tab_dem = client.get("/api/tableau/export/demand_forecast_summary")
    assert r_tab_dem.status_code == 200
    dem_rows = r_tab_dem.get_json()["rows"]
    assert len(dem_rows) == 1
    assert dem_rows[0]["target_term"] == "2026-T2"
    assert dem_rows[0]["forecast_horizon"] == 1
    assert dem_rows[0]["lower_ci"] == 28.0
    assert dem_rows[0]["upper_ci"] == 37.0

    # Analyst anomaly summary suppresses N=1 (<5), preserves real severity/review_status bucket keys
    r_tab_anom_ana = client.get("/api/tableau/export/anomaly_summary")
    assert r_tab_anom_ana.status_code == 200
    anom_ana_rows = r_tab_anom_ana.get_json()["rows"]
    assert anom_ana_rows[0]["severity"] == "High Anomaly"
    assert anom_ana_rows[0]["review_status"] == "Confirmed Anomaly"
    assert anom_ana_rows[0]["suppressed"] is True
    assert "Sensitive Name" not in str(anom_ana_rows)

    # Admin ?apply_sdc=false reveals count=1 for AnomalyRecord while omitting student PII
    _login(client, test_admin.email, "AdminPassword123!")
    r_tab_anom_adm = client.get("/api/tableau/export/anomaly_summary?apply_sdc=false")
    assert r_tab_anom_adm.status_code == 200
    anom_adm_rows = r_tab_anom_adm.get_json()["rows"]
    assert anom_adm_rows[0]["severity"] == "High Anomaly"
    assert anom_adm_rows[0]["review_status"] == "Confirmed Anomaly"
    assert anom_adm_rows[0]["alert_count_display"] == 1



