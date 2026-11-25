"""
EduPredict - Phase 9 Multi-Institution SaaS Security, Isolation, Billing & RBAC Tests
Module: tests.test_phase_9_multi_tenant_saas
"""

import hashlib
import hmac
import json
import time
from concurrent.futures import ThreadPoolExecutor

from backend.commands.admin_commands import create_super_admin_command
from backend.services.billing_service import BillingService
from backend.services.institution_service import InstitutionService
from backend.services.subject_service import SubjectService
from backend.services.user_service import UserService


def _sign_stripe(payload_bytes: bytes, secret: str) -> str:
    ts = str(int(time.time()))
    signed = f"{ts}.".encode("utf-8") + payload_bytes
    sig = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


def test_tenant_resolver_host_subdomain_header_and_suspended(client, clean_db):
    """Verify subdomain, X-Institution-ID, host spoofing, suspended tenant, and session mismatch."""
    res_a, err_a, code_a = InstitutionService.onboard_institution(
        clean_db, "Harvard Univ", "harvard", "dean@harvard.edu", "AdminPass123!", "Dean A", status="active"
    )
    assert code_a == 201 and not err_a
    res_b, err_b, code_b = InstitutionService.onboard_institution(
        clean_db, "Oxford Univ", "oxford", "dean@oxford.edu", "AdminPass123!", "Dean B", status="active"
    )
    assert code_b == 201 and not err_b

    # 1. Host header spoofing -> 403
    spoof = client.get("/api/health", headers={"Host": "evil-attacker.com"})
    assert spoof.status_code == 403

    # 2. Unknown subdomain / forged X-Institution-ID -> 403
    assert client.get("/api/health", headers={"Host": "unknown.edupredict.com"}).status_code == 403
    assert client.get("/api/health", headers={"X-Institution-ID": "org-nonexistent"}).status_code == 403

    # 3. Valid subdomain + matching X-Institution-ID -> 200
    ok = client.get(
        "/api/health",
        headers={"Host": "harvard.edupredict.com", "X-Institution-ID": res_a["institution"]["organization_id"]},
    )
    assert ok.status_code == 200

    # 4. Mismatched subdomain vs X-Institution-ID -> 403
    mismatch = client.get(
        "/api/health",
        headers={"Host": "harvard.edupredict.com", "X-Institution-ID": res_b["institution"]["organization_id"]},
    )
    assert mismatch.status_code == 403

    # 5. Authenticated Admin A accessing Oxford header -> 403 cross-tenant mismatch
    client.post("/auth/login", json={"email": "dean@harvard.edu", "password": "AdminPass123!"})
    cross = client.get(
        "/api/dropout/admin/records",
        headers={"X-Institution-ID": res_b["institution"]["organization_id"]},
    )
    assert cross.status_code == 403

    # 6. Suspended institution rejects requests -> 403
    InstitutionService.update_institution_status(clean_db, res_a["institution"]["id"], "suspended", actor_user=None)
    susp = client.get("/api/dropout/admin/records")
    assert susp.status_code == 403


def test_cross_tenant_isolation_subjects_and_records(client, clean_db):
    """Two institutions with identical subject codes (MATH-101) remain completely isolated."""
    res_a, _, _ = InstitutionService.onboard_institution(
        clean_db, "Alpha College", "alpha", "admin@alpha.edu", "AdminPass123!", "Alpha Admin", status="active"
    )
    res_b, _, _ = InstitutionService.onboard_institution(
        clean_db, "Beta College", "beta", "admin@beta.edu", "AdminPass123!", "Beta Admin", status="active"
    )
    org_a = res_a["institution"]["organization_id"]
    org_b = res_b["institution"]["organization_id"]

    # Both institutions independently have MATH-101 without DuplicateKeyError
    math_a = SubjectService.get_subject_by_code(clean_db, "MATH-101", organization_id=org_a)
    math_b = SubjectService.get_subject_by_code(clean_db, "MATH-101", organization_id=org_b)
    assert math_a is not None and math_b is not None
    assert math_a.id != math_b.id

    # Seed dropout record in Alpha; Beta Admin must not see it
    UserService.create_user(clean_db, "stu@alpha.edu", "StuPass123!", "Alpha Stu", "student", organization_id=org_a)
    clean_db.dropout_records.insert_one({
        "student_id": math_a.id,
        "student_name": "Alpha Stu",
        "risk_probability": 0.7,
        "risk_tier": "High",
        "model_version": "v1",
        "academic_term": "2026-Fall",
        "organization_id": org_a,
    })

    client.post("/auth/login", json={"email": "admin@beta.edu", "password": "AdminPass123!"})
    beta_recs = client.get("/api/dropout/admin/records")
    assert beta_recs.status_code == 200
    assert beta_recs.get_json()["total"] == 0


