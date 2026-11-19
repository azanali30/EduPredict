"""
EduPredict - Subject Catalog Service
Manages course catalog, canonical subject registries, and subject queries in MongoDB.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
from pymongo import ASCENDING
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from bson import ObjectId

from backend.models.subject_model import Subject
from backend.utils.security import to_object_id
from backend.services.system_log_service import log_event

logger = logging.getLogger(__name__)

# Baseline canonical subject definitions
CANONICAL_SUBJECTS = [
    {
        "code": "MATH-101",
        "name": "Mathematics",
        "canonical_key": "mathematics",
        "department": "STEM",
        "description": "Core secondary education mathematics curriculum.",
        "target_scale": "0 - 100",
    },
    {
        "code": "PORT-101",
        "name": "Portuguese Language",
        "canonical_key": "portuguese",
        "department": "Humanities & Languages",
        "description": "Core secondary education Portuguese language curriculum.",
        "target_scale": "0 - 100",
    },
]


class SubjectService:
    """Provides subject catalog management and lookup utilities."""

    @classmethod
    def create_subject(
        cls,
        db: Database,
        code: str,
        name: str,
        canonical_key: str,
        department: str = "",
        description: str = "",
        target_scale: str = "0 - 100",
        admin_id: Optional[ObjectId | str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Register a new academic subject in the catalog.
        Enforces normalized code and canonical_key uniqueness.
        """
        if db is None:
            return None, "Database unavailable."

        try:
            subject = Subject(
                code=code,
                name=name,
                canonical_key=canonical_key,
                department=department,
                description=description,
                target_scale=target_scale,
                is_active=True,
            )
        except ValueError as val_err:
            return None, str(val_err)

        # Pre-check for duplicate code or canonical key
        existing_code = db.subjects.find_one({"code": subject.code})
        if existing_code:
            return None, f"Subject with code '{subject.code}' already exists."

        existing_key = db.subjects.find_one({"canonical_key": subject.canonical_key})
        if existing_key:
            return None, f"Subject with canonical key '{subject.canonical_key}' already exists."

        a_oid = to_object_id(admin_id)

        try:
            db.subjects.insert_one(subject.to_doc())
            log_event(
                db,
                "SUBJECT_CREATED",
                {
                    "subject_id": str(subject.id),
                    "code": subject.code,
                    "canonical_key": subject.canonical_key,
                },
                actor_id=a_oid,
            )
            return subject.to_dict(), None
        except DuplicateKeyError:
            return None, f"Subject with code '{subject.code}' or canonical key '{subject.canonical_key}' already exists."
        except Exception as e:
            logger.error("Failed to create subject: %s", str(e))
            return None, f"Failed to create subject: {str(e)}"

    @classmethod
    def get_subject_by_id(cls, db: Database, subject_id: ObjectId | str) -> Optional[Subject]:
        """Fetch subject by its ObjectId."""
        if db is None:
            return None
        s_oid = to_object_id(subject_id)
        if not s_oid:
            return None
        doc = db.subjects.find_one({"_id": s_oid})
        return Subject.from_doc(doc) if doc else None

    @classmethod
    def get_subject_by_canonical_key(cls, db: Database, canonical_key: str) -> Optional[Subject]:
        """Fetch subject by canonical key (case-insensitive normalized)."""
        if db is None or not canonical_key:
            return None
        clean_key = canonical_key.strip().lower()
        doc = db.subjects.find_one({"canonical_key": clean_key})
        return Subject.from_doc(doc) if doc else None

    @classmethod
    def get_subject_by_code(cls, db: Database, code: str) -> Optional[Subject]:
        """Fetch subject by course code (case-insensitive normalized)."""
        if db is None or not code:
            return None
        clean_code = code.strip().upper()
        doc = db.subjects.find_one({"code": clean_code})
        return Subject.from_doc(doc) if doc else None

    @classmethod
    def list_active_subjects(cls, db: Database) -> List[Dict[str, Any]]:
        """List all active subjects in the institutional course catalog."""
        if db is None:
            return []
        cursor = db.subjects.find({"is_active": True}).sort("name", ASCENDING)
        subjects = []
        for doc in cursor:
            s = Subject.from_doc(doc)
            if s:
                subjects.append(s.to_dict())
        return subjects

    @classmethod
    def ensure_canonical_subjects(cls, db: Database) -> List[Dict[str, Any]]:
        """
        Idempotently ensure baseline canonical subjects exist in MongoDB.
        Returns the list of canonical subject dictionaries.
        """
        if db is None:
            return []

        results = []
        for s_def in CANONICAL_SUBJECTS:
            existing = cls.get_subject_by_canonical_key(db, s_def["canonical_key"])
            if not existing:
                created, err = cls.create_subject(
                    db=db,
                    code=s_def["code"],
                    name=s_def["name"],
                    canonical_key=s_def["canonical_key"],
                    department=s_def["department"],
                    description=s_def["description"],
                    target_scale=s_def["target_scale"],
                )
                if created:
                    results.append(created)
                else:
                    logger.warning("Could not auto-create canonical subject %s: %s", s_def["canonical_key"], err)
            else:
                results.append(existing.to_dict())

        return results
