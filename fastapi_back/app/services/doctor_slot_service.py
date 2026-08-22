import asyncio
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from app.config.db import db
from app.models import doctor_model, doctor_slot_model, doctor_schedule_model

IST = ZoneInfo("Asia/Kolkata")

MORNING_START = time(10, 0)
MORNING_END = time(13, 0)
EVENING_START = time(18, 0)
EVENING_END = time(21, 0)
VC_START = time(14, 0)
OFFLINE_SLOT_MINUTES = 9
VC_SLOT_MINUTES = 15
OFFLINE_SLOTS_PER_BLOCK = 20
VC_SLOTS_PER_DAY = 4
SCHEDULE_DAYS = 5


def _today_ist() -> date:
    return datetime.now(IST).date()


def _parse_time_str(val: Optional[str], default_time: time) -> time:
    if not val:
        return default_time
    try:
        parts = val.split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        return time(h, m)
    except Exception:
        return default_time


def _calculate_slot_count(start: time, end: time, slot_size_mins: int) -> int:
    dt_start = datetime.combine(date.today(), start)
    dt_end = datetime.combine(date.today(), end)
    if dt_end <= dt_start:
        dt_end += timedelta(days=1)
    total_mins = int((dt_end - dt_start).total_seconds() / 60)
    return max(1, total_mins // slot_size_mins)


def _session_window_minutes(start: time, end: time) -> int:
    dt_start = datetime.combine(date.today(), start)
    dt_end = datetime.combine(date.today(), end)
    if dt_end <= dt_start:
        dt_end += timedelta(days=1)
    return max(1, int((dt_end - dt_start).total_seconds() / 60))


def _seat_duration_minutes(start: time, end: time, count: int) -> int:
    """Minutes per seat so exactly `count` seats fit in the OP window.

    Prefer the standard 9-minute OPD seat when it fits; otherwise compress
    so doctor dashboard capacity is never silently truncated by the clock.
    """
    if count <= 0:
        return OFFLINE_SLOT_MINUTES
    window = _session_window_minutes(start, end)
    if count * OFFLINE_SLOT_MINUTES <= window:
        return OFFLINE_SLOT_MINUTES
    return max(1, window // count)


def _now_ist_time() -> time:
    return datetime.now(IST).time()


# End-of-block times used to auto-close elapsed OPD blocks for the current day.
_BLOCK_END_TIME = {
    "morning_opd": MORNING_END,
    "evening_opd": EVENING_END,
}


def _block_has_passed(slot_type: str, slot_day: date) -> bool:
    """True when slot_day is today (IST) and the block's end time has already passed."""
    if slot_day != _today_ist():
        return False
    end_time = _BLOCK_END_TIME.get(slot_type)
    if end_time is None:
        return False
    return _now_ist_time() >= end_time


def normalize_doctor_ref(doc_id: Any) -> Tuple[str, int]:
    text = str(doc_id).strip()
    if text.startswith("emb_"):
        num = int(text.replace("emb_", ""))
        return text, num
    num = int(text)
    return text, num


def normalize_booking_mode(mode_or_visit: Optional[str]) -> str:
    """Map visitType/mode strings to doctor_slots mode (offline | online)."""
    m = (mode_or_visit or "").lower().strip()
    if m in ("online", "video"):
        return "online"
    if m in (
        "offline",
        "in-clinic",
        "in_clinic",
        "in-person",
        "in_person",
        "inperson",
        "in clinic",
        "in person",
    ):
        return "offline"
    return m or "offline"


def infer_slot_type_from_label(
    slot_time: Optional[str], slot_type: Optional[str] = None
) -> Optional[str]:
    if slot_type in ("morning_opd", "evening_opd", "video"):
        return slot_type
    t = (slot_time or "").lower()
    if not t:
        return None
    if "evening" in t or "6:00" in t or "18:" in t or "9:00 pm" in t:
        return "evening_opd"
    if "10:00" in t or "morning" in t or "1:00 pm" in t:
        return "morning_opd"
    return None


def legacy_slot_date(d: date) -> str:
    return f"{d.day}_{d.month}_{d.year}"


def legacy_slot_date_padded(d: date) -> str:
    return f"{d.day:02d}_{d.month:02d}_{d.year}"


def format_time_12h(t: time) -> str:
    dt = datetime.combine(date.today(), t)
    return dt.strftime("%I:%M %p").lstrip("0")


def format_range_12h(start: time, end: time) -> str:
    return f"{format_time_12h(start)} - {format_time_12h(end)}"


def _add_minutes(t: time, minutes: int) -> time:
    base = datetime.combine(date.today(), t) + timedelta(minutes=minutes)
    return base.time()


async def list_bookable_doctor_refs() -> List[Tuple[str, int]]:
    refs: List[Tuple[str, int]] = []
    rows = await db.query(
        "SELECT id FROM doctors WHERE COALESCE(available, true) = true ORDER BY id"
    )
    for row in rows:
        refs.append((str(row["id"]), int(row["id"])))
    try:
        emb_rows = await db.query(
            """
            SELECT id FROM hospital_tieup_doctors
            WHERE COALESCE(available, true) = true
            ORDER BY id
            """
        )
        for row in emb_rows:
            refs.append((f"emb_{row['id']}", int(row["id"])))
    except Exception as e:
        print(f"[WARNING] hospital_tieup_doctors slots skip: {e}")
    return refs


def _append_opd_seats(
    rows: List[Dict[str, Any]],
    *,
    doctor_ref: str,
    doctor_numeric_id: int,
    day: date,
    date_key: str,
    start: time,
    end: time,
    count: int,
    slot_type: str,
    code_prefix: str,
) -> None:
    """Append exactly `count` OPD seat rows spanning [start, end).

    Doctor dashboard capacity is authoritative: we always emit `count` seats,
    spacing them evenly across the OP window (9-min when that fits).
    """
    if count <= 0:
        return
    window = _session_window_minutes(start, end)
    seat_mins = _seat_duration_minutes(start, end, count)
    use_fixed = count * seat_mins <= window and seat_mins == OFFLINE_SLOT_MINUTES

    if use_fixed:
        cursor = start
        for i in range(count):
            seat_end = _add_minutes(cursor, seat_mins)
            rows.append(
                {
                    "slot_code": f"DS-{date_key}-{code_prefix}{i+1:02d}-{doctor_ref}",
                    "doctor_ref": doctor_ref,
                    "doctor_numeric_id": doctor_numeric_id,
                    "slot_date": day,
                    "start_time": cursor,
                    "end_time": seat_end,
                    "mode": "offline",
                    "slot_type": slot_type,
                }
            )
            cursor = seat_end
        return

    # Evenly distribute when capacity exceeds standard 9-min packing.
    for i in range(count):
        offset_start = (i * window) // count
        offset_end = ((i + 1) * window) // count
        if offset_end <= offset_start:
            offset_end = offset_start + 1
        seat_start = _add_minutes(start, offset_start)
        seat_end = _add_minutes(start, offset_end)
        rows.append(
            {
                "slot_code": f"DS-{date_key}-{code_prefix}{i+1:02d}-{doctor_ref}",
                "doctor_ref": doctor_ref,
                "doctor_numeric_id": doctor_numeric_id,
                "slot_date": day,
                "start_time": seat_start,
                "end_time": seat_end,
                "mode": "offline",
                "slot_type": slot_type,
            }
        )


def _append_video_seats(
    rows: List[Dict[str, Any]],
    *,
    doctor_ref: str,
    doctor_numeric_id: int,
    day: date,
    date_key: str,
    start: time,
    end: time,
    count: int,
    slot_minutes: int,
) -> None:
    """Append exactly `count` video seats inside [start, end)."""
    if count <= 0:
        return
    mins = max(5, int(slot_minutes or VC_SLOT_MINUTES))
    window = _session_window_minutes(start, end)
    # Prefer configured duration when it fits; otherwise pack evenly in the window.
    if count * mins <= window:
        cursor = start
        for i in range(count):
            seat_end = _add_minutes(cursor, mins)
            rows.append(
                {
                    "slot_code": f"DS-{date_key}-V{i+1:02d}-{doctor_ref}",
                    "doctor_ref": doctor_ref,
                    "doctor_numeric_id": doctor_numeric_id,
                    "slot_date": day,
                    "start_time": cursor,
                    "end_time": seat_end,
                    "mode": "online",
                    "slot_type": "video",
                }
            )
            cursor = seat_end
        return

    for i in range(count):
        offset_start = (i * window) // count
        offset_end = ((i + 1) * window) // count
        if offset_end <= offset_start:
            offset_end = offset_start + 1
        seat_start = _add_minutes(start, offset_start)
        seat_end = _add_minutes(start, offset_end)
        rows.append(
            {
                "slot_code": f"DS-{date_key}-V{i+1:02d}-{doctor_ref}",
                "doctor_ref": doctor_ref,
                "doctor_numeric_id": doctor_numeric_id,
                "slot_date": day,
                "start_time": seat_start,
                "end_time": seat_end,
                "mode": "online",
                "slot_type": "video",
            }
        )


def _build_day_slot_rows(
    doctor_ref: str,
    doctor_numeric_id: int,
    day: date,
    t_morning_start: time,
    t_morning_end: time,
    t_afternoon_start: time,
    t_afternoon_end: time,
    morning_slots_count: int,
    afternoon_slots_count: int,
    *,
    t_video_start: Optional[time] = None,
    t_video_end: Optional[time] = None,
    video_slots_count: int = VC_SLOTS_PER_DAY,
    video_slot_minutes: int = VC_SLOT_MINUTES,
) -> List[Dict[str, Any]]:
    date_key = day.strftime("%Y%m%d")
    rows: List[Dict[str, Any]] = []

    _append_opd_seats(
        rows,
        doctor_ref=doctor_ref,
        doctor_numeric_id=doctor_numeric_id,
        day=day,
        date_key=date_key,
        start=t_morning_start,
        end=t_morning_end,
        count=morning_slots_count,
        slot_type="morning_opd",
        code_prefix="M",
    )

    v_start = t_video_start or VC_START
    v_end = t_video_end or _add_minutes(VC_START, VC_SLOTS_PER_DAY * VC_SLOT_MINUTES)
    _append_video_seats(
        rows,
        doctor_ref=doctor_ref,
        doctor_numeric_id=doctor_numeric_id,
        day=day,
        date_key=date_key,
        start=v_start,
        end=v_end,
        count=video_slots_count,
        slot_minutes=video_slot_minutes,
    )

    _append_opd_seats(
        rows,
        doctor_ref=doctor_ref,
        doctor_numeric_id=doctor_numeric_id,
        day=day,
        date_key=date_key,
        start=t_afternoon_start,
        end=t_afternoon_end,
        count=afternoon_slots_count,
        slot_type="evening_opd",
        code_prefix="E",
    )

    return rows


async def generate_day_slots(doctor_ref: str, doctor_numeric_id: int, day: date, force_regenerate: bool = False):
    has_slots = await doctor_slot_model.day_has_slots(doctor_ref, day)

    # Fetch doctor timing parameters from DB
    op_start = "10:00"
    op_end = "13:00"
    op_start_afternoon = "18:00"
    op_end_afternoon = "21:00"
    morning_slots = 20
    afternoon_slots = 20
    video_op_start = "14:00"
    video_op_end = "15:00"
    video_slots = VC_SLOTS_PER_DAY
    video_mins = VC_SLOT_MINUTES

    try:
        if str(doctor_ref).startswith("emb_"):
            row = await db.fetch_row(
                """
                SELECT op_start, op_end, op_start_afternoon, op_end_afternoon,
                       max_appointments_morning, max_appointments_afternoon,
                       video_op_start, video_op_end, max_video_slots, video_slot_minutes
                FROM hospital_tieup_doctors WHERE id = $1
                """,
                int(doctor_numeric_id),
            )
        else:
            row = await db.fetch_row(
                """
                SELECT op_start, op_end, op_start_afternoon, op_end_afternoon,
                       max_appointments_morning, max_appointments_afternoon,
                       video_op_start, video_op_end, max_video_slots, video_slot_minutes
                FROM doctors WHERE id = $1
                """,
                int(doctor_numeric_id),
            )
        if row:
            if row.get("op_start"): op_start = row["op_start"]
            if row.get("op_end"): op_end = row["op_end"]
            if row.get("op_start_afternoon"): op_start_afternoon = row["op_start_afternoon"]
            if row.get("op_end_afternoon"): op_end_afternoon = row["op_end_afternoon"]
            if row.get("max_appointments_morning") is not None:
                morning_slots = int(row["max_appointments_morning"])
            if row.get("max_appointments_afternoon") is not None:
                afternoon_slots = int(row["max_appointments_afternoon"])
            if row.get("video_op_start"):
                video_op_start = str(row["video_op_start"])[:5]
            if row.get("video_op_end"):
                video_op_end = str(row["video_op_end"])[:5]
            if row.get("max_video_slots") is not None:
                video_slots = max(0, int(row["max_video_slots"]))
            if row.get("video_slot_minutes") is not None:
                video_mins = max(5, int(row["video_slot_minutes"]))
            # Hospital policy is a ceiling per session (no half-split).
            try:
                from app.models import hospital_policy_model
                policy = await hospital_policy_model.get_policy_for_doctor(int(doctor_numeric_id))
                policy_cap = int(policy.get("opd_slot_capacity") or 0) if policy else 0
                if policy_cap > 0:
                    morning_slots = min(morning_slots, policy_cap)
                    afternoon_slots = min(afternoon_slots, policy_cap)
                video_cap = int(policy.get("video_slot_capacity") or 0) if policy else 0
                if video_cap > 0:
                    video_slots = min(video_slots, video_cap)
            except Exception:
                pass

            # Per-day override (half-day / custom times) wins over global profile.
            try:
                from app.models import doctor_schedule_model as dsm
                ov = await dsm.get_override_for_date(int(doctor_numeric_id), day)
                if ov:
                    if ov.get("is_cancelled"):
                        await db.execute(
                            "DELETE FROM doctor_slots WHERE doctor_ref = $1 AND slot_date = $2 AND status = 'available'",
                            doctor_ref,
                            day,
                        )
                        return
                    if ov.get("morning_start"):
                        op_start = str(ov["morning_start"])[:5]
                    if ov.get("morning_end"):
                        op_end = str(ov["morning_end"])[:5]
                    if ov.get("afternoon_start"):
                        op_start_afternoon = str(ov["afternoon_start"])[:5]
                    if ov.get("afternoon_end"):
                        op_end_afternoon = str(ov["afternoon_end"])[:5]
                    if ov.get("max_appointments_morning") is not None:
                        morning_slots = int(ov["max_appointments_morning"])
                    if ov.get("max_appointments_afternoon") is not None:
                        afternoon_slots = int(ov["max_appointments_afternoon"])
                    # Half-day: missing session window => zero seats for that session.
                    if not ov.get("morning_start") and not (
                        ov.get("start_time") and not ov.get("morning_start")
                    ):
                        if ov.get("afternoon_start") or (
                            ov.get("max_appointments_morning") == 0
                        ):
                            if not ov.get("morning_start") and ov.get("afternoon_start"):
                                morning_slots = 0
                    if not ov.get("afternoon_start") and not ov.get("start_time"):
                        if ov.get("morning_start") and ov.get("max_appointments_afternoon") == 0:
                            afternoon_slots = 0
                    if ov.get("max_appointments_morning") == 0:
                        morning_slots = 0
                    if ov.get("max_appointments_afternoon") == 0:
                        afternoon_slots = 0
                    # Legacy single-window override → morning only, no afternoon seats.
                    if ov.get("start_time") and not ov.get("morning_start"):
                        op_start = str(ov["start_time"])[:5]
                        if ov.get("end_time"):
                            op_end = str(ov["end_time"])[:5]
                        afternoon_slots = 0
                        if ov.get("max_capacity") is not None:
                            morning_slots = int(ov["max_capacity"])
            except Exception as ov_err:
                print(f"[WARNING] schedule override apply: {ov_err}")
    except Exception as e:
        print(f"[WARNING] generate_day_slots db fetch error: {e}")

    # Skip rebuild when existing seat totals already meet configured capacity.
    # (>= allows historically over-booked days to stop regenerating in a loop.)
    if not force_regenerate and has_slots:
        try:
            summaries = await doctor_slot_model.get_offline_block_summary(doctor_ref, day, day)
            by_type = {r["slot_type"]: int(r["total_count"]) for r in summaries}
            morning_ok = by_type.get("morning_opd", 0) >= int(morning_slots)
            evening_ok = by_type.get("evening_opd", 0) >= int(afternoon_slots)
            video_row = await db.fetch_row(
                """
                SELECT COUNT(*)::int AS c FROM doctor_slots
                WHERE doctor_ref = $1 AND slot_date = $2 AND slot_type = 'video'
                """,
                doctor_ref,
                day,
            )
            video_ok = int(video_row["c"] if video_row else 0) >= int(video_slots)
            if morning_ok and evening_ok and video_ok:
                return
        except Exception:
            pass

    t_morning_start = _parse_time_str(op_start, time(10, 0))
    t_morning_end = _parse_time_str(op_end, time(13, 0))
    t_afternoon_start = _parse_time_str(op_start_afternoon, time(18, 0))
    t_afternoon_end = _parse_time_str(op_end_afternoon, time(21, 0))
    t_video_start = _parse_time_str(video_op_start, VC_START)
    t_video_end = _parse_time_str(
        video_op_end, _add_minutes(VC_START, VC_SLOTS_PER_DAY * VC_SLOT_MINUTES)
    )

    # Fetch booked/completed slots for this day to avoid overlaps
    booked_slots = []
    booked_morning = 0
    booked_evening = 0
    booked_video = 0
    if has_slots:
        booked_slots = await db.query(
            """
            SELECT start_time, end_time, slot_type
            FROM doctor_slots
            WHERE doctor_ref = $1 AND slot_date = $2 AND status != 'available'
            """,
            doctor_ref,
            day
        )
        for b in booked_slots:
            st = b.get("slot_type")
            if st == "morning_opd":
                booked_morning += 1
            elif st == "evening_opd":
                booked_evening += 1
            elif st == "video":
                booked_video += 1
        # Delete only available slots
        await db.execute(
            "DELETE FROM doctor_slots WHERE doctor_ref = $1 AND slot_date = $2 AND status = 'available'",
            doctor_ref,
            day
        )

    # Create only the remaining seats so booked rows + new rows == doctor capacity.
    morning_to_create = max(0, int(morning_slots) - booked_morning)
    afternoon_to_create = max(0, int(afternoon_slots) - booked_evening)
    video_to_create = max(0, int(video_slots) - booked_video)

    # Build potential new slots
    potential_rows = _build_day_slot_rows(
        doctor_ref,
        doctor_numeric_id,
        day,
        t_morning_start,
        t_morning_end,
        t_afternoon_start,
        t_afternoon_end,
        morning_to_create,
        afternoon_to_create,
        t_video_start=t_video_start,
        t_video_end=t_video_end,
        video_slots_count=video_to_create,
        video_slot_minutes=video_mins,
    )

    # Filter out slots that overlap with booked slots
    final_rows = []
    for r in potential_rows:
        overlaps = False
        r_start = r["start_time"]
        r_end = r["end_time"]
        for b in booked_slots:
            b_start = b["start_time"]
            b_end = b["end_time"]
            if max(r_start, b_start) < min(r_end, b_end):
                overlaps = True
                break
        if not overlaps:
            final_rows.append(r)

    if final_rows:
        await doctor_slot_model.insert_slots_bulk(final_rows)


async def ensure_all_doctors_scheduled(days: int = SCHEDULE_DAYS):
    await doctor_slot_model.ensure_doctor_slots_schema()
    start = _today_ist()
    refs = await list_bookable_doctor_refs()
    for doctor_ref, doctor_numeric_id in refs:
        # Respect per-doctor booking_window_days if set
        window = await _get_doctor_booking_window(doctor_ref)
        effective_days = window if window else days
        await asyncio.gather(
            *[
                generate_day_slots(doctor_ref, doctor_numeric_id, start + timedelta(days=offset))
                for offset in range(effective_days)
            ]
        )


async def _get_doctor_booking_window(doctor_ref: str) -> Optional[int]:
    """Fetch booking_window_days from the doctor record. Returns None for embedded doctors."""
    if str(doctor_ref).startswith("emb_"):
        return None
    try:
        row = await db.fetch_row(
            "SELECT booking_window_days FROM doctors WHERE id = $1",
            int(doctor_ref),
        )
        if row and row.get("booking_window_days"):
            return int(row["booking_window_days"])
    except Exception:
        pass
    return None


async def _is_date_blocked_for_doctor(doctor_numeric_id: int, check_date: date) -> bool:
    """Return True if the date is blocked by hospital calendar or a doctor leave."""
    # Check hospital calendar (get hospital_id for doctor)
    try:
        row = await db.fetch_row(
            "SELECT hospital_id FROM doctors WHERE id = $1",
            int(doctor_numeric_id),
        )
        if row and row.get("hospital_id"):
            hospital_id = int(row["hospital_id"])
            if await doctor_schedule_model.is_date_hospital_holiday(hospital_id, check_date):
                return True
    except Exception:
        pass

    # Check doctor leave
    try:
        if await doctor_schedule_model.is_doctor_on_leave(doctor_numeric_id, check_date):
            return True
    except Exception:
        pass

    return False


async def _blocked_dates_in_range(
    doctor_numeric_id: int,
    start: date,
    end: date,
) -> set:
    """Load hospital calendar + leaves once and return blocked dates in [start, end]."""
    blocked: set = set()
    hospital_id = None
    try:
        row = await db.fetch_row(
            "SELECT hospital_id FROM doctors WHERE id = $1",
            int(doctor_numeric_id),
        )
        if row and row.get("hospital_id"):
            hospital_id = int(row["hospital_id"])
    except Exception:
        hospital_id = None

    calendar = None
    if hospital_id is not None:
        try:
            calendar = await doctor_schedule_model.get_hospital_calendar(hospital_id)
        except Exception:
            calendar = None

    closed_days: list = []
    holiday_dates: set = set()
    if calendar:
        closed_days = list(calendar.get("default_closed_days") or [0])
        for h in calendar.get("holidays") or []:
            d = h.get("date") if isinstance(h, dict) else None
            if d:
                holiday_dates.add(str(d))

    leave_ranges = []
    try:
        leaves = await doctor_schedule_model.get_leaves_for_doctor(int(doctor_numeric_id))
        for leave in leaves or []:
            if str(leave.get("status") or "").lower() != "approved":
                continue
            ls = leave.get("start_date")
            le = leave.get("end_date")
            if ls and le:
                leave_ranges.append((ls, le))
    except Exception:
        leave_ranges = []

    iso_to_ours = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0}
    cursor = start
    while cursor <= end:
        day_num = iso_to_ours[cursor.isoweekday()]
        if closed_days and day_num in closed_days:
            blocked.add(cursor)
        elif cursor.isoformat() in holiday_dates:
            blocked.add(cursor)
        else:
            for ls, le in leave_ranges:
                if ls <= cursor <= le:
                    blocked.add(cursor)
                    break
        cursor += timedelta(days=1)
    return blocked


async def _fetch_doctor_opd_config(doctor_ref: str, doctor_numeric_id: int) -> Dict[str, Any]:
    """Load OPD window labels and capacity for public slot display."""
    op_start = "10:00"
    op_end = "13:00"
    op_start_afternoon = "18:00"
    op_end_afternoon = "21:00"
    morning_slots = 20
    afternoon_slots = 20

    try:
        if str(doctor_ref).startswith("emb_"):
            row = await db.fetch_row(
                """
                SELECT op_start, op_end, op_start_afternoon, op_end_afternoon,
                       max_appointments_morning, max_appointments_afternoon
                FROM hospital_tieup_doctors WHERE id = $1
                """,
                int(doctor_numeric_id),
            )
        else:
            row = await db.fetch_row(
                """
                SELECT op_start, op_end, op_start_afternoon, op_end_afternoon,
                       max_appointments_morning, max_appointments_afternoon
                FROM doctors WHERE id = $1
                """,
                int(doctor_numeric_id),
            )
        if row:
            if row.get("op_start"):
                op_start = row["op_start"]
            if row.get("op_end"):
                op_end = row["op_end"]
            if row.get("op_start_afternoon"):
                op_start_afternoon = row["op_start_afternoon"]
            if row.get("op_end_afternoon"):
                op_end_afternoon = row["op_end_afternoon"]
            if row.get("max_appointments_morning") is not None:
                morning_slots = int(row["max_appointments_morning"])
            if row.get("max_appointments_afternoon") is not None:
                afternoon_slots = int(row["max_appointments_afternoon"])
            try:
                from app.models import hospital_policy_model

                policy = await hospital_policy_model.get_policy_for_doctor(int(doctor_numeric_id))
                policy_cap = int(policy.get("opd_slot_capacity") or 0) if policy else 0
                if policy_cap > 0:
                    morning_slots = min(morning_slots, policy_cap)
                    afternoon_slots = min(afternoon_slots, policy_cap)
            except Exception:
                pass
    except Exception as e:
        print(f"[WARNING] _fetch_doctor_opd_config error: {e}")

    def format_timestr_12h(time_str: str) -> str:
        try:
            parts = time_str.split(":")
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
            return format_time_12h(time(h, m))
        except Exception:
            return time_str

    disp_morning = f"{format_timestr_12h(op_start)} - {format_timestr_12h(op_end)}"
    disp_afternoon = f"{format_timestr_12h(op_start_afternoon)} - {format_timestr_12h(op_end_afternoon)}"
    return {
        "morning_slots": morning_slots,
        "afternoon_slots": afternoon_slots,
        "block_meta": {
            "morning_opd": {
                "label": "Morning OPD",
                "display": disp_morning,
                "total_count": morning_slots,
            },
            "evening_opd": {
                "label": "Evening OPD",
                "display": disp_afternoon,
                "total_count": afternoon_slots,
            },
        },
    }


async def get_public_slots(doctor_ref: str, mode: str) -> Dict[str, Any]:
    mode = (mode or "offline").lower()
    if mode not in ("offline", "online"):
        mode = "offline"

    doctor_ref, doctor_numeric_id = normalize_doctor_ref(doctor_ref)
    start = _today_ist()
    end = start + timedelta(days=SCHEDULE_DAYS - 1)

    days_map: Dict[str, Dict[str, Any]] = {}

    if mode == "online":
        rows = await doctor_slot_model.get_slots_for_doctor(doctor_ref, mode, start, end)
        if not rows:
            await ensure_doctor_slots_for_doctor(doctor_ref, days_limit=SCHEDULE_DAYS)
            rows = await doctor_slot_model.get_slots_for_doctor(doctor_ref, mode, start, end)
        for row in rows:
            d: date = row["slot_date"]
            key = d.isoformat()
            if key not in days_map:
                days_map[key] = {
                    "date": key,
                    "slotDate": legacy_slot_date(d),
                    "slotDatePadded": legacy_slot_date_padded(d),
                    "displayDate": d.strftime("%d %b %Y"),
                }
        for row in rows:
            d: date = row["slot_date"]
            key = d.isoformat()
            start_passed = d == _today_ist() and row["start_time"] <= _now_ist_time()
            days_map[key].setdefault("slots", []).append(
                {
                    "slot_id": row["id"],
                    "slot_type": row["slot_type"],
                    "start_time": row["start_time"].strftime("%H:%M"),
                    "end_time": row["end_time"].strftime("%H:%M"),
                    "display": format_range_12h(row["start_time"], row["end_time"]),
                    "available": not start_passed,
                }
            )
        days_list = [days_map[k] for k in sorted(days_map.keys())]
        return {"success": True, "mode": mode, "days": days_list}

    config, summaries = await asyncio.gather(
        _fetch_doctor_opd_config(doctor_ref, doctor_numeric_id),
        doctor_slot_model.get_offline_block_summary(doctor_ref, start, end),
    )
    block_meta = config["block_meta"]
    distinct_days = len({r["slot_date"] for r in summaries})
    if distinct_days < max(1, SCHEDULE_DAYS - 1):
        await ensure_doctor_slots_for_doctor(doctor_ref, days_limit=SCHEDULE_DAYS)
        summaries = await doctor_slot_model.get_offline_block_summary(doctor_ref, start, end)

    for offset in range(SCHEDULE_DAYS):
        d = start + timedelta(days=offset)
        key = d.isoformat()
        days_map.setdefault(
            key,
            {
                "date": key,
                "slotDate": legacy_slot_date(d),
                "slotDatePadded": legacy_slot_date_padded(d),
                "displayDate": d.strftime("%d %b %Y"),
                "blocks": [],
            },
        )

    block_order = ("morning_opd", "evening_opd")
    summary_by_day: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for row in summaries:
        d: date = row["slot_date"]
        key = d.isoformat()
        slot_type = row["slot_type"]
        summary_by_day.setdefault(key, {})[slot_type] = row

    for key, day_entry in days_map.items():
        day_summaries = summary_by_day.get(key, {})
        try:
            day_date = date.fromisoformat(key)
        except ValueError:
            day_date = None
        blocks: List[Dict[str, Any]] = []
        for slot_type in block_order:
            meta = block_meta[slot_type]
            row = day_summaries.get(slot_type)
            avail = int(row["available_count"]) if row else 0
            total = int(row["total_count"]) if row else meta["total_count"]
            rep_id = row.get("representative_slot_id") if row else None
            passed = day_date is not None and _block_has_passed(slot_type, day_date)
            blocks.append(
                {
                    "label": meta["label"],
                    "display": meta["display"],
                    "slot_type": slot_type,
                    "available_count": avail,
                    "total_count": total,
                    "bookable": avail > 0 and rep_id is not None and not passed,
                    "representative_slot_id": rep_id,
                    "slot_id": rep_id,
                }
            )
        day_entry["blocks"] = blocks

    days_list = [days_map[k] for k in sorted(days_map.keys())]
    return {"success": True, "mode": mode, "days": days_list}


async def ensure_doctor_slots_for_doctor(
    doctor_ref: str,
    *,
    days_limit: Optional[int] = None,
):
    """Ensure slot rows exist for the doctor.

    ``days_limit`` caps how many days ahead are touched. Public booking reads
    should pass SCHEDULE_DAYS (5); full booking-window heal belongs on schedule
    save / background jobs — not on every patient GET.
    """
    doctor_ref, doctor_numeric_id = normalize_doctor_ref(doctor_ref)
    # Use dynamic booking window if configured, else fall back to default SCHEDULE_DAYS
    window = await _get_doctor_booking_window(doctor_ref)
    effective_days = window if window else SCHEDULE_DAYS
    if days_limit is not None and days_limit > 0:
        effective_days = min(effective_days, int(days_limit))
    start = _today_ist()
    end = start + timedelta(days=effective_days - 1)

    blocked: set = set()
    if not str(doctor_ref).startswith("emb_"):
        blocked = await _blocked_dates_in_range(doctor_numeric_id, start, end)

    existing = await doctor_slot_model.slot_dates_in_range(doctor_ref, start, end)

    morning_target = 20
    afternoon_target = 20
    video_target = VC_SLOTS_PER_DAY
    try:
        if str(doctor_ref).startswith("emb_"):
            prow = await db.fetch_row(
                """
                SELECT max_appointments_morning, max_appointments_afternoon,
                       max_video_slots
                FROM hospital_tieup_doctors WHERE id = $1
                """,
                int(doctor_numeric_id),
            )
        else:
            prow = await db.fetch_row(
                """
                SELECT max_appointments_morning, max_appointments_afternoon,
                       max_video_slots
                FROM doctors WHERE id = $1
                """,
                int(doctor_numeric_id),
            )
        if prow:
            if prow.get("max_appointments_morning") is not None:
                morning_target = int(prow["max_appointments_morning"])
            if prow.get("max_appointments_afternoon") is not None:
                afternoon_target = int(prow["max_appointments_afternoon"])
            if prow.get("max_video_slots") is not None:
                video_target = max(0, int(prow["max_video_slots"]))
        try:
            from app.models import hospital_policy_model
            policy = await hospital_policy_model.get_policy_for_doctor(int(doctor_numeric_id))
            policy_cap = int(policy.get("opd_slot_capacity") or 0) if policy else 0
            if policy_cap > 0:
                morning_target = min(morning_target, policy_cap)
                afternoon_target = min(afternoon_target, policy_cap)
            video_cap = int(policy.get("video_slot_capacity") or 0) if policy else 0
            if video_cap > 0:
                video_target = min(video_target, video_cap)
        except Exception:
            pass
    except Exception:
        pass

    summary_by_day: Dict[date, Dict[str, int]] = {}
    try:
        for row in await doctor_slot_model.get_offline_block_summary(doctor_ref, start, end):
            d = row["slot_date"]
            summary_by_day.setdefault(d, {})[row["slot_type"]] = int(row["total_count"])
    except Exception:
        summary_by_day = {}

    video_by_day: Dict[date, int] = {}
    try:
        vrows = await db.query(
            """
            SELECT slot_date, COUNT(*)::int AS c
            FROM doctor_slots
            WHERE doctor_ref = $1 AND slot_date >= $2 AND slot_date <= $3
              AND slot_type = 'video'
            GROUP BY slot_date
            """,
            doctor_ref,
            start,
            end,
        )
        for vr in vrows:
            video_by_day[vr["slot_date"]] = int(vr["c"])
    except Exception:
        video_by_day = {}

    tasks = []
    for offset in range(effective_days):
        target_date = start + timedelta(days=offset)
        if target_date in blocked:
            # Drop only available slots on blocked dates; preserve booked/completed.
            if target_date in existing:
                await db.execute(
                    """
                    DELETE FROM doctor_slots
                    WHERE doctor_ref = $1 AND slot_date = $2 AND status = 'available'
                    """,
                    doctor_ref,
                    target_date,
                )
            continue
        if target_date not in existing:
            tasks.append(generate_day_slots(doctor_ref, doctor_numeric_id, target_date))
            continue
        totals = summary_by_day.get(target_date, {})
        if (
            totals.get("morning_opd", 0) < morning_target
            or totals.get("evening_opd", 0) < afternoon_target
            or video_by_day.get(target_date, 0) < video_target
        ):
            # No force: generate_day_slots applies day overrides, then no-ops
            # when totals already meet the effective (possibly overridden) capacity.
            tasks.append(generate_day_slots(doctor_ref, doctor_numeric_id, target_date))
    if tasks:
        await asyncio.gather(*tasks)


async def resolve_slot_for_booking(
    doctor_ref: str,
    slot_id: Optional[int],
    mode: str,
    slot_type: Optional[str] = None,
    slot_date_str: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    doctor_ref, _ = normalize_doctor_ref(doctor_ref)
    mode = normalize_booking_mode(mode)

    if slot_id:
        # Peek first for validation messages; claim holds FOR UPDATE in one TX.
        peek = await doctor_slot_model.get_slot_by_id(int(slot_id))
        if not peek:
            return None, "This slot is no longer available. Please choose another time."
        _, doc_num = normalize_doctor_ref(doctor_ref)
        peek_doc_ref = str(peek.get("doctor_ref") or "")
        peek_doc_num = int(peek.get("doctor_numeric_id") or 0)
        if not peek_doc_num and peek_doc_ref:
            _, peek_doc_num = normalize_doctor_ref(peek_doc_ref)
        if peek_doc_ref != str(doctor_ref) and peek_doc_num != doc_num:
            return None, "This slot does not belong to the selected doctor."
        if peek["mode"] != mode:
            return None, "This slot does not match the selected consultation type."
        if peek["status"] != "available":
            return None, "This time was just booked by another patient."
        if _slot_time_has_passed(peek):
            return None, "This slot time has already passed. Please choose another time."
        # Soft Redis hold (optional) + PostgreSQL claim (authority)
        from app.services import slot_lock_service
        holder = f"book:{doctor_ref}:{slot_id}"
        if not await slot_lock_service.hold_slot(int(slot_id), holder):
            return None, "This time was just booked by another patient."
        slot = await doctor_slot_model.claim_slot_by_id(int(slot_id))
        if not slot:
            await slot_lock_service.release_hold(int(slot_id), holder)
            return None, "This time was just booked by another patient."
        await slot_lock_service.release_hold(int(slot_id), holder)
        return slot, None

    if mode == "offline" and slot_type and slot_date_str:
        d = _parse_legacy_date(slot_date_str)
        if not d:
            return None, "Invalid appointment date."
        if _block_has_passed(slot_type, d):
            return None, "This slot time has already passed. Please choose another time."
        slot = await doctor_slot_model.claim_first_available_in_block(
            doctor_ref, d, slot_type
        )
        if not slot:
            label = "Morning OPD" if slot_type == "morning_opd" else "Evening OPD"
            return None, f"{label} is full for this date. Try another day."
        return slot, None

    return None, "Please select a time slot."


def _slot_time_has_passed(slot: Dict[str, Any]) -> bool:
    """True when a resolved slot row is on today (IST) and its usable time has elapsed.

    Offline OPD closes at the block end; online video closes once the slot start passes.
    """
    slot_day = slot.get("slot_date")
    if not isinstance(slot_day, date) or slot_day != _today_ist():
        return False
    if slot.get("mode") == "offline":
        return _block_has_passed(slot.get("slot_type"), slot_day)
    start = slot.get("start_time")
    if isinstance(start, time):
        return start <= _now_ist_time()
    return False


def _parse_legacy_date(slot_date_str: str) -> Optional[date]:
    try:
        parts = slot_date_str.replace("-", "_").split("_")
        if len(parts) != 3:
            return None
        day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
        return date(year, month, day)
    except Exception:
        return None


def slot_time_label(slot: Dict[str, Any]) -> str:
    return format_range_12h(slot["start_time"], slot["end_time"])


def consultation_fee_for_mode(doc_data: dict, mode: str) -> float:
    mode_l = (mode or "").lower()
    if mode_l == "online":
        return float(doc_data.get("video_consultation_fee") or 450)
    return float(doc_data.get("fees") or 600)


async def release_slot_for_appointment(appointment: dict):
    slot_id = appointment.get("slot_id")
    if not slot_id:
        return
    await doctor_slot_model.release_slot(int(slot_id))
    try:
        from app.controllers.doctor_slot_controller import invalidate_slots_cache
        doc_id = appointment.get("doctor_id")
        if doc_id is not None:
            invalidate_slots_cache(str(doc_id))
    except Exception:
        pass


async def complete_slot_for_appointment(appointment: dict):
    slot_id = appointment.get("slot_id")
    if not slot_id:
        return
    await doctor_slot_model.complete_slot(int(slot_id))


def normalize_appointment_mode_for_db(mode: str) -> str:
    """Map API/slot modes to DB values (appointments_mode_check: In-person | Video)."""
    if str(mode or "").strip().lower() in ("online", "video"):
        return "Video"
    return "In-person"


def appointment_mode_from_slot(slot: Dict[str, Any]) -> str:
    return normalize_appointment_mode_for_db(slot.get("mode"))


async def regenerate_future_slots(doctor_ref: str):
    doctor_ref, doctor_numeric_id = normalize_doctor_ref(doctor_ref)
    window = await _get_doctor_booking_window(doctor_ref)
    effective_days = window if window else SCHEDULE_DAYS
    start = _today_ist()
    
    async def process_day(offset: int):
        target_date = start + timedelta(days=offset)
        if not str(doctor_ref).startswith("emb_"):
            blocked = await _is_date_blocked_for_doctor(doctor_numeric_id, target_date)
            if blocked:
                await db.execute(
                    "DELETE FROM doctor_slots WHERE doctor_ref = $1 AND slot_date = $2 AND status = 'available'",
                    doctor_ref,
                    target_date,
                )
                return
        await generate_day_slots(doctor_ref, doctor_numeric_id, target_date, force_regenerate=True)

    tasks = [process_day(offset) for offset in range(effective_days)]
    await asyncio.gather(*tasks)
    try:
        from app.controllers.doctor_slot_controller import invalidate_slots_cache
        invalidate_slots_cache(str(doctor_numeric_id))
        invalidate_slots_cache(str(doctor_ref))
    except Exception:
        pass
