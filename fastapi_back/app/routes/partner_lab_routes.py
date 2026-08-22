"""Partner lab APIs — inbound order status + FHIR-lite results."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.middleware.partner_auth import require_partner_apis
from app.services import lab_partner_service
from app.services import partner_domain_registry as registry

router = APIRouter(prefix="/api/v1/partner/lab", tags=["Partner Lab"])


@router.get("/capabilities")
async def capabilities(partner: dict = Depends(require_partner_apis("lab.*", "lab.orders.read"))):
    domain = registry.get_domain("lab") or {}
    return {
        "success": True,
        "data": {
            "domain": "lab",
            "partnerType": domain.get("partner_type"),
            "label": domain.get("label"),
            "status": domain.get("status"),
            "partnerId": partner.get("partner_id"),
            "environment": partner.get("environment"),
            "defaultScopes": domain.get("default_scopes") or [],
            "events": domain.get("events") or [],
            "plannedEndpoints": domain.get("planned_endpoints") or [],
            "message": "Live lab domain — use /orders and result ingest endpoints.",
        },
    }


@router.get("/health")
async def health(partner: dict = Depends(require_partner_apis("lab.*", "lab.orders.read"))):
    return {
        "success": True,
        "data": {
            "domain": "lab",
            "status": "ok",
            "partnerId": partner.get("partner_id"),
            "isSandbox": partner.get("is_sandbox"),
        },
    }


@router.get("/orders")
async def list_orders(
    status: str | None = Query(default=None),
    partner: dict = Depends(require_partner_apis("lab.orders.read", "lab.*")),
):
    return await lab_partner_service.partner_list_orders(int(partner["partner_id"]), status=status)


@router.get("/orders/{order_id}")
async def get_order(
    order_id: int,
    partner: dict = Depends(require_partner_apis("lab.orders.read", "lab.*")),
):
    return await lab_partner_service.partner_get_order(int(partner["partner_id"]), order_id)


@router.post("/orders/{order_id}/status")
async def update_status(
    order_id: int,
    req: Request,
    partner: dict = Depends(require_partner_apis("lab.orders.write", "lab.*")),
):
    from app.services import partner_idempotency as idem

    replay = await idem.maybe_replay(int(partner["partner_id"]), req)
    if replay is not None:
        return replay
    body = await req.json()
    result = await lab_partner_service.partner_update_status(
        int(partner["partner_id"]),
        order_id,
        body or {},
        is_sandbox_key=bool(partner.get("is_sandbox", True)),
    )
    await idem.remember(int(partner["partner_id"]), req, result)
    return result


@router.post("/orders/{order_id}/results")
async def post_results(
    order_id: int,
    req: Request,
    partner: dict = Depends(require_partner_apis("lab.results.write", "lab.*")),
):
    from app.services import partner_idempotency as idem

    replay = await idem.maybe_replay(int(partner["partner_id"]), req)
    if replay is not None:
        return replay
    body = await req.json()
    result = await lab_partner_service.partner_post_results(
        int(partner["partner_id"]),
        order_id,
        body or {},
        is_sandbox_key=bool(partner.get("is_sandbox", True)),
    )
    await idem.remember(int(partner["partner_id"]), req, result)
    return result
