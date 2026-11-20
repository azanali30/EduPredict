"""
EduPredict - User Service
Business logic for user lookup, creation, updates, and role management.
"""

from datetime import datetime, timezone
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from backend.models.user_model import User, VALID_ROLES
from backend.utils.security import (
    hash_password,
    normalize_email,
    to_object_id,
    validate_email_format,
    validate_password_strength,
)
from backend.services.system_log_service import log_event


class UserService:
    """Manages user persistence, lookups, profile modifications, and role updates."""

    @staticmethod
    def get_by_id(db: Database, user_id) -> User | None:
        """Find a user by their MongoDB ObjectId."""
        oid = to_object_id(user_id)
        if not oid or db is None:
            return None
        doc = db.users.find_one({"_id": oid})
        return User.from_doc(doc) if doc else None

    @staticmethod
    def get_by_email(db: Database, email: str) -> User | None:
        """Find a user by normalized email address."""
        if not email or db is None:
            return None
        norm_email = normalize_email(email)
        doc = db.users.find_one({"email": norm_email})
        return User.from_doc(doc) if doc else None

    @staticmethod
    def create_user(
        db: Database,
        email: str,
        plain_password: str,
        full_name: str,
        role: str = "student",
        is_active: bool = True,
        student_id: str | None = None,
        employee_id: str | None = None,
        contact_number: str | None = None,
        department: str | None = None,
    ) -> tuple[User | None, str | None]:
        """
        Create a new user with secure password hashing.
        Returns: (User instance, error_message)
        """
        if db is None:
            return None, "Database service is unavailable."

        norm_email = normalize_email(email)
        if not validate_email_format(norm_email):
            return None, "Invalid email address format."

        valid, msg = validate_password_strength(plain_password)
        if not valid:
            return None, msg

        if not full_name or not full_name.strip():
            return None, "Full name is required."

        if role not in VALID_ROLES:
            return None, f"Invalid role '{role}'. Allowed roles: {', '.join(VALID_ROLES)}"

        # Check for existing account email
        existing = db.users.find_one({"email": norm_email})
        if existing:
            return None, "An account with this email address already exists."

        # Check unique student_id if provided
        clean_stu_id = student_id.strip() if student_id else None
        if clean_stu_id:
            if db.users.find_one({"student_id": clean_stu_id}):
                return None, f"A student with Student ID '{clean_stu_id}' already exists."

        # Check unique employee_id if provided
        clean_emp_id = employee_id.strip() if employee_id else None
        if clean_emp_id:
            if db.users.find_one({"employee_id": clean_emp_id}):
                return None, f"A teacher with Employee ID '{clean_emp_id}' already exists."

        pwd_hash = hash_password(plain_password)
        user = User(
            email=norm_email,
            password_hash=pwd_hash,
            full_name=full_name.strip(),
            role=role,
            is_active=is_active,
            student_id=clean_stu_id,
            employee_id=clean_emp_id,
            contact_number=contact_number.strip() if contact_number else None,
            department=department.strip() if department else None,
        )

        try:
            db.users.insert_one(user.to_doc())
            log_event(
                db,
                "USER_CREATED",
                {
                    "email": norm_email,
                    "role": role,
                    "student_id": clean_stu_id,
                    "employee_id": clean_emp_id,
                },
                user_id=user.id,
            )
            return user, None
        except DuplicateKeyError as e:
            err_str = str(e)
            if "student_id" in err_str:
                return None, f"A student with Student ID '{clean_stu_id}' already exists."
            if "employee_id" in err_str:
                return None, f"A teacher with Employee ID '{clean_emp_id}' already exists."
            return None, "An account with this email address already exists."
        except Exception as e:
            return None, f"Failed to create user: {str(e)}"

    @staticmethod
    def update_profile(
        db: Database,
        user_id,
        full_name: str,
    ) -> tuple[User | None, str | None]:
        """Update a user's editable profile information."""
        user = UserService.get_by_id(db, user_id)
        if not user:
            return None, "User not found."

        if not full_name or not full_name.strip():
            return None, "Full name cannot be empty."

        clean_name = full_name.strip()
        now = datetime.now(timezone.utc)

        try:
            db.users.update_one(
                {"_id": user.id},
                {"$set": {"full_name": clean_name, "updated_at": now}},
            )
            user.full_name = clean_name
            user.updated_at = now
            log_event(db, "PROFILE_UPDATED", {"user_id": str(user.id)}, user_id=user.id)
            return user, None
        except Exception as e:
            return None, f"Failed to update profile: {str(e)}"

    @staticmethod
    def change_password(
        db: Database,
        user_id,
        current_password: str,
        new_password: str,
    ) -> tuple[bool, str]:
        """Change a user's password after verifying the current password."""
        user = UserService.get_by_id(db, user_id)
        if not user:
            return False, "User not found."

        if not user.verify_password(current_password):
            return False, "Current password is incorrect."

        valid, msg = validate_password_strength(new_password)
        if not valid:
            return False, msg

        new_hash = hash_password(new_password)
        now = datetime.now(timezone.utc)

        try:
            db.users.update_one(
                {"_id": user.id},
                {"$set": {"password_hash": new_hash, "updated_at": now}},
            )
            log_event(db, "PASSWORD_CHANGED", {"user_id": str(user.id)}, user_id=user.id)
            return True, "Password successfully updated."
        except Exception as e:
            return False, f"Failed to update password: {str(e)}"

    @staticmethod
    def list_users(
        db: Database,
        role: str | None = None,
        limit: int = 50,
        skip: int = 0,
    ) -> list[dict]:
        """List users for administration, sorted by created_at desc."""
        if db is None:
            return []
        query = {}
        if role and role in VALID_ROLES:
            query["role"] = role
        cursor = db.users.find(query).sort("created_at", -1).skip(skip).limit(limit)
        return [User.from_doc(doc).to_dict() for doc in cursor if doc]

    @staticmethod
    def update_role(
        db: Database,
        target_user_id,
        new_role: str,
        actor_admin_id,
    ) -> tuple[User | None, str | None]:
        """Update user role (restricted to administrators)."""
        if new_role not in VALID_ROLES:
            return None, f"Invalid role '{new_role}'. Must be one of: {', '.join(VALID_ROLES)}"

        target_oid = to_object_id(target_user_id)
        actor_oid = to_object_id(actor_admin_id)
        if not target_oid:
            return None, "Invalid user ID format."

        target_user = UserService.get_by_id(db, target_oid)
        if not target_user:
            return None, "User not found."

        # Safety check: Prevent admin from demoting themselves if they are the current actor
        if target_oid == actor_oid and new_role != "admin":
            return None, "Administrators cannot remove their own administrator privileges."

        now = datetime.now(timezone.utc)
        try:
            db.users.update_one(
                {"_id": target_oid},
                {"$set": {"role": new_role, "updated_at": now}},
            )
            old_role = target_user.role
            target_user.role = new_role
            target_user.updated_at = now
            log_event(
                db,
                "ROLE_MODIFIED",
                {"target_user_id": str(target_oid), "old_role": old_role, "new_role": new_role},
                user_id=target_oid,
                actor_id=actor_oid,
            )
            return target_user, None
        except Exception as e:
            return None, f"Failed to update role: {str(e)}"

    @staticmethod
    def update_status(
        db: Database,
        target_user_id,
        is_active: bool,
        actor_admin_id,
    ) -> tuple[User | None, str | None]:
        """Activate or deactivate a user account (restricted to administrators)."""
        target_oid = to_object_id(target_user_id)
        actor_oid = to_object_id(actor_admin_id)
        if not target_oid or db is None:
            return None, "Invalid user ID or database unavailable."

        # Safety check: Cannot deactivate own account
        if target_oid == actor_oid and not is_active:
            return None, "Administrators cannot deactivate their own account."

        target_user = UserService.get_by_id(db, target_oid)
        if not target_user:
            return None, "User not found."

        now = datetime.now(timezone.utc)
        try:
            db.users.update_one(
                {"_id": target_oid},
                {"$set": {"is_active": is_active, "updated_at": now}},
            )
            target_user.is_active = is_active
            target_user.updated_at = now
            log_event(
                db,
                "USER_STATUS_UPDATED",
                {
                    "target_user_id": str(target_oid),
                    "is_active": is_active,
                    "admin_id": str(actor_oid),
                },
                user_id=actor_oid,
            )
            return target_user, None
        except Exception as e:
            return None, f"Failed to update status: {str(e)}"
