"""Slot capacity validation beyond doctor_slots row locking."""
from __future__ import annotations

from datetime import date
from typing import Any, Optional

from app.config.db import db
from app.models import hospital_policy_model
from app.services.appointment_lifecycle_service import ACTIVE_STATUSES

# Seat occupancy must not count follow-up windows or MISSED — those must not
# block new bookings into the same slot after policy.
OCCUPYING_STATUSES = frozenset(
    s for s in ACTIVE_STATUSES if s not in ("FOLLOWUP_AVAILABLE", "MISSED")
)
ACTIVE_LIST = list(OCCUPYING_STATUSES | {"CHECKED_IN"})


async def count_active_for_slot(
    doctor_id: int,
    slot_date: str,
    slot_time: str,
    *,
    mode: Optional[str] = None,
    slot_id: Optional[int] = None,
) -> int:
    if slot_id:
        row = await db.fetch_row(
            """
            SELECT COUNT(*)::int AS c FROM appointments
            WHERE slot_id = $1
              AND lifecycle_status = ANY($2::varchar[])
              AND cancelled = false
            """,
            int(slot_id),
            ACTIVE_LIST,
        )
        return int(row["c"]) if row else 0

    row = await db.fetch_row(
        """
        SELECT COUNT(*)::int AS c FROM appointments
        WHERE doctor_id = $1
          AND slot_date = $2
          AND slot_time = $3
          AND lifecycle_status = ANY($4::varchar[])
          AND cancelled = false
        """,
        int(doctor_id),
        slot_date,
        slot_time,
        ACTIVE_LIST,
    )
    return int(row["c"]) if row else 0


async def _doctor_block_capacity(
    doctor_id: int,
    slot_type: str,
    *,
    doctor_ref: Optional[str] = None,
) -> int:
    """Doctor max for morning/evening OPD; hospital policy as ceiling only."""
    row = None
    ref = str(doctor_ref or "").strip()
    if ref.startswith("emb_"):
        row = await db.fetch_row(
            """
            SELECT max_appointments_morning, max_appointments_afternoon
            FROM hospital_tieup_doctors WHERE id = $1
            """,
            int(doctor_id),
        )
    else:
        row = await db.fetch_row(
            """
            SELECT max_appointments_morning, max_appointments_afternoon
            FROM doctors WHERE id = $1
            """,
            int(doctor_id),
        )
        if not row:
            row = await db.fetch_row(
                """
                SELECT max_appointments_morning, max_appointments_afternoon
                FROM hospital_tieup_doctors WHERE id = $1
                """,
                int(doctor_id),
            )
    if slot_type == "morning_opd":
        doc_cap = int(row["max_appointments_morning"]) if row and row.get("max_appointments_morning") is not None else 20
    else:
        doc_cap = int(row["max_appointments_afternoon"]) if row and row.get("max_appointments_afternoon") is not None else 20

    policy = await hospital_policy_model.get_policy_for_doctor(int(doctor_id))
    policy_cap = int(policy.get("opd_slot_capacity") or 0) if policy else 0
    if policy_cap > 0:
        return max(1, min(doc_cap, policy_cap))
    return max(1, doc_cap)


async def assert_capacity_available(
    doctor_id: int,
    slot: dict[str, Any],
    *,
    slot_date_str: Optional[str] = None,
) -> Optional[str]:
    """Enforce seat limits from doctor max (OPD) or hospital video policy."""
    mode = (slot.get("mode") or "offline").lower()
    slot_type = slot.get("slot_type") or ""
    doctor_ref = slot.get("doctor_ref")

    if mode == "online" or slot_type == "video":
        # One patient per video time slot; doctor max_video_slots controls how
        # many such slots are generated per day (not concurrent seats on one row).
        capacity = 1
        msg = "Video slot already booked."
    elif slot_type in ("morning_opd", "evening_opd"):
        capacity = await _doctor_block_capacity(
            int(doctor_id), slot_type, doctor_ref=doctor_ref
        )
        msg = "Slot already full."
    else:
        capacity = await _doctor_block_capacity(
            int(doctor_id), "morning_opd", doctor_ref=doctor_ref
        )
        msg = "Slot already full."

    slot_date = slot.get("slot_date")
    if isinstance(slot_date, date):
        from app.services.doctor_slot_service import legacy_slot_date
        slot_date_str = legacy_slot_date(slot_date)
    elif not slot_date_str:
        slot_date_str = ""

    from app.services.doctor_slot_service import slot_time_label
    slot_time = slot_time_label(slot)

    count = await count_active_for_slot(
        int(doctor_id),
        slot_date_str,
        slot_time,
        mode=mode,
        slot_id=int(slot["id"]) if slot.get("id") else None,
    )

    if slot_type in ("morning_opd", "evening_opd"):
        # Prefer counting booked seat rows in the block (source of truth for UI counts).
        block_booked = await _count_block_booked_seats(
            slot.get("doctor_ref"),
            slot.get("slot_date"),
            slot_type,
        )
        if block_booked >= capacity:
            return msg
        return None

    if count >= capacity:
        return msg
    return None


async def _count_block_bookings(
    doctor_ref: Optional[str],
    slot_date: Any,
    slot_type: str,
) -> int:
    if not doctor_ref or not slot_date:
        return 0
    row = await db.fetch_row(
        """
        SELECT COUNT(*)::int AS c
        FROM appointments a
        JOIN doctor_slots ds ON ds.id = a.slot_id
        WHERE ds.doctor_ref = $1
          AND ds.slot_date = $2
          AND ds.slot_type = $3
          AND a.lifecycle_status = ANY($4::varchar[])
          AND a.cancelled = false
        """,
        str(doctor_ref),
        slot_date,
        slot_type,
        ACTIVE_LIST,
    )
    return int(row["c"]) if row else 0


async def _count_block_booked_seats(
    doctor_ref: Optional[str],
    slot_date: Any,
    slot_type: str,
) -> int:
    """Count doctor_slots rows already booked for this OPD block."""
    if not doctor_ref or not slot_date:
        return await _count_block_bookings(doctor_ref, slot_date, slot_type)
    row = await db.fetch_row(
        """
        SELECT COUNT(*)::int AS c
        FROM doctor_slots
        WHERE doctor_ref = $1
          AND slot_date = $2
          AND slot_type = $3
          AND status = 'booked'
        """,
        str(doctor_ref),
        slot_date,
        slot_type,
    )
    return int(row["c"]) if row else 0
