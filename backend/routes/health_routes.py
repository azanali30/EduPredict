"""
EduPredict - Health and Diagnostic Routes
Provides health-check endpoints for application status and MongoDB 6.x connectivity.
"""

from datetime import datetime, timezone
from flask import Blueprint, jsonify, current_app
from backend.extensions import mongo

health_bp = Blueprint("health", __name__)


@health_bp.route("/", methods=["GET"])
def index():
    """Root landing endpoint verifying application bootstrap."""
    return jsonify({
        "app": current_app.config.get("APP_NAME", "EduPredict"),
        "version": current_app.config.get("APP_VERSION", "1.0.0"),
        "status": "online",
        "description": "AI-Powered Educational Performance Prediction System",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoints": {
            "health": "/health",
            "api_health": "/api/health",
            "db_health": "/api/health/db",
        },
    }), 200


@health_bp.route("/health", methods=["GET"])
def health_check():
    """
    Lightweight health check endpoint for uptime probes.
    Returns status: healthy if app is up, reporting DB state.
    """
    db_health = mongo.ping()
    is_healthy = db_health.get("connected", False)

    response_data = {
        "status": "healthy" if is_healthy else "degraded",
        "app": current_app.config.get("APP_NAME", "EduPredict"),
        "version": current_app.config.get("APP_VERSION", "1.0.0"),
        "environment": current_app.config.get("ENV", "development"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "status": db_health.get("status"),
            "connected": db_health.get("connected"),
            "engine": "MongoDB",
            "database_name": db_health.get("database"),
            "latency_ms": db_health.get("latency_ms"),
        },
    }

    # If database is down, report 503 or degraded 200 based on standard health design
    # Return 200 with status=degraded if app is alive but DB is down, or 200 if fully healthy
    return jsonify(response_data), 200 if is_healthy else 503


@health_bp.route("/api/health", methods=["GET"])
def api_health():
    """Detailed health diagnostic endpoint including MongoDB version and configuration."""
    db_health = mongo.ping()
    is_healthy = db_health.get("connected", False)

    response_data = {
        "status": "healthy" if is_healthy else "degraded",
        "app": current_app.config.get("APP_NAME", "EduPredict"),
        "version": current_app.config.get("APP_VERSION", "1.0.0"),
        "environment": current_app.config.get("ENV", "development"),
        "debug": current_app.config.get("DEBUG", False),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "status": db_health.get("status"),
            "connected": db_health.get("connected"),
            "engine": "MongoDB 6.x",
            "database": db_health.get("database"),
            "server_version": db_health.get("version", "unknown"),
            "latency_ms": db_health.get("latency_ms"),
            "error": db_health.get("error"),
        },
    }
    return jsonify(response_data), 200 if is_healthy else 503


@health_bp.route("/api/health/db", methods=["GET"])
def db_health_check():
    """Dedicated endpoint checking only MongoDB 6.x health and metrics."""
    result = mongo.ping()
    status_code = 200 if result.get("connected") else 503
    return jsonify({
        "engine": "MongoDB",
        "result": result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), status_code