def test_platform_super_admin_rbac_and_cli_provisioning(app, client, runner, test_admin, test_analyst, test_teacher, test_student, clean_db):
    """Verify CLI create-super-admin, super_admin RBAC, and isolation from ordinary tenant routes."""
    cli_res = runner.invoke(
        create_super_admin_command,
        input="super@edupredict.com\nSuperPass123!\nSuperPass123!\nPlatform Boss\n",
    )
    assert cli_res.exit_code == 0
    assert "Platform Super Admin created" in cli_res.output

    # Ordinary roles cannot access /api/platform/overview -> 403
    for usr, pwd in [
        (test_admin, "AdminPassword123!"),
        (test_analyst, "AnalystPassword123!"),
        (test_teacher, "TeacherPassword123!"),
        (test_student, "StudentPassword123!"),
    ]:
        client.post("/auth/login", json={"email": usr.email, "password": pwd})
        assert client.get("/api/platform/overview").status_code == 403

    # Super Admin accesses /api/platform/overview -> 200, but blocked from ordinary tenant /api/dropout/admin/records -> 403
    client.post("/auth/login", json={"email": "super@edupredict.com", "password": "SuperPass123!"})
    assert client.get("/api/platform/overview").status_code == 200
    assert client.get("/api/platform/audit-logs").status_code == 200
    assert client.get("/api/dropout/admin/records").status_code == 403


def test_billing_webhooks_quotas_concurrency_and_feature_gates(app, client, clean_db):
    """Verify Stripe signature, idempotent replay, plan upgrades, seat/prediction quotas, and feature gates."""
    app.config["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret_123"
    res, _, code = InstitutionService.onboard_institution(
        clean_db, "Gamma Inst", "gamma", "admin@gamma.edu", "AdminPass123!", "Gamma Admin", plan_tier="starter", status="active"
    )
    assert code == 201
    org_id = res["institution"]["organization_id"]

    # 1. Feature gate: starter lacks 'bulk_prediction' -> 403
    ok_fg, _, fg_code = BillingService.check_feature_entitlement(clean_db, org_id, "bulk_prediction")
    assert ok_fg is False and fg_code == 403

    # 2. Plan upgrade to growth unlocks 'bulk_prediction'
    client.post("/auth/login", json={"email": "admin@gamma.edu", "password": "AdminPass123!"})
    up = client.post("/api/platform/billing/change-plan", json={"plan_tier": "growth"})
    assert up.status_code == 200
    ok_fg2, _, _ = BillingService.check_feature_entitlement(clean_db, org_id, "bulk_prediction")
    assert ok_fg2 is True

    # 3. Seat quota enforcement
    clean_db.subscriptions.update_one({"organization_id": org_id}, {"$set": {"seat_limit": 1}})
    _, seat_err = UserService.create_user(
        clean_db, "extra@gamma.edu", "UserPass123!", "Extra User", "student", organization_id=org_id
    )
    assert seat_err is not None and "Seat limit reached" in seat_err

    # 4. Concurrent atomic prediction quota enforcement (limit=5, 10 concurrent calls -> max 5 succeed)
    clean_db.subscriptions.update_one(
        {"organization_id": org_id}, {"$set": {"prediction_quota_monthly": 5, "predictions_used": 0}}
    )
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(lambda _: BillingService.consume_prediction_quota(clean_db, org_id, 1)[0], range(10)))
    assert sum(1 for r in results if r) == 5

    # 5. Webhook signature & replay idempotency
    payload = json.dumps({
        "id": "evt_test_001",
        "type": "invoice.payment_failed",
        "data": {"object": {"organization_id": org_id}},
    }).encode("utf-8")

    bad_sig = client.post("/api/platform/billing/webhook", data=payload, headers={"Stripe-Signature": "t=1,v1=bad"})
    assert bad_sig.status_code == 400

    good_sig = _sign_stripe(payload, "whsec_test_secret_123")
    wh1 = client.post("/api/platform/billing/webhook", data=payload, headers={"Stripe-Signature": good_sig})
    assert wh1.status_code == 200 and wh1.get_json()["status"] == "processed"
    assert BillingService.get_subscription(clean_db, org_id)["billing_status"] == "past_due"

    # Replay same event_id -> duplicate_ignored
    wh2 = client.post("/api/platform/billing/webhook", data=payload, headers={"Stripe-Signature": good_sig})
    assert wh2.status_code == 200 and wh2.get_json()["status"] == "duplicate_ignored"


