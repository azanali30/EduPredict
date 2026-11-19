"""
EduPredict - Subject Models, Services & Migration Foundation Tests
Phase 6A: Comprehensive test suite for Subject Catalog, Teacher-Subject Assignments,
Student-Subject Enrollments, Academic Term isolation, and Historical Migration.
"""

import pytest
from datetime import datetime, timezone
from bson import ObjectId

from backend.models.subject_model import Subject
from backend.models.teacher_subject_assignment_model import TeacherSubjectAssignment
from backend.models.student_subject_enrollment_model import StudentSubjectEnrollment
from backend.models.prediction_model import PredictionRecord
from backend.services.subject_service import SubjectService
from backend.services.enrollment_service import EnrollmentService
from backend.services.assignment_service import AssignmentService
from backend.services.user_service import UserService
from backend.database.schema import init_db_indexes
from scripts.migrate_prediction_subject_ids import run_migration


# =============================================================================
# 1. Subject Model Unit Tests
# =============================================================================

def test_subject_model_creation_and_normalization():
    """Verify Subject creation, code uppercase, canonical_key lowercase, and serialization."""
    subj = Subject(
        code=" math-101 ",
        name=" Mathematics ",
        canonical_key=" MATHEMATICS ",
        department=" STEM ",
        description="Core math course.",
        target_scale="0 - 100",
    )

    assert subj.code == "MATH-101"
    assert subj.name == "Mathematics"
    assert subj.canonical_key == "mathematics"
    assert subj.department == "STEM"
    assert subj.is_active is True

    doc = subj.to_doc()
    assert doc["code"] == "MATH-101"
    assert doc["canonical_key"] == "mathematics"

    restored = Subject.from_doc(doc)
    assert restored is not None
    assert restored.code == "MATH-101"
    assert restored.canonical_key == "mathematics"

    d = subj.to_dict()
    assert d["code"] == "MATH-101"
    assert d["canonical_key"] == "mathematics"
    assert isinstance(d["id"], str)


def test_subject_model_empty_validation():
    """Verify validation errors on empty required fields."""
    with pytest.raises(ValueError, match="Subject code cannot be empty"):
        Subject(code="", name="Math", canonical_key="math")

    with pytest.raises(ValueError, match="Subject name cannot be empty"):
        Subject(code="MATH-101", name="   ", canonical_key="math")

    with pytest.raises(ValueError, match="Subject canonical_key cannot be empty"):
        Subject(code="MATH-101", name="Math", canonical_key="")


# =============================================================================
# 2. Subject Service Integration Tests
# =============================================================================

def test_subject_service_create_and_unique_constraints(clean_db):
    """Verify subject creation, unique code and canonical_key enforcement."""
    admin_id = ObjectId()
    subj1, err1 = SubjectService.create_subject(
        clean_db,
        code="MATH-101",
        name="Mathematics",
        canonical_key="mathematics",
        department="STEM",
        admin_id=admin_id,
    )
    assert err1 is None
    assert subj1 is not None
    assert subj1["code"] == "MATH-101"

    # Duplicate code rejection
    subj2, err2 = SubjectService.create_subject(
        clean_db,
        code="MATH-101",
        name="Advanced Mathematics",
        canonical_key="advanced_math",
    )
    assert subj2 is None
    assert "already exists" in err2.lower()

    # Duplicate canonical_key rejection
    subj3, err3 = SubjectService.create_subject(
        clean_db,
        code="MATH-102",
        name="Mathematics Two",
        canonical_key="mathematics",
    )
    assert subj3 is None
    assert "already exists" in err3.lower()


def test_subject_service_lookups_and_canonical_seeding(clean_db):
    """Verify ensure_canonical_subjects seeds MATH and PORT idempotently."""
    seeded = SubjectService.ensure_canonical_subjects(clean_db)
    assert len(seeded) == 2
    keys = {s["canonical_key"] for s in seeded}
    assert keys == {"mathematics", "portuguese"}

    # Second call should return existing without duplicates
    seeded_again = SubjectService.ensure_canonical_subjects(clean_db)
    assert len(seeded_again) == 2
    assert clean_db.subjects.count_documents({}) == 2

    # Lookups
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    assert math_subj is not None
    assert math_subj.code == "MATH-101"

    port_subj = SubjectService.get_subject_by_code(clean_db, "PORT-101")
    assert port_subj is not None
    assert port_subj.canonical_key == "portuguese"

    by_id = SubjectService.get_subject_by_id(clean_db, math_subj.id)
    assert by_id is not None
    assert by_id.name == "Mathematics"

    active_list = SubjectService.list_active_subjects(clean_db)
    assert len(active_list) == 2


