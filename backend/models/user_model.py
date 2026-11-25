"""
EduPredict - User Model
Implements Flask-Login UserMixin interface and MongoDB document mapping.
"""

from datetime import datetime, timezone
from bson import ObjectId
from backend.utils.security import check_password, hash_password, normalize_email, to_object_id

VALID_ROLES = {"student", "teacher", "admin", "analyst", "platform_super_admin"}


class User:
    """
    User entity representing an authenticated identity in EduPredict.
    Compatible with Flask-Login.
    """

    def __init__(
        self,
        email: str,
        password_hash: str,
        full_name: str,
        role: str = "student",
        is_active: bool = True,
        user_id: ObjectId | str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
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
        organization_id: str | None = None,
    ):
        self.id = to_object_id(user_id) or ObjectId()
        self.email = normalize_email(email)
        self.password_hash = password_hash
        self.full_name = full_name.strip() if full_name else ""
        self.role = role if role in VALID_ROLES else "student"
        self.is_active = is_active
        self.student_id = student_id.strip() if student_id else None
        self.employee_id = employee_id.strip() if employee_id else None
        self.contact_number = contact_number.strip() if contact_number else None
        self.department = department.strip() if department else None
        self.avatar_url = avatar_url.strip() if avatar_url else None
        self.must_change_password = bool(must_change_password)
        self.personal_info = personal_info or {}
        self.contact_info = contact_info or {}
        self.guardian_info = guardian_info or {}
        self.academic_info = academic_info or {}
        self.professional_info = professional_info or {}
        self.employment_info = employment_info or {}
        self.documents = documents or []
        self.organization_id = organization_id.strip() if organization_id else None
        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    # Flask-Login Interface Methods
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False

    def get_id(self) -> str:
        return str(self.id)

    # Verification helper
    def verify_password(self, plain_password: str) -> bool:
        """Verify candidate plaintext password against stored bcrypt hash."""
        return check_password(plain_password, self.password_hash)

    def set_password(self, new_plain_password: str):
        """Hash and update the user's password."""
        self.password_hash = hash_password(new_plain_password)
        self.updated_at = datetime.now(timezone.utc)

    # Serialization
    def to_doc(self) -> dict:
        """Convert to MongoDB document dictionary."""
        doc = {
            "_id": self.id,
            "email": self.email,
            "password_hash": self.password_hash,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "must_change_password": self.must_change_password,
            "personal_info": self.personal_info,
            "contact_info": self.contact_info,
            "guardian_info": self.guardian_info,
            "academic_info": self.academic_info,
            "professional_info": self.professional_info,
            "employment_info": self.employment_info,
            "documents": self.documents,
        }
        if self.student_id:
            doc["student_id"] = self.student_id
        if self.employee_id:
            doc["employee_id"] = self.employee_id
        if self.contact_number:
            doc["contact_number"] = self.contact_number
        if self.department:
            doc["department"] = self.department
        if self.avatar_url:
            doc["avatar_url"] = self.avatar_url
        if self.organization_id:
            doc["organization_id"] = self.organization_id
        return doc

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert to JSON-safe dictionary (excludes password_hash by default)."""
        data = {
            "id": str(self.id),
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "student_id": self.student_id,
            "employee_id": self.employee_id,
            "contact_number": self.contact_number,
            "department": self.department,
            "organization_id": self.organization_id,
            "avatar_url": self.avatar_url,
            "must_change_password": self.must_change_password,
            "personal_info": self.personal_info,
            "contact_info": self.contact_info,
            "guardian_info": self.guardian_info,
            "academic_info": self.academic_info,
            "professional_info": self.professional_info,
            "employment_info": self.employment_info,
            "documents": self.documents,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sensitive:
            data["password_hash"] = self.password_hash
        return data

    @classmethod
    def from_doc(cls, doc: dict) -> "User | None":
        """Reconstruct User instance from MongoDB document."""
        if not doc:
            return None
        return cls(
            user_id=doc.get("_id"),
            email=doc.get("email", ""),
            password_hash=doc.get("password_hash", ""),
            full_name=doc.get("full_name", ""),
            role=doc.get("role", "student"),
            is_active=doc.get("is_active", True),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
            student_id=doc.get("student_id"),
            employee_id=doc.get("employee_id"),
            contact_number=doc.get("contact_number"),
            department=doc.get("department"),
            avatar_url=doc.get("avatar_url"),
            must_change_password=doc.get("must_change_password", False),
            personal_info=doc.get("personal_info") or {},
            contact_info=doc.get("contact_info") or {},
            guardian_info=doc.get("guardian_info") or {},
            academic_info=doc.get("academic_info") or {},
            professional_info=doc.get("professional_info") or {},
            employment_info=doc.get("employment_info") or {},
            documents=doc.get("documents") or [],
            organization_id=doc.get("organization_id"),
        )
