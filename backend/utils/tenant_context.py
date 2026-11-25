"""
EduPredict - Multi-Institution Tenant Resolver Middleware (Phase 9B)
Module: backend.utils.tenant_context
Purpose: Validates Host headers, extracts subdomain or X-Institution-ID, enforces
fail-closed tenant isolation, and binds g.tenant_id and g.institution.
"""

import re
import logging
from typing import Optional, Tuple
from flask import current_app, g, jsonify, request
from flask_login import current_user
from backend.extensions import mongo

logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$")
_RESERVED_SUBDOMAINS = {"www", "api", "app", "admin", "platform"}


def _extract_host_and_subdomain(
    raw_host: str, trusted_domains: set[str]
) -> Tuple[bool, Optional[str]]:
    """
    Validate Host header against trusted_domains and extract optional subdomain slug.
    Returns (is_trusted, subdomain_slug).
    """
    host = (raw_host or "").split(":", 1)[0].strip().lower()
    if not host:
        return False, None

    if host in trusted_domains:
        return True, None

    for domain in trusted_domains:
        if domain in {"127.0.0.1", "localhost"} and domain == "127.0.0.1":
            continue
        suffix = f".{domain}"
        if host.endswith(suffix):
            sub = host[: -len(suffix)]
            # Reject multi-level subdomains or invalid characters
            if not sub or "." in sub or not _SLUG_RE.match(sub):
                return False, None
            if sub in _RESERVED_SUBDOMAINS:
                return True, None
            return True, sub

    return False, None


def get_current_tenant_id(actor_user=None) -> Optional[str]:
    """Resolve canonical organization_id from g.tenant_id or actor_user."""
    tid = getattr(g, "tenant_id", None)
    if tid:
        return str(tid).strip()
    if actor_user is not None:
        org = getattr(actor_user, "organization_id", None)
        if org and str(org).strip():
            return str(org).strip()
    return None


def resolve_tenant_request():
    """
    Flask before_request hook:
    1. Validates Host header against TRUSTED_TENANT_DOMAINS (protects against Host spoofing).
    2. Resolves institution via subdomain slug and/or X-Institution-ID header.
    3. Rejects mismatched subdomain vs header, unknown/forged tenants, and suspended/cancelled institutions.
    4. For authenticated non-super-admin users, enforces tenant == current_user.organization_id.
    5. Binds g.tenant_id and g.institution.
    """
    g.tenant_id = None
    g.institution = None

    raw_domains = current_app.config.get(
        "TRUSTED_TENANT_DOMAINS",
        ["localhost", "127.0.0.1", "edupredict.com", "testserver"],
    )
    trusted_domains = {d.strip().lower() for d in raw_domains if d and d.strip()}

    is_trusted, subdomain_slug = _extract_host_and_subdomain(request.host, trusted_domains)
    if not is_trusted:
        logger.warning("Untrusted Host header rejected: %s", request.host)
        return jsonify({
            "error": "Forbidden",
            "message": "Untrusted Host header.",
            "status_code": 403,
        }), 403

    header_tenant = (request.headers.get("X-Institution-ID") or "").strip()
    db = mongo.db

    inst_from_sub = None
    inst_from_hdr = None

    if subdomain_slug and db is not None:
        inst_from_sub = db.institutions.find_one({"slug": subdomain_slug})
        if not inst_from_sub:
            return jsonify({
                "error": "Forbidden",
                "message": "Unknown or invalid institution subdomain.",
                "status_code": 403,
            }), 403

    if header_tenant and db is not None:
        inst_from_hdr = db.institutions.find_one({
            "$or": [
                {"organization_id": header_tenant},
                {"slug": header_tenant.lower()},
            ]
        })
        if not inst_from_hdr:
            return jsonify({
                "error": "Forbidden",
                "message": "Unknown or invalid X-Institution-ID.",
                "status_code": 403,
            }), 403

    if inst_from_sub and inst_from_hdr:
        if inst_from_sub.get("organization_id") != inst_from_hdr.get("organization_id"):
            return jsonify({
                "error": "Forbidden",
                "message": "X-Institution-ID does not match request subdomain.",
                "status_code": 403,
            }), 403

    resolved_inst = inst_from_sub or inst_from_hdr
    if resolved_inst:
        if resolved_inst.get("status") in {"suspended", "cancelled"}:
            return jsonify({
                "error": "Forbidden",
                "message": "Institution account is suspended or cancelled.",
                "status_code": 403,
            }), 403
        g.tenant_id = resolved_inst.get("organization_id")
        g.institution = resolved_inst

    # Authenticated user checks
    if getattr(current_user, "is_authenticated", False):
        user_role = getattr(current_user, "role", "")
        user_org = getattr(current_user, "organization_id", None)

        if user_role != "platform_super_admin":
            if resolved_inst:
                if not user_org or str(user_org).strip() != str(resolved_inst.get("organization_id")):
                    return jsonify({
                        "error": "Forbidden",
                        "message": "Cross-tenant access denied. Session does not belong to this institution.",
                        "status_code": 403,
                    }), 403
            elif user_org and db is not None:
                user_inst = db.institutions.find_one({"organization_id": str(user_org).strip()})
                if user_inst and user_inst.get("status") in {"suspended", "cancelled"}:
                    return jsonify({
                        "error": "Forbidden",
                        "message": "Institution account is suspended or cancelled.",
                        "status_code": 403,
                    }), 403
                g.tenant_id = str(user_org).strip()
                g.institution = user_inst

    return None
