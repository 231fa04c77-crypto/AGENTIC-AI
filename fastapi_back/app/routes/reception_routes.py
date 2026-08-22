from fastapi import APIRouter, Depends, Request
from app.controllers import reception_controller
from app.middleware.auth import auth_admin, auth_dean, auth_reception

router = APIRouter(prefix="/api/reception", tags=["Reception"])


# ── Auth ────────────────────────────────────────────────────────────────────
@router.post("/login")
async def reception_login(req: Request):
    body = await req.json()
    return await reception_controller.login(body)


def _hid(info: dict):
    return info.get("hospital_id")


# ── Dashboard ───────────────────────────────────────────────────────────────
@router.get("/dashboard")
async def dashboard(info: dict = Depends(auth_reception)):
    return await reception_controller.dashboard(_hid(info))


@router.get("/doctors")
async def doctors(info: dict = Depends(auth_reception)):
    return await reception_controller.doctors(_hid(info))


@router.get("/profile")
async def profile(info: dict = Depends(auth_reception)):
    return await reception_controller.profile(info["id"])


# ── Online bookings ─────────────────────────────────────────────────────────
@router.get("/online-bookings")
async def online_bookings(date: str | None = None, info: dict = Depends(auth_reception)):
    return await reception_controller.online_bookings(_hid(info), date)


