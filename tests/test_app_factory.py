"""
EduPredict - Application Factory Unit Tests
Verifies app creation, extension registration, and error handlers.
"""

from backend.app import create_app
from backend.extensions import mongo, csrf, login_manager


def test_create_app_testing():
    """Verify application factory creates a valid Flask testing instance."""
    app = create_app("testing")
    assert app is not None
    assert app.testing is True
    assert app.config["ENV"] == "testing"
    assert "mongo_manager" in app.extensions


def test_create_app_extensions_registered(app):
    """Verify that required extensions are properly bound to the app."""
    assert "mongo_manager" in app.extensions
    assert mongo.client is not None
    assert csrf is not None
    assert login_manager is not None


def test_custom_404_error_handler(client):
    """Verify 404 handler returns structured JSON response."""
    response = client.get("/non-existent-endpoint-xyz-1234")
    assert response.status_code == 404
    data = response.get_json()
    assert data is not None
    assert data.get("error") == "Not Found"
    assert data.get("status_code") == 404
