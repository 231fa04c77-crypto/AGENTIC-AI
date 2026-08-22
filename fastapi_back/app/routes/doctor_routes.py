from fastapi import APIRouter, Depends, Request, UploadFile, File, Form
from app.controllers import doctor_controller, consultation_controller, doctor_slot_controller, vc_chat_controller
from app.middleware.auth import auth_doctor
from app.utils.auth_response import build_auth_response
from app.models import doctor_model
from app.utils.formatters import format_doctor
from typing import Optional

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])

@router.post("/login")
async def login_doctor(req: Request):
    body = await req.json()
    result = await doctor_controller.login_doctor(body)
    return build_auth_response(result, "doctor", req)

@router.get("/appointments")
async def appointments_doctor(doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.appointments_doctor(doc_id)

@router.post("/cancel-appointment")
async def appointment_cancel(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await doctor_controller.appointment_cancel(doc_id, body.get('appointmentId'))

@router.post("/reject-appointment")
async def appointment_reject(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await doctor_controller.appointment_cancel(doc_id, body.get('appointmentId'), body.get('reason'))

@router.post("/accept-appointment")
async def appointment_accept(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await doctor_controller.appointment_accept(doc_id, body.get('appointmentId'))

@router.post("/complete-appointment")
async def appointment_complete(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await doctor_controller.appointment_complete(doc_id, body.get('appointmentId'), body)

@router.get("/list")
async def doctor_list(
    hospitalId: Optional[int] = None,
    limit: Optional[int] = 100,
    offset: int = 0,
    q: Optional[str] = None,
):
    return await doctor_controller.doctor_list(hospitalId, limit=limit, offset=offset, q=q)

@router.get("/change-availability")
async def change_availability(doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.change_availability(doc_id)

@router.get("/profile")
async def doctor_profile(doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.doctor_profile(doc_id)

@router.post("/update-profile")
async def update_profile(
    fees: Optional[str] = Form(None),
    about: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    available: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    opStart: Optional[str] = Form(None),
    opEnd: Optional[str] = Form(None),
    opStartAfternoon: Optional[str] = Form(None),
    opEndAfternoon: Optional[str] = Form(None),
    maxAppointmentsMorning: Optional[str] = Form(None),
    maxAppointmentsAfternoon: Optional[str] = Form(None),
    videoOpStart: Optional[str] = Form(None),
    videoOpEnd: Optional[str] = Form(None),
    maxVideoSlots: Optional[str] = Form(None),
    videoSlotMinutes: Optional[str] = Form(None),
    availableDays: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    doc_id: int = Depends(auth_doctor)
):
    form_data = {
        "fees": fees,
        "about": about,
        "address": address,
        "available": available,
        "status": status,
        "opStart": opStart,
        "opEnd": opEnd,
        "opStartAfternoon": opStartAfternoon,
        "opEndAfternoon": opEndAfternoon,
        "maxAppointmentsMorning": maxAppointmentsMorning,
        "maxAppointmentsAfternoon": maxAppointmentsAfternoon,
        "videoOpStart": videoOpStart,
        "videoOpEnd": videoOpEnd,
        "maxVideoSlots": maxVideoSlots,
        "videoSlotMinutes": videoSlotMinutes,
        "availableDays": availableDays,
    }
    return await doctor_controller.update_doctor_profile(doc_id, form_data, image)


@router.get("/schedule/overrides")
async def list_schedule_overrides(doc_id: int = Depends(auth_doctor)):
    from app.services import schedule_ops_service
    return await schedule_ops_service.list_day_overrides(doc_id)


@router.post("/schedule/overrides")
async def upsert_schedule_override(req: Request, doc_id: int = Depends(auth_doctor)):
    from app.services import schedule_ops_service
    body = await req.json()
    return await schedule_ops_service.save_day_override(doc_id, body or {})


@router.delete("/schedule/overrides/{override_id}")
async def delete_schedule_override(override_id: int, doc_id: int = Depends(auth_doctor)):
    from app.services import schedule_ops_service
    return await schedule_ops_service.delete_day_override(doc_id, override_id)

@router.get("/dashboard")
async def doctor_dashboard(doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.doctor_dashboard(doc_id)

@router.post("/update-status")
async def update_doctor_status(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await doctor_controller.update_doctor_status(doc_id, body)

@router.get("/in-queue")
async def get_in_queue(req: Request, doc_id: int = Depends(auth_doctor)):
    slot_date = req.query_params.get('slotDate')
    return await doctor_controller.get_in_queue(doc_id, slot_date)

@router.get("/patients/search")
async def search_patients(q: str = "", doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.search_patients(q)

@router.get("/patients/{userId}/history")
async def get_patient_history_by_user_id(userId: int, doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.get_patient_history_by_user_id(doc_id, userId)



@router.get("/appointments/{appointmentId}")
async def get_appointment_detail(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.get_appointment_detail(doc_id, appointmentId)

@router.get("/queue-status")
async def get_queue_status(req: Request, doc_id: int = Depends(auth_doctor)):
    slot_date = req.query_params.get('slotDate')
    return await doctor_controller.get_queue_status(doc_id, slot_date)

@router.post("/start-consultation")
async def start_consultation(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await doctor_controller.start_consultation(doc_id, body.get('appointmentId'))

@router.post("/end-consultation")
async def end_consultation(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await doctor_controller.end_consultation(doc_id, body)

@router.get("/consultations")
async def doctor_consultations(doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.doctor_consultations(doc_id)

@router.get("/consultation/{consultationId}")
async def get_consultation_details(consultationId: int, doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.get_consultation_details(doc_id, consultationId)

@router.get("/appointments/{appointmentId}/patient-history")
async def get_patient_history(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await doctor_controller.get_patient_history_for_doctor(doc_id, appointmentId)

@router.get("/patient-records/{appointmentId}")
async def get_patient_records(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    from app.controllers import health_record_controller
    return await health_record_controller.get_patient_records_for_doctor(doc_id, appointmentId)

@router.post("/patient-records/{recordId}/viewed")
async def mark_record_as_viewed(recordId: int, doc_id: int = Depends(auth_doctor)):
    from app.controllers import health_record_controller
    return await health_record_controller.mark_record_as_viewed(doc_id, recordId)

from app.controllers import call_session_controller

@router.get("/call/incoming")
async def doctor_incoming_calls(doc_id: int = Depends(auth_doctor)):
    return await call_session_controller.list_incoming_calls(doc_id)

@router.post("/appointments/{appointmentId}/call/accept")
async def doctor_accept_call(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await call_session_controller.accept_call(doc_id, appointmentId)

@router.post("/appointments/{appointmentId}/call/reject")
async def doctor_reject_call(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await call_session_controller.reject_call(doc_id, appointmentId)

@router.post("/appointments/{appointmentId}/call/busy")
async def doctor_busy_call(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await call_session_controller.busy_call(doc_id, appointmentId)

@router.post("/appointments/{appointmentId}/agora-token")
async def doctor_agora_token(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await consultation_controller.get_agora_token_for_doctor_appointment(doc_id, appointmentId)

@router.get("/appointments/{appointmentId}/video-call-status")
async def doctor_video_call_status(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await consultation_controller.get_video_call_status_for_doctor(doc_id, appointmentId)

@router.post("/appointments/{appointmentId}/sync-call-timer")
async def doctor_sync_call_timer(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await consultation_controller.sync_call_timer_for_doctor(doc_id, appointmentId)

@router.post("/appointments/{appointmentId}/save-consultation")
async def doctor_save_consultation(appointmentId: int, req: Request, doc_id: int = Depends(auth_doctor)):
    body = {}
    if req.headers.get('content-type', '').startswith('application/json'):
        try:
            body = await req.json()
        except Exception:
            body = {}
    return await consultation_controller.save_consultation_for_doctor(doc_id, appointmentId, body)

@router.get("/appointments/{appointmentId}/consultation")
async def doctor_get_consultation(appointmentId: int, doc_id: int = Depends(auth_doctor)):
    return await consultation_controller.get_consultation_for_doctor(doc_id, appointmentId)

@router.post("/appointments/{appointmentId}/publish-prescription")
async def doctor_publish_prescription(appointmentId: int, req: Request, doc_id: int = Depends(auth_doctor)):
    body = {}
    if req.headers.get('content-type', '').startswith('application/json'):
        try:
            body = await req.json()
        except Exception:
            body = {}
    return await consultation_controller.publish_prescription_for_doctor(doc_id, appointmentId, body)

@router.post("/appointments/{appointmentId}/end-video-call")
async def doctor_end_video_call(appointmentId: int, req: Request, doc_id: int = Depends(auth_doctor)):
    body = {}
    if req.headers.get('content-type', '').startswith('application/json'):
        try:
            body = await req.json()
        except Exception:
            body = {}
    return await consultation_controller.end_video_call_for_doctor(doc_id, appointmentId, body)

@router.get("/appointments/{appointmentId}/chat")
async def doctor_get_chat(appointmentId: int, after: int = 0, doc_id: int = Depends(auth_doctor)):
    return await vc_chat_controller.get_messages(appointmentId, after)

@router.post("/appointments/{appointmentId}/chat")
async def doctor_post_chat(appointmentId: int, req: Request, doc_id: int = Depends(auth_doctor)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    doctor = await doctor_model.get_doctor_by_id(doc_id)
    name = (doctor or {}).get('name') if doctor else None
    return await vc_chat_controller.post_message(appointmentId, 'doctor', name or 'Doctor', body.get('text', ''))

@router.get("/specialist-referrals")
async def specialist_referrals(doc_id: int = Depends(auth_doctor)):
    from app.models import referral_model

    rows = await referral_model.get_referrals_for_specialist(doc_id)
    referrals = []
    for row in rows or []:
        item = dict(row)
        for field in ("created_at", "updated_at", "appointment_date"):
            val = item.get(field)
            if val and hasattr(val, "isoformat"):
                item[field] = val.isoformat()
        referrals.append(item)
    return {"success": True, "referrals": referrals}


@router.get("/notifications")
async def doctor_notifications(doc_id: int = Depends(auth_doctor), limit: int = 20):
    from app.models import notification_model

    notes = await notification_model.list_for_doctor(doc_id, limit=min(limit, 50))
    for n in notes:
        created = n.get("created_at")
        if created and hasattr(created, "isoformat"):
            n["created_at"] = created.isoformat()
    return {"success": True, "notifications": notes}


@router.post("/referrals/{referral_id}/accept")
async def accept_specialist_referral(referral_id: int, doc_id: int = Depends(auth_doctor)):
    from app.models import referral_model, order_event_model
    from app.services.journey_notify import notify_patient, notify_doctor
    from app.services.order_monitoring_service import run_order_monitoring_cycle
    import asyncio

    order = await referral_model.get_referral_by_id(referral_id)
    if not order:
        return {"success": False, "message": "Referral not found"}
    if int(order.get("assigned_to") or 0) != int(doc_id):
        return {"success": False, "message": "Not authorized for this referral"}
    if str(order.get("status") or "").upper() != "PENDING":
        return {"success": False, "message": "Referral is not pending acceptance"}

    updated = await referral_model.update_referral(referral_id, {"status": "ACCEPTED"})
    await order_event_model.create_order_event(
        entity_type="referral",
        entity_id=referral_id,
        event_type="REFERRAL_ACCEPTED",
        payload={"old_status": "PENDING", "new_status": "ACCEPTED", "actor_role": "doctor"},
    )

    spec = await doctor_model.get_doctor_by_id(doc_id)
    ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
    from app.models import user_model

    patient = await user_model.get_user_by_id(int(order["patient_id"]))
    pname = (patient or {}).get("name") or "Patient"
    sname = (spec or {}).get("name") or "Specialist"

    await notify_patient(
        int(order["patient_id"]),
        "Referral accepted",
        f"Your referral to {sname} has been accepted. You can now book a specialist appointment.",
        {"type": "referral", "id": str(referral_id)},
    )
    if ref_doc:
        await notify_doctor(
            int(order["ordered_by"]),
            "Referral accepted",
            f"Referral for {pname} was accepted by {sname}.",
            {"type": "referral", "referralId": str(referral_id)},
        )

    asyncio.create_task(run_order_monitoring_cycle())
    return {"success": True, "referral": dict(updated) if updated else None}


@router.post("/referrals/{referral_id}/reject")
async def reject_specialist_referral(referral_id: int, req: Request, doc_id: int = Depends(auth_doctor)):
    from app.models import referral_model, order_event_model, user_model
    from app.services.journey_notify import notify_patient, notify_doctor
    from app.services.order_monitoring_service import run_order_monitoring_cycle
    import asyncio

    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}

    order = await referral_model.get_referral_by_id(referral_id)
    if not order:
        return {"success": False, "message": "Referral not found"}
    if int(order.get("assigned_to") or 0) != int(doc_id):
        return {"success": False, "message": "Not authorized for this referral"}
    if str(order.get("status") or "").upper() != "PENDING":
        return {"success": False, "message": "Referral is not pending"}

    notes = body.get("notes") or body.get("reason")
    update_data: dict = {"status": "REJECTED"}
    if notes:
        update_data["notes"] = notes

    updated = await referral_model.update_referral(referral_id, update_data)
    await order_event_model.create_order_event(
        entity_type="referral",
        entity_id=referral_id,
        event_type="REFERRAL_REJECTED",
        payload={"old_status": "PENDING", "new_status": "REJECTED", "actor_role": "doctor"},
    )

    ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
    patient = await user_model.get_user_by_id(int(order["patient_id"]))
    pname = (patient or {}).get("name") or "Patient"

    await notify_patient(
        int(order["patient_id"]),
        "Referral update",
        "Your specialist referral was declined. Your care team will coordinate next steps.",
        {"type": "referral", "id": str(referral_id)},
    )
    if ref_doc:
        spec = await doctor_model.get_doctor_by_id(doc_id)
        sname = (spec or {}).get("name") or "Specialist"
        await notify_doctor(
            int(order["ordered_by"]),
            "Referral declined",
            f"{sname} declined the referral for {pname}.",
            {"type": "referral", "referralId": str(referral_id)},
        )

    asyncio.create_task(run_order_monitoring_cycle())
    return {"success": True, "referral": dict(updated) if updated else None}


@router.post("/referrals/{referral_id}/complete")
async def complete_specialist_referral(referral_id: int, doc_id: int = Depends(auth_doctor)):
    from app.models import referral_model, order_event_model, user_model
    from app.services.journey_notify import notify_patient, notify_doctor
    from app.services.order_monitoring_service import run_order_monitoring_cycle
    import asyncio

    order = await referral_model.get_referral_by_id(referral_id)
    if not order:
        return {"success": False, "message": "Referral not found"}
    if int(order.get("assigned_to") or 0) != int(doc_id):
        return {"success": False, "message": "Not authorized for this referral"}

    updated = await referral_model.update_referral(referral_id, {"status": "COMPLETED"})
    await order_event_model.create_order_event(
        entity_type="referral",
        entity_id=referral_id,
        event_type="REFERRAL_COMPLETED",
        payload={"new_status": "COMPLETED", "actor_role": "doctor"},
    )

    ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
    patient = await user_model.get_user_by_id(int(order["patient_id"]))
    pname = (patient or {}).get("name") or "Patient"

    await notify_patient(
        int(order["patient_id"]),
        "Specialist consultation completed",
        "Your specialist consultation has been completed.",
        {"type": "referral", "id": str(referral_id)},
    )
    if ref_doc:
        await notify_doctor(
            int(order["ordered_by"]),
            "Specialist consultation completed",
            f"Specialist consultation completed for your referred patient {pname}.",
            {"type": "referral", "referralId": str(referral_id)},
        )

    asyncio.create_task(run_order_monitoring_cycle())
    return {"success": True, "referral": dict(updated) if updated else None}


@router.get("/{doctor_id}/slots")
async def get_doctor_schedule_slots(doctor_id: str, mode: str = "offline"):
    from fastapi.responses import JSONResponse

    data = await doctor_slot_controller.get_doctor_slots(doctor_id, mode)
    return JSONResponse(
        content=data,
        headers={"Cache-Control": "public, max-age=60"},
    )

# Public doctor details endpoint. Supports numeric ids and embedded ids like "emb_56".
@router.get("/{docId}")
async def get_doctor_by_id(docId: str):
    doctor = await doctor_model.get_doctor_by_id(docId)
    if not doctor:
        return {"success": False, "message": "Doctor not found"}
    return {"success": True, "doctor": format_doctor(doctor)}
