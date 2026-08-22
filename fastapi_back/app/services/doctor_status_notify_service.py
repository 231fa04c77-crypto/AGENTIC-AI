"""Broadcast doctor status changes to reception (socket + poll) and patients (FCM)."""
from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime
from typing import Any, Deque, Dict, List, Optional, Set
from zoneinfo import ZoneInfo

from app.models import appointment_model, doctor_model
from app.services.queue_service import _is_in_doctor_queue

CLINICAL_STATUS_LABELS: Dict[str, str] = {
    "in-clinic": "In Clinic",
    "in-consult": "In Consult",
    "on-break": "On Break",
    "unavailable": "Unavailable",
    "available": "Available",
    "emergency": "Emergency",
    "offline": "Offline",
    "online": "Online",
}

PATIENT_STATUS_MESSAGES: Dict[str, str] = {
    "in-clinic": "Dr. {name} is now In Clinic and ready to see patients.",
    "in-consult": "Dr. {name} is currently in consultation. Please wait in the queue.",
    "on-break": "Dr. {name} is on a short break. Your wait time may increase.",
    "unavailable": "Dr. {name} is temporarily unavailable.",
    "emergency": "Dr. {name} is handling an emergency. Please wait.",
    "offline": "Dr. {name} is offline for now.",
    "available": "Dr. {name} is now available for consultation.",
}

# In-memory feed for reception polling when socket is unavailable.
_events: Deque[Dict[str, Any]] = deque(maxlen=200)


def _status_label(status: str) -> str:
    return CLINICAL_STATUS_LABELS.get(status, status.replace("-", " ").title())


def get_events_since(since_iso: Optional[str], hospital_id: Optional[int] = None) -> List[Dict[str, Any]]:
    if not since_iso:
        return list(_events)[-20:]
    out: List[Dict[str, Any]] = []
    for ev in _events:
        if ev.get("timestamp", "") <= since_iso:
            continue
        if hospital_id is not None and ev.get("hospitalId") not in (None, hospital_id):
            continue
        out.append(ev)
    return out


def _push_event(event: Dict[str, Any]) -> None:
    _events.append(event)


async def _today_slot_date() -> str:
    from app.services.doctor_slot_service import legacy_slot_date

    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    return legacy_slot_date(today)


async def _patient_groups_for_doctor(doc_id: int) -> tuple[Set[int], Set[int]]:
    """Return (queue_patient_ids, booked_only_patient_ids) for today."""
    slot_date = await _today_slot_date()
    appointments = await appointment_model.get_appointments_by_filters({
        "docId": doc_id,
        "slotDate": slot_date,
        "cancelled": False,
        "isCompleted": False,
    })
    queue_ids: Set[int] = set()
    booked_ids: Set[int] = set()
    for apt in appointments:
        uid = apt.get("user_id")
        if not uid:
            continue
        if _is_in_doctor_queue(apt):
            queue_ids.add(int(uid))
        else:
            booked_ids.add(int(uid))
    booked_only = booked_ids - queue_ids
    return queue_ids, booked_only


async def broadcast_doctor_status_change(
    doc_id: int,
    new_status: str,
    *,
    previous_status: Optional[str] = None,
    break_duration: Optional[int] = None,
) -> Dict[str, Any]:
    if previous_status and previous_status == new_status:
        return {"notified": False, "reason": "unchanged"}

    doctor = await doctor_model.get_doctor_by_id(doc_id)
    if not doctor:
        return {"notified": False, "reason": "doctor_not_found"}

    doctor_name = (doctor.get("name") or "Doctor").replace("Dr. ", "").replace("Dr.", "").strip() or "Doctor"
    hospital_id = doctor.get("hospital_id")
    label = _status_label(new_status)
    message = PATIENT_STATUS_MESSAGES.get(new_status, f"Dr. {doctor_name} status: {label}.").format(
        name=doctor_name
    )
    if new_status == "on-break" and break_duration:
        message = f"Dr. {doctor_name} is on break for about {break_duration} minutes."

    event = {
        "doctorId": doc_id,
        "doctorName": doctor_name,
        "status": new_status,
        "statusLabel": label,
        "hospitalId": hospital_id,
        "message": f"Dr. {doctor_name} is now {label}",
        "breakDuration": break_duration,
        "timestamp": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(),
    }
    _push_event(event)

    try:
        from app.services.socket_service import emit_doctor_status

        await emit_doctor_status(event)
    except Exception as exc:
        print(f"[WARNING] socket doctor-status emit failed: {exc}")

    queue_ids, booked_only_ids = await _patient_groups_for_doctor(doc_id)

    try:
        from app.services import fcm_service

        asyncio.create_task(
            fcm_service.notify_doctor_status_to_patients(
                queue_user_ids=list(queue_ids),
                booked_user_ids=list(booked_only_ids),
                doctor_name=doctor_name,
                status=new_status,
                status_label=label,
                message=message,
            )
        )
    except Exception as exc:
        print(f"[WARNING] FCM doctor-status notify failed: {exc}")

    return {
        "notified": True,
        "queuePatients": len(queue_ids),
        "bookedPatients": len(booked_only_ids),
        "event": event,
    }
