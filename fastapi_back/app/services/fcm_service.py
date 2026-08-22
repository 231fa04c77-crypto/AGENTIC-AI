import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models import fcm_token_model

_initialized = False


def _credentials_path() -> Optional[Path]:
    raw = os.getenv("FIREBASE_CREDENTIALS_PATH", "").strip()
    if not raw:
        return None
    path = Path(raw)
    if not path.is_absolute():
        base = Path(__file__).resolve().parent.parent.parent
        path = base / raw
    return path if path.is_file() else None


def _credentials_dict() -> Optional[Dict[str, Any]]:
    """Service-account JSON provided directly via env (easiest on Render)."""
    raw = os.getenv("FIREBASE_CREDENTIALS_JSON", "").strip()
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except Exception as e:
        print(f"[WARNING] FIREBASE_CREDENTIALS_JSON is not valid JSON — push disabled ({e})")
        return None


def _ensure_firebase():
    global _initialized
    if _initialized:
        return True
    cred_dict = _credentials_dict()
    cred_path = _credentials_path()
    if not cred_dict and not cred_path:
        print(
            "[WARNING] Firebase Admin credentials not set "
            "(FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH) — push disabled"
        )
        return False
    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            cred = (
                credentials.Certificate(cred_dict)
                if cred_dict
                else credentials.Certificate(str(cred_path))
            )
            firebase_admin.initialize_app(cred)
        _initialized = True
        return True
    except Exception as e:
        print(f"[WARNING] Firebase Admin init failed: {e}")
        return False


def _send_multicast_sync(tokens: List[str], title: str, body: str, data: Dict[str, Any]):
    from firebase_admin import messaging

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in data.items()},
        tokens=tokens,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="medclues_appointments",
                sound="default",
            ),
        ),
    )
    return messaging.send_each_for_multicast(message)


