"""
EduPredict - Environment Configuration
Defines configuration environments: Development, Testing, Production.
"""

import os
from pathlib import Path
from urllib.parse import urlparse
from typing import List, Union
from dotenv import load_dotenv

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
load_dotenv(BASE_DIR / ".env")

# List of known default or insecure secret keys that must NEVER be used in production
KNOWN_INSECURE_SECRETS = {
    "edupredict-default-insecure-key-change-in-prod",
    "edupredict-safe-dev-secret-key-32chars-min-len!!",
    "secret",
    "secret_key",
    "secret-key",
    "changeme",
    "password",
    "development",
    "dev",
    "test",
    "testing",
    "123456",
    "admin",
    "default",
}


def validate_secret_key(secret_key: str | None, is_production: bool = False) -> None:
    """
    Validate secret key strength and provenance.
    Fails safely in production if secret is missing, weak (<32 chars), or a known default.
    """
    if is_production:
        if not secret_key or not isinstance(secret_key, str) or not secret_key.strip():
            raise RuntimeError(
                "Production configuration error: SECRET_KEY environment variable is missing. "
                "Production deployment requires a cryptographically strong SECRET_KEY set via environment variable."
            )
        clean_key = secret_key.strip()
        if clean_key.lower() in KNOWN_INSECURE_SECRETS:
            raise RuntimeError(
                "Production configuration error: SECRET_KEY is set to a known insecure default value. "
                "Please generate a random 32+ character secret key for production."
            )
        if len(clean_key) < 32:
            raise RuntimeError(
                f"Production configuration error: SECRET_KEY is too weak (length {len(clean_key)} < 32). "
                "Production SECRET_KEY must be at least 32 characters."
            )


def validate_cors_origins(origins_input: Union[List[str], str, None], is_production: bool = False) -> List[str]:
    """
    Strictly validate configured CORS origins.
    - Rejects wildcard '*' (strictly prohibited when credentials/cookies are enabled).
    - Rejects wildcards even when mixed with valid origins (e.g. 'https://trusted.example,*').
    - Requires explicit HTTP or HTTPS scheme.
    - Requires non-empty host/netloc and forbids paths (beyond empty or '/'), queries, fragments, or credentials.
    - In production, fails safely with RuntimeError on any invalid origin or empty origin list.
    - In non-production, raises ValueError on wildcard or malformed origin.
    """
    if origins_input is None:
        raw_items = []
    elif isinstance(origins_input, str):
        raw_items = [o.strip() for o in origins_input.split(",") if o.strip()]
    elif isinstance(origins_input, (list, tuple, set)):
        raw_items = [str(o).strip() for o in origins_input if str(o).strip()]
    else:
        raw_items = []

    # 1. Prohibit wildcards anywhere in the configuration
    for item in raw_items:
        if item == "*" or "*" in item:
            err_msg = (
                f"Insecure CORS configuration: Wildcard origin '{item}' is strictly prohibited "
                "when credentials (cookies/sessions) are enabled."
            )
            if is_production:
                raise RuntimeError(f"Production configuration error: {err_msg}")
            raise ValueError(err_msg)

    validated_origins: List[str] = []

    # 2. Validate URL structure for each origin
    for item in raw_items:
        try:
            parsed = urlparse(item)
        except Exception as e:
            err_msg = f"Malformed CORS origin URL '{item}': {str(e)}"
            if is_production:
                raise RuntimeError(f"Production configuration error: {err_msg}")
            raise ValueError(err_msg)

        if parsed.scheme not in ("http", "https"):
            err_msg = f"Invalid CORS origin scheme '{parsed.scheme}' for '{item}'. Only 'http' and 'https' are allowed."
            if is_production:
                raise RuntimeError(f"Production configuration error: {err_msg}")
            raise ValueError(err_msg)

        if not parsed.netloc:
            err_msg = f"Invalid CORS origin '{item}': Missing domain or host."
            if is_production:
                raise RuntimeError(f"Production configuration error: {err_msg}")
            raise ValueError(err_msg)

        if parsed.username or parsed.password:
            err_msg = f"Invalid CORS origin '{item}': Origins must not contain user credentials."
            if is_production:
                raise RuntimeError(f"Production configuration error: {err_msg}")
            raise ValueError(err_msg)

        if parsed.path not in ("", "/"):
            err_msg = f"Invalid CORS origin '{item}': Origins must not contain paths ('{parsed.path}')."
            if is_production:
                raise RuntimeError(f"Production configuration error: {err_msg}")
            raise ValueError(err_msg)

        if parsed.query or parsed.fragment or parsed.params:
            err_msg = f"Invalid CORS origin '{item}': Origins must not contain query parameters or fragments."
            if is_production:
                raise RuntimeError(f"Production configuration error: {err_msg}")
            raise ValueError(err_msg)

        # Canonical origin form: scheme://netloc (without trailing slash)
        canonical = f"{parsed.scheme}://{parsed.netloc}"
        if canonical not in validated_origins:
            validated_origins.append(canonical)

    if is_production and not validated_origins:
        raise RuntimeError(
            "Production configuration error: CORS_ORIGINS must contain at least one valid explicit HTTP/HTTPS origin."
        )

    return validated_origins


class BaseConfig:
    """Base application configuration."""

    # Secret key for sessions & CSRF (safe dev fallback; overridden by env in production)
    SECRET_KEY = os.getenv("SECRET_KEY", "edupredict-safe-dev-secret-key-32chars-min-len!!")

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
    PERMANENT_SESSION_LIFETIME = 28800  # 8 hours session lifetime
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600  # 1 hour token lifetime

    # Explicit CORS Allowed Origins
    CORS_ALLOWED_ORIGINS = validate_cors_origins(
        os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000"
        ),
        is_production=False,
    )

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

    # In production, SECRET_KEY must come strictly from environment
    SECRET_KEY = os.getenv("SECRET_KEY")

    # Enforce secure cookies in production
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    # Production CORS allowed origins: loaded strictly from environment
    CORS_ALLOWED_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "").split(",")
        if o.strip()
    ]


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
    cfg = config_by_name.get(config_name, DevelopmentConfig)
    if issubclass(cfg, ProductionConfig) or cfg is ProductionConfig:
        cfg.SECRET_KEY = os.getenv("SECRET_KEY")
        cfg.CORS_ALLOWED_ORIGINS = [
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "").split(",")
            if o.strip()
        ]
    return cfg
