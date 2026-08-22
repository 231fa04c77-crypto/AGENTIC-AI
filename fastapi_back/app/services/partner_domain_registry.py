"""Phase 3 — Enterprise Integration domain registry.

Each future vertical reuses partners + HMAC + webhooks.
Domain route modules live under /api/v1/partner/{slug}/* and start as
capability stubs until a full MVP (like pharmacy) is built.
"""
from __future__ import annotations

from typing import Any

# slug used in URL path: /api/v1/partner/{slug}
# partner_type stored on partners.partner_type
DOMAINS: list[dict[str, Any]] = [
    {
        "slug": "pharmacy",
        "partner_type": "PHARMACY",
        "label": "Pharmacy ERP",
        "status": "live",
        "default_scopes": [
            "pharmacy.*",
            "pharmacy.prescriptions.read",
            "pharmacy.orders.read",
            "pharmacy.orders.write",
        ],
        "events": [
            "prescription.created",
            "prescription.updated",
            "order.placed",
            "order.cancelled",
            "order.status.changed",
            "payment.completed",
            "availability.probe",
        ],
        "notes": "Full MVP (Phase 1–2). Patient APIs under /api/user/pharmacy.",
    },
    {
        "slug": "emergency",
        "partner_type": "TRANSPORT",
        "label": "Emergency / Transport",
        "status": "live",
        "path_prefix": "/api/partner/emergency",
        "default_scopes": [
            "emergency.create",
            "emergency.status",
            "emergency.cancel",
            "dashboard.*",
        ],
        "events": ["emergency.case.created", "emergency.status.changed"],
        "notes": "Legacy emergency partner platform (not under /api/v1).",
    },
    {
        "slug": "lab",
        "partner_type": "LAB",
        "label": "Laboratory",
        "status": "live",
        "default_scopes": ["lab.*", "lab.orders.read", "lab.orders.write", "lab.results.write"],
        "events": [
            "lab.order.status.changed",
            "lab.result.ready",
            "lab.order.placed",
        ],
        "planned_endpoints": [
            "GET /orders",
            "GET /orders/{id}",
            "POST /orders/{id}/status",
            "POST /orders/{id}/results",
            "GET /capabilities",
            "GET /health",
        ],
        "notes": "FHIR-lite / HL7 JSON results. Patient bookings under /api/lab.",
    },
    {
        "slug": "radiology",
        "partner_type": "RADIOLOGY",
        "label": "Radiology / Imaging",
        "status": "template",
        "default_scopes": ["radiology.*", "radiology.orders.read", "radiology.orders.write"],
        "events": ["radiology.order.placed", "radiology.report.ready"],
        "planned_endpoints": [
            "GET /orders",
            "POST /orders/{id}/status",
            "POST /orders/{id}/report",
        ],
    },
    {
        "slug": "insurance",
        "partner_type": "INSURANCE",
        "label": "Insurance / TPA",
        "status": "template",
        "default_scopes": [
            "insurance.*",
            "insurance.eligibility.read",
            "insurance.claims.write",
            "insurance.claims.read",
        ],
        "events": ["insurance.eligibility.checked", "insurance.claim.updated"],
        "planned_endpoints": [
            "POST /eligibility",
            "POST /claims",
            "GET /claims/{id}",
            "POST /claims/{id}/status",
        ],
    },
    {
        "slug": "corporate-health",
        "partner_type": "CORPORATE_HEALTH",
        "label": "Corporate Health",
        "status": "template",
        "default_scopes": ["corporate_health.*", "corporate_health.employees.read"],
        "events": ["corporate_health.checkup.scheduled"],
        "planned_endpoints": ["GET /employees/{id}", "POST /checkups"],
    },
    {
        "slug": "wearables",
        "partner_type": "WEARABLES",
        "label": "Wearables",
        "status": "template",
        "default_scopes": ["wearables.*", "wearables.vitals.write"],
        "events": ["wearables.vitals.received"],
        "planned_endpoints": ["POST /vitals", "GET /devices"],
    },
    {
        "slug": "telemedicine",
        "partner_type": "TELEMEDICINE",
        "label": "Telemedicine Platform",
        "status": "template",
        "default_scopes": ["telemedicine.*", "telemedicine.sessions.write"],
        "events": ["telemedicine.session.started", "telemedicine.session.ended"],
        "planned_endpoints": ["POST /sessions", "POST /sessions/{id}/status"],
    },
    {
        "slug": "home-healthcare",
        "partner_type": "HOME_HEALTHCARE",
        "label": "Home Healthcare",
        "status": "template",
        "default_scopes": ["home_healthcare.*", "home_healthcare.visits.write"],
        "events": ["home_healthcare.visit.scheduled", "home_healthcare.visit.completed"],
        "planned_endpoints": ["GET /visits", "POST /visits/{id}/status"],
    },
]