def _safe_int(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


async def _persist_notification(user_id: int, title: str, body: str, payload: Dict[str, Any]):
    """Store the notification so the in-app notifications page can show history."""
    try:
        from app.models import notification_model

        await notification_model.create(
            user_id=int(user_id),
            title=title,
            body=body,
            type=str(payload.get("type", "system")),
            appointment_id=_safe_int(payload.get("appointmentId")),
        )
    except Exception as e:
        print(f"[WARNING] notification persist failed for user {user_id}: {e}")


async def send_to_user(
    user_id: int,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> bool:
    payload = data or {}
    # Always record the notification (history survives even if push delivery fails).
    await _persist_notification(int(user_id), title, body, payload)
    if not _ensure_firebase():
        return False
    tokens = await fcm_token_model.get_tokens_for_user(int(user_id))
    if not tokens:
        return False

    def _run():
        response = _send_multicast_sync(tokens, title, body, payload)
        stale: List[str] = []
        for idx, resp in enumerate(response.responses):
            if not resp.success and resp.exception:
                err = str(resp.exception)
                if "not-found" in err.lower() or "registration-token-not-registered" in err.lower():
                    stale.append(tokens[idx])
        return stale

    try:
        stale = await asyncio.to_thread(_run)
        if stale:
            await fcm_token_model.delete_tokens(int(user_id), stale)
        return True
    except Exception as e:
        print(f"[WARNING] FCM send failed for user {user_id}: {e}")
        return False


async def notify_appointment_booked(
    user_id: int,
    doctor_name: str,
    slot_date: str,
    slot_time: str,
    appointment_id: int,
):
    await send_to_user(
        user_id,
        title="Appointment confirmed",
        body=f"With Dr. {doctor_name} on {slot_date} at {slot_time}",
        data={
            "type": "appointment",
            "appointmentId": str(appointment_id),
        },
    )


async def notify_patient_next_in_queue(
    user_id: int,
    doctor_name: str,
    appointment_id: int,
):
    await send_to_user(
        user_id,
        title="You are next to consult",
        body=f"Dr. {doctor_name} will see you next. Please be ready near the consultation room.",
        data={
            "type": "appointment_next_in_queue",
            "appointmentId": str(appointment_id),
        },
    )


async def notify_appointment_reminder_24h(
    user_id: int,
    doctor_name: str,
    slot_date: str,
    slot_time: str,
    appointment_id: int,
):
    await send_to_user(
        user_id,
        title="Appointment tomorrow",
        body=f"Reminder: Dr. {doctor_name} on {slot_date} at {slot_time}",
        data={
            "type": "appointment_reminder_24h",
            "appointmentId": str(appointment_id),
        },
    )


async def notify_appointment_reminder_1h(
    user_id: int,
    doctor_name: str,
    slot_date: str,
    slot_time: str,
    appointment_id: int,
    *,
    is_video: bool = False,
):
    if is_video:
        title = "Video consult in 1 hour"
        body = f"Your video consult with Dr. {doctor_name} starts in 1 hour ({slot_time})."
    else:
        title = "Appointment in 1 hour"
        body = f"Reminder: Dr. {doctor_name} at {slot_time} today."
    await send_to_user(
        user_id,
        title=title,
        body=body,
        data={
            "type": "appointment_reminder_1h",
            "appointmentId": str(appointment_id),
        },
    )


async def notify_appointment_cancelled(user_id: int, doctor_name: str, appointment_id: int):
    await send_to_user(
        user_id,
        title="Appointment cancelled",
        body=f"Your appointment with Dr. {doctor_name} was cancelled.",
        data={
            "type": "appointment_cancelled",
            "appointmentId": str(appointment_id),
        },
    )


async def notify_consultation_slot_ended(
    user_id: int,
    *,
    doctor_name: str,
    appointment_id: int,
    suggested_date: str,
    can_request_grace: bool,
    body: str | None = None,
):
    """Push when the booked slot window ends without attendance."""
    await send_to_user(
        user_id,
        title="Consultation over",
        body=body
        or (
            f"Your consultation with Dr. {doctor_name} has ended without attendance."
            + (
                f" You can request a reschedule to {suggested_date}."
                if can_request_grace
                else ""
            )
        ),
        data={
            "type": "consultation_slot_ended",
            "appointmentId": str(appointment_id),
            "suggestedDate": suggested_date,
            "canRequestGrace": "1" if can_request_grace else "0",
        },
    )


async def notify_missed_tomorrow_offer(
    user_id: int,
    *,
    doctor_name: str,
    appointment_id: int,
    offer_date: str,
    deadline: str,
    body: str | None = None,
):
    """Push when appointment is marked MISSED with tomorrow-only reschedule offer."""
    await send_to_user(
        user_id,
        title="Appointment missed",
        body=body
        or (
            f"Your appointment with Dr. {doctor_name} was missed. "
            f"Reschedule for tomorrow ({offer_date}) only — confirm before midnight."
        ),
        data={
            "type": "appointment_missed_tomorrow_offer",
            "appointmentId": str(appointment_id),
            "offerDate": offer_date,
            "deadline": deadline,
        },
    )


async def notify_missed_offer_expired(
    user_id: int,
    *,
    doctor_name: str,
    appointment_id: int,
):
    await send_to_user(
        user_id,
        title="Appointment cancelled",
        body=(
            f"The tomorrow reschedule offer for Dr. {doctor_name} expired. "
            "Your missed appointment was cancelled."
        ),
        data={
            "type": "appointment_missed_offer_expired",
            "appointmentId": str(appointment_id),
        },
    )


async def notify_tomorrow_reschedule_confirmed(
    user_id: int,
    *,
    doctor_name: str,
    appointment_id: int,
    offer_date: str,
    slot_label: str,
):
    await send_to_user(
        user_id,
        title="Rescheduled for tomorrow",
        body=(
            f"Your appointment with Dr. {doctor_name} is moved to {offer_date} "
            f"({slot_label})."
        ),
        data={
            "type": "appointment_tomorrow_reschedule_confirmed",
            "appointmentId": str(appointment_id),
            "offerDate": offer_date,
        },
    )


async def notify_prescription_ready(
    user_id: int,
    doctor_name: str,
    appointment_id: int,
    updated: bool = False,
):
    """Real-time push when a doctor publishes/updates a prescription for the patient."""
    await send_to_user(
        user_id,
        title="Prescription updated" if updated else "Your prescription is ready",
        body=(
            f"Dr. {doctor_name} updated your prescription. Tap to view the details."
            if updated
            else f"Dr. {doctor_name} has shared your prescription. Tap to view it."
        ),
        data={
            "type": "prescription",
            "appointmentId": str(appointment_id),
        },
    )


async def notify_doctor_incoming_video_consult(
    doctor_id: int,
    patient_name: str,
    appointment_id: int,
    session_id: int,
):
    """Doctors on web poll /incoming-calls; FCM reserved for future doctor mobile app."""
    print(
        f"[Video] Incoming consult for doctor {doctor_id}: "
        f"{patient_name} appointment={appointment_id} session={session_id}"
    )


async def notify_patient_call_status(
    user_id: int,
    appointment_id: int,
    status: str,
    doctor_name: str,
):
    titles = {
        "accepted": "Doctor joined",
        "rejected": "Call declined",
        "busy": "Doctor is busy",
        "missed": "Missed consultation",
    }
    bodies = {
        "accepted": f"Dr. {doctor_name} accepted — tap to join video consultation.",
        "rejected": f"Dr. {doctor_name} is unavailable for video now.",
        "busy": f"Dr. {doctor_name} is in another consultation.",
        "missed": "Your video consultation request was not answered.",
    }
    await send_to_user(
        user_id,
        title=titles.get(status, "Video consultation update"),
        body=bodies.get(status, f"Call status: {status}"),
        data={
            "type": "video_call_status",
            "status": status,
            "appointmentId": str(appointment_id),
        },
    )


async def notify_doctor_status_to_patients(
    queue_user_ids: List[int],
    booked_user_ids: List[int],
    doctor_name: str,
    status: str,
    status_label: str,
    message: str,
):
    """Push doctor availability updates to today's queue and booked patients."""
    title = f"Doctor Update — {status_label}"
    base_data = {
        "type": "doctor_status",
        "status": status,
        "statusLabel": status_label,
    }

    seen: set[int] = set()
    for uid in queue_user_ids:
        if uid in seen:
            continue
        seen.add(uid)
        await send_to_user(
            int(uid),
            title=title,
            body=message,
            data={**base_data, "audience": "queue"},
        )

    for uid in booked_user_ids:
        if uid in seen:
            continue
        seen.add(uid)
        booked_msg = message
        if status in ("on-break", "unavailable", "in-consult"):
            booked_msg = (
                f"Dr. {doctor_name} is {status_label.lower()}. "
                "Your appointment is still booked — we will update you when the doctor is ready."
            )
        await send_to_user(
            int(uid),
            title=title,
            body=booked_msg,
            data={**base_data, "audience": "booked"},
        )
