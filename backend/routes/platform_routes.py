"""
EduPredict - Platform Super Admin, Onboarding & Billing Routes (Phase 9C)
Module: backend.routes.platform_routes
Purpose: Exposes multi-institution provisioning, platform oversight, subscription management,
and Stripe-compatible webhook verification endpoints.
"""

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import csrf, mongo
from backend.services.billing_service import BillingService
from backend.services.global_audit_service import list_global_events
from backend.services.institution_service import InstitutionService
from backend.utils.decorators import admin_required, super_admin_required
from backend.utils.rate_limiter import rate_limit

platform_bp = Blueprint("platform", __name__, url_prefix="/api/platform")


@platform_bp.route("/overview", methods=["GET"])
@login_required
@super_admin_required
def platform_overview():
    """Platform-wide KPIs for Platform Super Admin."""
    stats = InstitutionService.get_platform_overview(mongo.db)
    return jsonify({"status_code": 200, **stats}), 200


@platform_bp.route("/institutions", methods=["GET"])
@login_required
@super_admin_required
def list_institutions():
    """List all tenant institutions with pagination."""
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(int(request.args.get("limit", 20)), 100))
    except (ValueError, TypeError):
        page, limit = 1, 20
    data = InstitutionService.list_institutions(
        mongo.db, status=request.args.get("status"), page=page, limit=limit
    )
    return jsonify({"status_code": 200, **data}), 200


