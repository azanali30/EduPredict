"""
EduPredict - Pytest Configuration and Shared Fixtures
"""

import pytest
from backend.app import create_app
from backend.extensions import mongo
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.enrollment_service import EnrollmentService
from backend.database.schema import init_db_indexes


@pytest.fixture(scope="session")
def app():
    """Create and configure a Flask application instance for testing."""
    test_app = create_app("testing")
    with test_app.app_context():
        if mongo.db is not None:
            init_db_indexes(mongo.db)
    yield test_app
    # Clean up test collections and close
    if mongo.db is not None:
        mongo.client.drop_database("edupredict_test")
    mongo.close()


@pytest.fixture(scope="function")
def clean_db(app):
    """Ensure clean collections for each test function in edupredict_test."""
    with app.app_context():
        if mongo.db is not None:
            mongo.db.users.delete_many({})
            mongo.db.teacher_student_assignments.delete_many({})
            mongo.db.academic_records.delete_many({})
            mongo.db.predictions.delete_many({})
            mongo.db.system_logs.delete_many({})
            mongo.db.subjects.delete_many({})
            mongo.db.teacher_subject_assignments.delete_many({})
            mongo.db.student_subject_enrollments.delete_many({})
            mongo.db.anomaly_records.delete_many({})
            mongo.db.dropout_records.delete_many({})
            mongo.db.dropout_prediction_history.delete_many({})
            mongo.db.demand_forecasts.delete_many({})
            mongo.db.demand_model_metadata.delete_many({})
            mongo.db.model_registry.delete_many({})
    yield mongo.db


@pytest.fixture(scope="function")
def client(app):
    """Provide a Flask test client for HTTP requests."""
    return app.test_client()


@pytest.fixture(scope="function")
def runner(app):
    """Provide a Flask CLI test runner."""
    return app.test_cli_runner()


@pytest.fixture(scope="function")
def test_student(clean_db):
    """Create and return a sample student user in the test database."""
    user, _ = UserService.create_user(
        db=clean_db,
        email="student.test@edupredict.com",
        plain_password="StudentPassword123!",
        full_name="Alice Student",
        role="student",
    )
    return user


@pytest.fixture(scope="function")
def test_teacher(clean_db):
    """Create and return a sample teacher user in the test database."""
    user, _ = UserService.create_user(
        db=clean_db,
        email="teacher.test@edupredict.com",
        plain_password="TeacherPassword123!",
        full_name="Bob Instructor",
        role="teacher",
    )
    return user


@pytest.fixture(scope="function")
def test_admin(clean_db):
    """Create and return a sample administrator user in the test database."""
    user, _ = UserService.create_user(
        db=clean_db,
        email="admin.test@edupredict.com",
        plain_password="AdminPassword123!",
        full_name="Carol Administrator",
        role="admin",
    )
    return user


@pytest.fixture(scope="function")
def test_analyst(clean_db):
    """Create and return a sample analyst user in the test database."""
    user, _ = UserService.create_user(
        db=clean_db,
        email="analyst.test@edupredict.com",
        plain_password="AnalystPassword123!",
        full_name="Dave Analyst",
        role="analyst",
    )
    return user
