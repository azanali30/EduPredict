"""
EduPredict - Subscription Model (Phase 9A / 9C)
Module: backend.models.subscription_model
Purpose: Tracks tenant SaaS subscription plan, quotas, billing status, and Stripe references.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import to_object_id

VALID_SUBSCRIPTION_STATUSES = {
    "trialing",
    "active",
    "past_due",
    "cancelled",
    "expired",
    "suspended",
}


class Subscription:
    """Represents a tenant institution's SaaS subscription in `subscriptions`."""

    def __init__(
        self,
        organization_id: str,
        plan_tier: str = "starter",
        billing_status: str = "trialing",
        seat_limit: int = 25,
        prediction_quota_monthly: int = 500,
        predictions_used: int = 0,
        current_period_start: Optional[datetime] = None,
        current_period_end: Optional[datetime] = None,
        stripe_customer_id: Optional[str] = None,
        stripe_subscription_id: Optional[str] = None,
        subscription_id: Optional[ObjectId | str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        clean_org = (organization_id or "").strip()
        if not clean_org:
            raise ValueError("organization_id is required for Subscription.")

        clean_status = (billing_status or "trialing").strip().lower()
        if clean_status not in VALID_SUBSCRIPTION_STATUSES:
            raise ValueError(f"Invalid billing_status: {billing_status}")

        now = datetime.now(timezone.utc)
        self.id = to_object_id(subscription_id) or ObjectId()
        self.organization_id = clean_org
        self.plan_tier = (plan_tier or "starter").strip().lower()
        self.billing_status = clean_status
        self.seat_limit = max(1, int(seat_limit))
        self.prediction_quota_monthly = max(0, int(prediction_quota_monthly))
        self.predictions_used = max(0, int(predictions_used))
        self.current_period_start = current_period_start or now
        self.current_period_end = current_period_end or (now + timedelta(days=14))
        self.stripe_customer_id = stripe_customer_id
        self.stripe_subscription_id = stripe_subscription_id
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "organization_id": self.organization_id,
            "plan_tier": self.plan_tier,
            "billing_status": self.billing_status,
            "seat_limit": self.seat_limit,
            "prediction_quota_monthly": self.prediction_quota_monthly,
            "predictions_used": self.predictions_used,
            "current_period_start": self.current_period_start,
            "current_period_end": self.current_period_end,
            "stripe_customer_id": self.stripe_customer_id,
            "stripe_subscription_id": self.stripe_subscription_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "organization_id": self.organization_id,
            "plan_tier": self.plan_tier,
            "billing_status": self.billing_status,
            "seat_limit": self.seat_limit,
            "prediction_quota_monthly": self.prediction_quota_monthly,
            "predictions_used": self.predictions_used,
            "current_period_start": (
                self.current_period_start.isoformat()
                if isinstance(self.current_period_start, datetime)
                else self.current_period_start
            ),
            "current_period_end": (
                self.current_period_end.isoformat()
                if isinstance(self.current_period_end, datetime)
                else self.current_period_end
            ),
            "stripe_customer_id": self.stripe_customer_id,
            "stripe_subscription_id": self.stripe_subscription_id,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["Subscription"]:
        if not doc:
            return None
        return cls(
            subscription_id=doc.get("_id"),
            organization_id=doc.get("organization_id", ""),
            plan_tier=doc.get("plan_tier", "starter"),
            billing_status=doc.get("billing_status", "trialing"),
            seat_limit=doc.get("seat_limit", 25),
            prediction_quota_monthly=doc.get("prediction_quota_monthly", 500),
            predictions_used=doc.get("predictions_used", 0),
            current_period_start=doc.get("current_period_start"),
            current_period_end=doc.get("current_period_end"),
            stripe_customer_id=doc.get("stripe_customer_id"),
            stripe_subscription_id=doc.get("stripe_subscription_id"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