@router.post("/appointments/{appointment_id}/verify")
async def verify(appointment_id: int, req: Request, info: dict = Depends(auth_reception)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    return await reception_controller.verify_appointment(appointment_id, info["id"], _hid(info), body.get("notes"))


@router.post("/appointments/{appointment_id}/arrive")
async def arrive(appointment_id: int, info: dict = Depends(auth_reception)):
    return await reception_controller.mark_arrived(appointment_id, info["id"], _hid(info))


@router.post("/appointments/{appointment_id}/generate-token")
async def generate_token(appointment_id: int, info: dict = Depends(auth_reception)):
    return await reception_controller.generate_token(appointment_id, info["id"], _hid(info))


@router.post("/appointments/{appointment_id}/no-show")
async def no_show(appointment_id: int, info: dict = Depends(auth_reception)):
    return await reception_controller.mark_no_show(appointment_id, info["id"], _hid(info))


@router.post("/appointments/{appointment_id}/collect-payment")
async def collect_payment(appointment_id: int, req: Request, info: dict = Depends(auth_reception)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    return await reception_controller.collect_payment(appointment_id, info["id"], _hid(info), body.get("method", "cash"))


@router.post("/appointments/{appointment_id}/refund-request")
async def refund_request(appointment_id: int, req: Request, info: dict = Depends(auth_reception)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    return await reception_controller.request_refund(appointment_id, info["id"], _hid(info), body.get("reason"))


@router.post("/appointments/{appointment_id}/use-followup")
async def use_followup(appointment_id: int, info: dict = Depends(auth_reception)):
    return await reception_controller.use_followup(appointment_id, info["id"], _hid(info))


@router.get("/consultation-summary/{appointment_id}")
async def consultation_summary(appointment_id: int, info: dict = Depends(auth_reception)):
    return await reception_controller.consultation_summary(appointment_id, _hid(info))


# ── Patients ────────────────────────────────────────────────────────────────
@router.get("/patients")
async def list_patients(date: str = "", info: dict = Depends(auth_reception)):
    return await reception_controller.list_patients(_hid(info), date or None)


@router.get("/patients/search")
async def patients_search(q: str = "", info: dict = Depends(auth_reception)):
    return await reception_controller.search_patients(q)


@router.post("/patients")
async def register_patient(req: Request, info: dict = Depends(auth_reception)):
    body = await req.json()
    return await reception_controller.register_patient(body)


# ── Walk-in ─────────────────────────────────────────────────────────────────
@router.post("/walk-in")
async def walk_in(req: Request, info: dict = Depends(auth_reception)):
    body = await req.json()
    return await reception_controller.walk_in(body, info["id"], _hid(info))


# ── QR / Booking-ID check-in ────────────────────────────────────────────────
@router.post("/check-in")
async def check_in(req: Request, info: dict = Depends(auth_reception)):
    body = await req.json()
    booking_id = body.get("bookingId") or body.get("booking_id") or ""
    return await reception_controller.scan_qr(
        booking_id, scanner_id=info["id"], scanner_role="receptionist", hospital_id=_hid(info),
    )


# ── Queue ───────────────────────────────────────────────────────────────────
@router.get("/queue")
async def queue(doctorId: int | None = None, date: str | None = None, info: dict = Depends(auth_reception)):
    return await reception_controller.queue(_hid(info), doctorId, date)


@router.post("/queue/{appointment_id}/action")
async def queue_action(appointment_id: int, req: Request, info: dict = Depends(auth_reception)):
    body = await req.json()
    return await reception_controller.queue_action(appointment_id, body.get("action", ""), info["id"], _hid(info))


@router.get("/doctor-status-events")
async def doctor_status_events(since: str | None = None, info: dict = Depends(auth_reception)):
    return await reception_controller.doctor_status_events(_hid(info), since)


# ── Follow-ups / Payments / Refunds / No-shows ──────────────────────────────
@router.get("/followups")
async def followups(info: dict = Depends(auth_reception)):
    return await reception_controller.followups(_hid(info))


@router.get("/payments")
async def payments(date: str | None = None, info: dict = Depends(auth_reception)):
    return await reception_controller.payments(_hid(info), date)


@router.get("/refund-requests")
async def refund_requests(info: dict = Depends(auth_reception)):
    return await reception_controller.refund_requests(_hid(info))


@router.get("/no-shows")
async def no_shows(info: dict = Depends(auth_reception)):
    return await reception_controller.no_shows(_hid(info))


# ── Manage receptionists (Dean — hospital scoped) ───────────────────────────
@router.get("/manage")
async def list_receptionists_dean(dean_info: dict = Depends(auth_dean)):
    return await reception_controller.list_receptionists(dean_info.get("hospital_id"))


@router.post("/manage")
async def create_receptionist_dean(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await reception_controller.create_receptionist(body, dean_info.get("hospital_id"))


@router.post("/manage/{rec_id}/toggle")
async def toggle_receptionist_dean(rec_id: int, req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await reception_controller.toggle_receptionist(rec_id, body.get("isActive", True), dean_info.get("hospital_id"))


@router.post("/manage/{rec_id}/reset-password")
async def reset_receptionist_dean(rec_id: int, req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await reception_controller.reset_receptionist_password(rec_id, body.get("newPassword", ""), dean_info.get("hospital_id"))


@router.delete("/manage/{rec_id}")
async def delete_receptionist_dean(rec_id: int, dean_info: dict = Depends(auth_dean)):
    return await reception_controller.delete_receptionist(rec_id, dean_info.get("hospital_id"))


# ── Manage receptionists (Admin — global) ───────────────────────────────────
@router.get("/manage/admin")
async def list_receptionists_admin(_email: str = Depends(auth_admin)):
    return await reception_controller.list_receptionists(None)


@router.post("/manage/admin")
async def create_receptionist_admin(req: Request, _email: str = Depends(auth_admin)):
    body = await req.json()
    return await reception_controller.create_receptionist(body, None)


@router.post("/manage/admin/{rec_id}/toggle")
async def toggle_receptionist_admin(rec_id: int, req: Request, _email: str = Depends(auth_admin)):
    body = await req.json()
    return await reception_controller.toggle_receptionist(rec_id, body.get("isActive", True))


@router.post("/manage/admin/{rec_id}/reset-password")
async def reset_receptionist_admin(rec_id: int, req: Request, _email: str = Depends(auth_admin)):
    body = await req.json()
    return await reception_controller.reset_receptionist_password(rec_id, body.get("newPassword", ""))


@router.delete("/manage/admin/{rec_id}")
async def delete_receptionist_admin(rec_id: int, _email: str = Depends(auth_admin)):
    return await reception_controller.delete_receptionist(rec_id)


# ── Legacy dean/admin scan + grace endpoints (unchanged) ────────────────────
@router.post("/scan")
async def scan_appointment(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    booking_id = body.get("bookingId") or body.get("booking_id") or ""
    return await reception_controller.scan_qr(
        booking_id, scanner_id=dean_info.get("id"), scanner_role="dean", hospital_id=dean_info.get("hospital_id"),
    )


@router.post("/scan/admin")
async def scan_appointment_admin(req: Request, _email: str = Depends(auth_admin)):
    body = await req.json()
    booking_id = body.get("bookingId") or body.get("booking_id") or ""
    hospital_id = body.get("hospitalId")
    return await reception_controller.scan_qr(
        booking_id, scanner_role="admin", hospital_id=int(hospital_id) if hospital_id else None,
    )


@router.get("/grace-requests")
async def grace_requests(info: dict = Depends(auth_reception)):
    return await reception_controller.list_grace_requests(_hid(info))


@router.get("/grace-requests/admin")
async def grace_requests_admin(_email: str = Depends(auth_admin)):
    return await reception_controller.list_grace_requests()


@router.get("/grace-requests/dean")
async def grace_requests_dean(dean_info: dict = Depends(auth_dean)):
    return await reception_controller.list_grace_requests(dean_info.get("hospital_id"))


@router.post("/grace-requests/{request_id}/approve")
async def approve_grace(request_id: int, req: Request, info: dict = Depends(auth_reception)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    return await reception_controller.approve_grace(
        request_id, info["id"], "receptionist", body.get("notes")
    )


@router.post("/grace-requests/{request_id}/reject")
async def reject_grace(request_id: int, req: Request, info: dict = Depends(auth_reception)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    return await reception_controller.reject_grace(
        request_id, info["id"], "receptionist", body.get("notes")
    )