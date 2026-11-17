"""
EduPredict - Authentication Service
Handles student registration, user authentication, and credential verification.
"""

from pymongo.database import Database
from backend.models.user_model import User
from backend.services.user_service import UserService
from backend.services.system_log_service import log_event
from backend.utils.security import normalize_email


class AuthService:
    """Manages authentication workflows, credential checks, and registration."""

    @staticmethod
    def register_student(
        db: Database,
        email: str,
        password: str,
        full_name: str,
    ) -> tuple[dict | None, str | None]:
        """
        Register a new student account.
        Role is strictly enforced as 'student' to prevent privilege escalation.
        """
        user, err = UserService.create_user(
            db=db,
            email=email,
            plain_password=password,
            full_name=full_name,
            role="student",
        )
        if err or not user:
            return None, err

        return user.to_dict(), None

    @staticmethod
    def authenticate(
        db: Database,
        email: str,
        password: str,
        ip_address: str | None = None,
    ) -> tuple[User | None, str | None]:
        """
        Authenticate a user by email and password.
        Returns: (User instance, error_message)
        """
        if db is None:
            return None, "Database service is unavailable."

        norm_email = normalize_email(email)
        if not norm_email or not password:
            return None, "Email and password are required."

        user = UserService.get_by_email(db, norm_email)
        if not user:
            log_event(
                db,
                "AUTH_LOGIN_FAILED",
                {"email": norm_email, "reason": "User not found"},
                ip_address=ip_address,
            )
            return None, "Invalid email or password."

        if not user.is_active:
            log_event(
                db,
                "AUTH_LOGIN_FAILED",
                {"email": norm_email, "reason": "Account inactive"},
                user_id=user.id,
                ip_address=ip_address,
            )
            return None, "Account is disabled. Please contact the administrator."

        if not user.verify_password(password):
            log_event(
                db,
                "AUTH_LOGIN_FAILED",
                {"email": norm_email, "reason": "Invalid password"},
                user_id=user.id,
                ip_address=ip_address,
            )
            return None, "Invalid email or password."

        log_event(
            db,
            "AUTH_LOGIN_SUCCESS",
            {"email": norm_email, "role": user.role},
            user_id=user.id,
            ip_address=ip_address,
        )
        return user, None
