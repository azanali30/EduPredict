"""
EduPredict - Environment Configuration
Defines configuration environments: Development, Testing, Production.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
load_dotenv(BASE_DIR / ".env")


class BaseConfig:
    """Base application configuration."""

    # Secret key for sessions & CSRF
    SECRET_KEY = os.getenv("SECRET_KEY", "edupredict-default-insecure-key-change-in-prod")

    # Host & Port
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", 5000))

    # MongoDB 6.x Configuration
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/edupredict")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "edupredict")
    MONGO_SERVER_SELECTION_TIMEOUT_MS = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", 3000))
    MONGO_CONNECT_TIMEOUT_MS = int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", 3000))

    # Security & Session Settings
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False  # Set to True in Production with HTTPS
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600  # 1 hour token lifetime

    # Application Metadata
    APP_NAME = "EduPredict"
    APP_VERSION = "1.0.0"

    # Upload and File Management
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "backend" / "uploads"))
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB maximum request payload limit

    # ML Artifact Paths
    ML_REGRESSION_MODEL_PATH = os.getenv(
        "ML_REGRESSION_MODEL_PATH", str(BASE_DIR / "ml_models" / "performance_regressor.joblib")
    )
    ML_CLASSIFICATION_MODEL_PATH = os.getenv(
        "ML_CLASSIFICATION_MODEL_PATH", str(BASE_DIR / "ml_models" / "risk_classifier.joblib")
    )
    ML_SCALER_PATH = os.getenv(
        "ML_SCALER_PATH", str(BASE_DIR / "ml_models" / "feature_scaler.joblib")
    )


class DevelopmentConfig(BaseConfig):
    """Development environment configuration."""

    DEBUG = True
    TESTING = False
    ENV = "development"


class TestingConfig(BaseConfig):
    """Testing environment configuration."""

    DEBUG = False
    TESTING = True
    ENV = "testing"

    # Use a separate test database
    MONGO_URI = os.getenv("MONGO_TEST_URI", "mongodb://localhost:27017/edupredict_test")
    MONGO_DB_NAME = os.getenv("MONGO_TEST_DB_NAME", "edupredict_test")

    # Disable CSRF for simplified automated testing
    WTF_CSRF_ENABLED = False


class ProductionConfig(BaseConfig):
    """Production environment configuration."""

    DEBUG = False
    TESTING = False
    ENV = "production"

    # Enforce secure cookies in production
    SESSION_COOKIE_SECURE = True


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}


def get_config(config_name=None):
    """Retrieve configuration object by name or from environment."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development").lower()
    return config_by_name.get(config_name, DevelopmentConfig)
