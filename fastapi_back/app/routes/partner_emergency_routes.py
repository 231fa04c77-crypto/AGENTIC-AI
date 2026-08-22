"""Partner-facing emergency API routes.

Base path: /api/partner/emergency
Auth: X-Api-Key + X-Timestamp + X-Signature headers (partner_auth dependency)

Endpoints:
    POST   /cases           → create a new emergency case
    GET    /cases/{case_id} → poll status of an existing case
    POST   /cases/{case_id}/cancel → cancel an active case
    GET    /cases           → list all cases for this partner (paged)
    POST   /webhook/test    → fire a test webhook to verify configuration
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Any, Optional

from app.controllers import dispatch_controller
from app.middleware.partner_auth import partner_auth
from app.models import emergency_case_model as ecm
from app.utils.app_logger import get_logger

log = get_logger(__name__)

# Shared route table — mounted at legacy + v1 prefixes (same handlers).
_routes = APIRouter()
router = APIRouter(prefix="/api/partner/emergency", tags=["Partner Emergency API"])
router_v1 = APIRouter(prefix="/api/v1/partner/emergency", tags=["Partner Emergency API"])


# ── Request / Response schemas ────────────────────────────────────────────────

class CreateCaseRequest(BaseModel):
    request_id: str = Field(..., description="Partner-generated idempotency key (UUID recommended)")
    patient_name: str = Field(..., min_length=1, max_length=255)
    patient_phone: str = Field(..., min_length=7, max_length=20)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    location_text: Optional[str] = None
    emergency_type: Optional[str] = "MEDICAL_EMERGENCY"
    user_id: Optional[int] = None
    additional_info: Optional[dict[str, Any]] = Field(default_factory=dict)
    partner_metadata: Optional[dict[str, Any]] = Field(default_factory=dict)
    webhook_url: Optional[str] = None    # one-off override per request


class CancelCaseRequest(BaseModel):
    reason: Optional[str] = None


class WebhookTestRequest(BaseModel):
    webhook_url: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@_routes.post("/cases", summary="Create a new emergency case")
async def create_case(
    body: CreateCaseRequest,
    partner: dict = Depends(partner_auth),
):
    """Called by partner applications when a user triggers an emergency.
    Returns the MEDCLUES case ID, assigned hospital info, and tracking URL.
    """
    try:
        result = await dispatch_controller.create_emergency_case(partner, body.model_dump())
        return {"success": True, "data": result}
    except Exception as exc:
        log.exception("create_case error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@_routes.get("/cases/{case_id}", summary="Get status of an emergency case")
async def get_case(
    case_id: str,
    partner: dict = Depends(partner_auth),
):
    """Poll the current status and full history of a case."""
    try:
        result = await dispatch_controller.get_case_status(case_id)
        # Security: partners can only view their own cases
        case_row = await ecm.get_case_by_public_id(case_id)
        if case_row and case_row["partner_id"] != partner["partner_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.exception("get_case error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@_routes.post("/cases/{case_id}/cancel", summary="Cancel an active emergency case")
async def cancel_case(
    case_id: str,
    body: CancelCaseRequest,
    partner: dict = Depends(partner_auth),
):
    """Allows a partner to cancel an active emergency (e.g., user dismissed alert)."""
    try:
        case_row = await ecm.get_case_by_public_id(case_id)
        if not case_row:
            raise HTTPException(status_code=404, detail="Case not found")
        if case_row["partner_id"] != partner["partner_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        result = await dispatch_controller.cancel_case(case_id, body.reason)
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        log.exception("cancel_case error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@_routes.get("/cases", summary="List all cases for this partner")
async def list_cases(
    partner: dict = Depends(partner_auth),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Paginated list of all cases created by this partner."""
    from app.models.emergency_case_model import list_cases_for_partner
    cases = await list_cases_for_partner(partner["partner_id"], limit, offset)
    return {
        "success": True,
        "data": [dispatch_controller._format_case_response(dict(c)) for c in cases],
        "pagination": {"limit": limit, "offset": offset, "count": len(cases)},
    }


@_routes.post("/webhook/test", summary="Send a test webhook to verify connectivity")
async def test_webhook(
    body: WebhookTestRequest,
    partner: dict = Depends(partner_auth),
):
    """Sends a synthetic test event to the provided URL so partners can verify
    their webhook receiver is working before going live.
    """
    import time
    from app.services.partner_webhook_service import enqueue_webhook_event
    payload = {
        "event": "emergency.test",
        "message": "This is a test webhook from MEDCLUES Emergency Partner Platform.",
        "partner_id": partner["partner_id"],
        "partner_name": partner["partner_name"],
        "timestamp": int(time.time()),
    }
    try:
        await enqueue_webhook_event(
            partner["partner_id"],
            None,
            "emergency.test",
            payload,
            body.webhook_url,
        )
        return {"success": True, "message": "Test webhook queued. Check your endpoint."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


router.include_router(_routes)
router_v1.include_router(_routes)
