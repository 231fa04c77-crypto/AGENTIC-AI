"""Video call request / accept / reject workflow."""

from app.models import appointment_model, call_session_model, user_model
from app.services import agora_service, fcm_service
from app.controllers import consultation_controller
from app.utils.ownership import load_appointment_for_user
from app.utils.vc_slot_window import assert_within_join_window, slot_window_payload


def _appointment_paid_for_video(appointment: dict) -> bool:
    mode = (appointment.get("mode") or "").lower()
    if mode not in ("online", "video"):
        return True
    pay_method = (appointment.get("payment_method") or "").lower()
    if pay_method in ("payonvisit", "cash", "offline", ""):
        return True
    pay_status = (
        appointment.get("payment_status")
        or appointment.get("payment")
        or ""
    ).lower()
    return pay_status in ("paid", "success", "completed", "captured")


def _session_payload(session: dict, appointment: dict | None = None, patient_name: str | None = None):
    window = slot_window_payload(appointment) if appointment else {}
    session_ok = session["status"] in ("accepted", "ongoing")
    can_join = session_ok and bool(window.get("canJoinWindow", True))
    return {
        "success": True,
        "sessionId": session["id"],
        "appointmentId": session["appointment_id"],
        "status": session["status"],
        "rejectReason": session.get("reject_reason"),
        "channel": session.get("agora_channel"),
        "requestedAt": session.get("requested_at"),
        "acceptedAt": session.get("accepted_at"),
        "patientName": patient_name,
        "tokenNumber": appointment.get("token_number") if appointment else None,
        "queuePosition": appointment.get("queue_position") if appointment else None,
        "canJoin": can_join,
        "slotWindow": window,
    }


async def request_call(user_id: int, appointment_id: int):
    appointment, err = await load_appointment_for_user(int(appointment_id), user_id)
    if err:
        return err
    if appointment.get("cancelled"):
        return {"success": False, "message": "This appointment was cancelled"}
    if not consultation_controller._appointment_is_online_video(appointment):
        return {"success": False, "message": "Video call is only available for online consultations"}
    if not _appointment_paid_for_video(appointment):
        return {"success": False, "message": "Please complete payment before starting video consultation"}

    window_err = assert_within_join_window(appointment)
    if window_err:
        return {"success": False, "message": window_err, "slotWindow": slot_window_payload(appointment)}

    existing = await call_session_model.get_by_appointment(int(appointment_id))
    if existing and existing["status"] in ("accepted", "ongoing"):
        patient = await user_model.get_user_by_id(user_id)
        return _session_payload(
            existing,
            appointment,
            patient.get("name") if patient else None,
        )
    if existing and existing["status"] in ("requested", "ringing"):
        patient = await user_model.get_user_by_id(user_id)
        return _session_payload(existing, appointment, (patient or {}).get("name"))

    consultation, err = await consultation_controller.ensure_consultation_for_appointment(
        user_id, int(appointment_id)
    )
    if err:
        return {"success": False, "message": err}

    if existing and existing["status"] in (
        "completed", "cancelled", "rejected", "busy", "missed",
    ):
        consultation = await consultation_controller._ensure_consultation_started(consultation)
        consultation = await consultation_controller._clear_call_timer(consultation)

    channel = consultation.get("meeting_id") or agora_service.channel_for_appointment(int(appointment_id))
    session = await call_session_model.create_session(
        {
            "appointment_id": int(appointment_id),
            "consultation_id": consultation["id"],
            "patient_user_id": user_id,
            "doctor_id": appointment["doctor_id"],
            "status": "requested",
            "agora_channel": channel,
        }
    )

    patient = await user_model.get_user_by_id(user_id)
    patient_name = (patient or {}).get("name") or "Patient"
    await fcm_service.notify_doctor_incoming_video_consult(
        doctor_id=int(appointment["doctor_id"]),
        patient_name=patient_name,
        appointment_id=int(appointment_id),
        session_id=int(session["id"]),
    )
    return _session_payload(session, appointment, patient_name)


async def get_call_status_for_user(user_id: int, appointment_id: int):
    appointment, err = await load_appointment_for_user(int(appointment_id), user_id)
    if err:
        return err
    session = await call_session_model.get_by_appointment(int(appointment_id))
    if not session:
        window = slot_window_payload(appointment)
        return {
            "success": True,
            "status": "none",
            "canJoin": False,
            "slotWindow": window,
        }
    patient = await user_model.get_user_by_id(user_id)
    return _session_payload(session, appointment, (patient or {}).get("name"))


async def cancel_call_request(user_id: int, appointment_id: int):
    appointment, err = await load_appointment_for_user(int(appointment_id), user_id)
    if err:
        return err
    session = await call_session_model.get_by_appointment(int(appointment_id))
    if not session:
        return {"success": True, "message": "No active request"}
    if session["status"] not in ("requested", "ringing"):
        return {"success": False, "message": "Call cannot be cancelled in current state"}
    updated = await call_session_model.update_status(session["id"], "cancelled")
    return {"success": True, "status": updated["status"]}


