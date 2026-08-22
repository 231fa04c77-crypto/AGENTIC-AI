"""Background missed-slot detection: MISSED → tomorrow offer → EOD auto-cancel."""
from __future__ import annotations

import asyncio
import json
import re
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from app.config.config import settings
from app.config.db import db
from app.services import appointment_lifecycle_service, fcm_service, trust_score_service
from app.utils.app_logger import get_logger

log = get_logger(__name__)
IST = ZoneInfo("Asia/Kolkata")


def _now_ist() -> datetime:
    return datetime.now(IST)


def _today_ist() -> date:
    return _now_ist().date()


def _parse_slot_start(slot_date: str, slot_time: str) -> Optional[datetime]:
    """Parse DD_MM_YYYY + time string into a naive local datetime (treat as IST wall clock)."""
    if not slot_date or not slot_time:
        return None
    parts = str(slot_date).split("_")
    if len(parts) != 3:
        return None
    try:
        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return None

    text = str(slot_time).strip().lower()
    nums = [int(x) for x in re.findall(r"\d+", text)]
    if not nums:
        return None
    hour = nums[0]
    minute = nums[1] if len(nums) > 1 else 0
    if "pm" in text and hour < 12:
        hour += 12
    if "am" in text and hour == 12:
        hour = 0
    # OPD block labels
    if "evening" in text or "afternoon" in text:
        hour = max(hour, 18)
    try:
        return datetime(y, m, d, hour, minute)
    except ValueError:
        return None


def _parse_legacy_date_only(slot_date: str) -> Optional[date]:
    parts = str(slot_date or "").split("_")
    if len(parts) != 3:
        return None
    try:
        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
        return date(y, m, d)
    except ValueError:
        return None


def _doctor_name_from_apt(apt: dict) -> str:
    raw = apt.get("doctor_data")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = None
    if isinstance(raw, dict) and raw.get("name"):
        return str(raw["name"]).strip()
    return "your doctor"


def _slot_has_ended(apt: dict, now: datetime) -> bool:
    """True when the booked slot window (or calendar day) has passed in IST."""
    slot_start = _parse_slot_start(apt.get("slot_date") or "", apt.get("slot_time") or "")
    if slot_start:
        # Compare using IST "now" as naive wall clock matching stored slot times.
        now_naive = now.replace(tzinfo=None)
        return now_naive >= slot_start + timedelta(minutes=30)
    day = _parse_legacy_date_only(apt.get("slot_date") or "")
    if day:
        return day < now.date()
    return False


async def mark_appointment_missed(apt: dict) -> bool:
    """Transition to MISSED, set tomorrow offer deadline (end of today IST), notify."""
    apt_id = int(apt["id"])
    user_id = int(apt["user_id"])
    doctor_name = _doctor_name_from_apt(apt)
    today = _today_ist()
    tomorrow = today + timedelta(days=1)
    now = _now_ist()

    await appointment_lifecycle_service.transition(
        apt_id,
        "MISSED",
        actor_role="system",
        reason="Appointment slot/date passed — tomorrow reschedule offer opened",
        extra_fields={
            "missed_at": now.replace(tzinfo=None),
            "tomorrow_reschedule_deadline": today,
            "tomorrow_reschedule_offered": True,
            "slot_ended_notified": True,
        },
    )

    body = (
        f"Your appointment with Dr. {doctor_name} was missed. "
        f"You can reschedule for tomorrow ({tomorrow.isoformat()}) only. "
        f"Confirm before midnight tonight, or it will be cancelled."
    )
    await fcm_service.notify_missed_tomorrow_offer(
        user_id,
        doctor_name=doctor_name,
        appointment_id=apt_id,
        offer_date=tomorrow.isoformat(),
        deadline=today.isoformat(),
        body=body,
    )
    return True


async def process_ended_slots() -> int:
    """After slot window ends: mark MISSED and offer tomorrow-only reschedule."""
    rows = await db.query(
        """
        SELECT a.*
        FROM appointments a
        WHERE a.cancelled = false
          AND a.is_completed = false
          AND a.lifecycle_status IN ('BOOKED', 'CONFIRMED', 'RESCHEDULED_ONCE')
          AND COALESCE(a.reception_status, '') NOT IN (
                'VERIFIED', 'ARRIVED', 'READY_FOR_DOCTOR', 'NO_SHOW', 'COMPLETED'
              )
        LIMIT 300
        """
    )
    notified = 0
    now = _now_ist()
    for apt in rows:
        try:
            if not _slot_has_ended(apt, now):
                continue
            await mark_appointment_missed(apt)
            notified += 1
        except Exception as exc:
            log.warning("Missed-slot processing failed for %s: %s", apt.get("id"), exc)
    return notified


