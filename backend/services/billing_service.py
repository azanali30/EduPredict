"""
EduPredict - SaaS Billing, Plan Configuration, Quotas & Feature Gates (Phase 9C)
Module: backend.services.billing_service
Purpose: Centralized plan catalog, Stripe-compatible webhook signature verification & idempotency,
atomic seat/prediction quota enforcement, and centralized feature gates.
"""

import hmac
import hashlib
import json
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from backend.models.subscription_model import Subscription
from backend.services.global_audit_service import log_global_event

logger = logging.getLogger(__name__)

# Centralized SaaS plan configuration
PLAN_CONFIGS: Dict[str, Dict[str, Any]] = {
    "starter": {
        "plan_tier": "starter",
        "name": "Starter",
        "price_monthly_usd": 0,
        "billing_interval": "month",
        "trial_days": 14,
        "seat_limit": 25,
        "prediction_quota_monthly": 500,
        "features": ["dropout_analytics", "model_evaluation"],
        "is_active": True,
    },
    "growth": {
        "plan_tier": "growth",
        "name": "Growth",
        "price_monthly_usd": 199,
        "billing_interval": "month",
        "trial_days": 14,
        "seat_limit": 150,
        "prediction_quota_monthly": 5000,
        "features": [
            "dropout_analytics",
            "advanced_forecasting",
            "model_evaluation",
            "bulk_prediction",
        ],
        "is_active": True,
    },
    "enterprise": {
        "plan_tier": "enterprise",
        "name": "Enterprise",
        "price_monthly_usd": 599,
        "billing_interval": "month",
        "trial_days": 14,
        "seat_limit": 1000,
        "prediction_quota_monthly": 50000,
        "features": [
            "dropout_analytics",
            "advanced_forecasting",
            "model_evaluation",
            "bulk_prediction",
            "advanced_analyst_dashboards",
        ],
        "is_active": True,
    },
}