def test_admin_cannot_escalate_to_super_admin_and_user_mgmt_org_isolation(client, clean_db):
    """
    Verify Institution Admin cannot promote any user to platform_super_admin (403)
    and cannot list or modify users belonging to another institution (403).
    """
    res_a, _, _ = InstitutionService.onboard_institution(
        clean_db, "Org Alpha", "orgalpha", "admin@orgalpha.edu", "AdminPass123!", "Alpha Admin", status="active"
    )
    res_b, _, _ = InstitutionService.onboard_institution(
        clean_db, "Org Beta", "orgbeta", "admin@orgbeta.edu", "AdminPass123!", "Beta Admin", status="active"
    )
    org_a = res_a["institution"]["organization_id"]
    org_b = res_b["institution"]["organization_id"]

    stu_a, _ = UserService.create_user(
        clean_db, "stu.a@orgalpha.edu", "StuPass123!", "Student A", "student", organization_id=org_a
    )
    stu_b, _ = UserService.create_user(
        clean_db, "stu.b@orgbeta.edu", "StuPass123!", "Student B", "student", organization_id=org_b
    )

    # Log in as Org Alpha Admin
    client.post("/auth/login", json={"email": "admin@orgalpha.edu", "password": "AdminPass123!"})

    # 1. Privilege escalation blocked (403)
    esc = client.put(f"/api/admin/users/{stu_a.id}/role", json={"role": "platform_super_admin"})
    assert esc.status_code == 403
    assert UserService.get_by_id(clean_db, stu_a.id).role == "student"

    # 2. Org A Admin lists only Org A users (cannot see Org B users)
    list_res = client.get("/api/admin/users")
    assert list_res.status_code == 200
    listed_ids = {u["id"] for u in list_res.get_json()["users"]}
    assert str(stu_a.id) in listed_ids
    assert str(stu_b.id) not in listed_ids

    # 3. Org A Admin cannot update Org B user details, role, or status (403) & DB unchanged
    assert client.put(f"/api/admin/users/{stu_b.id}", json={"full_name": "Hacked"}).status_code == 403
    assert client.put(f"/api/admin/users/{stu_b.id}/role", json={"role": "teacher"}).status_code == 403
    assert client.put(f"/api/admin/users/{stu_b.id}/status", json={"is_active": False}).status_code == 403
    stu_b_after = UserService.get_by_id(clean_db, stu_b.id)
    assert stu_b_after.full_name == "Student B"
    assert stu_b_after.role == "student"
    assert stu_b_after.is_active is True

    # 4. Same-tenant operation still works
    ok_upd = client.put(f"/api/admin/users/{stu_a.id}", json={"full_name": "Student A Updated"})
    assert ok_upd.status_code == 200
    assert UserService.get_by_id(clean_db, stu_a.id).full_name == "Student A Updated"


def test_create_super_admin_cli_duplicate_guard_and_force(runner, clean_db):
    """Verify create-super-admin refuses duplicate by default and requires explicit --force."""
    r1 = runner.invoke(
        create_super_admin_command,
        input="super1@edupredict.com\nSuperPass123!\nSuperPass123!\nSuper One\n",
    )
    assert r1.exit_code == 0

    # Duplicate without --force must fail
    r2 = runner.invoke(
        create_super_admin_command,
        input="super2@edupredict.com\nSuperPass123!\nSuperPass123!\nSuper Two\n",
    )
    assert r2.exit_code != 0
    assert "already exists" in r2.output.lower()

    # Duplicate with --force succeeds while still validating password/email & logging audit event
    r3 = runner.invoke(
        create_super_admin_command,
        args=["--force"],
        input="super2@edupredict.com\nSuperPass123!\nSuperPass123!\nSuper Two\n",
    )
    assert r3.exit_code == 0
    assert clean_db.users.count_documents({"role": "platform_super_admin"}) == 2
    assert clean_db.global_audit_logs.count_documents({"action": "PLATFORM_SUPER_ADMIN_PROVISIONED"}) == 2


def test_demand_forecasting_billing_entitlement_and_quota(client, clean_db):
    """Verify advanced_forecasting entitlement and atomic quota checks on POST /api/demand/forecast."""
    res, _, _ = InstitutionService.onboard_institution(
        clean_db, "Delta Univ", "delta", "admin@delta.edu", "AdminPass123!", "Delta Admin", plan_tier="starter", status="active"
    )
    org_id = res["institution"]["organization_id"]

    client.post("/auth/login", json={"email": "admin@delta.edu", "password": "AdminPass123!"})

    # 1. Starter plan lacks 'advanced_forecasting' -> 403
    blocked = client.post("/api/demand/forecast", json={"periods_ahead": 1})
    assert blocked.status_code == 403

    # 2. Upgrade to Growth -> enabled, and quota=1 permits 1 generation, blocks 2nd (429)
    BillingService.change_plan(clean_db, org_id, "growth")
    clean_db.subscriptions.update_one(
        {"organization_id": org_id}, {"$set": {"prediction_quota_monthly": 1, "predictions_used": 0}}
    )

    # Invalid periods_ahead fails BEFORE consuming quota (predictions_used stays 0)
    bad_req = client.post("/api/demand/forecast", json={"periods_ahead": 99})
    assert bad_req.status_code == 400
    assert BillingService.get_subscription(clean_db, org_id)["predictions_used"] == 0

    # Valid forecast consumes 1 quota
    ok_req = client.post("/api/demand/forecast", json={"periods_ahead": 1})
    assert ok_req.status_code == 201
    assert BillingService.get_subscription(clean_db, org_id)["predictions_used"] == 1

    # Next forecast exceeds quota -> 429
    over_req = client.post("/api/demand/forecast", json={"periods_ahead": 1})
    assert over_req.status_code == 429