# =============================================================================
# 3. Teacher Subject Assignment Tests
# =============================================================================

def test_teacher_subject_assignment_lifecycle(clean_db, test_teacher, test_admin):
    """Verify teacher subject assignment, duplicate handling, and reactivation."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    assert math_subj is not None

    # 1. Valid Assignment
    assign1, err = AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        admin_id=test_admin.id,
    )
    assert err is None
    assert assign1 is not None
    assert assign1["status"] == "active"
    assert assign1["academic_term"] == "2026-T1"

    # 2. Duplicate assignment in same term returns existing without duplicate document
    assign2, err2 = AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        admin_id=test_admin.id,
    )
    assert err2 is None
    assert assign2["id"] == assign1["id"]
    assert clean_db.teacher_subject_assignments.count_documents({}) == 1

    # 3. Assignment in a different term creates a distinct document
    assign_t2, err_t2 = AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T2",
        admin_id=test_admin.id,
    )
    assert err_t2 is None
    assert clean_db.teacher_subject_assignments.count_documents({}) == 2

    # 4. Deactivate first assignment manually then verify reactivation updates doc
    clean_db.teacher_subject_assignments.update_one(
        {"_id": ObjectId(assign1["id"])},
        {"$set": {"status": "inactive"}},
    )
    assign_reactivated, err_r = AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        admin_id=test_admin.id,
    )
    assert err_r is None
    assert assign_reactivated["status"] == "active"
    assert assign_reactivated["id"] == assign1["id"]
    assert clean_db.teacher_subject_assignments.count_documents({}) == 2


def test_teacher_subject_assignment_role_and_subject_validation(clean_db, test_student, test_admin):
    """Verify student cannot be assigned as teacher, and invalid subject is rejected."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    # Non-teacher user rejected
    assign, err = AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_student.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        admin_id=test_admin.id,
    )
    assert assign is None
    assert "does not hold the 'teacher' role" in err

    # Non-existent subject rejected
    assign_bad_subj, err_subj = AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_admin.id,
        subject_id=ObjectId(),
        academic_term="2026-T1",
    )
    assert assign_bad_subj is None
    assert "teacher" in err_subj.lower() or "subject" in err_subj.lower()

    # Empty academic term rejected
    assign_empty_term, err_term = AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_admin.id,
        subject_id=math_subj.id,
        academic_term="   ",
    )
    assert assign_empty_term is None
    assert "academic_term cannot be empty" in err_term


# =============================================================================
# 4. Student Subject Enrollment Tests
# =============================================================================

def test_student_enrollment_lifecycle(clean_db, test_student, test_admin):
    """Verify student enrollment, duplicate prevention, dropping, and reactivation."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # 1. Enroll student in Math
    enroll1, err1 = EnrollmentService.enroll_student(
        clean_db,
        student_id=test_student.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        enrolled_by=test_admin.id,
    )
    assert err1 is None
    assert enroll1 is not None
    assert enroll1["status"] == "active"

    # 2. Duplicate enrollment returns existing
    enroll_dup, err_dup = EnrollmentService.enroll_student(
        clean_db,
        student_id=test_student.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
    )
    assert err_dup is None
    assert enroll_dup["id"] == enroll1["id"]
    assert clean_db.student_subject_enrollments.count_documents({}) == 1

    # 3. Enroll in second subject (Portuguese)
    enroll2, err2 = EnrollmentService.enroll_student(
        clean_db,
        student_id=test_student.id,
        subject_id=port_subj.id,
        academic_term="2026-T1",
        enrolled_by=test_admin.id,
    )
    assert err2 is None
    assert clean_db.student_subject_enrollments.count_documents({}) == 2

    # Query student enrolled subjects
    student_subjs = EnrollmentService.get_student_enrolled_subjects(
        clean_db,
        student_id=test_student.id,
        academic_term="2026-T1",
    )
    assert len(student_subjs) == 2
    subj_names = {s["name"] for s in student_subjs}
    assert subj_names == {"Mathematics", "Portuguese Language"}

    # 4. Drop student from Math
    dropped, err_drop = EnrollmentService.drop_student(
        clean_db,
        student_id=test_student.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
    )
    assert err_drop is None
    assert dropped["status"] == "dropped"

    # Query active only
    active_subjs = EnrollmentService.get_student_enrolled_subjects(
        clean_db,
        student_id=test_student.id,
        active_only=True,
    )
    assert len(active_subjs) == 1
    assert active_subjs[0]["name"] == "Portuguese Language"

    # 5. Re-enrolling dropped student reactivates status to 'active'
    reactivated, err_re = EnrollmentService.enroll_student(
        clean_db,
        student_id=test_student.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
    )
    assert err_re is None
    assert reactivated["status"] == "active"
    assert reactivated["id"] == enroll1["id"]
    assert clean_db.student_subject_enrollments.count_documents({}) == 2


def test_student_enrollment_role_validation(clean_db, test_teacher, test_admin):
    """Verify teacher or admin cannot be enrolled as student."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")

    enroll, err = EnrollmentService.enroll_student(
        clean_db,
        student_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
    )
    assert enroll is None
    assert "does not hold the 'student' role" in err


