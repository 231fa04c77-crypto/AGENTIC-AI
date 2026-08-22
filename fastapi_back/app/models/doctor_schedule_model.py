"""Doctor schedule model — weekly timings, overrides, leaves, and hospital calendars."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from app.config.db import db


# ─── Hospital Working Calendar ────────────────────────────────────────────────

async def get_hospital_calendar(hospital_id: int) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        "SELECT * FROM hospital_working_calendars WHERE hospital_id = $1",
        int(hospital_id),
    )


async def upsert_hospital_calendar(
    hospital_id: int,
    default_closed_days: Optional[List[int]] = None,
    holidays: Optional[List[Dict[str, str]]] = None,
) -> Optional[Dict[str, Any]]:
    import json
    closed = default_closed_days if default_closed_days is not None else [0]
    hols = json.dumps(holidays or [])
    return await db.fetch_row(
        """
        INSERT INTO hospital_working_calendars (hospital_id, default_closed_days, holidays)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (hospital_id) DO UPDATE
            SET default_closed_days = EXCLUDED.default_closed_days,
                holidays             = EXCLUDED.holidays
        RETURNING *
        """,
        int(hospital_id),
        closed,
        hols,
    )


async def is_date_hospital_holiday(hospital_id: int, check_date: date) -> bool:
    """Returns True if the given date is a weekend or marked holiday for the hospital."""
    calendar = await get_hospital_calendar(int(hospital_id))
    if not calendar:
        return False

    # Check weekend/closed days (0=Sunday ... 6=Saturday)
    closed_days: List[int] = list(calendar.get("default_closed_days") or [0])
    if check_date.weekday() in [d % 7 for d in closed_days]:
        # weekday() → 0=Mon, so convert: Sunday=6 in Python weekday
        pass
    # Use isoweekday (1=Mon, 7=Sun) mapped to our convention
    iso_to_ours = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0}
    day_num = iso_to_ours[check_date.isoweekday()]
    if day_num in closed_days:
        return True

    # Check holidays
    holidays = calendar.get("holidays") or []
    target = check_date.isoformat()
    return any(h.get("date") == target for h in holidays)


# ─── Doctor Weekly Schedules ──────────────────────────────────────────────────

async def get_weekly_schedules(doctor_id: int) -> List[Dict[str, Any]]:
    return await db.query(
        "SELECT * FROM doctor_weekly_schedules WHERE doctor_id = $1 ORDER BY day_of_week, start_time",
        int(doctor_id),
    )


async def get_schedules_for_day(doctor_id: int, day_of_week: int) -> List[Dict[str, Any]]:
    """Get all schedule sessions for a doctor on a particular weekday (0=Sun, 6=Sat)."""
    return await db.query(
        """
        SELECT * FROM doctor_weekly_schedules
        WHERE doctor_id = $1 AND day_of_week = $2
        ORDER BY start_time ASC
        """,
        int(doctor_id),
        int(day_of_week),
    )


async def create_weekly_schedule(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        """
        INSERT INTO doctor_weekly_schedules
            (doctor_id, day_of_week, start_time, end_time, mode, slot_duration, buffer_time, max_capacity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        """,
        int(data["doctor_id"]),
        int(data["day_of_week"]),
        data["start_time"],
        data["end_time"],
        data["mode"],
        int(data.get("slot_duration", 15)),
        int(data.get("buffer_time", 2)),
        data.get("max_capacity"),
    )


async def delete_weekly_schedule(schedule_id: int) -> None:
    await db.execute("DELETE FROM doctor_weekly_schedules WHERE id = $1", int(schedule_id))


async def replace_weekly_schedules(doctor_id: int, schedules: List[Dict[str, Any]]) -> None:
    """Replace all weekly schedules for a doctor atomically."""
    await db.execute("DELETE FROM doctor_weekly_schedules WHERE doctor_id = $1", int(doctor_id))
    for s in schedules:
        s["doctor_id"] = doctor_id
        await create_weekly_schedule(s)


# ─── Doctor Schedule Overrides ────────────────────────────────────────────────

async def get_override_for_date(doctor_id: int, override_date: date) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        "SELECT * FROM doctor_schedule_overrides WHERE doctor_id = $1 AND override_date = $2",
        int(doctor_id),
        override_date,
    )


async def create_override(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        """
        INSERT INTO doctor_schedule_overrides
            (doctor_id, override_date, start_time, end_time, mode, slot_duration, buffer_time,
             max_capacity, is_cancelled,
             morning_start, morning_end, afternoon_start, afternoon_end,
             max_appointments_morning, max_appointments_afternoon)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT DO NOTHING
        RETURNING *
        """,
        int(data["doctor_id"]),
        data["override_date"],
        data.get("start_time"),
        data.get("end_time"),
        data.get("mode"),
        data.get("slot_duration"),
        data.get("buffer_time"),
        data.get("max_capacity"),
        bool(data.get("is_cancelled", False)),
        data.get("morning_start"),
        data.get("morning_end"),
        data.get("afternoon_start"),
        data.get("afternoon_end"),
        data.get("max_appointments_morning"),
        data.get("max_appointments_afternoon"),
    )


async def upsert_day_override(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Create or replace a per-day OP override (half-day / cancel day)."""
    doctor_id = int(data["doctor_id"])
    override_date = data["override_date"]
    existing = await get_override_for_date(doctor_id, override_date)
    if existing:
        await delete_override(int(existing["id"]))
    return await create_override(data)


async def list_overrides_for_doctor(
    doctor_id: int, *, from_date: Optional[date] = None, to_date: Optional[date] = None
) -> List[Dict[str, Any]]:
    if from_date and to_date:
        return await db.query(
            """
            SELECT * FROM doctor_schedule_overrides
            WHERE doctor_id = $1 AND override_date BETWEEN $2 AND $3
            ORDER BY override_date ASC
            """,
            int(doctor_id),
            from_date,
            to_date,
        )
    return await db.query(
        """
        SELECT * FROM doctor_schedule_overrides
        WHERE doctor_id = $1 AND override_date >= CURRENT_DATE
        ORDER BY override_date ASC
        """,
        int(doctor_id),
    )


async def delete_override(override_id: int) -> None:
    await db.execute("DELETE FROM doctor_schedule_overrides WHERE id = $1", int(override_id))


# ─── Doctor Leaves ────────────────────────────────────────────────────────────

async def get_leaves_for_doctor(doctor_id: int) -> List[Dict[str, Any]]:
    return await db.query(
        "SELECT * FROM doctor_leaves WHERE doctor_id = $1 ORDER BY start_date DESC",
        int(doctor_id),
    )


async def is_doctor_on_leave(doctor_id: int, check_date: date) -> bool:
    """Returns True if the doctor has an approved leave covering the given date."""
    row = await db.fetch_row(
        """
        SELECT 1 FROM doctor_leaves
        WHERE doctor_id = $1
          AND status = 'approved'
          AND start_date <= $2
          AND end_date >= $2
        LIMIT 1
        """,
        int(doctor_id),
        check_date,
    )
    return row is not None


async def create_leave(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        """
        INSERT INTO doctor_leaves (doctor_id, start_date, end_date, leave_type, reason, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """,
        int(data["doctor_id"]),
        data["start_date"],
        data["end_date"],
        data["leave_type"],
        data.get("reason"),
        data.get("status", "approved"),
    )


async def cancel_leave(leave_id: int) -> None:
    await db.execute(
        "UPDATE doctor_leaves SET status = 'cancelled' WHERE id = $1",
        int(leave_id),
    )


async def delete_leave(leave_id: int) -> None:
    await db.execute("DELETE FROM doctor_leaves WHERE id = $1", int(leave_id))
