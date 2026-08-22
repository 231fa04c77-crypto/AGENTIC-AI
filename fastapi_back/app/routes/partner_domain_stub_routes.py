"""Phase 3 template routes — /api/v1/partner/{domain}/* capability stubs.

Full domain MVPs (orders, patient APIs) are added later like pharmacy.
These endpoints let partners validate credentials, scopes, and discover the contract.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.middleware.auth import auth_admin
from app.middleware.partner_auth import require_partner_apis
from app.services import partner_domain_registry as registry

admin_catalog_router = APIRouter(
    prefix="/api/admin/partner-domains",
    tags=["Partner Domain Catalog"],
)


@admin_catalog_router.get("/")
async def list_partner_domains(_admin=Depends(auth_admin)):
    """Catalog of integration domains for Super Admin / partner onboarding."""
    return registry.catalog_payload()


def _make_domain_router(slug: str) -> APIRouter:
    domain = registry.get_domain(slug)
    if not domain:
        raise ValueError(f"Unknown domain slug: {slug}")

    scopes = domain["default_scopes"]
    scope_args = tuple(scopes) if scopes else ("*",)

    router = APIRouter(
        prefix=f"/api/v1/partner/{slug}",
        tags=[f"Partner {domain['label']} (template)"],
    )

    @router.get("/capabilities")
    async def capabilities(
        partner: dict = Depends(require_partner_apis(*scope_args)),
    ):
        return {
            "success": True,
            "data": {
                "domain": slug,
                "partnerType": domain["partner_type"],
                "label": domain["label"],
                "status": domain["status"],
                "partnerId": partner.get("partner_id"),
                "environment": partner.get("environment"),
                "defaultScopes": domain["default_scopes"],
                "events": domain.get("events") or [],
                "plannedEndpoints": domain.get("planned_endpoints") or [],
                "message": (
                    "Template domain — authenticate and scope checks work. "
                    "Clinical order APIs will be added in a later MVP."
                    if domain["status"] == "template"
                    else "Live domain — use the documented operational endpoints."
                ),
            },
        }

    @router.get("/health")
    async def health(
        partner: dict = Depends(require_partner_apis(*scope_args)),
    ):
        return {
            "success": True,
            "data": {
                "domain": slug,
                "status": "ok",
                "partnerId": partner.get("partner_id"),
                "isSandbox": partner.get("is_sandbox"),
            },
        }

    return router


TEMPLATE_SLUGS = [
    # lab is live via partner_lab_routes
    "radiology",
    "insurance",
    "corporate-health",
    "wearables",
    "telemedicine",
    "home-healthcare",
]

domain_routers: list[APIRouter] = [_make_domain_router(s) for s in TEMPLATE_SLUGS]