@platform_bp.route("/institutions", methods=["POST"])
@login_required
@super_admin_required
def create_institution():
    """Provision a new tenant institution (Platform Super Admin)."""
    data = request.get_json(silent=True) or {}
    res, err, status = InstitutionService.onboard_institution(
        db=mongo.db,
        name=data.get("name", ""),
        slug=data.get("slug", ""),
        admin_email=data.get("admin_email", ""),
        admin_password=data.get("admin_password", ""),
        admin_name=data.get("admin_name", "Institution Admin"),
        plan_tier=data.get("plan_tier", "starter"),
        contact_email=data.get("contact_email"),
        status=data.get("status", "active"),
        actor_user=current_user,
    )
    if err:
        return jsonify({"error": "Provisioning Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 201, **res}), 201


@platform_bp.route("/onboarding/register", methods=["POST"])
@csrf.exempt
@rate_limit(max_requests=10, window_seconds=60)
def self_service_onboarding():
    """Self-service institution trial registration."""
    data = request.get_json(silent=True) or {}
    res, err, status = InstitutionService.onboard_institution(
        db=mongo.db,
        name=data.get("name", ""),
        slug=data.get("slug", ""),
        admin_email=data.get("admin_email", ""),
        admin_password=data.get("admin_password", ""),
        admin_name=data.get("admin_name", "Institution Admin"),
        plan_tier=data.get("plan_tier", "starter"),
        contact_email=data.get("contact_email"),
        status="trial",
        actor_user=None,
    )
    if err:
        return jsonify({"error": "Onboarding Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 201, **res}), 201


@platform_bp.route("/institutions/<inst_id>", methods=["GET"])
@login_required
@super_admin_required
def get_institution(inst_id: str):
    res, err, status = InstitutionService.get_institution_detail(mongo.db, inst_id)
    if err:
        return jsonify({"error": "Not Found", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, "institution": res}), 200


@platform_bp.route("/institutions/<inst_id>/activate", methods=["POST"])
@login_required
@super_admin_required
def activate_institution(inst_id: str):
    data = request.get_json(silent=True) or {}
    res, err, status = InstitutionService.update_institution_status(
        mongo.db, inst_id, "active", current_user, reason=data.get("reason")
    )
    if err:
        return jsonify({"error": "Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, "institution": res}), 200


@platform_bp.route("/institutions/<inst_id>/suspend", methods=["POST"])
@login_required
@super_admin_required
def suspend_institution(inst_id: str):
    data = request.get_json(silent=True) or {}
    res, err, status = InstitutionService.update_institution_status(
        mongo.db, inst_id, "suspended", current_user, reason=data.get("reason")
    )
    if err:
        return jsonify({"error": "Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, "institution": res}), 200


@platform_bp.route("/institutions/<inst_id>/reactivate", methods=["POST"])
@login_required
@super_admin_required
def reactivate_institution(inst_id: str):
    data = request.get_json(silent=True) or {}
    res, err, status = InstitutionService.update_institution_status(
        mongo.db, inst_id, "active", current_user, reason=data.get("reason")
    )
    if err:
        return jsonify({"error": "Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, "institution": res}), 200


@platform_bp.route("/plans", methods=["GET"])
@login_required
def list_plans():
    """Return available SaaS subscription plans."""
    return jsonify({"status_code": 200, "plans": BillingService.list_plans()}), 200


@platform_bp.route("/subscriptions", methods=["GET"])
@login_required
@super_admin_required
def list_subscriptions():
    """List all tenant subscriptions (Platform Super Admin)."""
    subs = []
    for doc in mongo.db.subscriptions.find({}).sort("updated_at", -1).limit(100):
        org_id = doc.get("organization_id")
        sub = BillingService.get_subscription(mongo.db, org_id)
        if sub:
            subs.append(sub)
    return jsonify({"status_code": 200, "subscriptions": subs}), 200


@platform_bp.route("/audit-logs", methods=["GET"])
@login_required
@super_admin_required
def get_global_audit_logs():
    """Paginated global platform audit logs (Platform Super Admin)."""
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(int(request.args.get("limit", 50)), 100))
    except (ValueError, TypeError):
        page, limit = 1, 50
    data = list_global_events(
        mongo.db,
        action=request.args.get("action"),
        target_institution=request.args.get("target_institution"),
        page=page,
        limit=limit,
    )
    return jsonify({"status_code": 200, **data}), 200


@platform_bp.route("/billing/my-subscription", methods=["GET"])
@login_required
@admin_required
def get_my_subscription():
    """Institution Admin view of their own institution's subscription & quotas."""
    org_id = getattr(current_user, "organization_id", None)
    if not org_id:
        return jsonify({
            "error": "Forbidden",
            "message": "Organization context required.",
            "status_code": 403,
        }), 403
    sub = BillingService.get_subscription(mongo.db, org_id)
    if not sub:
        return jsonify({"error": "Not Found", "message": "No subscription found.", "status_code": 404}), 404
    return jsonify({"status_code": 200, "subscription": sub, "plans": BillingService.list_plans()}), 200


@platform_bp.route("/billing/change-plan", methods=["POST"])
@login_required
@admin_required
def change_my_plan():
    """Upgrade or downgrade own institution's plan."""
    org_id = getattr(current_user, "organization_id", None)
    if not org_id:
        return jsonify({"error": "Forbidden", "message": "Organization context required.", "status_code": 403}), 403
    data = request.get_json(silent=True) or {}
    sub, err, status = BillingService.change_plan(
        mongo.db, org_id, data.get("plan_tier", ""), actor_user=current_user
    )
    if err:
        return jsonify({"error": "Billing Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, "subscription": sub}), 200


@platform_bp.route("/billing/cancel", methods=["POST"])
@login_required
@admin_required
def cancel_my_plan():
    """Cancel own institution's subscription."""
    org_id = getattr(current_user, "organization_id", None)
    if not org_id:
        return jsonify({"error": "Forbidden", "message": "Organization context required.", "status_code": 403}), 403
    sub, err, status = BillingService.cancel_subscription(mongo.db, org_id, actor_user=current_user)
    if err:
        return jsonify({"error": "Billing Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, "subscription": sub}), 200


@platform_bp.route("/billing/webhook", methods=["POST"])
@csrf.exempt
def billing_webhook():
    """Stripe-compatible webhook endpoint with signature verification & idempotency."""
    sig = request.headers.get("Stripe-Signature", "")
    secret = current_app.config.get("STRIPE_WEBHOOK_SECRET", "")
    res, err, status = BillingService.process_webhook_event(
        db=mongo.db,
        payload_bytes=request.get_data(),
        sig_header=sig,
        webhook_secret=secret,
    )
    if err:
        return jsonify({"error": "Webhook Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200
