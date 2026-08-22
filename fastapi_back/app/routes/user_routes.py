import io
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from app.controllers import user_controller
from app.middleware.auth import auth_user
from app.middleware.rate_limit import rate_limit_dependency
from app.utils.auth_response import build_auth_response

router = APIRouter(prefix="/api/user", tags=["User"])

_login_limit = rate_limit_dependency("user_login", max_calls=30, window_seconds=3600)
_book_limit = rate_limit_dependency("book_appointment", max_calls=20, window_seconds=60)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None

@router.post("/register")
async def register_user(req: Request):
    from app.schemas.auth import RegisterRequest
    from app.utils.validation import validate_body

    body = await req.json()
    parsed = validate_body(RegisterRequest, body)
    if hasattr(parsed, "status_code"):
        return parsed
    result = await user_controller.register_user(parsed.model_dump())
    return build_auth_response(result, "patient", req)

@router.post("/login")
async def login_user(req: Request, _: None = Depends(_login_limit)):
    from app.schemas.auth import LoginRequest
    from app.utils.validation import validate_body

    body = await req.json()
    parsed = validate_body(LoginRequest, body)
    if hasattr(parsed, "status_code"):
        return parsed
    result = await user_controller.login_user(parsed.model_dump())
    return build_auth_response(result, "patient", req)

@router.post("/social-login")
async def social_login(req: Request):
    body = await req.json()
    result = await user_controller.social_login(body)
    return build_auth_response(result, "patient", req)

@router.get("/get-profile")
async def get_profile(user_id: int = Depends(auth_user)):
    return await user_controller.get_profile(user_id)

