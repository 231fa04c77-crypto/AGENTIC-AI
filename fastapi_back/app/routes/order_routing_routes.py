from fastapi import APIRouter, Depends, Request, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from typing import Optional, Dict, Any, List
from jose import jwt
from datetime import date, datetime
import httpx

from app.config.config import settings
from app.config.db import db
from app.models import (
    investigation_model,
    referral_model,
    followup_model,
    order_event_model,
    order_finding_model,
    doctor_model,
    user_model,
)
from app.middleware.auth import auth_doctor, auth_user
from app.utils.order_helpers import is_investigation_pending_review

router = APIRouter(prefix="/api", tags=["Order Routing & Queues"])


async def _log_investigation_event(
    inv_id: int,
    event_type: str,
    actor: Dict[str, Any],
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    body = dict(payload or {})
    body["actor_id"] = actor.get("id")
    body["actor_role"] = actor.get("role")
    await order_event_model.create_order_event(
        entity_type="investigation",
        entity_id=inv_id,
        event_type=event_type,
        payload=body,
    )

# Unified Staff Auth Dependency
async def auth_staff_role(request: Request) -> Dict[str, Any]:
    # Look for headers
    token_str = (
        request.headers.get("token")
        or request.headers.get("Token")
        or request.headers.get("dtoken")
        or request.headers.get("dToken")
        or request.headers.get("rectoken")
        or request.headers.get("deantoken")
        or request.headers.get("Authorization")
    )
    
    if token_str and token_str.startswith("Bearer "):
        token_str = token_str[7:]
        
    if not token_str:
        raise HTTPException(status_code=401, detail="Authentication token missing")
        
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        role = (payload.get("role") or "patient").strip().lower()
        if role == "patient":
            raise HTTPException(status_code=403, detail="Staff access required")
        
        # Get id and hospital_id
        actor_id = payload.get("id") or payload.get("userId")
        hospital_id = payload.get("hospital_id")
        
        return {
            "id": int(actor_id) if actor_id is not None else None,
            "role": role,
            "hospital_id": int(hospital_id) if hospital_id is not None else None,
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _token_from_request(request: Request) -> Optional[str]:
    token_str = (
        request.headers.get("token")
        or request.headers.get("Token")
        or request.headers.get("dtoken")
        or request.headers.get("dToken")
        or request.headers.get("rectoken")
        or request.headers.get("deantoken")
    )
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            token_str = auth_header[7:] if auth_header.startswith("Bearer ") else auth_header
    if not token_str:
        token_str = request.query_params.get("token") or request.query_params.get("dtoken")
    return token_str


def _decode_token_actor(token_str: str) -> Dict[str, Any]:
    secret = settings.JWT_SECRET.strip('"').strip("'")
    payload = jwt.decode(token_str, secret, algorithms=["HS256"])
    role = (payload.get("role") or "patient").strip().lower()
    actor_id = payload.get("id") or payload.get("userId")
    if actor_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    hospital_id = payload.get("hospital_id")
    return {
        "id": int(actor_id),
        "role": role,
        "hospital_id": int(hospital_id) if hospital_id is not None else None,
    }


async def _authorize_investigation_report(actor: Dict[str, Any], order: Dict[str, Any]) -> None:
    """RBAC for investigation report files — one stored file, role-based access."""
    role = actor.get("role") or ""
    patient_id = int(order["patient_id"])
    status = str(order.get("status") or "").upper()

    if role == "patient":
        if actor["id"] != patient_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this report")
        if status not in ("REPORT_AVAILABLE", "REVIEWED"):
            raise HTTPException(status_code=403, detail="Report is not yet published")
        return

    if role == "doctor":
        if int(order.get("ordered_by") or 0) != actor["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this report")
        if status not in ("TEST_PERFORMED", "REPORT_AVAILABLE", "REVIEWED"):
            raise HTTPException(status_code=404, detail="Report not available")
        return

    if role in {"receptionist", "lab", "admin", "dean", "assistant"}:
        if not order.get("report_url"):
            raise HTTPException(status_code=404, detail="Report not uploaded")
        return

    raise HTTPException(status_code=403, detail="Not authorized to access this report")


def _report_content_type(report_url: str) -> str:
    lower = (report_url or "").lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return "image/jpeg"
    return "application/pdf"

async def get_hospital_id_for_actor(actor: Dict[str, Any]) -> Optional[int]:
    if actor["role"] == "doctor" and actor["id"] is not None:
        doc = await doctor_model.get_doctor_by_id(actor["id"])
        if doc:
            try:
                return int(doc.get("hospital_id")) if doc.get("hospital_id") is not None else None
            except (ValueError, TypeError):
                return None
    return actor.get("hospital_id")


# ─── ORDER CREATION ENDPOINTS (Doctors Only) ───────────────────────────

@router.post("/investigations")
async def create_investigation_endpoint(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    test_name = body.get("testName") or body.get("test_name")
    patient_id = body.get("patientId") or body.get("patient_id")
    priority = body.get("priority", "ROUTINE")
    notes = body.get("notes")

    if not test_name or not patient_id:
        raise HTTPException(status_code=400, detail="test_name and patient_id are required")

    # Fetch doctor details to resolve hospital_id
    doc = await doctor_model.get_doctor_by_id(doc_id)
    hospital_id = None
    if doc:
        try:
            hospital_id = int(doc.get("hospital_id")) if doc.get("hospital_id") is not None else None
        except (ValueError, TypeError):
            hospital_id = None

    order = await investigation_model.create_investigation(
        patient_id=int(patient_id),
        ordered_by=doc_id,
        hospital_id=hospital_id,
        test_name=test_name,
        priority=priority,
        notes=notes,
    )

    if not order:
        raise HTTPException(status_code=500, detail="Failed to create investigation order")

    # Emit event
    await order_event_model.create_order_event(
        entity_type="investigation",
        entity_id=order["id"],
        event_type="ORDER_CREATED",
        payload={"status": "ORDERED", "test_name": test_name, "priority": priority},
    )
    from app.models import care_decision_model
    from app.services.journey_notify import notify_patient
    try:
        await care_decision_model.upsert(int(patient_id), investigation_required=True, decided_by=doc_id)
    except Exception:
        pass
    await notify_patient(
        int(patient_id),
        "Investigation ordered",
        f"Your doctor requested {test_name}. The lab will process this test.",
        {"type": "investigation", "id": str(order["id"])},
    )

    return {"success": True, "investigation": dict(order)}


@router.post("/referrals")
async def create_referral_endpoint(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    patient_id = body.get("patientId") or body.get("patient_id")
    to_dept = body.get("toDept") or body.get("to_dept")
    from_dept = body.get("fromDept") or body.get("from_dept")
    reason = body.get("reason")
    notes = body.get("notes")
    specialist_id = body.get("specialistDoctorId") or body.get("specialist_doctor_id") or body.get("assigned_to") or body.get("assignedTo")

    if not to_dept or not reason or not patient_id:
        raise HTTPException(status_code=400, detail="patient_id, to_dept, and reason are required")
    if not specialist_id:
        raise HTTPException(status_code=400, detail="specialistDoctorId is required — select a specialist doctor")

    specialist = await doctor_model.get_doctor_by_id(int(specialist_id))
    if not specialist:
        raise HTTPException(status_code=400, detail="Specialist doctor not found")
    if int(specialist_id) == int(doc_id):
        raise HTTPException(status_code=400, detail="Cannot refer to yourself")

    doc = await doctor_model.get_doctor_by_id(doc_id)
    hospital_id = None
    if doc:
        try:
            hospital_id = int(doc.get("hospital_id")) if doc.get("hospital_id") is not None else None
        except (ValueError, TypeError):
            hospital_id = None

    patient = await user_model.get_user_by_id(int(patient_id))
    patient_name = (patient or {}).get("name") or f"Patient #{patient_id}"

    order = await referral_model.create_referral(
        patient_id=int(patient_id),
        ordered_by=doc_id,
        hospital_id=hospital_id,
        from_dept=from_dept or (doc or {}).get("speciality"),
        to_dept=to_dept,
        reason=reason,
        notes=notes,
        assigned_to=int(specialist_id),
    )

    if not order:
        raise HTTPException(status_code=500, detail="Failed to create referral order")

    await order_event_model.create_order_event(
        entity_type="referral",
        entity_id=order["id"],
        event_type="REFERRAL_CREATED",
        payload={
            "status": "PENDING",
            "to_dept": to_dept,
            "from_dept": from_dept,
            "assigned_to": int(specialist_id),
            "specialist_name": specialist.get("name"),
        },
    )
    from app.models import care_decision_model
    from app.services.journey_notify import notify_patient, notify_doctor

    try:
        await care_decision_model.upsert(
            int(patient_id), referral_required=True, specialist_required=True, decided_by=doc_id
        )
    except Exception:
        pass

    referring_name = (doc or {}).get("name") or "Doctor"
    spec_name = specialist.get("name") or "Specialist"
    spec_dept = specialist.get("speciality") or to_dept

    await notify_patient(
        int(patient_id),
        "Specialist referral created",
        f"You have been referred to {spec_name} ({spec_dept}).",
        {"type": "referral", "id": str(order["id"])},
    )
    await notify_doctor(
        int(specialist_id),
        "New patient referral",
        f"Patient {patient_name} was referred by {referring_name}. Specialization: {spec_dept}. Reason: {reason}",
        {"type": "referral", "referralId": str(order["id"]), "patientId": str(patient_id)},
    )

    import asyncio
    from app.services.order_monitoring_service import run_order_monitoring_cycle
    asyncio.create_task(run_order_monitoring_cycle())

    enriched = dict(order)
    enriched["specialist_name"] = spec_name
    enriched["referring_doctor_name"] = referring_name
    return {"success": True, "referral": enriched}


@router.post("/followups")
async def create_followup_endpoint(req: Request, doc_id: int = Depends(auth_doctor)):
    body = await req.json()
    patient_id = body.get("patientId") or body.get("patient_id")
    due_date_str = body.get("dueDate") or body.get("due_date")
    reason = body.get("reason")
    notes = body.get("notes")
    instructions = body.get("instructions")

    if not patient_id or not due_date_str:
        raise HTTPException(status_code=400, detail="patient_id and due_date are required")

    if not reason and not instructions:
        raise HTTPException(status_code=400, detail="reason is required")

    try:
        due_date = date.fromisoformat(due_date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="due_date must be in YYYY-MM-DD format")

    if due_date < date.today():
        raise HTTPException(status_code=400, detail="Follow-up date cannot be in the past")

    doc = await doctor_model.get_doctor_by_id(doc_id)
    hospital_id = None
    if doc:
        try:
            hospital_id = int(doc.get("hospital_id")) if doc.get("hospital_id") is not None else None
        except (ValueError, TypeError):
            hospital_id = None

    primary_reason = reason or instructions

    order = await followup_model.create_followup(
        patient_id=int(patient_id),
        ordered_by=doc_id,
        hospital_id=hospital_id,
        due_date=due_date,
        reason=primary_reason,
        notes=notes,
        instructions=primary_reason,
    )

    if not order:
        raise HTTPException(status_code=500, detail="Failed to create followup order")

    await order_event_model.create_order_event(
        entity_type="followup",
        entity_id=order["id"],
        event_type="FOLLOWUP_CREATED",
        payload={"status": "SCHEDULED", "due_date": due_date_str},
    )
    from app.services.journey_notify import notify_patient
    await notify_patient(
        int(patient_id),
        "Follow-up scheduled",
        f"Your follow-up is scheduled for {due_date_str}.",
        {"type": "followup", "id": str(order["id"])},
    )

    import asyncio
    from app.services.order_monitoring_service import run_order_monitoring_cycle
    asyncio.create_task(run_order_monitoring_cycle())

    return {"success": True, "followup": dict(order)}


@router.post("/care-decisions")
async def upsert_care_decision(req: Request, doc_id: int = Depends(auth_doctor)):
    from app.models import care_decision_model

    body = await req.json()
    patient_id = body.get("patientId") or body.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    row = await care_decision_model.upsert(
        int(patient_id),
        investigation_required=body.get("investigationRequired", body.get("investigation_required")),
        referral_required=body.get("referralRequired", body.get("referral_required")),
        specialist_required=body.get("specialistRequired", body.get("specialist_required")),
        treatment_notes=body.get("treatmentNotes") or body.get("treatment_notes"),
        decided_by=doc_id,
    )
    return {"success": True, "decision": row}


# ─── QUEUE ENDPOINTS (Role / Hospital Guarded) ─────────────────────────

@router.get("/lab/queue")
async def get_lab_queue_endpoint(
    status: Optional[str] = None,
    actor: Dict[str, Any] = Depends(auth_staff_role),
):
    hospital_id = await get_hospital_id_for_actor(actor)
    queue = await investigation_model.get_lab_queue(hospital_id=hospital_id, status=status)
    return {"success": True, "queue": [dict(x) for x in queue]}


@router.get("/referrals/queue")
async def get_referrals_queue_endpoint(actor: Dict[str, Any] = Depends(auth_staff_role)):
    hospital_id = await get_hospital_id_for_actor(actor)
    queue = await referral_model.get_referrals_queue(hospital_id=hospital_id)
    return {"success": True, "queue": [dict(x) for x in queue]}


@router.get("/appointments/queue")
async def get_appointments_queue_endpoint(actor: Dict[str, Any] = Depends(auth_staff_role)):
    hospital_id = await get_hospital_id_for_actor(actor)
    queue = await followup_model.get_followups_queue(hospital_id=hospital_id)
    return {"success": True, "queue": [dict(x) for x in queue]}


# ─── STATUS UPDATE PATCH ENDPOINTS ───────────────────────────────────────

@router.patch("/investigations/{id}")
async def update_investigation_endpoint(id: int, req: Request, actor: Dict[str, Any] = Depends(auth_staff_role)):
    body = await req.json()
    status = body.get("status")
    assigned_to = body.get("assigned_to") or body.get("assignedTo")
    result_summary = body.get("result_summary") or body.get("resultSummary") or body.get("results")
    review_notes = body.get("review_notes") or body.get("reviewNotes") or body.get("clinicalNotes")
    next_step = body.get("next_step") or body.get("nextStep")
    report_review_status = body.get("report_review_status") or body.get("reportReviewStatus")

    order = await investigation_model.get_investigation_by_id(id)
    if not order:
        raise HTTPException(status_code=404, detail="Investigation order not found")

    old_status = order["status"]
    update_data: Dict[str, Any] = {}

    if status:
        if status == "ACCEPTED" and old_status not in ("ORDERED",):
            raise HTTPException(status_code=400, detail="Only ORDERED investigations can be accepted")
        if status == "TEST_PERFORMED" and old_status not in ("ACCEPTED", "SAMPLE_COLLECTED"):
            raise HTTPException(status_code=400, detail="Investigation must be accepted before marking test performed")
        if status == "REPORT_AVAILABLE":
            raise HTTPException(status_code=400, detail="Use POST /investigations/{id}/publish after uploading a report")
        update_data["status"] = status
        if status == "ACCEPTED":
            update_data["accepted_by"] = actor.get("id")
            update_data["accepted_at"] = datetime.now()
        if status == "REVIEWED":
            update_data["reviewed_at"] = datetime.now()
            update_data["reviewed_by"] = actor.get("id")
            update_data["report_review_status"] = "REVIEWED"

    if report_review_status:
        rrs = str(report_review_status).upper()
        if rrs not in ("PENDING", "REVIEWED"):
            raise HTTPException(status_code=400, detail="report_review_status must be PENDING or REVIEWED")
        update_data["report_review_status"] = rrs
        if rrs == "REVIEWED":
            update_data["reviewed_at"] = datetime.now()
            update_data["reviewed_by"] = actor.get("id")
            if not status:
                update_data["status"] = "REVIEWED"

    if assigned_to:
        update_data["assigned_to"] = int(assigned_to)
    if result_summary is not None:
        update_data["result_summary"] = result_summary
    if review_notes is not None:
        update_data["review_notes"] = review_notes
    if next_step:
        update_data["next_step"] = str(next_step).upper()[:32]

    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")

    updated = await investigation_model.update_investigation(id, update_data)

    if status == "ACCEPTED" and old_status != "ACCEPTED":
        await _log_investigation_event(id, "INVESTIGATION_ACCEPTED", actor, {"old_status": old_status, "new_status": "ACCEPTED"})
    elif status and status != old_status:
        evt = "TEST_PERFORMED" if status == "TEST_PERFORMED" else "STATUS_CHANGED"
        await _log_investigation_event(id, evt, actor, {"old_status": old_status, "new_status": status})
    elif str(report_review_status or "").upper() == "REVIEWED":
        await _log_investigation_event(id, "REPORT_REVIEWED", actor, {"report_review_status": "REVIEWED"})

    if str(report_review_status or "").upper() == "REVIEWED" or status == "REVIEWED":
        from app.services import patient_journey_service
        try:
            await patient_journey_service.verify_and_close_stale_findings(patient_id=int(order["patient_id"]))
        except Exception:
            pass

    if status == "REVIEWED" and str(next_step or "").upper() == "TREATMENT":
        from app.models import care_decision_model
        try:
            await care_decision_model.upsert(
                int(order["patient_id"]),
                referral_required=False,
                specialist_required=False,
                treatment_notes=review_notes,
                decided_by=actor.get("id"),
            )
        except Exception:
            pass

    return {"success": True, "investigation": dict(updated)}


@router.post("/investigations/{id}/report")
async def upload_investigation_report(
    id: int,
    file: UploadFile = File(...),
    actor: Dict[str, Any] = Depends(auth_staff_role),
):
    await investigation_model.ensure_investigation_columns()
    from app.services.cloudinary_folders import patient_reports_folder
    from app.utils.upload_safe import UploadRejected, cloudinary_upload_bytes, read_upload_limited

    order = await investigation_model.get_investigation_by_id(id)
    if not order:
        raise HTTPException(status_code=404, detail="Investigation order not found")
    if str(order.get("status") or "").upper() != "TEST_PERFORMED":
        raise HTTPException(status_code=400, detail="Report upload is allowed only when status is TEST_PERFORMED")

    try:
        file_content, fname, ctype = await read_upload_limited(file)
    except UploadRejected as e:
        raise HTTPException(status_code=400, detail=e.message)

    patient = await user_model.get_user_by_id(int(order["patient_id"]))
    folder = patient_reports_folder(patient, user_id=int(order["patient_id"]))
    resource_type = "raw" if (ctype or "").lower().startswith("application/pdf") else "image"
    try:
        upload_result = await cloudinary_upload_bytes(
            file_content,
            folder=folder,
            resource_type=resource_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report upload failed: {type(e).__name__}")

    report_url = upload_result.get("secure_url")
    public_id = upload_result.get("public_id")
    if not report_url:
        raise HTTPException(status_code=500, detail="Storage did not return a report URL")

    updated = await investigation_model.update_investigation(
        id,
        {
            "report_url": report_url,
            "report_public_id": public_id,
            "report_uploaded_at": datetime.now(),
        },
    )
    await _log_investigation_event(
        id,
        "REPORT_UPLOADED",
        actor,
        {"report_url": report_url, "filename": fname},
    )
    return {"success": True, "message": "Report uploaded successfully", "investigation": dict(updated)}


@router.post("/investigations/{id}/publish")
async def publish_investigation_report(id: int, actor: Dict[str, Any] = Depends(auth_staff_role)):
    order = await investigation_model.get_investigation_by_id(id)
    if not order:
        raise HTTPException(status_code=404, detail="Investigation order not found")
    if not order.get("report_url"):
        raise HTTPException(status_code=400, detail="Upload a report file before publishing")
    if str(order.get("status") or "").upper() not in ("TEST_PERFORMED",):
        raise HTTPException(status_code=400, detail="Only TEST_PERFORMED investigations with an uploaded report can be published")

    old_status = order["status"]
    updated = await investigation_model.update_investigation(
        id,
        {
            "status": "REPORT_AVAILABLE",
            "published_by": actor.get("id"),
            "published_at": datetime.now(),
            "report_review_status": "PENDING",
        },
    )
    await _log_investigation_event(
        id,
        "REPORT_PUBLISHED",
        actor,
        {"old_status": old_status, "new_status": "REPORT_AVAILABLE"},
    )

    from app.services.journey_notify import notify_patient
    test_name = order.get("test_name") or "investigation"
    await notify_patient(
        int(order["patient_id"]),
        "Your investigation report is now available",
        f"Your {test_name} report has been published and is ready to view.",
        {"type": "lab_report", "investigationId": str(id)},
    )

    doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
    if doc:
        log_msg = f"{test_name} report for patient #{order['patient_id']} is ready for review."
        print(f"[Lab] Notify Dr. {doc.get('name')}: {log_msg}")

    import asyncio
    from app.services.order_monitoring_service import run_order_monitoring_cycle
    asyncio.create_task(run_order_monitoring_cycle())

    return {"success": True, "message": "Report published successfully", "investigation": dict(updated)}


@router.get("/investigations/{id}/report")
async def get_investigation_report(
    id: int,
    request: Request,
    download: bool = Query(False),
):
    """Authorized download/view of the single lab-uploaded report file."""
    token_str = _token_from_request(request)
    if not token_str:
        raise HTTPException(status_code=401, detail="Authentication token missing")
    try:
        actor = _decode_token_actor(token_str)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    order = await investigation_model.get_investigation_by_id(id)
    if not order:
        raise HTTPException(status_code=404, detail="Investigation order not found")
    if not order.get("report_url"):
        raise HTTPException(status_code=404, detail="Report file not found")

    await _authorize_investigation_report(actor, order)

    report_url = str(order["report_url"])
    try:
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            upstream = await client.get(report_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch report: {type(e).__name__}")

    if upstream.status_code != 200:
        raise HTTPException(status_code=404, detail="Report file not found in storage")

    test_name = (order.get("test_name") or "investigation").strip().replace("/", "-")
    ext = ".pdf"
    lower = report_url.lower()
    if lower.endswith(".png"):
        ext = ".png"
    elif lower.endswith(".jpg") or lower.endswith(".jpeg"):
        ext = ".jpg"
    filename = f"{test_name}{ext}"
    if ext == ".pdf":
        content_type = "application/pdf"
    else:
        content_type = upstream.headers.get("content-type") or _report_content_type(report_url)
    disposition = "attachment" if download else "inline"

    return Response(
        content=upstream.content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.patch("/referrals/{id}")
async def update_referral_endpoint(id: int, req: Request, actor: Dict[str, Any] = Depends(auth_staff_role)):
    body = await req.json()
    status = body.get("status")
    assigned_to = body.get("assigned_to") or body.get("assignedTo")
    appointment_date_str = body.get("appointment_date") or body.get("appointmentDate")
    notes = body.get("notes")

    order = await referral_model.get_referral_by_id(id)
    if not order:
        raise HTTPException(status_code=404, detail="Referral order not found")

    old_status = order["status"]
    update_data: Dict[str, Any] = {}
    if status:
        update_data["status"] = status
    if assigned_to:
        update_data["assigned_to"] = int(assigned_to)
    if appointment_date_str:
        update_data["appointment_date"] = datetime.fromisoformat(appointment_date_str)
    if notes:
        update_data["notes"] = notes

    updated = await referral_model.update_referral(id, update_data)

    if status and status != old_status:
        await order_event_model.create_order_event(
            entity_type="referral",
            entity_id=id,
            event_type="STATUS_CHANGED",
            payload={"old_status": old_status, "new_status": status, "actor_role": actor["role"]},
        )

    if (status == "APPOINTMENT_BOOKED" or appointment_date_str) and updated:
        from app.services.journey_notify import notify_patient, notify_doctor

        spec = await doctor_model.get_doctor_by_id(int(order["assigned_to"])) if order.get("assigned_to") else None
        ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
        patient = await user_model.get_user_by_id(int(order["patient_id"]))
        pname = (patient or {}).get("name") or "Patient"
        sname = (spec or {}).get("name") or "Specialist"
        when = appointment_date_str or (
            updated.get("appointment_date").isoformat()
            if updated.get("appointment_date") and hasattr(updated.get("appointment_date"), "isoformat")
            else str(updated.get("appointment_date") or "scheduled time")
        )

        await notify_patient(
            int(order["patient_id"]),
            "Specialist appointment confirmed",
            f"Your specialist appointment with {sname} is confirmed for {when}.",
            {"type": "referral", "id": str(id)},
        )
        if order.get("assigned_to"):
            await notify_doctor(
                int(order["assigned_to"]),
                "Specialist appointment booked",
                f"New specialist appointment confirmed for {pname}.",
                {"type": "referral", "referralId": str(id)},
            )
        if ref_doc:
            await notify_doctor(
                int(order["ordered_by"]),
                "Patient specialist appointment booked",
                f"Patient {pname}'s specialist appointment with {sname} has been booked.",
                {"type": "referral", "referralId": str(id)},
            )
        import asyncio
        from app.services.order_monitoring_service import run_order_monitoring_cycle
        asyncio.create_task(run_order_monitoring_cycle())

    if status == "ACCEPTED" and old_status != "ACCEPTED":
        await order_event_model.create_order_event(
            entity_type="referral",
            entity_id=id,
            event_type="REFERRAL_ACCEPTED",
            payload={"old_status": old_status, "new_status": "ACCEPTED", "actor_role": actor["role"]},
        )
        from app.services.journey_notify import notify_patient, notify_doctor
        spec = await doctor_model.get_doctor_by_id(int(order["assigned_to"])) if order.get("assigned_to") else None
        ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
        patient = await user_model.get_user_by_id(int(order["patient_id"]))
        pname = (patient or {}).get("name") or "Patient"
        sname = (spec or {}).get("name") or "Specialist"
        await notify_patient(
            int(order["patient_id"]),
            "Referral accepted",
            f"Your referral to {sname} has been accepted. You can now book a specialist appointment.",
            {"type": "referral", "id": str(id)},
        )
        if ref_doc:
            await notify_doctor(
                int(order["ordered_by"]),
                "Referral accepted",
                f"Referral for {pname} was accepted by {sname}.",
                {"type": "referral", "referralId": str(id)},
            )

    if status == "REJECTED" and old_status != "REJECTED":
        from app.services.journey_notify import notify_patient, notify_doctor
        ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
        patient = await user_model.get_user_by_id(int(order["patient_id"]))
        pname = (patient or {}).get("name") or "Patient"
        await notify_patient(
            int(order["patient_id"]),
            "Referral update",
            "Your specialist referral was declined. Your care team will coordinate next steps.",
            {"type": "referral", "id": str(id)},
        )
        if ref_doc:
            await notify_doctor(
                int(order["ordered_by"]),
                "Referral declined",
                f"Specialist declined the referral for {pname}.",
                {"type": "referral", "referralId": str(id)},
            )

    if status == "COMPLETED" and old_status != "COMPLETED":
        from app.services.journey_notify import notify_patient, notify_doctor
        ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
        patient = await user_model.get_user_by_id(int(order["patient_id"]))
        pname = (patient or {}).get("name") or "Patient"
        await notify_patient(
            int(order["patient_id"]),
            "Specialist consultation completed",
            "Your specialist consultation has been completed.",
            {"type": "referral", "id": str(id)},
        )
        if ref_doc:
            await notify_doctor(
                int(order["ordered_by"]),
                "Specialist consultation completed",
                f"Specialist consultation completed for your referred patient {pname}.",
                {"type": "referral", "referralId": str(id)},
            )
        import asyncio
        from app.services.order_monitoring_service import run_order_monitoring_cycle
        asyncio.create_task(run_order_monitoring_cycle())

    return {"success": True, "referral": dict(updated)}


@router.patch("/followups/{id}")
async def update_followup_endpoint(id: int, req: Request, actor: Dict[str, Any] = Depends(auth_staff_role)):
    body = await req.json()
    status = body.get("status")
    assigned_to = body.get("assigned_to") or body.get("assignedTo")

    order = await followup_model.get_followup_by_id(id)
    if not order:
        raise HTTPException(status_code=404, detail="Followup order not found")

    old_status = order["status"]
    update_data: Dict[str, Any] = {}
    if status:
        update_data["status"] = status
        if status == "COMPLETED":
            update_data["completed_at"] = datetime.now()
        elif status == "REMINDED":
            update_data["reminded_at"] = datetime.now()
    if assigned_to:
        update_data["assigned_to"] = int(assigned_to)

    updated = await followup_model.update_followup(id, update_data)

    if status and status != old_status:
        await order_event_model.create_order_event(
            entity_type="followup",
            entity_id=id,
            event_type="FOLLOWUP_COMPLETED" if status == "COMPLETED" else "STATUS_CHANGED",
            payload={"old_status": old_status, "new_status": status, "actor_role": actor["role"]},
        )

    if status == "COMPLETED" or (status and status != old_status):
        import asyncio
        from app.services.order_monitoring_service import run_order_monitoring_cycle
        asyncio.create_task(run_order_monitoring_cycle())

    return {"success": True, "followup": dict(updated)}


@router.get("/patients/{patient_id}/orders")
async def get_patient_orders_endpoint(
    patient_id: int,
    scope: str = "doctor",
    actor: Dict[str, Any] = Depends(auth_staff_role)
):
    params = [int(patient_id)]
    doctor_clause = ""
    if scope == "doctor" and actor["role"] == "doctor":
        doctor_clause = " AND ordered_by = $2"
        params.append(actor["id"])

    # Query investigations
    inv_sql = f"SELECT *, 'investigation' as type FROM investigations WHERE patient_id = $1{doctor_clause}"
    inv_rows = await db.fetch_all(inv_sql, *params)
    
    # Enrich investigations with needsReview boolean using our Phase 3 helper
    enriched_invs = []
    for inv in inv_rows:
        inv_dict = dict(inv)
        inv_dict["needsReview"] = is_investigation_pending_review(inv_dict)
        enriched_invs.append(inv_dict)

    # Query referrals (with specialist + referring doctor names)
    ref_sql = f"""
        SELECT r.*, 'referral' as type,
               sd.name AS specialist_name,
               rd.name AS referring_doctor_name
        FROM referrals r
        LEFT JOIN doctors sd ON sd.id = r.assigned_to
        LEFT JOIN doctors rd ON rd.id = r.ordered_by
        WHERE r.patient_id = $1{doctor_clause.replace('ordered_by', 'r.ordered_by')}
    """
    ref_rows = await db.fetch_all(ref_sql, *params)

    # Query followups
    fol_sql = f"SELECT *, 'followup' as type FROM followups WHERE patient_id = $1{doctor_clause}"
    fol_rows = await db.fetch_all(fol_sql, *params)

    # Combine all
    all_orders = enriched_invs + [dict(x) for x in ref_rows] + [dict(x) for x in fol_rows]
    
    # Format all datetimes/dates for json responses
    for item in all_orders:
        for field in ("created_at", "updated_at", "reviewed_at", "appointment_date", "reminded_at", "completed_at"):
            val = item.get(field)
            if val:
                item[field] = val.isoformat() if hasattr(val, "isoformat") else str(val)
        dd = item.get("due_date")
        if dd:
            item["due_date"] = dd.isoformat() if hasattr(dd, "isoformat") else str(dd)

    # Sort combined list by created_at DESC
    all_orders.sort(key=lambda x: x["created_at"], reverse=True)

    return {"success": True, "orders": all_orders}


def _parse_slot_datetime(slot_date: str, slot_time: str):
    """Best-effort parse of booking slot into timestamptz for referral.appointment_date."""
    try:
        parts = str(slot_date).split("_")
        if len(parts) == 3:
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            time_part = str(slot_time or "").strip()
            if time_part:
                for fmt in ("%I:%M %p", "%H:%M", "%I %p"):
                    try:
                        from datetime import datetime as dt

                        t = dt.strptime(time_part.upper(), fmt).time()
                        return dt(year, month, day, t.hour, t.minute)
                    except ValueError:
                        continue
            from datetime import datetime as dt

            return dt(year, month, day, 9, 0)
    except Exception:
        pass
    return None


@router.post("/referrals/{id}/book")
async def book_referral_appointment(id: int, req: Request, user_id: int = Depends(auth_user)):
    """Patient books specialist appointment for an accepted referral (reuses appointment APIs)."""
    from app.controllers import user_controller
    from app.services.journey_notify import notify_patient, notify_doctor
    from app.services.order_monitoring_service import run_order_monitoring_cycle
    import asyncio

    body = await req.json()
    order = await referral_model.get_referral_by_id(id)
    if not order:
        raise HTTPException(status_code=404, detail="Referral not found")
    if int(order["patient_id"]) != int(user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    status = str(order.get("status") or "").upper()
    if status not in {"ACCEPTED"}:
        raise HTTPException(status_code=400, detail="Referral must be accepted before booking")
    specialist_id = order.get("assigned_to")
    if not specialist_id:
        raise HTTPException(status_code=400, detail="No specialist assigned to this referral")

    slot_date = body.get("slotDate") or body.get("slot_date")
    slot_time = body.get("slotTime") or body.get("slot_time")
    if not slot_date or not slot_time:
        raise HTTPException(status_code=400, detail="slotDate and slotTime are required")

    book_body = {
        **body,
        "docId": specialist_id,
        "slotDate": slot_date,
        "slotTime": slot_time,
        "paymentMethod": body.get("paymentMethod") or "payOnVisit",
        "symptoms": body.get("symptoms") or [f"Specialist referral — {order.get('to_dept') or 'consultation'}"],
    }
    result = await user_controller.book_appointment(user_id, book_body)
    if not result.get("success"):
        return result

    appt_id = result.get("appointmentId")
    appt_dt = _parse_slot_datetime(slot_date, slot_time)
    updated = await referral_model.update_referral(
        id,
        {
            "status": "APPOINTMENT_BOOKED",
            "specialist_appointment_id": int(appt_id) if appt_id else None,
            "appointment_date": appt_dt,
        },
    )
    await order_event_model.create_order_event(
        entity_type="referral",
        entity_id=id,
        event_type="REFERRAL_APPOINTMENT_BOOKED",
        payload={
            "appointment_id": appt_id,
            "slot_date": slot_date,
            "slot_time": slot_time,
            "specialist_id": int(specialist_id),
        },
    )

    spec = await doctor_model.get_doctor_by_id(int(specialist_id))
    ref_doc = await doctor_model.get_doctor_by_id(int(order["ordered_by"])) if order.get("ordered_by") else None
    patient = await user_model.get_user_by_id(int(user_id))
    pname = (patient or {}).get("name") or "Patient"
    sname = (spec or {}).get("name") or "Specialist"
    when_label = f"{slot_date.replace('_', '-')} {slot_time}"

    await notify_patient(
        int(user_id),
        "Specialist appointment confirmed",
        f"Your specialist appointment with {sname} is confirmed for {when_label}.",
        {"type": "referral", "id": str(id), "appointmentId": str(appt_id or "")},
    )
    await notify_doctor(
        int(specialist_id),
        "Specialist appointment booked",
        f"New specialist appointment confirmed — {pname}, {when_label}.",
        {"type": "referral", "referralId": str(id), "appointmentId": str(appt_id or "")},
    )
    if ref_doc:
        await notify_doctor(
            int(order["ordered_by"]),
            "Patient specialist appointment booked",
            f"Patient {pname}'s specialist appointment with {sname} has been booked.",
            {"type": "referral", "referralId": str(id)},
        )

    asyncio.create_task(run_order_monitoring_cycle())
    return {
        "success": True,
        "referral": dict(updated) if updated else None,
        "appointment": result,
    }


# ─── FINDINGS & ALERTS ENDPOINTS ────────────────────────────────────────

@router.get("/findings")
async def get_findings_endpoint(
    patient_id: Optional[int] = None,
    assigned_role: Optional[str] = None,
    doctor_id: Optional[int] = None,
    actor: Dict[str, Any] = Depends(auth_staff_role)
):
    if patient_id is not None:
        findings = await order_finding_model.get_findings_by_patient(int(patient_id))
    elif doctor_id is not None:
        findings = await order_finding_model.get_open_findings_for_doctor(int(doctor_id))
    elif assigned_role is not None:
        findings = await order_finding_model.get_open_findings_by_role(assigned_role)
    else:
        # Default fallback: return all open findings for the actor's role
        findings = await order_finding_model.get_open_findings_by_role(actor["role"])
        
    return {"success": True, "findings": [dict(x) for x in findings]}


@router.patch("/findings/{id}/resolve")
async def resolve_finding_endpoint(id: int, req: Request, actor: Dict[str, Any] = Depends(auth_staff_role)):
    body = await req.json()
    status = body.get("status", "RESOLVED")

    finding = await order_finding_model.get_finding_by_id(id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    from app.services import patient_journey_service

    entity = await patient_journey_service.load_entity(finding["entity_type"], finding["entity_id"])
    if status == "RESOLVED" and patient_journey_service.finding_still_valid(finding, entity):
        raise HTTPException(
            status_code=409,
            detail="Finding is still valid against current database state. Approve a coordination action or wait until the workflow step is done.",
        )

    updated = await order_finding_model.update_finding_status(id, status)

    await order_event_model.create_order_event(
        entity_type=finding["entity_type"],
        entity_id=finding["entity_id"],
        event_type="FINDING_RESOLVED",
        payload={"finding_id": id, "status": status, "actor_role": actor["role"]},
    )

    return {"success": True, "finding": dict(updated)}

