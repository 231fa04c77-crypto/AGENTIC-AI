from fastapi import APIRouter, Depends, Request
from app.controllers import otp_controller
from app.middleware.rate_limit import rate_limit_dependency

router = APIRouter(prefix="/api", tags=["OTP"])

_otp_send_limit = rate_limit_dependency("otp_send", max_calls=5, window_seconds=3600)
_otp_verify_limit = rate_limit_dependency("otp_verify", max_calls=20, window_seconds=3600)


@router.post("/send-otp")
async def send_otp(req: Request, _: None = Depends(_otp_send_limit)):
    from app.schemas.auth import OtpSendRequest
    from app.utils.validation import validate_body

    body = await req.json()
    parsed = validate_body(OtpSendRequest, body)
    if hasattr(parsed, "status_code"):
        return parsed
    return await otp_controller.send_otp(parsed.email)

@router.post("/verify-otp")
async def verify_otp(req: Request, _: None = Depends(_otp_verify_limit)):
    from app.schemas.auth import OtpVerifyRequest
    from app.utils.validation import validate_body

    body = await req.json()
    parsed = validate_body(OtpVerifyRequest, body)
    if hasattr(parsed, "status_code"):
        return parsed
    return await otp_controller.verify_otp_code(parsed.email, parsed.otp)

@router.get("/verify-brevo")
async def verify_brevo():
    from app.services import email_service
    return await email_service.verify_brevo_connection()
