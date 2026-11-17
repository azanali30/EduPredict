"""
EduPredict - Security Utilities
Provides bcrypt password hashing, verification, email normalization, and validation.
"""

import re
import bcrypt
from bson import ObjectId
from bson.errors import InvalidId


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using bcrypt with salt."""
    if not plain_password or not isinstance(plain_password, str):
        raise ValueError("Password must be a non-empty string.")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def check_password(plain_password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    if not plain_password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except Exception:
        return False


def normalize_email(email: str) -> str:
    """Normalize an email address (strip whitespace, lowercase)."""
    if not email or not isinstance(email, str):
        return ""
    return email.strip().lower()


def validate_email_format(email: str) -> bool:
    """Validate email syntax against a standard RFC-compatible regex."""
    if not email or not isinstance(email, str):
        return False
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email.strip()))


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password complexity:
    - At least 8 characters
    - At least one letter
    - At least one number
    """
    if not password or not isinstance(password, str):
        return False, "Password cannot be empty."
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Za-z]", password):
        return False, "Password must contain at least one letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    return True, ""


def is_valid_object_id(oid_str: str) -> bool:
    """Check whether a string is a valid 24-character hexadecimal ObjectId."""
    if not oid_str or not isinstance(oid_str, str):
        return False
    try:
        ObjectId(oid_str)
        return True
    except (InvalidId, TypeError):
        return False


def to_object_id(val) -> ObjectId | None:
    """Safely convert a string or ObjectId to an ObjectId instance, or None if invalid."""
    if isinstance(val, ObjectId):
        return val
    if not val or not isinstance(val, str):
        return None
    try:
        return ObjectId(val)
    except (InvalidId, TypeError):
        return None
