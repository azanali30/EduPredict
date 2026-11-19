"""
EduPredict - Phase 7A Analyst RBAC & Authorization Regression Tests
Validates least-privilege boundaries, authentication, endpoint scoping,
admin overrides, and administrative write protection for the Analyst role.
"""

from bson import ObjectId
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService


# ==============================================================================
# 1. Authentication & Basic Lifecycle
# ==============================================================================

def test_analyst_can_authenticate(client, test_analyst):
    """Verify that a user with the analyst role can successfully log in and establish a session."""
    res = client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["role"] == "analyst"
    assert data["user"]["email"] == test_analyst.email

    # Verify session via /api/me
    me_res = client.get("/api/me")
    assert me_res.status_code == 200
    assert me_res.get_json()["user"]["role"] == "analyst"


def test_public_registration_cannot_create_analyst_account(client, clean_db):
    """Verify that public registration endpoint /auth/register rejects any attempt to register as analyst."""
    payload = {
        "email": "infiltrator.analyst@edupredict.com",
        "password": "Password123!",
        "full_name": "Fake Analyst",
        "role": "analyst",
    }
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "only permitted for student accounts" in data.get("message", "").lower()

    # Verify no analyst was created in database
    user = clean_db.users.find_one({"email": "infiltrator.analyst@edupredict.com"})
    assert user is None