async def process_expired_missed_offers() -> int:
    """Auto-cancel MISSED appointments whose tomorrow offer deadline has passed (IST)."""
    today = _today_ist()
    rows = await db.query(
        """
        SELECT a.*
        FROM appointments a
        WHERE a.lifecycle_status = 'MISSED'
          AND a.cancelled = false
          AND a.is_completed = false
          AND a.tomorrow_reschedule_deadline IS NOT NULL
          AND a.tomorrow_reschedule_deadline < $1::date
        LIMIT 200
        """,
        today,
    )
    processed = 0
    for apt in rows:
        try:
            apt_id = int(apt["id"])
            user_id = int(apt["user_id"])
            doctor_name = _doctor_name_from_apt(apt)
            try:
                from app.services import doctor_slot_service

                await doctor_slot_service.release_slot_for_appointment(apt)
            except Exception as release_err:
                log.debug("release slot on auto-cancel %s: %s", apt_id, release_err)

            await appointment_lifecycle_service.transition(
                apt_id,
                "CANCELLED",
                actor_role="system",
                reason="Auto-cancel: tomorrow reschedule offer expired",
            )
            await appointment_lifecycle_service.transition(
                apt_id,
                "CLOSED",
                actor_role="system",
                reason="Auto-cancel: tomorrow reschedule offer expired",
            )
            await fcm_service.notify_missed_offer_expired(
                user_id,
                doctor_name=doctor_name,
                appointment_id=apt_id,
            )
            processed += 1
        except Exception as exc:
            log.warning("Expired missed-offer cancel failed for %s: %s", apt.get("id"), exc)
    return processed


async def process_missed_appointments() -> int:
    """Legacy stale sweep: mark as MISSED (tomorrow offer) instead of immediate NO_SHOW close."""
    rows = await db.query(
        """
        SELECT a.* FROM appointments a
        WHERE a.lifecycle_status IN ('BOOKED', 'CONFIRMED', 'RESCHEDULED_ONCE')
          AND a.cancelled = false
          AND a.is_completed = false
          AND a.updated_at < NOW() - INTERVAL '1 day'
        LIMIT 200
        """
    )
    processed = 0
    now = _now_ist()
    for apt in rows:
        try:
            if not _slot_has_ended(apt, now):
                # Stale row but slot not ended yet — skip
                day = _parse_legacy_date_only(apt.get("slot_date") or "")
                if not day or day >= now.date():
                    continue
            await mark_appointment_missed(apt)
            processed += 1
        except Exception as exc:
            log.warning("Stale missed processing failed for %s: %s", apt.get("id"), exc)
    return processed


async def start_no_show_scheduler(interval_seconds: int = 300) -> None:
    if not settings.AUTO_NO_SHOW_JOB:
        log.info(
            "No-show / auto-expire scheduler DISABLED "
            "(AUTO_NO_SHOW_JOB=false). Past slots will not auto-MISSED/cancel."
        )
        return
    log.info(
        "No-show / auto-expire scheduler STARTED (interval=%ss). "
        "BOOKED/CONFIRMED slots past +30min IST → MISSED; expired offers → CANCELLED/CLOSED.",
        interval_seconds,
    )
    while True:
        try:
            if db.pool:
                ended = await process_ended_slots()
                if ended:
                    log.info("Marked %s appointments as MISSED (tomorrow offer)", ended)
                expired = await process_expired_missed_offers()
                if expired:
                    log.info("Auto-cancelled %s expired MISSED offers", expired)
                try:
                    from app.services.schedule_ops_service import expire_closure_offers
                    closed_n = await expire_closure_offers()
                    if closed_n:
                        log.info("Auto-cancelled %s hospital-closure offers", closed_n)
                except Exception as clo_err:
                    log.warning("Closure offer expiry error: %s", clo_err)
                count = await process_missed_appointments()
                if count:
                    log.info("Processed %s stale appointments into MISSED", count)
        except Exception as exc:
            log.warning("No-show scheduler error: %s", exc)
        await asyncio.sleep(interval_seconds)
