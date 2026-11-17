"""
EduPredict - Configuration Unit Tests
Verifies environment-based configuration loading, defaults, and overrides.
"""

from backend.config import (
    BaseConfig,
    DevelopmentConfig,
    TestingConfig,
    ProductionConfig,
    get_config,
)


def test_development_config():
    """Verify development configuration attributes."""
    config = DevelopmentConfig()
    assert config.DEBUG is True
    assert config.TESTING is False
    assert config.ENV == "development"
    assert config.WTF_CSRF_ENABLED is True
    assert "mongodb://" in config.MONGO_URI


def test_testing_config():
    """Verify testing configuration attributes."""
    config = TestingConfig()
    assert config.DEBUG is False
    assert config.TESTING is True
    assert config.ENV == "testing"
    assert config.WTF_CSRF_ENABLED is False
    assert "test" in config.MONGO_DB_NAME.lower()


def test_production_config():
    """Verify production configuration attributes."""
    config = ProductionConfig()
    assert config.DEBUG is False
    assert config.TESTING is False
    assert config.ENV == "production"
    assert config.SESSION_COOKIE_SECURE is True


def test_get_config_by_name():
    """Verify configuration resolution by environment name string."""
    assert get_config("development") == DevelopmentConfig
    assert get_config("testing") == TestingConfig
    assert get_config("production") == ProductionConfig
    # Default fallback
    assert get_config("unknown_environment") == DevelopmentConfig
