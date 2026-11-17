"""
EduPredict - Flask Extensions
Initializes CSRF protection, Flask-Login, and PyMongo client management.
"""

import time
import logging
from flask_wtf.csrf import CSRFProtect
from flask_login import LoginManager
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, PyMongoError

logger = logging.getLogger(__name__)

# Initialize standard Flask extensions
csrf = CSRFProtect()
login_manager = LoginManager()


class MongoManager:
    """
    Manages MongoDB 6.x connectivity for the Flask application.
    Provides safe client lifecycle, connection pooling, and health ping diagnostics.
    """

    def __init__(self, app=None):
        self.client = None
        self.db = None
        self.uri = None
        self.db_name = None
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        """Initialize MongoDB client using Flask application configuration."""
        self.uri = app.config.get("MONGO_URI", "mongodb://localhost:27017/edupredict")
        self.db_name = app.config.get("MONGO_DB_NAME", "edupredict")
        timeout_ms = app.config.get("MONGO_SERVER_SELECTION_TIMEOUT_MS", 3000)
        connect_timeout_ms = app.config.get("MONGO_CONNECT_TIMEOUT_MS", 3000)

        try:
            self.client = MongoClient(
                self.uri,
                serverSelectionTimeoutMS=timeout_ms,
                connectTimeoutMS=connect_timeout_ms,
                retryWrites=True,
            )
            self.db = self.client[self.db_name]
            app.extensions = getattr(app, "extensions", {})
            app.extensions["mongo_manager"] = self
            logger.info("MongoDB client configured for database: %s", self.db_name)
        except Exception as e:
            logger.error("Failed to configure MongoDB client: %s", str(e))
            self.client = None
            self.db = None

    def ping(self):
        """
        Safely ping the MongoDB server to verify health and measure latency.
        Returns a structured dictionary with status, version, and latency.
        """
        if self.client is None:
            return {
                "status": "disconnected",
                "connected": False,
                "error": "MongoDB client is not initialized",
                "database": self.db_name,
            }

        start_time = time.perf_counter()
        try:
            # Send ping command to admin database
            result = self.client.admin.command("ping")
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Query server info for version check
            server_info = self.client.server_info()
            version = server_info.get("version", "unknown")

            return {
                "status": "connected",
                "connected": True,
                "database": self.db_name,
                "version": version,
                "latency_ms": latency_ms,
                "ok": result.get("ok", 1.0),
            }
        except (ServerSelectionTimeoutError, ConnectionFailure) as conn_err:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.warning("MongoDB ping failed (timeout/connection): %s", str(conn_err))
            return {
                "status": "disconnected",
                "connected": False,
                "error": f"Connection timed out: {type(conn_err).__name__}",
                "database": self.db_name,
                "latency_ms": latency_ms,
            }
        except PyMongoError as pm_err:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("MongoDB PyMongo error during ping: %s", str(pm_err))
            return {
                "status": "error",
                "connected": False,
                "error": str(pm_err),
                "database": self.db_name,
                "latency_ms": latency_ms,
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error("Unexpected error during MongoDB ping: %s", str(e))
            return {
                "status": "error",
                "connected": False,
                "error": str(e),
                "database": self.db_name,
                "latency_ms": latency_ms,
            }

    def close(self):
        """Close client connection."""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None


# Global MongoDB manager instance
mongo = MongoManager()
