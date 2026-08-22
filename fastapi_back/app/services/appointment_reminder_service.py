"""24h + 1h appointment reminders via FCM + Telegram (background scheduler)."""
import asyncio
import json
import re
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from app.models import appointment_reminder_model
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_POLL_SECONDS = 15 * 60  # every 15 minutes (catches 1h window reliably)
_REMINDER_24H_HOURS = 24
_WINDOW_24H_HOURS = 1  # 23h–25h before appointment
_REMINDER_1H_MINUTES = 60
_WINDOW_1H_MINUTES = 20  # 50–70 min before


def _parse_slot_start(slot_date: str, slot_time: str) -> Optional[datetime]:
    if not slot_date or not slot_time:
        return None
    date_raw = str(slot_date).replace("/", "_").replace("-", "_")
    for fmt in ("%d_%m_%Y", "%d_%m_%y"):
        try:
            d = datetime.strptime(date_raw[:10], fmt).date()
            break
        except ValueError:
            d = None
    if d is None:
        return None

    time_part = str(slot_time).split("-")[0].strip()
    time_part = re.split(r"[–—]", time_part)[0].strip()
    for fmt in ("%I:%M %p", "%H:%M", "%I %p"):
        try:
            t = datetime.strptime(time_part.upper(), fmt).time()
            return datetime.combine(d, t)
        except ValueError:
            continue
    m = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM)?", time_part, re.I)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        mer = (m.group(3) or "").upper()
        if mer == "PM" and hour < 12:
            hour += 12
        if mer == "AM" and hour == 12:
            hour = 0
        return datetime.combine(d, datetime.min.time().replace(hour=hour, minute=minute))
    return None


def _doctor_name(doctor_data) -> str:
    if isinstance(doctor_data, str):
        try:
            doctor_data = json.loads(doctor_data)
        except json.JSONDecodeError:
            return "your doctor"
    if isinstance(doctor_data, dict):
        return doctor_data.get("name") or "your doctor"
    return "your doctor"


def _in_24h_window(start: datetime, now: datetime) -> bool:
    delta = start - now
    low = timedelta(hours=_REMINDER_24H_HOURS - _WINDOW_24H_HOURS / 2)
    high = timedelta(hours=_REMINDER_24H_HOURS + _WINDOW_24H_HOURS / 2)
    return low <= delta <= high


def _in_1h_window(start: datetime, now: datetime) -> bool:
    delta = start - now
    half = _WINDOW_1H_MINUTES / 2
    low = timedelta(minutes=_REMINDER_1H_MINUTES - half)
    high = timedelta(minutes=_REMINDER_1H_MINUTES + half)
    return low <= delta <= high


async def process_due_reminders() -> int:
    await appointment_reminder_model.ensure_reminder_schema()
    now = datetime.now()
    sent = 0
    sent += await _process_24h(now)
    sent += await _process_1h(now)
    return sent


async def _process_24h(now: datetime) -> int:
    rows = await appointment_reminder_model.get_upcoming_for_24h_reminder()
    sent = 0

    for row in rows:
        start = _parse_slot_start(row.get("slot_date"), row.get("slot_time"))
        if not start or not _in_24h_window(start, now):
            continue

        user_id = int(row["user_id"])
        apt_id = int(row["id"])
        doc_name = _doctor_name(row.get("doctor_data"))
        slot_date = str(row.get("slot_date", "")).replace("_", "/")
        slot_time = row.get("slot_time", "")
        patient = row.get("patient_name") or "Patient"

        try:
            from app.services import fcm_service
            await fcm_service.notify_appointment_reminder_24h(
                user_id, doc_name, slot_date, slot_time, apt_id
            )
        except Exception as e:
            log.warning("FCM 24h reminder failed apt=%s: %s", apt_id, e)

        try:
            from app.services import telegram_notify_service
            await telegram_notify_service.notify_appointment_reminder(
                user_id,
                patient_name=patient,
                doctor_name=doc_name,
                slot_time=slot_time,
                hospital_name="MEDCLUES Partner Hospital",
                minutes=24 * 60,
            )
        except Exception as e:
            log.warning("Telegram 24h reminder failed apt=%s: %s", apt_id, e)

        await appointment_reminder_model.mark_reminder_sent(apt_id)
        sent += 1

    if sent:
        log.info("Sent %s appointment 24h reminder(s)", sent)
    return sent


async def _process_1h(now: datetime) -> int:
    rows = await appointment_reminder_model.get_upcoming_for_1h_reminder()
    sent = 0

    for row in rows:
        start = _parse_slot_start(row.get("slot_date"), row.get("slot_time"))
        if not start or not _in_1h_window(start, now):
            continue

        user_id = int(row["user_id"])
        apt_id = int(row["id"])
        doc_name = _doctor_name(row.get("doctor_data"))
        slot_date = str(row.get("slot_date", "")).replace("_", "/")
        slot_time = row.get("slot_time", "")
        patient = row.get("patient_name") or "Patient"
        mode = (row.get("mode") or "").lower()
        is_video = mode in ("online", "video") or "video" in mode

        try:
            from app.services import fcm_service
            await fcm_service.notify_appointment_reminder_1h(
                user_id,
                doc_name,
                slot_date,
                slot_time,
                apt_id,
                is_video=is_video,
            )
        except Exception as e:
            log.warning("FCM 1h reminder failed apt=%s: %s", apt_id, e)

        try:
            from app.services import telegram_notify_service
            await telegram_notify_service.notify_appointment_reminder(
                user_id,
                patient_name=patient,
                doctor_name=doc_name,
                slot_time=slot_time,
                hospital_name="MEDCLUES Partner Hospital",
                minutes=60,
            )
        except Exception as e:
            log.warning("Telegram 1h reminder failed apt=%s: %s", apt_id, e)

        await appointment_reminder_model.mark_1h_reminder_sent(apt_id)
        sent += 1

    if sent:
        log.info("Sent %s appointment 1h reminder(s)", sent)
    return sent


async def start_reminder_scheduler() -> None:
    schema_ready = False
    log.info("Appointment reminder scheduler started (every %ss)", _POLL_SECONDS)

    while True:
        try:
            if not schema_ready:
                await appointment_reminder_model.ensure_reminder_schema()
                schema_ready = True
            await process_due_reminders()
        except Exception as e:
            log.warning("Reminder scheduler error: %s", e)
        await asyncio.sleep(_POLL_SECONDS)


async def stop_reminder_scheduler() -> None:
    pass
