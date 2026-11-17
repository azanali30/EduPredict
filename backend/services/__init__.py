"""
EduPredict - Services Package
"""

from backend.services.system_log_service import log_event
from backend.services.user_service import UserService
from backend.services.auth_service import AuthService
from backend.services.assignment_service import AssignmentService
from backend.services.prediction_service import PredictionService

__all__ = [
    "log_event",
    "UserService",
    "AuthService",
    "AssignmentService",
    "PredictionService",
]
