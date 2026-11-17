"""
EduPredict - Health Route Tests
Verifies HTTP endpoints: /, /health, /api/health, /api/health/db.
"""


def test_root_index_endpoint(client):
    """Verify root / landing endpoint returns application metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.get_json()
    assert data["app"] == "EduPredict"
    assert data["status"] == "online"
    assert "endpoints" in data


def test_health_check_endpoint(client):
    """Verify /health endpoint returns healthy status and DB metrics."""
    response = client.get("/health")
    assert response.status_code in [200, 503]
    data = response.get_json()
    assert "status" in data
    assert "database" in data
    assert data["database"]["engine"] == "MongoDB"


def test_api_health_detailed_endpoint(client):
    """Verify /api/health returns detailed environment and database info."""
    response = client.get("/api/health")
    assert response.status_code in [200, 503]
    data = response.get_json()
    assert data["app"] == "EduPredict"
    assert data["environment"] == "testing"
    assert "database" in data
    assert data["database"]["connected"] is True
    assert "6.0" in data["database"]["server_version"]


def test_api_health_db_endpoint(client):
    """Verify dedicated /api/health/db endpoint."""
    response = client.get("/api/health/db")
    assert response.status_code in [200, 503]
    data = response.get_json()
    assert data["engine"] == "MongoDB"
    assert "result" in data
    assert data["result"]["connected"] is True
