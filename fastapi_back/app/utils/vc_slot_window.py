"""Video consult join window helpers (IST wall-clock).

Join allowed in [slot_start - 1 min, slot_end + 5 min].
Soft warning at T−2 min before slot_end; force-end at grace end.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Optional, Tuple
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

VC_SLOT_MINUTES = 15
EARLY_GRACE_MINUTES = 1
LATE_GRACE_MINUTES = 5
SOFT_WARN_BEFORE_END_MINUTES = 2


def now_ist_naive() -> datetime:
    return datetime.now(IST).replace(tzinfo=None)


def _parse_legacy_date(slot_date: str) -> Optional[datetime]:
    raw = str(slot_date or "").strip().replace("/", "_").replace("-", "_")
    parts = raw.split("_")
    if len(parts) != 3:
        return None
    try:
        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
        return datetime(y, m, d)
    except ValueError:
        return None


def _parse_clock(text: str) -> Optional[Tuple[int, int]]:
    """Parse a time fragment into (hour, minute) 24h."""
    s = (text or "").strip()
    if not s:
        return None
    m = re.search(r"(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM|am|pm)?", s)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2))
        mer = (m.group(3) or "").upper()
        if mer == "PM" and hour < 12:
            hour += 12
        if mer == "AM" and hour == 12:
            hour = 0
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return hour, minute
    m2 = re.search(r"(\d{1,2})\s*(AM|PM|am|pm)", s)
    if m2:
        hour = int(m2.group(1))
        mer = m2.group(2).upper()
        if mer == "PM" and hour < 12:
            hour += 12
        if mer == "AM" and hour == 12:
            hour = 0
        if 0 <= hour <= 23:
            return hour, 0
    nums = [int(x) for x in re.findall(r"\d+", s)]
    if nums:
        hour = nums[0]
        minute = nums[1] if len(nums) > 1 else 0
        lower = s.lower()
        if "pm" in lower and hour < 12:
            hour += 12
        if "am" in lower and hour == 12:
            hour = 0
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return hour, minute
    return None


def parse_slot_bounds(slot_date: str, slot_time: str) -> Optional[Tuple[datetime, datetime]]:
    """Return (slot_start, slot_end) naive IST wall clock, or None."""
    day = _parse_legacy_date(slot_date)
    if day is None:
        return None
    raw = str(slot_time or "").strip()
    if not raw:
        return None

    # Range: "2:00 PM - 2:15 PM" / "14:00 - 14:15"
    parts = re.split(r"\s*[-–—]\s*", raw, maxsplit=1)
    start_clock = _parse_clock(parts[0])
    if start_clock is None:
        return None
    start = day.replace(hour=start_clock[0], minute=start_clock[1], second=0, microsecond=0)

    end: Optional[datetime] = None
    if len(parts) > 1:
        end_clock = _parse_clock(parts[1])
        if end_clock is not None:
            end = day.replace(hour=end_clock[0], minute=end_clock[1], second=0, microsecond=0)
            if end <= start:
                end = end + timedelta(days=1)

    if end is None:
        end = start + timedelta(minutes=VC_SLOT_MINUTES)
    return start, end


def slot_window_payload(
    appointment: dict,
    *,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Compute join/soft-end/force-end flags for an appointment."""
    now = now or now_ist_naive()
    bounds = parse_slot_bounds(
        str(appointment.get("slot_date") or ""),
        str(appointment.get("slot_time") or ""),
    )
    if bounds is None:
        # Fail open for malformed legacy rows so existing bookings still work.
        return {
            "slotStartAt": None,
            "slotEndAt": None,
            "graceEndsAt": None,
            "joinOpensAt": None,
            "canJoinWindow": True,
            "inGrace": False,
            "softWarn": False,
            "forceEnd": False,
            "windowMessage": None,
            "slotDurationMinutes": VC_SLOT_MINUTES,
            "earlyGraceMinutes": EARLY_GRACE_MINUTES,
            "lateGraceMinutes": LATE_GRACE_MINUTES,
        }

    slot_start, slot_end = bounds
    join_opens = slot_start - timedelta(minutes=EARLY_GRACE_MINUTES)
    grace_ends = slot_end + timedelta(minutes=LATE_GRACE_MINUTES)
    soft_at = slot_end - timedelta(minutes=SOFT_WARN_BEFORE_END_MINUTES)

    force_end = now >= grace_ends
    in_grace = slot_end <= now < grace_ends
    soft_warn = (not force_end) and now >= soft_at
    can_join = join_opens <= now < grace_ends

    message = None
    if now < join_opens:
        message = f"Join opens at {slot_start.strftime('%I:%M %p').lstrip('0')}"
    elif force_end:
        message = "This slot has ended"
    elif in_grace:
        message = "Slot ended. Grace period — finish or leave soon."
    elif soft_warn:
        message = "Consultation ends in 2 minutes."

    def _ms(dt: datetime) -> int:
        # Clients treat these as absolute epoch ms in local IST wall clock.
        aware = dt.replace(tzinfo=IST)
        return int(aware.timestamp() * 1000)

    return {
        "slotStartAt": _ms(slot_start),
        "slotEndAt": _ms(slot_end),
        "graceEndsAt": _ms(grace_ends),
        "joinOpensAt": _ms(join_opens),
        "canJoinWindow": can_join,
        "inGrace": in_grace,
        "softWarn": soft_warn,
        "forceEnd": force_end,
        "windowMessage": message,
        "slotDurationMinutes": max(
            1, int((slot_end - slot_start).total_seconds() // 60)
        ),
        "earlyGraceMinutes": EARLY_GRACE_MINUTES,
        "lateGraceMinutes": LATE_GRACE_MINUTES,
    }


def assert_within_join_window(appointment: dict) -> Optional[str]:
    """Return an error message if outside the VC join window."""
    window = slot_window_payload(appointment)
    if window.get("canJoinWindow"):
        return None
    return window.get("windowMessage") or "Video call is not available for this slot right now"
