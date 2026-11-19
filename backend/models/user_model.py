"""
EduPredict - User Model
Implements Flask-Login UserMixin interface and MongoDB document mapping.
"""

from datetime import datetime, timezone
from bson import ObjectId
from backend.utils.security import check_password, hash_password, normalize_email, to_object_id

VALID_ROLES = {"student", "teacher", "admin", "analyst"}


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
    ):
        self.id = to_object_id(user_id) or ObjectId()
        self.email = normalize_email(email)
        self.password_hash = password_hash
        self.full_name = full_name.strip() if full_name else ""
        self.role = role if role in VALID_ROLES else "student"
        self.is_active = is_active
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
        return {
            "_id": self.id,
            "email": self.email,
            "password_hash": self.password_hash,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert to JSON-safe dictionary (excludes password_hash by default)."""
        data = {
            "id": str(self.id),
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
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
        )
