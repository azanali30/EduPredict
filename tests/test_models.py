"""
EduPredict - Data Model Unit Tests
Tests domain entities: User, AcademicRecord, TeacherStudentAssignment, SystemLog.
"""

from bson import ObjectId
from backend.models.user_model import User
from backend.models.academic_record_model import AcademicRecord
from backend.models.assignment_model import TeacherStudentAssignment
from backend.models.system_log_model import SystemLog
from backend.utils.security import hash_password, check_password


def test_user_model_creation_and_hashing():
    """Verify User entity construction, bcrypt hashing, and password verification."""
    plain = "SecurePassword123!"
    hashed = hash_password(plain)
    assert hashed.startswith("$2b$")  # standard bcrypt prefix

    user = User(
        email="Test.Student@EduPredict.COM ",
        password_hash=hashed,
        full_name=" Test Student ",
        role="student",
    )

    assert user.email == "test.student@edupredict.com"
    assert user.full_name == "Test Student"
    assert user.role == "student"
    assert user.is_authenticated is True
    assert user.is_active is True
    assert user.verify_password(plain) is True
    assert user.verify_password("WrongPassword123!") is False

    # Check serialization does not leak password hash
    safe_dict = user.to_dict()
    assert "password_hash" not in safe_dict
    assert safe_dict["email"] == "test.student@edupredict.com"


def test_academic_record_model():
    """Verify AcademicRecord model conversion to/from MongoDB document."""
    student_id = ObjectId()
    record = AcademicRecord(
        student_id=student_id,
        term="Fall 2026",
        attendance_percentage=94.5,
        study_hours_per_week=14.0,
        assignment_completion_rate=98.0,
        quiz_average=87.5,
        previous_exam_marks=85.0,
        subject_scores={"Mathematics": 88.0, "Science": 82.0},
    )

    doc = record.to_doc()
    assert doc["student_id"] == student_id
    assert doc["term"] == "Fall 2026"
    assert doc["subject_scores"]["Mathematics"] == 88.0

    restored = AcademicRecord.from_doc(doc)
    assert restored is not None
    assert restored.student_id == student_id
    assert restored.attendance_percentage == 94.5


def test_teacher_student_assignment_model():
    """Verify TeacherStudentAssignment entity serialization."""
    teacher_id = ObjectId()
    student_id = ObjectId()
    admin_id = ObjectId()

    assignment = TeacherStudentAssignment(
        teacher_id=teacher_id,
        student_id=student_id,
        assigned_by=admin_id,
    )

    doc = assignment.to_doc()
    assert doc["teacher_id"] == teacher_id
    assert doc["student_id"] == student_id
    assert doc["status"] == "active"

    data = assignment.to_dict()
    assert data["teacher_id"] == str(teacher_id)
    assert data["student_id"] == str(student_id)


def test_system_log_model():
    """Verify SystemLog entity structure."""
    user_id = ObjectId()
    log = SystemLog(
        event_type="AUTH_LOGIN_SUCCESS",
        details={"ip": "127.0.0.1"},
        user_id=user_id,
    )

    doc = log.to_doc()
    assert doc["event_type"] == "AUTH_LOGIN_SUCCESS"
    assert doc["user_id"] == user_id
    assert doc["details"]["ip"] == "127.0.0.1"
