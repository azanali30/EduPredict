"""
EduPredict - Routes Package
"""

from backend.routes.health_routes import health_bp
from backend.routes.auth_routes import auth_bp
from backend.routes.user_routes import user_bp
from backend.routes.admin_routes import admin_bp

__all__ = [
    "health_bp",
    "auth_bp",
    "user_bp",
    "admin_bp",
]
