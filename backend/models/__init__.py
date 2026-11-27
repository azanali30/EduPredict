"""
EduPredict - Data Models Package
"""

from backend.models.user_model import User, VALID_ROLES
from backend.models.academic_record_model import AcademicRecord
from backend.models.assignment_model import TeacherStudentAssignment
from backend.models.system_log_model import SystemLog
from backend.models.prediction_model import PredictionRecord
from backend.models.subject_model import Subject
from backend.models.teacher_subject_assignment_model import TeacherSubjectAssignment
from backend.models.student_subject_enrollment_model import StudentSubjectEnrollment
from backend.models.notification_model import Notification
from backend.models.feedback_model import FeedbackTicket

__all__ = [
    "User",
    "VALID_ROLES",
    "AcademicRecord",
    "TeacherStudentAssignment",
    "SystemLog",
    "PredictionRecord",
    "Subject",
    "TeacherSubjectAssignment",
    "StudentSubjectEnrollment",
    "Notification",
    "FeedbackTicket",
]
