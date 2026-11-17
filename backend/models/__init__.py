"""
EduPredict - Data Models Package
"""

from backend.models.user_model import User, VALID_ROLES
from backend.models.academic_record_model import AcademicRecord
from backend.models.assignment_model import TeacherStudentAssignment
from backend.models.system_log_model import SystemLog

__all__ = [
    "User",
    "VALID_ROLES",
    "AcademicRecord",
    "TeacherStudentAssignment",
    "SystemLog",
]