# =============================================================================
# 5. Teacher-Student Subject Lookup Service Tests
# =============================================================================

def test_teacher_subject_student_lookups(clean_db, test_teacher, test_student, test_admin):
    """Verify AssignmentService.get_students_for_teacher_by_subject query resolution."""
    SubjectService.ensure_canonical_subjects(clean_db)
    math_subj = SubjectService.get_subject_by_canonical_key(clean_db, "mathematics")
    port_subj = SubjectService.get_subject_by_canonical_key(clean_db, "portuguese")

    # Assign Teacher to Math
    AssignmentService.assign_teacher_to_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=math_subj.id,
        academic_term="2026-T1",
        admin_id=test_admin.id,
    )

    # Enroll Student in Math and Portuguese
    EnrollmentService.enroll_student(clean_db, test_student.id, math_subj.id, "2026-T1")
    EnrollmentService.enroll_student(clean_db, test_student.id, port_subj.id, "2026-T1")

    # Teacher gets students for their subjects -> returns student with Math
    students = AssignmentService.get_students_for_teacher_by_subject(
        clean_db,
        teacher_id=test_teacher.id,
        academic_term="2026-T1",
    )
    assert len(students) == 1
    assert students[0]["id"] == str(test_student.id)
    assert students[0]["enrolled_subjects_under_teacher"] == ["Mathematics"]

    # Teacher requests students specifically for Portuguese -> returns empty since teacher does not teach Port
    port_students = AssignmentService.get_students_for_teacher_by_subject(
        clean_db,
        teacher_id=test_teacher.id,
        subject_id=port_subj.id,
        academic_term="2026-T1",
    )
    assert len(port_students) == 0


# =============================================================================
# 6. Legacy Assignment Isolation
# =============================================================================

def test_legacy_assignments_remain_unaltered(clean_db, test_teacher, test_student, test_admin):
    """Verify legacy teacher_student_assignments continue to function independently."""
    res, err = AssignmentService.assign_teacher_to_student(
        clean_db,
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        admin_id=test_admin.id,
    )
    assert err is None
    assert res is not None

    # Verify legacy check
    assert AssignmentService.is_student_assigned_to_teacher(clean_db, test_teacher.id, test_student.id) is True
    legacy_list = AssignmentService.get_students_for_teacher(clean_db, test_teacher.id)
    assert len(legacy_list) == 1
    assert legacy_list[0]["id"] == str(test_student.id)

    # Verify new collections remain unpolluted by legacy operations
    assert clean_db.teacher_subject_assignments.count_documents({}) == 0
    assert clean_db.student_subject_enrollments.count_documents({}) == 0


# =============================================================================
# 7. Migration Script Tests (Dry Run & Apply Idempotency)
# =============================================================================