def test_admin_can_promote_user_to_analyst_and_demote(client, clean_db, test_admin, test_student):
    """Verify that only an administrator can promote a student to analyst and demote back."""
    # Authenticate as admin
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # Promote student to analyst
    res = client.put(f"/api/admin/users/{test_student.id}/role", json={"role": "analyst"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["role"] == "analyst"

    # Verify persistence in database
    doc = clean_db.users.find_one({"_id": test_student.id})
    assert doc["role"] == "analyst"

    # Demote analyst back to student
    res_demote = client.put(f"/api/admin/users/{test_student.id}/role", json={"role": "student"})
    assert res_demote.status_code == 200
    assert res_demote.get_json()["user"]["role"] == "student"


# ==============================================================================
# 2. Analyst Endpoint Scoping & Explicit Admin Override
# ==============================================================================

def test_unauthenticated_request_to_analyst_endpoints_returns_401(client, clean_db):
    """Verify that requests without an active session return 401 Unauthorized."""
    res_overview = client.get("/api/analyst/overview")
    assert res_overview.status_code == 401

    res_curriculum = client.get("/api/analyst/curriculum-stats")
    assert res_curriculum.status_code == 401

    res_diagnostics = client.get("/api/analyst/diagnostics")
    assert res_diagnostics.status_code == 401


def test_analyst_can_access_authorized_analyst_endpoints(client, test_analyst, clean_db):
    """Verify that an authenticated analyst can access reporting and diagnostic analyst endpoints."""
    SubjectService.ensure_canonical_subjects(clean_db)

    # Login as analyst
    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    # 1. Overview
    res_overview = client.get("/api/analyst/overview")
    assert res_overview.status_code == 200
    data_overview = res_overview.get_json()
    assert data_overview["status"] == "operational"
    assert "metrics" in data_overview
    assert data_overview["metrics"]["total_active_subjects"] >= 2

    # 2. Curriculum Stats
    res_curriculum = client.get("/api/analyst/curriculum-stats")
    assert res_curriculum.status_code == 200
    data_curriculum = res_curriculum.get_json()
    assert "subjects" in data_curriculum
    assert len(data_curriculum["subjects"]) >= 2

    # 3. Analyst-Only Diagnostics
    res_diagnostics = client.get("/api/analyst/diagnostics")
    assert res_diagnostics.status_code == 200
    assert res_diagnostics.get_json()["status"] == "active"


def test_admin_can_access_analyst_reporting_endpoints_via_override(client, test_admin, clean_db):
    """Verify that administrators can access analyst reporting endpoints through explicit override."""
    SubjectService.ensure_canonical_subjects(clean_db)

    # Login as admin
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    res_overview = client.get("/api/analyst/overview")
    assert res_overview.status_code == 200
    assert res_overview.get_json()["scope"] == "institutional_aggregate"

    res_curriculum = client.get("/api/analyst/curriculum-stats")
    assert res_curriculum.status_code == 200
    assert "subjects" in res_curriculum.get_json()


def test_admin_is_rejected_on_strict_analyst_only_endpoint(client, test_admin):
    """Verify that strictly analyst-only endpoints protected by @analyst_required reject admins with 403."""
    # Login as admin
    client.post("/auth/login", json={
        "email": test_admin.email,
        "password": "AdminPassword123!",
    })

    # Strict analyst-only diagnostics endpoint
    res_diag = client.get("/api/analyst/diagnostics")
    assert res_diag.status_code == 403
    data = res_diag.get_json()
    assert "access denied" in data.get("message", "").lower()


def test_student_and_teacher_cannot_access_analyst_endpoints(client, test_student, test_teacher):
    """Verify that students and teachers are rejected with 403 Forbidden on all analyst endpoints."""
    # Test Student
    client.post("/auth/login", json={
        "email": test_student.email,
        "password": "StudentPassword123!",
    })
    assert client.get("/api/analyst/overview").status_code == 403
    assert client.get("/api/analyst/curriculum-stats").status_code == 403
    assert client.get("/api/analyst/diagnostics").status_code == 403
    client.post("/auth/logout")

    # Test Teacher
    client.post("/auth/login", json={
        "email": test_teacher.email,
        "password": "TeacherPassword123!",
    })
    assert client.get("/api/analyst/overview").status_code == 403
    assert client.get("/api/analyst/curriculum-stats").status_code == 403
    assert client.get("/api/analyst/diagnostics").status_code == 403


# ==============================================================================
# 3. Least-Privilege Enforcement: Analyst Blocked from Administrative APIs
# ==============================================================================

def test_analyst_cannot_access_user_management(client, test_analyst, test_student):
    """Verify that an analyst cannot list system users or mutate user roles."""
    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    # Cannot list users
    res_list = client.get("/api/admin/users")
    assert res_list.status_code == 403

    # Cannot change role
    res_role = client.put(f"/api/admin/users/{test_student.id}/role", json={"role": "admin"})
    assert res_role.status_code == 403


def test_analyst_cannot_create_or_modify_subjects(client, test_analyst):
    """Verify that an analyst cannot create subjects or toggle subject status."""
    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    # Attempt create subject
    payload = {
        "code": "CHEM-101",
        "name": "Chemistry",
        "canonical_key": "chemistry",
        "department": "Science",
    }
    res_create = client.post("/api/admin/subjects", json=payload)
    assert res_create.status_code == 403

    # Attempt toggle status
    res_toggle = client.put(f"/api/admin/subjects/{ObjectId()}/status", json={"is_active": False})
    assert res_toggle.status_code == 403


def test_analyst_cannot_allocate_teachers_or_enroll_students(client, test_analyst, test_teacher, test_student):
    """Verify that an analyst cannot create teacher allocations or student enrollments."""
    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    dummy_subject_id = str(ObjectId())

    # Attempt teacher allocation
    res_t = client.post("/api/admin/teacher-subjects", json={
        "teacher_id": str(test_teacher.id),
        "subject_id": dummy_subject_id,
        "academic_term": "2026-T1",
    })
    assert res_t.status_code == 403

    # Attempt student enrollment
    res_s = client.post("/api/admin/student-enrollments", json={
        "student_id": str(test_student.id),
        "subject_id": dummy_subject_id,
        "academic_term": "2026-T1",
    })
    assert res_s.status_code == 403


def test_analyst_cannot_access_audit_logs_or_admin_diagnostics(client, test_analyst):
    """Verify that an analyst cannot view administrative audit logs or admin users list."""
    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    assert client.get("/api/admin/logs").status_code == 403
    assert client.get("/api/admin/users").status_code == 403


# ==============================================================================
# 4. Academic Isolation: Analyst Blocked from Student PII & Direct Predictions
# ==============================================================================

def test_analyst_cannot_access_individual_student_profile(client, test_analyst, test_student):
    """Verify that an analyst cannot retrieve an individual student's profile (PII protection)."""
    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    res = client.get(f"/api/students/{test_student.id}")
    assert res.status_code == 403
    data = res.get_json()
    assert "not authorized" in data.get("message", "").lower()


def test_analyst_cannot_generate_or_list_predictions(client, test_analyst, test_student, clean_db):
    """Verify that an analyst cannot generate predictions or query the prediction list API."""
    SubjectService.ensure_canonical_subjects(clean_db)

    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    # Attempt prediction generation
    res_pred = client.post("/api/predictions", json={
        "student_id": str(test_student.id),
        "subject": "Mathematics",
        "milestone": 0,
        "features": {
            "school": "GP", "sex": "F", "age": 17, "address": "U", "famsize": "GT3",
            "Pstatus": "T", "Medu": 4, "Fedu": 4, "Mjob": "other", "Fjob": "other",
            "reason": "course", "guardian": "mother", "traveltime": 1, "studytime": 2,
            "study_hours_per_week": 3.5, "failures": 0, "schoolsup": "no", "famsup": "yes",
            "paid": "no", "activities": "yes", "nursery": "yes", "higher": "yes",
            "internet": "yes", "romantic": "no", "famrel": 4, "freetime": 3, "goout": 3,
            "Dalc": 1, "Walc": 1, "health": 3, "absences": 2, "attendance_percentage": 96.67,
            "assignment_completion_rate": 88.0,
        },
    })
    assert res_pred.status_code == 403

    # Attempt listing predictions
    res_list = client.get("/api/predictions")
    assert res_list.status_code == 403


def test_analyst_cannot_access_teacher_or_student_specific_routes(client, test_analyst):
    """Verify that an analyst cannot query teacher subject rosters or student enrollment routes."""
    client.post("/auth/login", json={
        "email": test_analyst.email,
        "password": "AnalystPassword123!",
    })

    assert client.get("/api/teacher/subjects").status_code == 403
    assert client.get("/api/teacher/students").status_code == 403
    assert client.get("/api/student/subjects").status_code == 403


# ==============================================================================
# 5. Non-Regression: Existing Student, Teacher, Admin Isolation Intact
# ==============================================================================

def test_existing_roles_and_subject_isolation_remain_unaltered(client, clean_db, test_admin, test_teacher, test_student):
    """Verify that existing admin, teacher, and student permissions and subject-based RBAC continue to work flawlessly."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Admin allocates teacher and enrolls student
    client.post("/auth/login", json={"email": test_admin.email, "password": "AdminPassword123!"})
    res_assign = client.post("/api/admin/teacher-subjects", json={
        "teacher_id": str(test_teacher.id),
        "subject_id": str(math_subj.id),
        "academic_term": "2026-T1",
    })
    assert res_assign.status_code == 201

    res_enroll = client.post("/api/admin/student-enrollments", json={
        "student_id": str(test_student.id),
        "subject_id": str(math_subj.id),
        "academic_term": "2026-T1",
    })
    assert res_enroll.status_code == 201
    client.post("/auth/logout")

    # Teacher accesses student roster
    client.post("/auth/login", json={"email": test_teacher.email, "password": "TeacherPassword123!"})
    res_roster = client.get(f"/api/teacher/students?subject_id={math_subj.id}")
    assert res_roster.status_code == 200
    assert res_roster.get_json()["count"] == 1
    client.post("/auth/logout")

    # Student accesses own profile
    client.post("/auth/login", json={"email": test_student.email, "password": "StudentPassword123!"})
    res_own = client.get(f"/api/students/{test_student.id}")
    assert res_own.status_code == 200
    assert res_own.get_json()["student"]["email"] == test_student.email


# ==============================================================================
# 6. Privacy Remediation: Minimum Cell Suppression & SDC Safeguards
# ==============================================================================

def test_curriculum_stats_cell_suppression_student_enrollments(client, clean_db, test_analyst):
    """
    Verify that curriculum-stats enforces minimum student cohort suppression (threshold N < 5):
    - 0 count returns 0, "0", suppressed False.
    - 1 and 4 counts return null (None), "<5", suppressed True (raw number never exposed).
    - 5 and values above 5 return exact numeric count and suppressed False.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Authenticate as Analyst
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})

    # Case 1: Count == 0
    res_0 = client.get("/api/analyst/curriculum-stats")
    assert res_0.status_code == 200
    subjs_0 = {s["code"]: s for s in res_0.get_json()["subjects"]}
    math_0 = subjs_0["MATH-101"]
    assert math_0["active_enrollments"] == 0
    assert math_0["active_enrollments_display"] == "0"
    assert math_0["active_enrollments_suppressed"] is False

    # Helper to insert active student enrollments
    def add_students(count):
        for i in range(count):
            clean_db.student_subject_enrollments.insert_one({
                "student_id": ObjectId(),
                "subject_id": math_subj.id,
                "status": "active",
                "academic_term": "2026-T1",
            })

    # Case 2: Count == 1 (Suppressed)
    add_students(1)
    res_1 = client.get("/api/analyst/curriculum-stats")
    math_1 = {s["code"]: s for s in res_1.get_json()["subjects"]}["MATH-101"]
    assert math_1["active_enrollments"] is None
    assert math_1["active_enrollments_display"] == "<5"
    assert math_1["active_enrollments_suppressed"] is True
    # Verify exact number 1 is NOT present in numeric field
    assert math_1["active_enrollments"] != 1

    # Case 3: Count == 4 (Suppressed)
    add_students(3)  # 1 + 3 = 4
    res_4 = client.get("/api/analyst/curriculum-stats")
    math_4 = {s["code"]: s for s in res_4.get_json()["subjects"]}["MATH-101"]
    assert math_4["active_enrollments"] is None
    assert math_4["active_enrollments_display"] == "<5"
    assert math_4["active_enrollments_suppressed"] is True
    assert math_4["active_enrollments"] != 4

    # Case 4: Count == 5 (Unsuppressed Threshold)
    add_students(1)  # 4 + 1 = 5
    res_5 = client.get("/api/analyst/curriculum-stats")
    math_5 = {s["code"]: s for s in res_5.get_json()["subjects"]}["MATH-101"]
    assert math_5["active_enrollments"] == 5
    assert math_5["active_enrollments_display"] == "5"
    assert math_5["active_enrollments_suppressed"] is False

    # Case 5: Count == 8 (Unsuppressed > 5)
    add_students(3)  # 5 + 3 = 8
    res_8 = client.get("/api/analyst/curriculum-stats")
    math_8 = {s["code"]: s for s in res_8.get_json()["subjects"]}["MATH-101"]
    assert math_8["active_enrollments"] == 8
    assert math_8["active_enrollments_display"] == "8"
    assert math_8["active_enrollments_suppressed"] is False


