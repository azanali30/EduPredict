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
        avatar_url: str | None = None,
        must_change_password: bool = False,
        personal_info: dict | None = None,
        contact_info: dict | None = None,
        guardian_info: dict | None = None,
        academic_info: dict | None = None,
        professional_info: dict | None = None,
        employment_info: dict | None = None,
        documents: list[dict] | None = None,
    ) -> tuple[User | None, str | None]:
        """
        Create a new user with secure password hashing and multi-section profile metadata.
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

        # Propagate contact_number or department from contact_info/academic_info/professional_info if not explicitly provided
        final_contact = contact_number.strip() if contact_number else None
        if not final_contact and contact_info:
            final_contact = contact_info.get("contact_number") or contact_info.get("phone")

        final_dept = department.strip() if department else None
        if not final_dept and professional_info:
            final_dept = professional_info.get("department")
        if not final_dept and academic_info:
            final_dept = academic_info.get("department")

        pwd_hash = hash_password(plain_password)
        user = User(
            email=norm_email,
            password_hash=pwd_hash,
            full_name=full_name.strip(),
            role=role,
            is_active=is_active,
            student_id=clean_stu_id,
            employee_id=clean_emp_id,
            contact_number=final_contact,
            department=final_dept,
            avatar_url=avatar_url,
            must_change_password=must_change_password,
            personal_info=personal_info,
            contact_info=contact_info,
            guardian_info=guardian_info,
            academic_info=academic_info,
            professional_info=professional_info,
            employment_info=employment_info,
            documents=documents,
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
    def update_user_by_admin(
        db: Database,
        target_user_id,
        update_data: dict,
        actor_admin_id=None,
    ) -> tuple[User | None, str | None]:
        """
        Update user profile attributes by an administrator.
        Prevents privilege escalation (role/email cannot be modified through this method).
        Validates unique student_id / employee_id when modified.
        """
        user = UserService.get_by_id(db, target_user_id)
        if not user:
            return None, "User not found."

        set_fields = {}
        now = datetime.now(timezone.utc)
        set_fields["updated_at"] = now

        # 1. Full name
        if "full_name" in update_data:
            name = update_data["full_name"]
            if not name or not name.strip():
                return None, "Full name cannot be empty."
            set_fields["full_name"] = name.strip()
            user.full_name = name.strip()

        # 2. Student ID uniqueness if changed
        if "student_id" in update_data and user.role == "student":
            stu_id = update_data["student_id"]
            clean_stu = stu_id.strip() if stu_id else None
            if clean_stu and clean_stu != user.student_id:
                if db.users.find_one({"student_id": clean_stu, "_id": {"$ne": user.id}}):
                    return None, f"A student with Student ID '{clean_stu}' already exists."
            set_fields["student_id"] = clean_stu
            user.student_id = clean_stu

        # 3. Employee ID uniqueness if changed
        if "employee_id" in update_data and user.role == "teacher":
            emp_id = update_data["employee_id"]
            clean_emp = emp_id.strip() if emp_id else None
            if clean_emp and clean_emp != user.employee_id:
                if db.users.find_one({"employee_id": clean_emp, "_id": {"$ne": user.id}}):
                    return None, f"A teacher with Employee ID '{clean_emp}' already exists."
            set_fields["employee_id"] = clean_emp
            user.employee_id = clean_emp

        # 4. Department
        if "department" in update_data:
            dept = update_data["department"]
            clean_dept = dept.strip() if dept else None
            set_fields["department"] = clean_dept
            user.department = clean_dept

        # 5. Contact number
        if "contact_number" in update_data:
            contact = update_data["contact_number"]
            clean_contact = contact.strip() if contact else None
            set_fields["contact_number"] = clean_contact
            user.contact_number = clean_contact

        # 6. Avatar URL
        if "avatar_url" in update_data:
            set_fields["avatar_url"] = update_data["avatar_url"]
            user.avatar_url = update_data["avatar_url"]

        # 7. Must change password
        if "must_change_password" in update_data:
            set_fields["must_change_password"] = bool(update_data["must_change_password"])
            user.must_change_password = bool(update_data["must_change_password"])

        # 8. Profile subdocuments
        for section in ("personal_info", "contact_info", "guardian_info", "academic_info", "professional_info", "employment_info"):
            if section in update_data and isinstance(update_data[section], dict):
                merged = getattr(user, section, {}) or {}
                merged.update(update_data[section])
                set_fields[section] = merged
                setattr(user, section, merged)

        # 9. Documents
        if "documents" in update_data and isinstance(update_data["documents"], list):
            set_fields["documents"] = update_data["documents"]
            user.documents = update_data["documents"]

        try:
            db.users.update_one({"_id": user.id}, {"$set": set_fields})
            user.updated_at = now
            log_event(
                db,
                "ADMIN_USER_UPDATED",
                {"target_user_id": str(user.id), "updated_fields": list(set_fields.keys())},
                user_id=actor_admin_id or user.id,
            )
            return user, None
        except DuplicateKeyError as e:
            err_str = str(e)
            if "student_id" in err_str:
                return None, "Student ID already in use."
            if "employee_id" in err_str:
                return None, "Employee ID already in use."
            return None, "Duplicate field constraint violated."
        except Exception as e:
            return None, f"Failed to update user profile: {str(e)}"

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
    def update_self_service_profile(
        db: Database,
        user_id,
        update_data: dict,
        role: str,
    ) -> tuple[User | None, str | None, int]:
        """
        Secure self-service user profile update.
        Allows users to update their own personal, contact, and role-appropriate details.
        Strictly rejects forbidden/privileged institutional fields.
        Returns: (updated_user, error_message, http_status_code)
        """
        user = UserService.get_by_id(db, user_id)
        if not user:
            return None, "User not found.", 404

        # 1. Reject forbidden / privileged institutional fields
        FORBIDDEN_FIELDS = {
            "role", "student_id", "employee_id", "is_active", "academic_info",
            "password_hash", "password", "email", "_id", "id", "created_at",
            "updated_at", "must_change_password"
        }
        for field in FORBIDDEN_FIELDS:
            if field in update_data:
                return None, f"Modifying '{field}' is not permitted through self-service profile updates.", 403

        # 2. Allowlist by role
        ALLOWED_TOP_KEYS = {"full_name", "contact_number", "avatar_url", "personal_info", "contact_info"}
        if role == "student":
            ALLOWED_TOP_KEYS.add("guardian_info")
        elif role == "teacher":
            ALLOWED_TOP_KEYS.add("professional_info")
            ALLOWED_TOP_KEYS.add("employment_info")
        elif role == "admin":
            ALLOWED_TOP_KEYS.update({"guardian_info", "professional_info", "employment_info"})

        for key in update_data:
            if key not in ALLOWED_TOP_KEYS:
                return None, f"Field '{key}' is not an authorized editable profile attribute.", 400

        set_fields = {}
        now = datetime.now(timezone.utc)
        set_fields["updated_at"] = now

        # Validate full_name
        if "full_name" in update_data:
            name = update_data["full_name"]
            if not isinstance(name, str) or not name.strip():
                return None, "Full name cannot be empty.", 400
            if len(name.strip()) > 100:
                return None, "Full name cannot exceed 100 characters.", 400
            set_fields["full_name"] = name.strip()
            user.full_name = name.strip()

        # Validate contact_number
        if "contact_number" in update_data:
            cnum = update_data["contact_number"]
            clean_cnum = cnum.strip() if isinstance(cnum, str) and cnum.strip() else None
            if clean_cnum and len(clean_cnum) > 30:
                return None, "Contact number cannot exceed 30 characters.", 400
            set_fields["contact_number"] = clean_cnum
            user.contact_number = clean_cnum

        # Validate avatar_url
        if "avatar_url" in update_data:
            avatar = update_data["avatar_url"]
            clean_avatar = avatar.strip() if isinstance(avatar, str) and avatar.strip() else None
            if clean_avatar and len(clean_avatar) > 500:
                return None, "Avatar URL is too long.", 400
            set_fields["avatar_url"] = clean_avatar
            user.avatar_url = clean_avatar

        # Sub-document allowlists
        ALLOWED_SUBKEYS = {
            "personal_info": {"date_of_birth", "gender", "nationality", "blood_group"},
            "contact_info": {
                "primary_phone", "emergency_phone", "contact_number", "alternate_contact_number",
                "personal_email", "residential_address", "city", "state", "postal_code", "country"
            },
            "guardian_info": {
                "guardian_name", "guardian_full_name", "relationship", "guardian_email",
                "guardian_phone", "guardian_contact_number", "emergency_contact_number",
                "occupation", "address"
            },
            "professional_info": {
                "highest_qualification", "institution_graduated", "previous_institution",
                "graduation_year", "specialization", "total_experience_years", "experience_years",
                "research_interests", "bio", "job_title", "department"
            },
            "employment_info": {"office_room", "internal_notes"},
        }

        for subdoc, allowed_keys in ALLOWED_SUBKEYS.items():
            if subdoc in update_data:
                sub_val = update_data[subdoc]
                if not isinstance(sub_val, dict):
                    return None, f"'{subdoc}' must be an object.", 400
                for k in sub_val:
                    if k not in allowed_keys:
                        return None, f"Sub-field '{k}' in '{subdoc}' is not permitted.", 400
                merged = getattr(user, subdoc, {}) or {}
                clean_sub = {}
                for k, v in sub_val.items():
                    if isinstance(v, str):
                        clean_sub[k] = v.strip()
                    else:
                        clean_sub[k] = v
                merged.update(clean_sub)
                set_fields[subdoc] = merged
                setattr(user, subdoc, merged)

        try:
            db.users.update_one({"_id": user.id}, {"$set": set_fields})
            user.updated_at = now
            log_event(
                db,
                "PROFILE_UPDATED",
                {"user_id": str(user.id), "updated_fields": list(set_fields.keys())},
                user_id=user.id,
            )
            return user, None, 200
        except Exception as e:
            return None, f"Failed to update profile: {str(e)}", 500

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
