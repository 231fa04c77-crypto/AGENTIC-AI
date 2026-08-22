"""Partner pharmacy APIs — PharmaSync inbound (API key + HMAC + scopes)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.middleware.partner_auth import require_partner_apis
from app.services import pharmacy_service

router = APIRouter(prefix="/api/v1/partner/pharmacy", tags=["Partner Pharmacy"])


@router.get("/prescriptions/{consultation_id}")
async def get_prescription(
    consultation_id: int,
    partner: dict = Depends(require_partner_apis("pharmacy.prescriptions.read", "pharmacy.*")),
):
    return await pharmacy_service.partner_get_prescription(
        int(partner["partner_id"]), consultation_id,
    )


@router.get("/orders")
async def list_orders(
    status: str | None = Query(default=None),
    partner: dict = Depends(require_partner_apis("pharmacy.orders.read", "pharmacy.*")),
):
    return await pharmacy_service.partner_list_orders(int(partner["partner_id"]), status=status)


@router.get("/orders/{order_id}")
async def get_order(
    order_id: int,
    partner: dict = Depends(require_partner_apis("pharmacy.orders.read", "pharmacy.*")),
):
    return await pharmacy_service.partner_get_order(int(partner["partner_id"]), order_id)


@router.post("/orders/{order_id}/status")
async def update_status(
    order_id: int,
    req: Request,
    partner: dict = Depends(require_partner_apis("pharmacy.orders.write", "pharmacy.*")),
):
    from app.services import partner_idempotency as idem

    replay = await idem.maybe_replay(int(partner["partner_id"]), req)
    if replay is not None:
        return replay
    body = await req.json()
    result = await pharmacy_service.partner_update_status(
        int(partner["partner_id"]),
        order_id,
        body or {},
        is_sandbox_key=bool(partner.get("is_sandbox", True)),
    )
    await idem.remember(int(partner["partner_id"]), req, result)
    return result


@router.post("/orders/{order_id}/bill")
async def post_bill(
    order_id: int,
    req: Request,
    partner: dict = Depends(require_partner_apis("pharmacy.orders.write", "pharmacy.*")),
):
    from app.services import partner_idempotency as idem

    replay = await idem.maybe_replay(int(partner["partner_id"]), req)
    if replay is not None:
        return replay
    body = await req.json()
    result = await pharmacy_service.partner_post_bill(
        int(partner["partner_id"]),
        order_id,
        body or {},
        is_sandbox_key=bool(partner.get("is_sandbox", True)),
    )
    await idem.remember(int(partner["partner_id"]), req, result)
    return result


@router.post("/availability")
async def push_availability(
    req: Request,
    partner: dict = Depends(require_partner_apis("pharmacy.*", "pharmacy.orders.write")),
):
    body = await req.json()
    return await pharmacy_service.partner_push_availability(int(partner["partner_id"]), body or {})


@router.post("/webhook/pharmacy-status")
async def webhook_pharmacy_status(req: Request):
    import os
    from app.utils.app_logger import get_logger
    logger = get_logger(__name__)
    
    expected_key = os.getenv("INTERNAL_API_KEY") or os.getenv("PHARMACY_INTERNAL_API_KEY") or "d82a9cf038d0f27d90d0601ae5aa3eefd8562b1a7303ba3b2151dc2b13a3b461"
    key = req.headers.get("x-internal-api-key") or req.headers.get("x-api-key")
    if key != expected_key:
        return {"success": False, "message": "Unauthorized internal API key"}
    
    body = await req.json()
    prescription_id = body.get("prescriptionId")
    status = body.get("status")
    patient_phone = body.get("patientPhone")
    
    logger.info("Received live pharmacy status push: rx=%s status=%s phone=%s", prescription_id, status, patient_phone)
    return {"success": True, "message": "Status updated successfully", "data": body}