def test_curriculum_stats_cell_suppression_assigned_teachers(client, clean_db, test_analyst):
    """
    Verify that curriculum-stats enforces teacher cohort suppression (threshold N < 5):
    - 0 count returns 0, "0", suppressed False.
    - 1 and 4 counts return null (None), "<5", suppressed True.
    - 5 and values above 5 return exact numeric count and suppressed False.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # Authenticate as Analyst
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})

    # Case 1: Count == 0
    res_0 = client.get("/api/analyst/curriculum-stats")
    port_0 = {s["code"]: s for s in res_0.get_json()["subjects"]}["PORT-101"]
    assert port_0["assigned_teachers"] == 0
    assert port_0["assigned_teachers_display"] == "0"
    assert port_0["assigned_teachers_suppressed"] is False

    def add_teachers(count):
        for _ in range(count):
            clean_db.teacher_subject_assignments.insert_one({
                "teacher_id": ObjectId(),
                "subject_id": port_subj.id,
                "status": "active",
                "academic_term": "2026-T1",
            })

    # Case 2: Count == 1 (Suppressed)
    add_teachers(1)
    res_1 = client.get("/api/analyst/curriculum-stats")
    port_1 = {s["code"]: s for s in res_1.get_json()["subjects"]}["PORT-101"]
    assert port_1["assigned_teachers"] is None
    assert port_1["assigned_teachers_display"] == "<5"
    assert port_1["assigned_teachers_suppressed"] is True

    # Case 3: Count == 4 (Suppressed)
    add_teachers(3)  # 1 + 3 = 4
    res_4 = client.get("/api/analyst/curriculum-stats")
    port_4 = {s["code"]: s for s in res_4.get_json()["subjects"]}["PORT-101"]
    assert port_4["assigned_teachers"] is None
    assert port_4["assigned_teachers_display"] == "<5"
    assert port_4["assigned_teachers_suppressed"] is True

    # Case 4: Count == 5 (Unsuppressed)
    add_teachers(1)  # 4 + 1 = 5
    res_5 = client.get("/api/analyst/curriculum-stats")
    port_5 = {s["code"]: s for s in res_5.get_json()["subjects"]}["PORT-101"]
    assert port_5["assigned_teachers"] == 5
    assert port_5["assigned_teachers_display"] == "5"
    assert port_5["assigned_teachers_suppressed"] is False

    # Case 5: Count == 7 (Unsuppressed > 5)
    add_teachers(2)  # 5 + 2 = 7
    res_7 = client.get("/api/analyst/curriculum-stats")
    port_7 = {s["code"]: s for s in res_7.get_json()["subjects"]}["PORT-101"]
    assert port_7["assigned_teachers"] == 7
    assert port_7["assigned_teachers_display"] == "7"
    assert port_7["assigned_teachers_suppressed"] is False


def test_overview_privacy_and_complementary_suppression(client, clean_db, test_analyst):
    """
    Verify that /api/analyst/overview protects aggregate privacy and prevents
    complementary subtraction leakage when a single subject is suppressed in curriculum-stats.
    """
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # Authenticate as Analyst
    client.post("/auth/login", json={"email": test_analyst.email, "password": "AnalystPassword123!"})

    # Case 1: All enrollments are 0
    res_0 = client.get("/api/analyst/overview")
    assert res_0.status_code == 200
    m_0 = res_0.get_json()["metrics"]
    assert m_0["total_active_enrollments"] == 0
    assert m_0["total_active_enrollments_display"] == "0"
    assert m_0["total_active_enrollments_suppressed"] is False

    # Case 2: Math has 10 enrollments (unsuppressed), Port has 1 enrollment (suppressed)
    # Total = 11. If 11 were returned, 11 - 10 = 1 discloses Portuguese!
    # Complementary suppression must trigger on total_active_enrollments.
    for _ in range(10):
        clean_db.student_subject_enrollments.insert_one({
            "student_id": ObjectId(),
            "subject_id": math_subj.id,
            "status": "active",
        })
    clean_db.student_subject_enrollments.insert_one({
        "student_id": ObjectId(),
        "subject_id": port_subj.id,
        "status": "active",
    })

    res_comp = client.get("/api/analyst/overview")
    assert res_comp.status_code == 200
    m_comp = res_comp.get_json()["metrics"]
    assert m_comp["total_active_enrollments"] is None
    assert m_comp["total_active_enrollments_suppressed"] is True
    assert "Complementary" in m_comp["total_active_enrollments_display"]

    # Case 3: Both Math and Portuguese have >= 5 enrollments (e.g. Math 10, Port 5 = 15 total)
    # Neither subject is suppressed, so complementary suppression is not required.
    for _ in range(4):  # 1 + 4 = 5
        clean_db.student_subject_enrollments.insert_one({
            "student_id": ObjectId(),
            "subject_id": port_subj.id,
            "status": "active",
        })

    res_unsuppressed = client.get("/api/analyst/overview")
    assert res_unsuppressed.status_code == 200
    m_unsuppressed = res_unsuppressed.get_json()["metrics"]
    assert m_unsuppressed["total_active_enrollments"] == 15
    assert m_unsuppressed["total_active_enrollments_display"] == "15"
    assert m_unsuppressed["total_active_enrollments_suppressed"] is False

