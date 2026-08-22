from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.controllers import emergency_controller
from app.middleware.auth import auth_user
from app.middleware.rate_limit import rate_limit_dependency

router = APIRouter(prefix="/api/emergency", tags=["Emergency"])

_emergency_alert_limit = rate_limit_dependency("emergency_alert", max_calls=10, window_seconds=3600)
_sos_log_limit = rate_limit_dependency("emergency_sos_log", max_calls=30, window_seconds=3600)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def _optional_user_id(request: Request) -> int | None:
    try:
        return await auth_user(request)
    except HTTPException:
        return None


@router.post("/send-alert")
async def send_emergency_alert(
    req: Request,
    _: None = Depends(_emergency_alert_limit),
):
    from app.schemas.emergency import EmergencyAlertRequest
    from app.utils.validation import validate_body

    body = await req.json()
    parsed = validate_body(EmergencyAlertRequest, body)
    if hasattr(parsed, "status_code"):
        return parsed
    payload = parsed.model_dump()
    user_id = await _optional_user_id(req)
    source = (payload.get("source") or "web").strip()[:32]
    result = await emergency_controller.send_emergency_alert(
        payload,
        user_id=user_id,
        ip_address=_client_ip(req),
        source=source,
    )
    if not result.get("success"):
        return JSONResponse(status_code=400, content=result)
    return result


@router.post("/log-event")
async def log_emergency_event(
    req: Request,
    _: None = Depends(_sos_log_limit),
):
    """Log SOS activation — optional auth; does not send SMS."""
    body = await req.json()
    user_id = await _optional_user_id(req)
    source = (body.get("source") or "flutter").strip()[:32]
    result = await emergency_controller.log_sos_event(
        body,
        user_id=user_id,
        ip_address=_client_ip(req),
        source=source,
    )
    if not result.get("success"):
        return JSONResponse(status_code=400, content=result)
    return result
