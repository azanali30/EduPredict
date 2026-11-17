"""
EduPredict - Pytest Configuration and Shared Fixtures
"""

import pytest
from backend.app import create_app
from backend.extensions import mongo


@pytest.fixture(scope="session")
def app():
    """Create and configure a Flask application instance for testing."""
    test_app = create_app("testing")
    yield test_app
    # Teardown
    mongo.close()


@pytest.fixture(scope="function")
def client(app):
    """Provide a Flask test client for HTTP requests."""
    return app.test_client()


@pytest.fixture(scope="function")
def runner(app):
    """Provide a Flask CLI test runner."""
    return app.test_cli_runner()