class BillingService:
    """Centralized subscription lifecycle, quota enforcement, and webhook handler."""

    @classmethod
    def list_plans(cls) -> List[Dict[str, Any]]:
        return list(PLAN_CONFIGS.values())

    @classmethod
    def get_plan(cls, plan_tier: str) -> Optional[Dict[str, Any]]:
        return PLAN_CONFIGS.get((plan_tier or "").strip().lower())

    @classmethod
    def create_trial_subscription(
        cls,
        db: Database,
        organization_id: str,
        plan_tier: str = "starter",
        stripe_customer_id: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        if db is None:
            return None, "Database unavailable."

        plan = cls.get_plan(plan_tier)
        if not plan:
            return None, f"Unknown plan_tier '{plan_tier}'."

        now = datetime.now(timezone.utc)
        sub = Subscription(
            organization_id=organization_id,
            plan_tier=plan["plan_tier"],
            billing_status="trialing",
            seat_limit=plan["seat_limit"],
            prediction_quota_monthly=plan["prediction_quota_monthly"],
            predictions_used=0,
            current_period_start=now,
            current_period_end=now + timedelta(days=plan["trial_days"]),
            stripe_customer_id=stripe_customer_id or f"cus_sandbox_{organization_id}",
        )
        try:
            db.subscriptions.insert_one(sub.to_doc())
            return sub.to_dict(), None
        except DuplicateKeyError:
            return None, "Subscription already exists for this organization."
        except Exception as exc:
            return None, str(exc)

    @classmethod
    def get_subscription(cls, db: Database, organization_id: str) -> Optional[Dict[str, Any]]:
        if db is None or not organization_id:
            return None
        doc = db.subscriptions.find_one({"organization_id": organization_id.strip()})
        if not doc:
            return None
        sub = Subscription.from_doc(doc).to_dict()
        plan = cls.get_plan(sub["plan_tier"]) or PLAN_CONFIGS["starter"]
        sub["features"] = plan["features"]
        sub["plan_name"] = plan["name"]
        sub["price_monthly_usd"] = plan["price_monthly_usd"]
        sub["seats_used"] = db.users.count_documents({"organization_id": organization_id.strip(), "is_active": True})
        return sub

    @classmethod
    def change_plan(
        cls,
        db: Database,
        organization_id: str,
        new_plan_tier: str,
        actor_user: Any = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 500
        plan = cls.get_plan(new_plan_tier)
        if not plan:
            return None, f"Invalid plan tier '{new_plan_tier}'.", 400

        now = datetime.now(timezone.utc)
        updated = db.subscriptions.find_one_and_update(
            {"organization_id": organization_id.strip()},
            {
                "$set": {
                    "plan_tier": plan["plan_tier"],
                    "billing_status": "active",
                    "seat_limit": plan["seat_limit"],
                    "prediction_quota_monthly": plan["prediction_quota_monthly"],
                    "current_period_start": now,
                    "current_period_end": now + timedelta(days=30),
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            return None, "Subscription not found.", 404

        db.institutions.update_one(
            {"organization_id": organization_id.strip()},
            {"$set": {"plan_tier": plan["plan_tier"], "status": "active", "updated_at": now}},
        )

        log_global_event(
            db,
            action="SUBSCRIPTION_PLAN_CHANGED",
            actor_id=getattr(actor_user, "id", None),
            actor_role=getattr(actor_user, "role", "system"),
            target_institution=organization_id,
            resource_type="subscription",
            resource_id=str(updated["_id"]),
            metadata={"plan_tier": plan["plan_tier"]},
        )
        return cls.get_subscription(db, organization_id), None, 200

    @classmethod
    def cancel_subscription(
        cls, db: Database, organization_id: str, actor_user: Any = None
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 500
        now = datetime.now(timezone.utc)
        updated = db.subscriptions.find_one_and_update(
            {"organization_id": organization_id.strip()},
            {"$set": {"billing_status": "cancelled", "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            return None, "Subscription not found.", 404

        log_global_event(
            db,
            action="SUBSCRIPTION_CANCELLED",
            actor_id=getattr(actor_user, "id", None),
            actor_role=getattr(actor_user, "role", "system"),
            target_institution=organization_id,
            resource_type="subscription",
            resource_id=str(updated["_id"]),
        )
        return cls.get_subscription(db, organization_id), None, 200

    @classmethod
    def renew_subscription(
        cls, db: Database, organization_id: str, actor_user: Any = None
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 500
        now = datetime.now(timezone.utc)
        updated = db.subscriptions.find_one_and_update(
            {"organization_id": organization_id.strip()},
            {
                "$set": {
                    "billing_status": "active",
                    "predictions_used": 0,
                    "current_period_start": now,
                    "current_period_end": now + timedelta(days=30),
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            return None, "Subscription not found.", 404

        log_global_event(
            db,
            action="SUBSCRIPTION_RENEWED",
            actor_id=getattr(actor_user, "id", None),
            actor_role=getattr(actor_user, "role", "system"),
            target_institution=organization_id,
            resource_type="subscription",
            resource_id=str(updated["_id"]),
        )
        return cls.get_subscription(db, organization_id), None, 200

    @classmethod
    def check_seat_quota(cls, db: Database, organization_id: str) -> Tuple[bool, Optional[str], int]:
        """Verify organization has remaining seat capacity before adding a user."""
        if db is None or not organization_id:
            return True, None, 200
        sub = db.subscriptions.find_one({"organization_id": organization_id.strip()})
        if not sub:
            return True, None, 200  # Legacy single-tenant tests without subscription doc

        if sub.get("billing_status") in {"cancelled", "expired", "suspended"}:
            return False, "Subscription is inactive or expired. Please renew your plan.", 402

        active_seats = db.users.count_documents({"organization_id": organization_id.strip(), "is_active": True})
        seat_limit = int(sub.get("seat_limit", 25))
        if active_seats >= seat_limit:
            return False, f"Seat limit reached ({active_seats}/{seat_limit}). Upgrade plan to add more users.", 403
        return True, None, 200

    @classmethod
    def consume_prediction_quota(
        cls, db: Database, organization_id: str, count: int = 1
    ) -> Tuple[bool, Optional[str], int]:
        """
        Atomically increment predictions_used only if billing_status is active/trialing
        and predictions_used + count <= prediction_quota_monthly.
        """
        if db is None or not organization_id:
            return True, None, 200

        sub = db.subscriptions.find_one({"organization_id": organization_id.strip()})
        if not sub:
            return True, None, 200

        if sub.get("billing_status") in {"cancelled", "expired", "suspended", "past_due"}:
            return False, f"Subscription status '{sub.get('billing_status')}' blocks prediction execution.", 402

        now = datetime.now(timezone.utc)
        period_end = sub.get("current_period_end")
        if isinstance(period_end, datetime):
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
            if now > period_end:
                db.subscriptions.update_one(
                    {"_id": sub["_id"]},
                    {"$set": {"billing_status": "expired", "updated_at": now}},
                )
                return False, "Subscription billing period has expired.", 402

        updated = db.subscriptions.find_one_and_update(
            {
                "_id": sub["_id"],
                "billing_status": {"$in": ["trialing", "active"]},
                "$expr": {
                    "$lte": [
                        {"$add": ["$predictions_used", count]},
                        "$prediction_quota_monthly",
                    ]
                },
            },
            {
                "$inc": {"predictions_used": count},
                "$set": {"updated_at": now},
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            return (
                False,
                f"Monthly prediction quota exceeded (limit: {sub.get('prediction_quota_monthly')}). Upgrade plan.",
                429,
            )
        return True, None, 200

    @classmethod
    def check_feature_entitlement(
        cls, db: Database, organization_id: str, feature_name: str
    ) -> Tuple[bool, Optional[str], int]:
        """Server-side feature gate check against the tenant's active plan."""
        if db is None or not organization_id:
            return True, None, 200
        sub = db.subscriptions.find_one({"organization_id": organization_id.strip()})
        if not sub:
            return True, None, 200

        if sub.get("billing_status") in {"cancelled", "expired", "suspended"}:
            return False, "Subscription is inactive or expired.", 402

        plan = cls.get_plan(sub.get("plan_tier", "starter")) or PLAN_CONFIGS["starter"]
        if feature_name not in plan.get("features", []):
            return (
                False,
                f"Feature '{feature_name}' requires a higher subscription tier than '{plan['name']}'.",
                403,
            )
        return True, None, 200

    @staticmethod
    def verify_stripe_signature(payload_bytes: bytes, sig_header: str, webhook_secret: str) -> bool:
        """
        Verify Stripe webhook HMAC-SHA256 signature (`t=<ts>,v1=<sig>`) with 5-minute tolerance.
        """
        if not payload_bytes or not sig_header or not webhook_secret:
            return False
        parts: Dict[str, str] = {}
        for item in sig_header.split(","):
            if "=" in item:
                k, v = item.split("=", 1)
                parts[k.strip()] = v.strip()

        ts_str = parts.get("t")
        v1_sig = parts.get("v1")
        if not ts_str or not v1_sig:
            return False
        try:
            ts = int(ts_str)
        except ValueError:
            return False

        if abs(time.time() - ts) > 300:
            return False

        signed_payload = f"{ts_str}.".encode("utf-8") + payload_bytes
        expected = hmac.new(
            webhook_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, v1_sig)

    @classmethod
    def process_webhook_event(
        cls,
        db: Database,
        payload_bytes: bytes,
        sig_header: str,
        webhook_secret: str,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Verify Stripe signature, enforce event_id idempotency, and apply billing lifecycle updates."""
        if not webhook_secret:
            return None, "Webhook secret is not configured.", 500
        if not cls.verify_stripe_signature(payload_bytes, sig_header, webhook_secret):
            log_global_event(
                db,
                action="BILLING_WEBHOOK_INVALID_SIGNATURE",
                resource_type="billing_webhook",
                outcome="rejected",
            )
            return None, "Invalid webhook signature.", 400

        try:
            event = json.loads(payload_bytes.decode("utf-8"))
        except Exception:
            return None, "Malformed webhook JSON payload.", 400

        event_id = (event.get("id") or "").strip()
        event_type = (event.get("type") or "").strip()
        if not event_id or not event_type:
            return None, "Webhook payload missing 'id' or 'type'.", 400

        # Idempotency guard via unique index on event_id
        try:
            db.processed_billing_events.insert_one({
                "_id": ObjectId(),
                "event_id": event_id,
                "event_type": event_type,
                "processed_at": datetime.now(timezone.utc),
            })
        except DuplicateKeyError:
            return {"status": "duplicate_ignored", "event_id": event_id}, None, 200

        data_obj = (event.get("data") or {}).get("object") or {}
        org_id = (
            data_obj.get("organization_id")
            or (data_obj.get("metadata") or {}).get("organization_id")
            or ""
        ).strip()

        now = datetime.now(timezone.utc)
        if org_id:
            if event_type == "invoice.payment_succeeded":
                cls.renew_subscription(db, org_id)
            elif event_type == "invoice.payment_failed":
                db.subscriptions.update_one(
                    {"organization_id": org_id},
                    {"$set": {"billing_status": "past_due", "updated_at": now}},
                )
            elif event_type == "customer.subscription.deleted":
                db.subscriptions.update_one(
                    {"organization_id": org_id},
                    {"$set": {"billing_status": "cancelled", "updated_at": now}},
                )
            elif event_type == "customer.subscription.updated":
                new_status = data_obj.get("status", "active")
                if new_status in {"trialing", "active", "past_due", "cancelled", "expired", "suspended"}:
                    db.subscriptions.update_one(
                        {"organization_id": org_id},
                        {"$set": {"billing_status": new_status, "updated_at": now}},
                    )

        log_global_event(
            db,
            action="BILLING_WEBHOOK_PROCESSED",
            target_institution=org_id or None,
            resource_type="billing_webhook",
            resource_id=event_id,
            metadata={"event_type": event_type},
        )
        return {"status": "processed", "event_id": event_id, "event_type": event_type}, None, 200