@router.patch("/profile")
async def patch_profile(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.patch_profile(user_id, body)


@router.patch("/onboarding")
async def patch_onboarding(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.patch_onboarding(user_id, body)


@router.post("/email/signup/send-otp")
async def signup_send_email_otp(req: Request):
    body = await req.json()
    return await user_controller.send_signup_email_otp(body.get("email"))


@router.post("/email/signup/verify-otp")
async def signup_verify_email_otp(req: Request):
    body = await req.json()
    return await user_controller.verify_signup_email_otp(body.get("email"), str(body.get("otp", "")))


@router.post("/email/send-verification")
async def send_email_verification(user_id: int = Depends(auth_user)):
    return await user_controller.send_email_verification(user_id)


@router.post("/email/verify")
async def verify_email(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.verify_email(user_id, str(body.get("otp", "")))


@router.post("/update-profile")
async def update_profile(
    name: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    bloodGroup: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    user_id: int = Depends(auth_user)
):
    form_data = {}
    if name is not None:
        form_data["name"] = name
    if phone is not None:
        form_data["phone"] = phone
    if address is not None:
        form_data["address"] = address
    if dob is not None:
        form_data["dob"] = dob
    if gender is not None:
        form_data["gender"] = gender
    if bloodGroup is not None:
        form_data["bloodGroup"] = bloodGroup
    return await user_controller.update_profile(user_id, form_data, image)

@router.post("/slots/{slot_id}/hold")
async def hold_slot(slot_id: int, user_id: int = Depends(auth_user)):
    """Temporary Redis hold while patient starts checkout (TTL 5 min)."""
    from app.services import slot_lock_service
    ok = await slot_lock_service.hold_slot(slot_id, f"user:{user_id}")
    if not ok:
        return JSONResponse(
            status_code=409,
            content={"success": False, "message": "This slot is held by another patient. Try another time."},
        )
    return {"success": True, "message": "Slot held", "ttlSeconds": 300}


@router.delete("/slots/{slot_id}/hold")
async def release_slot_hold(slot_id: int, user_id: int = Depends(auth_user)):
    from app.services import slot_lock_service
    await slot_lock_service.release_hold(slot_id, f"user:{user_id}")
    return {"success": True, "message": "Hold released"}


@router.post("/book-appointment")
async def book_appointment(
    docId: str = Form(...),
    slotDate: str = Form(...),
    slotTime: str = Form(...),
    symptoms: str = Form("[]"),
    paymentMethod: str = Form("payOnVisit"),
    mode: Optional[str] = Form(None),
    slotId: Optional[str] = Form(None),
    slotType: Optional[str] = Form(None),
    actualPatient: Optional[str] = Form(None),
    hospitalName: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    prescription: Optional[UploadFile] = File(None),
    user_id: int = Depends(auth_user),
    _: None = Depends(_book_limit),
):
    try:
        import json
        body = {
            "docId": docId,
            "slotDate": slotDate,
            "slotTime": slotTime,
            "symptoms": json.loads(symptoms) if symptoms and symptoms != 'undefined' else [],
            "paymentMethod": paymentMethod,
            "mode": mode,
            "slotId": int(slotId) if slotId and str(slotId).isdigit() else None,
            "slotType": slotType,
            "hospitalName": hospitalName,
            "location": location,
            "actualPatient": json.loads(actualPatient) if actualPatient and actualPatient != 'undefined' and actualPatient != 'null' else {"isSelf": True}
        }
        return await user_controller.book_appointment(user_id, body, prescription)
    except Exception as e:
        return {"success": False, "message": f"Invalid request data: {str(e)}"}

@router.get("/appointments")
async def list_appointments(
    user_id: int = Depends(auth_user),
    limit: int | None = None,
    offset: int = 0,
):
    from app.utils.pagination import parse_pagination

    lim, off = parse_pagination(limit, offset)
    return await user_controller.list_appointments(user_id, limit=lim, offset=off)

@router.post("/cancel-appointment")
async def cancel_appointment(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.cancel_appointment(user_id, body.get('appointmentId'))


@router.get("/appointments/{appointmentId}/lifecycle")
async def appointment_lifecycle(appointmentId: int, user_id: int = Depends(auth_user)):
    from app.controllers import lifecycle_controller
    return await lifecycle_controller.get_lifecycle(appointmentId, user_id)


@router.get("/appointments/{appointmentId}/consultation-summary")
async def consultation_summary(appointmentId: int, user_id: int = Depends(auth_user)):
    from app.controllers import lifecycle_controller
    return await lifecycle_controller.get_consultation_summary(appointmentId, user_id)


@router.get("/appointments/{appointmentId}/queue-live")
async def appointment_queue_live(appointmentId: int, user_id: int = Depends(auth_user)):
    return await user_controller.get_appointment_queue_live(appointmentId, user_id)


@router.post("/appointments/{appointmentId}/grace-reschedule")
async def grace_reschedule(appointmentId: int, req: Request, user_id: int = Depends(auth_user)):
    from app.controllers import lifecycle_controller
    body = await req.json()
    return await lifecycle_controller.request_grace_reschedule(
        user_id, appointmentId, body.get("requestedDate") or body.get("requested_date") or ""
    )


@router.post("/appointments/{appointmentId}/confirm-tomorrow-reschedule")
async def confirm_tomorrow_reschedule(
    appointmentId: int, req: Request, user_id: int = Depends(auth_user)
):
    from app.controllers import lifecycle_controller

    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    return await lifecycle_controller.confirm_tomorrow_reschedule(
        user_id,
        appointmentId,
        requested_date=body.get("requestedDate") or body.get("requested_date"),
        preferred_slot_type=body.get("slotType")
        or body.get("slot_type")
        or body.get("preferredSlotType"),
    )


@router.post("/appointments/{appointmentId}/followup-visit")
async def followup_visit(appointmentId: int, user_id: int = Depends(auth_user)):
    from app.services import followup_service
    try:
        updated = await followup_service.use_followup_visit(appointmentId, user_id)
        from app.services import appointment_lifecycle_service
        return {
            "success": True,
            "appointment": appointment_lifecycle_service.lifecycle_payload(updated),
        }
    except Exception as exc:
        from app.services.appointment_lifecycle_service import AppointmentPolicyError
        if isinstance(exc, AppointmentPolicyError):
            return {"success": False, "message": exc.message}
        return {"success": False, "message": str(exc)}


@router.get("/booking-constraints")
async def booking_constraints(user_id: int = Depends(auth_user)):
    from app.services import trust_score_service
    return {"success": True, **await trust_score_service.booking_constraints(user_id)}

@router.post("/payment-razorpay")
async def payment_razorpay(req: Request, user_id: int = Depends(auth_user)):
    """Deprecated — use POST /api/payments/appointment-order."""
    from fastapi import HTTPException
    raise HTTPException(
        status_code=410,
        detail="Deprecated. Use /api/payments/appointment-order or /api/payments/create-order (amount in paise).",
    )

@router.post("/verify-razorpay")
async def verify_razorpay(req: Request, user_id: int = Depends(auth_user)):
    """Deprecated — use POST /api/payments/appointment-verify."""
    from fastapi import HTTPException
    raise HTTPException(
        status_code=410,
        detail="Deprecated. Use /api/payments/appointment-verify or /api/payments/verify.",
    )

# Health Records - accessible under /api/user/health-records (frontend uses this path)
@router.get("/health-records")
async def get_user_health_records(req: Request, user_id: int = Depends(auth_user)):
    from app.controllers import health_record_controller
    params = dict(req.query_params)
    return await health_record_controller.get_health_records(user_id, params)

@router.post("/health-records")
async def create_user_health_record(
    record_type: str = Form(None),
    title: str = Form(None),
    description: str = Form(None),
    doctor_name: str = Form(None),
    doc_id: Optional[int] = Form(None),
    appointment_id: Optional[int] = Form(None),
    date_str: str = Form(None),
    tags: str = Form(None),
    is_important: bool = Form(False),
    files: List[UploadFile] = File([]),
    user_id: int = Depends(auth_user)
):
    from app.controllers import health_record_controller
    return await health_record_controller.create_health_record(
        user_id, record_type or 'general', title, description, doctor_name, doc_id,
        appointment_id, date_str, tags, is_important, files
    )

@router.delete("/health-records/{record_id}")
async def delete_user_health_record(record_id: int, user_id: int = Depends(auth_user)):
    from app.controllers import health_record_controller
    return await health_record_controller.delete_health_record(user_id, record_id)

@router.get("/health-records/{record_id}/view-url")
async def get_health_record_view_url(
    req: Request,
    record_id: int,
    fileIndex: int = 0,
    user_id: int = Depends(auth_user),
):
    from app.controllers import health_record_controller
    return await health_record_controller.get_record_file_view_url(
        user_id,
        record_id,
        fileIndex,
        ip_address=_client_ip(req),
        user_agent=req.headers.get("User-Agent"),
    )

@router.get("/health-records/{record_id}/file")
async def stream_health_record_file(
    req: Request,
    record_id: int,
    fileIndex: int = 0,
    user_id: int = Depends(auth_user),
):
    from app.controllers import health_record_controller
    result = await health_record_controller.stream_record_file(
        user_id,
        record_id,
        fileIndex,
        ip_address=_client_ip(req),
        user_agent=req.headers.get("User-Agent"),
    )
    if not result.get("success"):
        status = 404 if "not found" in (result.get("message") or "").lower() else 502
        return JSONResponse(status_code=status, content=result)
    filename = result.get("fileName") or "report.pdf"
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)
    return StreamingResponse(
        io.BytesIO(result["content"]),
        media_type=result.get("contentType") or "application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Cache-Control": "private, max-age=300",
        },
    )


# Public appointment verification (QR)
@router.get("/appointment/verify/{id}")
async def verify_appointment(id: int):
    return await user_controller.verify_appointment(id)


@router.get("/appointment/by-booking/{booking_id}")
async def appointment_by_booking_id(booking_id: str, sig: str | None = None):
    """Alias for signed BK lookup (same as GET /api/appointments/{booking_id}?sig=)."""
    return await user_controller.get_appointment_by_booking_id(booking_id, sig=sig)

# Public contact form
@router.post("/contact")
async def send_contact(req: Request):
    body = await req.json()
    return await user_controller.send_contact_message(body)

# Saved Profiles
@router.get("/saved-profiles")
async def get_saved_profiles(user_id: int = Depends(auth_user)):
    return await user_controller.get_saved_profiles(user_id)

@router.post("/save-profile")
async def save_profile(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.save_profile(user_id, body)

@router.put("/saved-profiles/{profile_id}")
async def update_saved_profile(profile_id: int, req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.update_saved_profile(user_id, profile_id, body)

@router.delete("/saved-profiles/{profile_id}")
async def delete_saved_profile(profile_id: int, user_id: int = Depends(auth_user)):
    return await user_controller.delete_saved_profile(user_id, profile_id)

# Payments (PayU & UPI)
@router.post("/payment-payu/init")
async def init_payu(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.init_payu_payment(user_id, body)

@router.get("/payment/merchant-upi")
async def get_merchant_upi(user_id: int = Depends(auth_user)):
    return await user_controller.get_merchant_upi()

# Queue & Status
@router.get("/queue-status")
async def get_queue_status(docId: str, slotDate: str, user_id: int = Depends(auth_user)):
    return await user_controller.get_queue_status(docId, slotDate)

@router.get("/doctor-status")
async def get_doctor_status(docId: str):
    return await user_controller.get_doctor_status(docId)

@router.post("/mark-alerted")
async def mark_alerted(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.mark_alerted(user_id, body.get('appointmentId'))

# Emergency Contacts
@router.get("/emergency-contacts")
async def get_emergency_contacts(user_id: int = Depends(auth_user)):
    return await user_controller.get_emergency_contacts(user_id)

@router.post("/emergency-contacts/add")
async def add_emergency_contact(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.add_emergency_contact(user_id, body)

@router.post("/emergency-contacts/update")
async def update_emergency_contact(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    contact_id = body.get('contactId')
    if not contact_id:
        return {"success": False, "message": "contactId is required"}
    return await user_controller.update_emergency_contact(user_id, int(contact_id), body)

@router.post("/emergency-contacts/delete")
async def delete_emergency_contact(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    contact_id = body.get('contactId')
    if not contact_id:
        return {"success": False, "message": "contactId is required"}
    return await user_controller.delete_emergency_contact(user_id, int(contact_id))

# Video Consultation
from app.controllers import consultation_controller

@router.get("/video-consult-doctors")
async def get_video_consult_doctors(lat: float = None, lng: float = None, distance: str = 'all'):
    return await consultation_controller.get_video_consult_doctors(lat, lng, distance)

@router.post("/consultation/create")
async def create_consultation(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await consultation_controller.create_consultation(user_id, body)

@router.get("/consultations")
async def get_user_consultations(user_id: int = Depends(auth_user)):
    return await consultation_controller.get_user_consultations(user_id)

@router.get("/consultation/{consultationId}")
async def get_consultation(consultationId: int, user_id: int = Depends(auth_user)):
    return await consultation_controller.get_consultation(consultationId)

from app.controllers import call_session_controller

@router.post("/appointments/{appointmentId}/call/request")
async def request_video_call(appointmentId: int, user_id: int = Depends(auth_user)):
    return await call_session_controller.request_call(user_id, appointmentId)

@router.get("/appointments/{appointmentId}/call/status")
async def video_call_session_status(appointmentId: int, user_id: int = Depends(auth_user)):
    return await call_session_controller.get_call_status_for_user(user_id, appointmentId)

@router.post("/appointments/{appointmentId}/call/cancel")
async def cancel_video_call_request(appointmentId: int, user_id: int = Depends(auth_user)):
    return await call_session_controller.cancel_call_request(user_id, appointmentId)

@router.post("/appointments/{appointmentId}/agora-token")
async def get_appointment_agora_token(appointmentId: int, user_id: int = Depends(auth_user)):
    return await consultation_controller.get_agora_token_for_appointment(user_id, appointmentId)

@router.get("/appointments/{appointmentId}/video-call-status")
async def user_video_call_status(appointmentId: int, user_id: int = Depends(auth_user)):
    return await consultation_controller.get_video_call_status_for_user(user_id, appointmentId)

@router.post("/appointments/{appointmentId}/sync-call-timer")
async def user_sync_call_timer(appointmentId: int, user_id: int = Depends(auth_user)):
    return await consultation_controller.sync_call_timer_for_user(user_id, appointmentId)

@router.post("/appointments/{appointmentId}/end-video-call")
async def user_end_video_call(appointmentId: int, req: Request, user_id: int = Depends(auth_user)):
    body = {}
    if req.headers.get('content-type', '').startswith('application/json'):
        try:
            body = await req.json()
        except Exception:
            body = {}
    return await consultation_controller.end_video_call_for_user(user_id, appointmentId, body)


@router.get("/appointments/{appointmentId}/chat")
async def user_get_chat(appointmentId: int, after: int = 0, user_id: int = Depends(auth_user)):
    from app.controllers import vc_chat_controller
    return await vc_chat_controller.get_messages(appointmentId, after)


@router.post("/appointments/{appointmentId}/chat")
async def user_post_chat(appointmentId: int, req: Request, user_id: int = Depends(auth_user)):
    from app.controllers import vc_chat_controller
    from app.models import user_model
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    user = await user_model.get_user_by_id(user_id)
    name = (user or {}).get('name') if user else None
    return await vc_chat_controller.post_message(appointmentId, 'patient', name or 'Patient', body.get('text', ''))


@router.get("/notifications")
async def list_notifications(
    user_id: int = Depends(auth_user),
    limit: int = 50,
    offset: int = 0,
):
    return await user_controller.list_notifications(user_id, limit=limit, offset=offset)


@router.post("/notifications/read")
async def mark_notification_read(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.mark_notification_read(user_id, body.get("id"))


@router.post("/notifications/read-all")
async def mark_all_notifications_read(user_id: int = Depends(auth_user)):
    return await user_controller.mark_all_notifications_read(user_id)


@router.post("/fcm-token")
async def register_fcm_token(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.register_fcm_token(user_id, body)


@router.delete("/fcm-token")
async def remove_fcm_token(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await user_controller.remove_fcm_token(user_id, body)


@router.post("/telegram/link-code")
async def telegram_link_code(user_id: int = Depends(auth_user)):
    from app.controllers import telegram_link_controller

    return await telegram_link_controller.create_app_link_code(user_id)


@router.get("/telegram/status")
async def telegram_link_status(user_id: int = Depends(auth_user)):
    from app.controllers import telegram_link_controller

    return await telegram_link_controller.get_telegram_link_status(user_id)


@router.delete("/telegram/link")
async def telegram_unlink(user_id: int = Depends(auth_user)):
    from app.controllers import telegram_link_controller

    return await telegram_link_controller.unlink_telegram_from_app(user_id)
