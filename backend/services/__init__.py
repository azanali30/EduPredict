"""
EduPredict - Services Package
"""

from backend.services.system_log_service import log_event
from backend.services.user_service import UserService
from backend.services.auth_service import AuthService
from backend.services.assignment_service import AssignmentService

__all__ = [
    "log_event",
    "UserService",
    "AuthService",
    "AssignmentService",
]
