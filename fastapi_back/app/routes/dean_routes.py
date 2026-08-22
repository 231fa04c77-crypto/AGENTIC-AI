from fastapi import APIRouter, Depends, Request, Form, UploadFile, File
from app.controllers import dean_controller
from app.middleware.auth import auth_dean
from app.utils.auth_response import build_auth_response
from typing import Optional

router = APIRouter(prefix="/api/dean", tags=["DEAN - Hospital Controller"])

# ── Auth ──────────────────────────────────────────────────────────────────────
@router.post("/login")
async def dean_login(req: Request):
    body = await req.json()
    result = await dean_controller.login_dean(body)
    return build_auth_response(result, "dean", req)

# ── Dashboard ─────────────────────────────────────────────────────────────────
@router.get("/dashboard")
async def dean_dashboard(dean_info: dict = Depends(auth_dean)):
    return await dean_controller.dean_dashboard(dean_info["hospital_id"])

# ── Hospital Info ─────────────────────────────────────────────────────────────
@router.get("/hospital")
async def get_hospital(dean_info: dict = Depends(auth_dean)):
    return await dean_controller.get_hospital(dean_info["hospital_id"])

@router.put("/hospital/update")
async def update_hospital(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.update_hospital(dean_info["hospital_id"], body)

# ── Doctor Management (scoped to hospital) ────────────────────────────────────
@router.get("/doctors")
async def get_doctors(dean_info: dict = Depends(auth_dean)):
    return await dean_controller.get_hospital_doctors(dean_info["hospital_id"])

@router.post("/doctors/add")
async def add_hospital_doctor(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.add_hospital_doctor(dean_info["hospital_id"], body)

@router.put("/doctors/update")
async def update_hospital_doctor(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.update_hospital_doctor(
        dean_info["hospital_id"], body.get("doctorId"), body.get("doctorData", {})
    )

@router.post("/doctors/delete")
async def delete_hospital_doctor(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.delete_hospital_doctor(
        dean_info["hospital_id"], body.get("doctorId")
    )

@router.post("/doctors/availability")
async def change_doctor_availability(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.change_doctor_availability(
        dean_info["hospital_id"], body.get("doctorId")
    )

@router.post("/doctors/reset-password")
async def reset_doctor_password(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.reset_doctor_credentials(
        dean_info["hospital_id"], body.get("doctorId"), body.get("newPassword")
    )

@router.post("/doctors/toggle-status")
async def toggle_doctor_status(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.toggle_doctor_account_status(
        dean_info["hospital_id"], body.get("doctorId")
    )

# ── Appointment Management (scoped to hospital) ───────────────────────────────
@router.get("/appointments")
async def get_appointments(dean_info: dict = Depends(auth_dean)):
    return await dean_controller.get_hospital_appointments(dean_info["hospital_id"])

@router.post("/appointments/cancel")
async def cancel_appointment(req: Request, dean_info: dict = Depends(auth_dean)):
    body = await req.json()
    return await dean_controller.cancel_appointment(
        dean_info["hospital_id"], body.get("appointmentId")
    )


@router.post("/hospital/close-day")
async def mark_hospital_closed_day(req: Request, dean_info: dict = Depends(auth_dean)):
    """Mark a date closed: notify booked patients, offer reschedule, deadline auto-cancel."""
    from datetime import date as date_cls
    from app.services import schedule_ops_service
    body = await req.json()
    raw = (body.get("date") or body.get("closedDate") or "").strip()
    if not raw:
        return {"success": False, "message": "date is required (YYYY-MM-DD)"}
    try:
        closed = date_cls.fromisoformat(raw[:10])
    except ValueError:
        return {"success": False, "message": "Invalid date"}
    return await schedule_ops_service.mark_hospital_closed_day(
        int(dean_info["hospital_id"]),
        closed,
        reason=str(body.get("reason") or "Hospital closed"),
        deadline_hours=int(body.get("deadlineHours") or 12),
    )


@router.get("/patients")
async def get_patients(dean_info: dict = Depends(auth_dean)):
    return await dean_controller.get_hospital_patients(dean_info["hospital_id"])

@router.get("/revenue-analytics")
async def get_hospital_revenue_analytics(dean_info: dict = Depends(auth_dean)):
    return await dean_controller.get_hospital_revenue_analytics(dean_info["hospital_id"])
