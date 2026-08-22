"""In-app (+ FCM) notices when journey stages change. Never raises to callers."""
from typing import Any, Dict, Optional

from app.utils.app_logger import get_logger

log = get_logger("medclues.journey_notify")


async def notify_patient(user_id: Optional[int], title: str, body: str, data: Optional[Dict[str, Any]] = None) -> None:
    if not user_id:
        return
    try:
        from app.services import fcm_service

        await fcm_service.send_to_user(int(user_id), title, body, data or {"type": "care_journey"})
    except Exception as e:
        log.warning("patient notify skipped: %s", e)


async def notify_doctor(doctor_id: Optional[int], title: str, body: str, data: Optional[Dict[str, Any]] = None) -> None:
    if not doctor_id:
        return
    try:
        from app.models import notification_model

        await notification_model.create_for_doctor(
            int(doctor_id),
            title,
            body,
            type=str((data or {}).get("type") or "referral")[:48],
            appointment_id=int(data["appointmentId"]) if data and data.get("appointmentId") else None,
        )
    except Exception as e:
        log.warning("doctor notify skipped: %s", e)
