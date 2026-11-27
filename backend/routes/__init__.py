"""
EduPredict - Routes Package
"""

from backend.routes.health_routes import health_bp
from backend.routes.auth_routes import auth_bp
from backend.routes.user_routes import user_bp
from backend.routes.admin_routes import admin_bp
from backend.routes.prediction_routes import prediction_bp
from backend.routes.notification_routes import notification_bp
from backend.routes.feedback_routes import feedback_bp

__all__ = [
    "health_bp",
    "auth_bp",
    "user_bp",
    "admin_bp",
    "prediction_bp",
    "notification_bp",
    "feedback_bp",
]
