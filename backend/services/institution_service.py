"""
EduPredict - Institution Onboarding & Lifecycle Service (Phase 9C)
Module: backend.services.institution_service
Purpose: Transactional/compensating provisioning of institutions, initial admins,
canonical subjects, and trial subscriptions, plus Super Admin lifecycle controls.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from pymongo import DESCENDING
from pymongo.database import Database

from backend.models.institution_model import Institution, VALID_INSTITUTION_STATUSES
from backend.services.user_service import UserService
from backend.services.subject_service import SubjectService
from backend.services.billing_service import BillingService
from backend.services.global_audit_service import log_global_event
from backend.utils.security import to_object_id


class InstitutionService:
    """Manages multi-institution provisioning, lifecycle transitions, and platform overview."""

    @classmethod
    def onboard_institution(
        cls,
        db: Database,
        name: str,
        slug: str,
        admin_email: str,
        admin_password: str,
        admin_name: str,
        plan_tier: str = "starter",
        contact_email: Optional[str] = None,
        status: str = "trial",
        actor_user: Any = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Provision an institution with compensating rollback if any sub-step fails:
        1. Create Institution record.
        2. Create initial institution Admin user scoped to organization_id.
        3. Seed canonical subjects scoped to organization_id.
        4. Create trial Subscription.
        """
        if db is None:
            return None, "Database unavailable.", 500

        try:
            inst = Institution(
                name=name,
                slug=slug,
                status=status,
                plan_tier=plan_tier,
                contact_email=contact_email or admin_email,
                created_by=getattr(actor_user, "id", None),
            )
        except ValueError as exc:
            return None, str(exc), 400

        if db.institutions.find_one({"$or": [{"slug": inst.slug}, {"organization_id": inst.organization_id}]}):
            return None, f"Institution with slug '{inst.slug}' already exists.", 409

        created_inst = False
        created_user_id = None
        created_subjects = False
        created_sub = False

        try:
            db.institutions.insert_one(inst.to_doc())
            created_inst = True

            admin_user, user_err = UserService.create_user(
                db=db,
                email=admin_email,
                plain_password=admin_password,
                full_name=admin_name,
                role="admin",
                organization_id=inst.organization_id,
            )
            if user_err or not admin_user:
                raise ValueError(user_err or "Failed to create institution admin.")
            created_user_id = admin_user.id

            SubjectService.ensure_canonical_subjects(db, organization_id=inst.organization_id)
            created_subjects = True

            sub_dict, sub_err = BillingService.create_trial_subscription(
                db=db,
                organization_id=inst.organization_id,
                plan_tier=inst.plan_tier,
            )
            if sub_err or not sub_dict:
                raise ValueError(sub_err or "Failed to create trial subscription.")
            created_sub = True

            log_global_event(
                db,
                action="INSTITUTION_ONBOARDED",
                actor_id=getattr(actor_user, "id", None),
                actor_role=getattr(actor_user, "role", "self_service"),
                target_institution=inst.organization_id,
                resource_type="institution",
                resource_id=str(inst.id),
                metadata={"slug": inst.slug, "plan_tier": inst.plan_tier, "status": inst.status},
            )

            return {
                "institution": inst.to_dict(),
                "admin": admin_user.to_dict(),
                "subscription": sub_dict,
            }, None, 201

        except Exception as exc:
            # Compensating rollback so partial provisioning never remains active
            if created_sub:
                db.subscriptions.delete_one({"organization_id": inst.organization_id})
            if created_subjects:
                db.subjects.delete_many({"organization_id": inst.organization_id})
            if created_user_id:
                db.users.delete_one({"_id": created_user_id})
            if created_inst:
                db.institutions.delete_one({"_id": inst.id})
            code = 409 if "already exists" in str(exc).lower() else 400
            return None, str(exc), code

    @classmethod
    def list_institutions(
        cls,
        db: Database,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        if db is None:
            return {"institutions": [], "total": 0, "page": 1, "limit": limit}

        query: Dict[str, Any] = {}
        if status and status.strip().lower() in VALID_INSTITUTION_STATUSES:
            query["status"] = status.strip().lower()

        page = max(1, page)
        limit = max(1, min(limit, 100))
        skip = (page - 1) * limit

        total = db.institutions.count_documents(query)
        cursor = db.institutions.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit)
        items = []
        for doc in cursor:
            inst_d = Institution.from_doc(doc).to_dict()
            sub = BillingService.get_subscription(db, inst_d["organization_id"])
            inst_d["subscription"] = sub
            items.append(inst_d)
        return {"institutions": items, "total": total, "page": page, "limit": limit}

    @classmethod
    def get_institution_detail(
        cls, db: Database, inst_identifier: str
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 500
        oid = to_object_id(inst_identifier)
        query = (
            {"_id": oid}
            if oid
            else {"$or": [{"organization_id": inst_identifier}, {"slug": inst_identifier.lower()}]}
        )
        doc = db.institutions.find_one(query)
        if not doc:
            return None, "Institution not found.", 404
        inst_d = Institution.from_doc(doc).to_dict()
        org_id = inst_d["organization_id"]
        inst_d["subscription"] = BillingService.get_subscription(db, org_id)
        inst_d["user_count"] = db.users.count_documents({"organization_id": org_id})
        inst_d["subject_count"] = db.subjects.count_documents({"organization_id": org_id})
        return inst_d, None, 200

    @classmethod
    def update_institution_status(
        cls,
        db: Database,
        inst_identifier: str,
        new_status: str,
        actor_user: Any,
        reason: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 500
        clean_status = (new_status or "").strip().lower()
        if clean_status not in VALID_INSTITUTION_STATUSES:
            return None, f"Invalid institution status '{new_status}'.", 400

        oid = to_object_id(inst_identifier)
        query = {"_id": oid} if oid else {"organization_id": inst_identifier}
        doc = db.institutions.find_one(query)
        if not doc:
            return None, "Institution not found.", 404

        now = datetime.now(timezone.utc)
        db.institutions.update_one(
            {"_id": doc["_id"]},
            {"$set": {"status": clean_status, "updated_at": now}},
        )
        if clean_status in {"suspended", "cancelled"}:
            db.subscriptions.update_one(
                {"organization_id": doc["organization_id"]},
                {"$set": {"billing_status": clean_status, "updated_at": now}},
            )
        elif clean_status == "active":
            db.subscriptions.update_one(
                {"organization_id": doc["organization_id"]},
                {"$set": {"billing_status": "active", "updated_at": now}},
            )

        log_global_event(
            db,
            action=f"INSTITUTION_{clean_status.upper()}",
            actor_id=getattr(actor_user, "id", None),
            actor_role=getattr(actor_user, "role", "platform_super_admin"),
            target_institution=doc["organization_id"],
            resource_type="institution",
            resource_id=str(doc["_id"]),
            metadata={"reason": reason or ""},
        )
        return cls.get_institution_detail(db, str(doc["_id"]))

    @classmethod
    def get_platform_overview(cls, db: Database) -> Dict[str, Any]:
        if db is None:
            return {}
        total_inst = db.institutions.count_documents({})
        active_inst = db.institutions.count_documents({"status": "active"})
        trial_inst = db.institutions.count_documents({"status": "trial"})
        suspended_inst = db.institutions.count_documents({"status": "suspended"})
        active_subs = db.subscriptions.count_documents({"billing_status": "active"})
        past_due_subs = db.subscriptions.count_documents({"billing_status": "past_due"})

        usage_agg = list(
            db.subscriptions.aggregate([{"$group": {"_id": None, "total": {"$sum": "$predictions_used"}}}])
        )
        monthly_usage = usage_agg[0]["total"] if usage_agg else 0

        return {
            "total_institutions": total_inst,
            "active_institutions": active_inst,
            "trial_institutions": trial_inst,
            "suspended_institutions": suspended_inst,
            "active_subscriptions": active_subs,
            "past_due_subscriptions": past_due_subs,
            "monthly_predictions_used": monthly_usage,
        }
