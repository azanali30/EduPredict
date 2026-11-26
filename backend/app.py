"""
EduPredict - Application Factory
Creates and configures the Flask application instance.
"""

import os
import logging
from flask import Flask, jsonify, request
from backend.config import get_config, validate_secret_key, validate_cors_origins
from backend.extensions import csrf, login_manager, mongo
from backend.routes.health_routes import health_bp
from backend.routes.auth_routes import auth_bp
from backend.routes.user_routes import user_bp
from backend.routes.admin_routes import admin_bp
from backend.routes.prediction_routes import prediction_bp
from backend.routes.analyst_routes import analyst_bp
from backend.routes.upload_routes import upload_bp
from backend.routes.anomaly_routes import anomaly_bp
from backend.routes.dropout_routes import dropout_bp
from backend.routes.demand_routes import demand_bp
from backend.routes.evaluation_routes import evaluation_bp
from backend.routes.stream_routes import stream_bp
from backend.routes.monitoring_routes import monitoring_bp
from backend.commands.admin_commands import (
    create_admin_command,
    init_db_command,
    backup_db_command,
    verify_backup_command,
    list_backups_command,
    restore_db_command,
)
from backend.services.user_service import UserService
from backend.database.schema import init_db_indexes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("edupredict")


def create_app(config_name=None):
    """
    Application Factory Pattern for EduPredict.
    Initializes Flask application, configuration, extensions, routes, and CLI commands.

    :param config_name: 'development', 'testing', 'production', or None (uses FLASK_ENV)
    :return: Configured Flask application instance
    """
    app = Flask(
        __name__,
        static_folder="../frontend/static",
        template_folder="../frontend/templates",
    )

    # 1. Load Configuration & Validate Production Invariants
    config_obj = get_config(config_name)
    app.config.from_object(config_obj)

    is_prod = (app.config.get("ENV") == "production" or config_name == "production")
    validate_secret_key(app.config.get("SECRET_KEY"), is_production=is_prod)

    # Validate and normalize CORS origins (fails startup safely if invalid in production)
    raw_cors = app.config.get("CORS_ALLOWED_ORIGINS")
    validated_cors = validate_cors_origins(raw_cors, is_production=is_prod)
    app.config["CORS_ALLOWED_ORIGINS"] = validated_cors

    if is_prod:
        # Enforce strict production safety invariants
        app.config["DEBUG"] = False
        app.config["TESTING"] = False
        app.config["SESSION_COOKIE_SECURE"] = True

    logger.info("Initializing EduPredict in '%s' mode", app.config.get("ENV", "development"))

    # 2. Initialize Extensions
    csrf.init_app(app)
    login_manager.init_app(app)
    mongo.init_app(app)

    # Configure LoginManager with strong session protection
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please log in to access this page."
    login_manager.login_message_category = "info"
    login_manager.session_protection = "strong"

    from flask_wtf.csrf import CSRFError

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        """Custom structured JSON handler for CSRF validation failures."""
        reason = getattr(e, "description", str(e))
        logger.warning("CSRF validation failed: %s (IP: %s)", reason, request.remote_addr)
        return jsonify({
            "error": "Bad Request",
            "message": f"CSRF validation failed: {reason}",
            "status_code": 400,
        }), 400

    @login_manager.user_loader
    def load_user(user_id):
        """Flask-Login user loader callback."""
        return UserService.get_by_id(mongo.db, user_id)

    @login_manager.unauthorized_handler
    def unauthorized_handler():
        """Handle unauthorized access with structured JSON response."""
        return jsonify({
            "error": "Unauthorized",
            "message": "Authentication required. Please log in.",
            "status_code": 401,
        }), 401

    # 3. Register Blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(prediction_bp)
    app.register_blueprint(analyst_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(anomaly_bp)
    app.register_blueprint(dropout_bp)
    app.register_blueprint(demand_bp)
    app.register_blueprint(evaluation_bp)
    app.register_blueprint(stream_bp)
    app.register_blueprint(monitoring_bp)

    # 4. Register CLI Commands
    app.cli.add_command(create_admin_command)
    app.cli.add_command(init_db_command)
    app.cli.add_command(backup_db_command)
    app.cli.add_command(verify_backup_command)
    app.cli.add_command(list_backups_command)
    app.cli.add_command(restore_db_command)

    # 5. Initialize Database Indexes if database is reachable
    with app.app_context():
        if mongo.db is not None:
            try:
                init_db_indexes(mongo.db)
            except Exception as e:
                logger.warning("Could not auto-initialize indexes on startup: %s", str(e))

    # 6. CORS & Security Headers
    @app.before_request
    def handle_cors_preflight():
        """Handle CORS OPTIONS preflight requests for explicitly allowed origins."""
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin")
            allowed_origins = app.config.get("CORS_ALLOWED_ORIGINS", [])
            # Wildcard '*' is strictly rejected when credentials are enabled
            if origin and origin != "*" and origin in allowed_origins:
                response = app.make_default_options_response()
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = (
                    "Content-Type, X-CSRFToken, X-CSRF-Token, X-Requested-With, Authorization"
                )
                response.headers["Access-Control-Max-Age"] = "3600"
                return response

    @app.after_request
    def set_security_headers(response):
        """Set explicit CORS and hardening security headers on responses."""
        origin = request.headers.get("Origin")
        allowed_origins = app.config.get("CORS_ALLOWED_ORIGINS", [])
        # Only reflect exact matching origin from allowlist; never reflect wildcard '*'
        if origin and origin != "*" and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, X-CSRFToken, X-CSRF-Token, X-Requested-With, Authorization"
            )

        # Baseline Security Hardening Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # 7. Global Error Handlers (Consistent JSON Responses)
    @app.errorhandler(400)
    def handle_bad_request(e):
        return jsonify({
            "error": "Bad Request",
            "message": str(e.description) if hasattr(e, "description") else "Bad request syntax or invalid parameters.",
            "status_code": 400,
        }), 400

    @app.errorhandler(403)
    def handle_forbidden(e):
        return jsonify({
            "error": "Forbidden",
            "message": str(e.description) if hasattr(e, "description") and e.description != "403 Forbidden" else "You do not have permission to access this resource.",
            "status_code": 403,
        }), 403

    @app.errorhandler(404)
    def handle_not_found(e):
        return jsonify({
            "error": "Not Found",
            "message": "The requested resource could not be found.",
            "status_code": 404,
        }), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(e):
        return jsonify({
            "error": "Method Not Allowed",
            "message": "The requested HTTP method is not supported for this endpoint.",
            "status_code": 405,
        }), 405

    @app.errorhandler(413)
    def handle_payload_too_large(e):
        return jsonify({
            "error": "Payload Too Large",
            "message": "The request payload size exceeds the maximum allowed server limit.",
            "status_code": 413,
        }), 413

    @app.errorhandler(415)
    def handle_unsupported_media_type(e):
        return jsonify({
            "error": "Unsupported Media Type",
            "message": "The request payload format or media type is not supported.",
            "status_code": 415,
        }), 415

    @app.errorhandler(500)
    def handle_server_error(e):
        logger.error("Internal Server Error: %s", str(e), exc_info=True)
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected error occurred on the server.",
            "status_code": 500,
        }), 500

    return app


if __name__ == "__main__":
    flask_app = create_app()
    host = flask_app.config.get("HOST", "127.0.0.1")
    port = flask_app.config.get("PORT", 5000)
    debug = flask_app.config.get("DEBUG", False)
    # Strictly forbid debug mode when in production environment
    if flask_app.config.get("ENV") == "production":
        debug = False
    logger.info("Starting EduPredict Flask server at http://%s:%s (debug=%s)", host, port, debug)
    flask_app.run(host=host, port=port, debug=debug)