async def accept_call(doctor_id: int, appointment_id: int):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment["doctor_id"] != doctor_id:
        return {"success": False, "message": "Appointment not found"}
    session = await call_session_model.get_by_appointment(int(appointment_id))
    if not session:
        return {"success": False, "message": "No call request for this appointment"}
    if session["status"] not in ("requested", "ringing"):
        return {"success": False, "message": f"Call is already {session['status']}"}

    consultation, err = await consultation_controller.ensure_consultation_for_doctor(
        doctor_id, int(appointment_id)
    )
    if err:
        return {"success": False, "message": err}

    await consultation_controller._ensure_consultation_started(consultation)
    updated = await call_session_model.update_status(
        session["id"],
        "accepted",
        consultation_id=consultation["id"],
    )
    patient = await user_model.get_user_by_id(appointment["user_id"])
    await fcm_service.notify_patient_call_status(
        user_id=int(appointment["user_id"]),
        appointment_id=int(appointment_id),
        status="accepted",
        doctor_name=(await _doctor_name(doctor_id)),
    )
    return _session_payload(updated, appointment, (patient or {}).get("name"))


async def reject_call(doctor_id: int, appointment_id: int, reason: str = "rejected"):
    return await _doctor_decline(doctor_id, appointment_id, "rejected", reason)


async def busy_call(doctor_id: int, appointment_id: int):
    return await _doctor_decline(doctor_id, appointment_id, "busy", "busy")


async def _doctor_decline(doctor_id: int, appointment_id: int, status: str, reason: str):
    appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not appointment or appointment["doctor_id"] != doctor_id:
        return {"success": False, "message": "Appointment not found"}
    session = await call_session_model.get_by_appointment(int(appointment_id))
    if not session:
        return {"success": False, "message": "No call request"}
    if session["status"] not in ("requested", "ringing"):
        return {"success": False, "message": f"Call is already {session['status']}"}
    updated = await call_session_model.update_status(session["id"], status, reject_reason=reason)
    await fcm_service.notify_patient_call_status(
        user_id=int(appointment["user_id"]),
        appointment_id=int(appointment_id),
        status=status,
        doctor_name=await _doctor_name(doctor_id),
    )
    return _session_payload(updated, appointment)


_incoming_cache: dict[int, tuple[float, list]] = {}
_INCOMING_TTL_SEC = 1.5


async def list_incoming_calls(doctor_id: int):
    import time

    now = time.monotonic()
    cached = _incoming_cache.get(int(doctor_id))
    if cached and (now - cached[0]) < _INCOMING_TTL_SEC:
        return {"success": True, "calls": cached[1]}
    try:
        rows = await call_session_model.list_incoming_for_doctor(doctor_id)
    except Exception:
        cached = _incoming_cache.get(int(doctor_id))
        return {"success": True, "calls": cached[1] if cached else []}
    calls = []
    for row in rows:
        calls.append(
            {
                "sessionId": row["id"],
                "appointmentId": row["appointment_id"],
                "status": row["status"],
                "patientName": row.get("patient_name"),
                "slotDate": str(row.get("slot_date") or ""),
                "slotTime": row.get("slot_time"),
                "tokenNumber": row.get("token_number"),
                "requestedAt": row.get("requested_at"),
            }
        )
    _incoming_cache[int(doctor_id)] = (now, calls)
    if len(_incoming_cache) > 200:
        stale = [k for k, (ts, _) in _incoming_cache.items() if now - ts > 30]
        for k in stale:
            _incoming_cache.pop(k, None)
    return {"success": True, "calls": calls}


async def _doctor_name(doctor_id: int) -> str:
    from app.models import doctor_model

    doc = await doctor_model.get_doctor_by_id(doctor_id)
    return (doc or {}).get("name") or "Doctor"


async def mark_ongoing_if_joined(appointment_id: int):
    session = await call_session_model.get_by_appointment(int(appointment_id))
    if session and session["status"] == "accepted":
        await call_session_model.update_status(session["id"], "ongoing")


async def mark_completed(appointment_id: int):
    session = await call_session_model.get_by_appointment(int(appointment_id))
    if session and session["status"] in ("accepted", "ongoing"):
        await call_session_model.update_status(session["id"], "completed")


async def assert_can_issue_patient_token(user_id: int, appointment_id: int) -> str | None:
    """Return error message if patient cannot get Agora token yet."""
    appointment, err = await load_appointment_for_user(int(appointment_id), user_id)
    if err:
        return (err.get("message") if isinstance(err, dict) else None) or "Appointment not found"

    window_err = assert_within_join_window(appointment)
    if window_err:
        return window_err

    session = await call_session_model.get_by_appointment(int(appointment_id))
    if not session:
        return "Please start consultation and wait for the doctor to accept"
    if session["status"] in ("accepted", "ongoing"):
        return None
    if session["status"] == "requested":
        return "Waiting for doctor to accept the call"
    if session["status"] == "rejected":
        return "Doctor declined the video call"
    if session["status"] == "busy":
        return "Doctor is busy — try again shortly"
    if session["status"] == "cancelled":
        return "Call request was cancelled"
    if session["status"] == "completed":
        return "This slot has ended"
    return "Video call is not available"
