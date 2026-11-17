"""
EduPredict - MongoDB Connectivity & Resilience Tests
Verifies MongoDB 6.x client lifecycle, ping latency, and error resilience.
"""

from flask import Flask
from backend.extensions import MongoManager


def test_mongo_ping_success(app):
    """Verify successful ping against running local MongoDB 6 instance."""
    from backend.extensions import mongo
    ping_result = mongo.ping()

    assert ping_result["connected"] is True
    assert ping_result["status"] == "connected"
    assert "version" in ping_result
    assert "6.0" in ping_result["version"]
    assert ping_result["latency_ms"] >= 0.0
    assert ping_result["ok"] == 1.0


def test_mongo_unreachable_graceful_handling():
    """Verify that an unreachable MongoDB endpoint returns a graceful error dictionary."""
    mock_app = Flask("test_mock_app")
    mock_app.config["MONGO_URI"] = "mongodb://127.0.0.1:29999/edupredict_unreachable"
    mock_app.config["MONGO_DB_NAME"] = "edupredict_unreachable"
    mock_app.config["MONGO_SERVER_SELECTION_TIMEOUT_MS"] = 300  # 300ms fast timeout
    mock_app.config["MONGO_CONNECT_TIMEOUT_MS"] = 300

    manager = MongoManager(mock_app)
    result = manager.ping()

    assert result["connected"] is False
    assert result["status"] == "disconnected"
    assert "Connection timed out" in result.get("error", "")
    manager.close()


def test_mongo_uninitialized_client():
    """Verify behavior when client is uninitialized."""
    manager = MongoManager()
    result = manager.ping()

    assert result["connected"] is False
    assert result["status"] == "disconnected"
    assert "not initialized" in result.get("error", "")