def get_domain(slug: str) -> dict[str, Any] | None:
    slug = (slug or "").strip().lower()
    for d in DOMAINS:
        if d["slug"] == slug:
            return d
    return None


def get_domain_by_partner_type(partner_type: str) -> dict[str, Any] | None:
    pt = (partner_type or "").strip().upper()
    for d in DOMAINS:
        if d["partner_type"] == pt:
            return d
    return None


def default_apis_for_partner_type(partner_type: str) -> list[str]:
    d = get_domain_by_partner_type(partner_type)
    if d:
        return list(d["default_scopes"])
    # Legacy / generic types
    pt = (partner_type or "").upper()
    if pt in ("TRANSPORT", "INFRASTRUCTURE", "EDUCATION", "GOVERNMENT", "CORPORATE", "TECHNOLOGY"):
        return [
            "emergency.create",
            "emergency.status",
            "emergency.cancel",
            "dashboard.*",
        ]
    return ["dashboard.*"]


def template_domains() -> list[dict[str, Any]]:
    return [d for d in DOMAINS if d.get("status") == "template"]


def path_prefix_for_slug(slug: str) -> str:
    d = get_domain(slug)
    if not d:
        return f"/api/v1/partner/{slug}"
    return d.get("path_prefix") or f"/api/v1/partner/{d['slug']}"


def build_scope_prefix_map() -> dict[str, str]:
    """Map allowed_apis scope strings → URL path prefixes for partner_auth."""
    prefix_map: dict[str, str] = {
        "emergency": "/api/partner/emergency",
        "emergency.*": "/api/partner/emergency",
        "emergency.create": "/api/partner/emergency",
        "emergency.status": "/api/partner/emergency",
        "emergency.cancel": "/api/partner/emergency",
        "dashboard": "/api/partner/dashboard",
        "dashboard.*": "/api/partner/dashboard",
        "pharmacy": "/api/v1/partner/pharmacy",
        "pharmacy.*": "/api/v1/partner/pharmacy",
        "pharmacy.prescriptions.read": "/api/v1/partner/pharmacy/prescriptions",
        "pharmacy.orders.read": "/api/v1/partner/pharmacy/orders",
        "pharmacy.orders.write": "/api/v1/partner/pharmacy/orders",
        "lab": "/api/v1/partner/lab",
        "lab.*": "/api/v1/partner/lab",
        "lab.orders.read": "/api/v1/partner/lab/orders",
        "lab.orders.write": "/api/v1/partner/lab/orders",
        "lab.results.write": "/api/v1/partner/lab/orders",
    }
    for d in DOMAINS:
        if d["slug"] in ("pharmacy", "emergency", "lab"):
            continue
        base = path_prefix_for_slug(d["slug"])
        # Scope root uses underscore form matching default_scopes (corporate_health.*)
        scope_root = d["partner_type"].lower()
        # Prefer first default scope prefix before .*
        roots: set[str] = set()
        for s in d["default_scopes"]:
            root = s.split(".")[0]
            roots.add(root)
        for root in roots:
            prefix_map[root] = base
            prefix_map[f"{root}.*"] = base
            for s in d["default_scopes"]:
                if s.startswith(root + "."):
                    prefix_map[s] = base
    return prefix_map


def catalog_payload() -> dict[str, Any]:
    return {
        "success": True,
        "data": [
            {
                "slug": d["slug"],
                "partnerType": d["partner_type"],
                "label": d["label"],
                "status": d["status"],
                "basePath": path_prefix_for_slug(d["slug"]),
                "defaultScopes": d["default_scopes"],
                "events": d.get("events") or [],
                "plannedEndpoints": d.get("planned_endpoints") or [],
                "notes": d.get("notes"),
            }
            for d in DOMAINS
        ],
    }