def test_migration_dry_run_causes_zero_writes(clean_db, test_student, test_admin):
    """Verify migration dry-run scans correctly and causes zero database writes."""
    # Seed 3 predictions with string subject names
    p1 = {
        "_id": ObjectId(),
        "student_id": test_student.id,
        "created_by": test_admin.id,
        "subject": "Mathematics",
        "milestone": 0,
        "predicted_marks": 75.0,
        "predicted_status": "Low Risk / On Track",
        "risk_level": "Low Risk",
        "created_at": datetime.now(timezone.utc),
    }
    p2 = {
        "_id": ObjectId(),
        "student_id": test_student.id,
        "created_by": test_admin.id,
        "subject": "Portuguese Language",
        "milestone": 1,
        "predicted_marks": 60.0,
        "predicted_status": "Moderate Risk",
        "risk_level": "Moderate Risk",
        "created_at": datetime.now(timezone.utc),
    }
    p3_unknown = {
        "_id": ObjectId(),
        "student_id": test_student.id,
        "created_by": test_admin.id,
        "subject": "Quantum Computing",
        "milestone": 0,
        "predicted_marks": 80.0,
        "predicted_status": "Low Risk / On Track",
        "risk_level": "Low Risk",
        "created_at": datetime.now(timezone.utc),
    }
    clean_db.predictions.insert_many([p1, p2, p3_unknown])

    # Run migration in DRY RUN mode
    stats_dry = run_migration(db=clean_db, apply_writes=False)
    assert stats_dry["total_predictions"] == 3
    assert stats_dry["matched_and_ready"] == 2
    assert stats_dry["unmatched_unknown_subject"] == 1
    assert stats_dry["written_count"] == 0

    # Verify database has zero subject_id fields
    for doc in clean_db.predictions.find():
        assert "subject_id" not in doc


def test_migration_apply_and_idempotency(clean_db, test_student, test_admin):
    """Verify migration in --apply mode writes subject_id correctly, preserves other fields, and is idempotent."""
    # Seed predictions
    p_math = {
        "_id": ObjectId(),
        "student_id": test_student.id,
        "created_by": test_admin.id,
        "subject": "Mathematics",
        "milestone": 0,
        "predicted_marks": 75.0,
        "predicted_status": "Low Risk / On Track",
        "risk_level": "Low Risk",
        "created_at": datetime.now(timezone.utc),
    }
    p_port = {
        "_id": ObjectId(),
        "student_id": test_student.id,
        "created_by": test_admin.id,
        "subject": "Portuguese Language",
        "milestone": 1,
        "predicted_marks": 62.5,
        "predicted_status": "Moderate Risk",
        "risk_level": "Moderate Risk",
        "created_at": datetime.now(timezone.utc),
    }
    p_bad = {
        "_id": ObjectId(),
        "student_id": test_student.id,
        "created_by": test_admin.id,
        "subject": "Astrophysics",
        "milestone": 0,
        "predicted_marks": 55.0,
        "predicted_status": "Moderate Risk",
        "risk_level": "Moderate Risk",
        "created_at": datetime.now(timezone.utc),
    }
    clean_db.predictions.insert_many([p_math, p_port, p_bad])

    # 1. First Live Apply
    stats_live = run_migration(db=clean_db, apply_writes=True)
    assert stats_live["total_predictions"] == 3
    assert stats_live["matched_and_ready"] == 2
    assert stats_live["written_count"] == 2
    assert stats_live["unmatched_unknown_subject"] == 1

    # Verify Math prediction has valid subject_id referencing Mathematics
    math_doc = clean_db.predictions.find_one({"_id": p_math["_id"]})
    assert "subject_id" in math_doc
    math_subject = clean_db.subjects.find_one({"_id": math_doc["subject_id"]})
    assert math_subject["canonical_key"] == "mathematics"
    # Verify original fields preserved exactly
    assert math_doc["subject"] == "Mathematics"
    assert math_doc["predicted_marks"] == 75.0
    assert math_doc["milestone"] == 0

    # Verify Unknown subject was untouched
    bad_doc = clean_db.predictions.find_one({"_id": p_bad["_id"]})
    assert "subject_id" not in bad_doc
    assert bad_doc["subject"] == "Astrophysics"

    # 2. Second Live Apply (Idempotency Check)
    stats_idempotent = run_migration(db=clean_db, apply_writes=True)
    assert stats_idempotent["total_predictions"] == 3
    assert stats_idempotent["already_migrated"] == 2
    assert stats_idempotent["written_count"] == 0
    assert stats_idempotent["unmatched_unknown_subject"] == 1


# =============================================================================
# 8. Schema Index Idempotency
# =============================================================================

def test_schema_init_indexes_repeatable(clean_db):
    """Verify init_db_indexes can be run multiple times safely without error."""
    idx1 = init_db_indexes(clean_db)
    assert "subjects" in idx1
    assert "teacher_subject_assignments" in idx1
    assert "student_subject_enrollments" in idx1

    # Second run must succeed idempotently
    idx2 = init_db_indexes(clean_db)
    assert "subjects" in idx2
