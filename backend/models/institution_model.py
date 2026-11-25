"""
EduPredict - Institution Model (Phase 9A)
Module: backend.models.institution_model
Purpose: Represents a tenant institution mapped to a canonical organization_id.
"""

import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import normalize_email, to_object_id

VALID_INSTITUTION_STATUSES = {"pending", "trial", "active", "suspended", "cancelled"}
VALID_PLAN_TIERS = {"starter", "growth", "enterprise"}

_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$")


def normalize_slug(raw: str) -> str:
    """Normalize an institution name or slug into a URL-safe lowercase slug."""
    if not raw or not isinstance(raw, str):
        return ""
    cleaned = re.sub(r"[^a-z0-9-]+", "-", raw.strip().lower()).strip("-")
    cleaned = re.sub(r"-{2,}", "-", cleaned)
    return cleaned[:50]


class Institution:
    """Represents a tenant institution in the `institutions` control collection."""

    def __init__(
        self,
        name: str,
        slug: str,
        organization_id: Optional[str] = None,
        status: str = "trial",
        plan_tier: str = "starter",
        contact_email: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None,
        created_by: Optional[ObjectId | str] = None,
        institution_id: Optional[ObjectId | str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        clean_name = (name or "").strip()
        if len(clean_name) < 2:
            raise ValueError("Institution name must be at least 2 characters.")

        norm_slug = normalize_slug(slug or clean_name)
        if not _SLUG_RE.match(norm_slug):
            raise ValueError(
                "Institution slug must be 3-50 lowercase alphanumeric characters or hyphens."
            )

        clean_status = (status or "trial").strip().lower()
        if clean_status not in VALID_INSTITUTION_STATUSES:
            raise ValueError(f"Invalid institution status: {status}")

        clean_tier = (plan_tier or "starter").strip().lower()
        if clean_tier not in VALID_PLAN_TIERS:
            raise ValueError(f"Invalid plan_tier: {plan_tier}")

        self.id = to_object_id(institution_id) or ObjectId()
        self.name = clean_name
        self.slug = norm_slug
        self.organization_id = (organization_id or f"org-{norm_slug}").strip()
        self.status = clean_status
        self.plan_tier = clean_tier
        self.contact_email = normalize_email(contact_email) if contact_email else None
        self.settings = settings if isinstance(settings, dict) else {}
        self.created_by = to_object_id(created_by) if created_by else None
        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "name": self.name,
            "slug": self.slug,
            "organization_id": self.organization_id,
            "status": self.status,
            "plan_tier": self.plan_tier,
            "contact_email": self.contact_email,
            "settings": self.settings,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "organization_id": self.organization_id,
            "status": self.status,
            "plan_tier": self.plan_tier,
            "contact_email": self.contact_email,
            "settings": self.settings,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["Institution"]:
        if not doc:
            return None
        return cls(
            institution_id=doc.get("_id"),
            name=doc.get("name", ""),
            slug=doc.get("slug", ""),
            organization_id=doc.get("organization_id"),
            status=doc.get("status", "trial"),
            plan_tier=doc.get("plan_tier", "starter"),
            contact_email=doc.get("contact_email"),
            settings=doc.get("settings") or {},
            created_by=doc.get("created_by"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
