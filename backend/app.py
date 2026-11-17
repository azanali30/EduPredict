"""
EduPredict - Application Factory
Creates and configures the Flask application instance.
"""

import os
import logging
from flask import Flask, jsonify
from backend.config import get_config
from backend.extensions import csrf, login_manager, mongo
from backend.routes.health_routes import health_bp
from backend.routes.auth_routes import auth_bp
from backend.routes.user_routes import user_bp
from backend.routes.admin_routes import admin_bp
from backend.commands.admin_commands import create_admin_command, init_db_command
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

    # 1. Load Configuration
    config_obj = get_config(config_name)
    app.config.from_object(config_obj)

    logger.info("Initializing EduPredict in '%s' mode", app.config.get("ENV", "development"))

    # 2. Initialize Extensions
    csrf.init_app(app)
    login_manager.init_app(app)
    mongo.init_app(app)

    # Configure LoginManager
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please log in to access this page."
    login_manager.login_message_category = "info"

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

    # 4. Register CLI Commands
    app.cli.add_command(create_admin_command)
    app.cli.add_command(init_db_command)

    # 5. Initialize Database Indexes if database is reachable
    with app.app_context():
        if mongo.db is not None:
            try:
                init_db_indexes(mongo.db)
            except Exception as e:
                logger.warning("Could not auto-initialize indexes on startup: %s", str(e))

    # 6. Global Error Handlers
    @app.errorhandler(404)
    def handle_not_found(e):
        return jsonify({
            "error": "Not Found",
            "message": "The requested resource could not be found.",
            "status_code": 404,
        }), 404

    @app.errorhandler(500)
    def handle_server_error(e):
        logger.error("Internal Server Error: %s", str(e))
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected error occurred on the server.",
            "status_code": 500,
        }), 500

    @app.errorhandler(400)
    def handle_bad_request(e):
        return jsonify({
            "error": "Bad Request",
            "message": str(e.description) if hasattr(e, "description") else "Bad request.",
            "status_code": 400,
        }), 400

    @app.errorhandler(403)
    def handle_forbidden(e):
        return jsonify({
            "error": "Forbidden",
            "message": "You do not have permission to access this resource.",
            "status_code": 403,
        }), 403
    
    @app.errorhandler(403)
    def handle_forbidden(e):
        return jsonify({
            "error": "Forbidden",
            "message": "You do not have permission to access this resource.",
            "status_code": 403,
        }), 403

    return app


if __name__ == "__main__":
    flask_app = create_app()
    host = flask_app.config.get("HOST", "127.0.0.1")
    port = flask_app.config.get("PORT", 5000)
    debug = flask_app.config.get("DEBUG", True)
    logger.info("Starting EduPredict Flask server at http://%s:%s", host, port)
    flask_app.run(host=host, port=port, debug=debug)
