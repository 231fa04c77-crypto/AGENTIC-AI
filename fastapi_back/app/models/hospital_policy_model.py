"""Per-hospital appointment policy configuration."""
from __future__ import annotations

from typing import Any, Optional

from app.config.db import db

DEFAULT_POLICY: dict[str, Any] = {
    "hospital_id": None,
    "validity_days": 7,
    "max_visits": 3,
    "followup_days": 7,
    "followup_visits": 1,
    # 0 = no ceiling; doctor max_appointments_* from dashboard is authoritative
    # until a hospital explicitly configures opd_slot_capacity.
    "opd_slot_capacity": 0,
    # 0 = no ceiling; doctor max_video_slots is authoritative until hospital sets one.
    "video_slot_capacity": 0,
    "platform_fee_percent": 5.0,
    "grace_reschedule_enabled": True,
    "no_show_auto_hours": 2,
}


async def get_policy(hospital_id: Optional[int]) -> dict[str, Any]:
    if hospital_id is None:
        return dict(DEFAULT_POLICY)
    row = await db.fetch_row(
        "SELECT * FROM hospital_appointment_policies WHERE hospital_id = $1",
        int(hospital_id),
    )
    if not row:
        # No configured policy row → do not invent a 20-seat OPD ceiling.
        return {**DEFAULT_POLICY, "hospital_id": int(hospital_id)}
    return dict(row)


async def get_policy_for_doctor(doctor_id: int) -> dict[str, Any]:
    row = await db.fetch_row(
        "SELECT hospital_id FROM doctors WHERE id = $1",
        int(doctor_id),
    )
    if not row:
        row = await db.fetch_row(
            "SELECT hospital_id FROM hospital_tieup_doctors WHERE id = $1",
            int(doctor_id),
        )
    hospital_id = row.get("hospital_id") if row else None
    return await get_policy(hospital_id)


async def upsert_policy(hospital_id: int, data: dict[str, Any]) -> dict:
    existing = await get_policy(hospital_id)
    merged = {**existing, **data, "hospital_id": int(hospital_id)}
    row = await db.fetch_row(
        """
        INSERT INTO hospital_appointment_policies (
            hospital_id, validity_days, max_visits, followup_days, followup_visits,
            opd_slot_capacity, video_slot_capacity, platform_fee_percent,
            grace_reschedule_enabled, no_show_auto_hours
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (hospital_id) DO UPDATE SET
            validity_days = EXCLUDED.validity_days,
            max_visits = EXCLUDED.max_visits,
            followup_days = EXCLUDED.followup_days,
            followup_visits = EXCLUDED.followup_visits,
            opd_slot_capacity = EXCLUDED.opd_slot_capacity,
            video_slot_capacity = EXCLUDED.video_slot_capacity,
            platform_fee_percent = EXCLUDED.platform_fee_percent,
            grace_reschedule_enabled = EXCLUDED.grace_reschedule_enabled,
            no_show_auto_hours = EXCLUDED.no_show_auto_hours,
            updated_at = NOW()
        RETURNING *
        """,
        int(hospital_id),
        int(merged.get("validity_days", 7)),
        int(merged.get("max_visits", 3)),
        int(merged.get("followup_days", 7)),
        int(merged.get("followup_visits", 1)),
        int(merged.get("opd_slot_capacity", 20)),
        int(merged.get("video_slot_capacity", 4)),
        float(merged.get("platform_fee_percent", 5.0)),
        bool(merged.get("grace_reschedule_enabled", True)),
        int(merged.get("no_show_auto_hours", 2)),
    )
    return dict(row) if row else merged
