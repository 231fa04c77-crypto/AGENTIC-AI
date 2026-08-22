"""Follow-up consultation eligibility after COMPLETED."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from app.config.db import db
from app.models import hospital_policy_model
from app.services import appointment_lifecycle_service, trust_score_service


async def open_followup_window(appointment: dict) -> None:
    policy = await hospital_policy_model.get_policy_for_doctor(
        int(appointment["doctor_id"])
    )
    followup_visits = int(policy.get("followup_visits") or 0)
    if followup_visits <= 0:
        await appointment_lifecycle_service.transition(
            int(appointment["id"]),
            "CLOSED",
            actor_role="system",
            reason="No follow-up policy",
        )
        return

    followup_days = int(policy.get("followup_days") or 7)
    valid_until = datetime.utcnow() + timedelta(days=followup_days)
    await db.execute(
        """
        UPDATE appointments SET
            followup_visits_max = $2,
            followup_valid_until = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        """,
        int(appointment["id"]),
        followup_visits,
        valid_until,
    )
    await appointment_lifecycle_service.transition(
        int(appointment["id"]),
        "FOLLOWUP_AVAILABLE",
        actor_role="system",
        reason="Consultation completed",
    )


async def use_followup_visit(appointment_id: int, user_id: int) -> dict:
    appointment = await db.fetch_row(
        "SELECT * FROM appointments WHERE id = $1 AND user_id = $2",
        int(appointment_id),
        int(user_id),
    )
    if not appointment:
        raise appointment_lifecycle_service.AppointmentPolicyError("Not found")

    ls = (appointment.get("lifecycle_status") or "BOOKED").upper()
    if ls != "FOLLOWUP_AVAILABLE":
        raise appointment_lifecycle_service.AppointmentPolicyError(
            "Follow-up is not available for this appointment."
        )

    used = int(appointment.get("followup_visits_used") or 0)
    max_visits = int(appointment.get("followup_visits_max") or 0)
    if used >= max_visits:
        raise appointment_lifecycle_service.AppointmentPolicyError(
            "Follow-up visit limit reached."
        )

    followup_until = appointment.get("followup_valid_until")
    if followup_until and isinstance(followup_until, datetime):
        if datetime.utcnow() > followup_until:
            await appointment_lifecycle_service.transition(
                int(appointment_id),
                "FOLLOWUP_EXPIRED",
                actor_id=user_id,
                actor_role="patient",
            )
            raise appointment_lifecycle_service.AppointmentPolicyError(
                "Follow-up window has expired."
            )

    new_used = used + 1
    await db.execute(
        """
        UPDATE appointments SET
            followup_visits_used = $2,
            visit_count = visit_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        """,
        int(appointment_id),
        new_used,
    )
    await appointment_lifecycle_service.transition(
        int(appointment_id),
        "FOLLOWUP_USED",
        actor_id=user_id,
        actor_role="patient",
    )
    await trust_score_service.apply_event(user_id, "FOLLOWUP_VISIT")

    if new_used >= max_visits:
        await appointment_lifecycle_service.transition(
            int(appointment_id),
            "FOLLOWUP_EXPIRED",
            actor_id=user_id,
            actor_role="patient",
        )
    else:
        await appointment_lifecycle_service.transition(
            int(appointment_id),
            "FOLLOWUP_AVAILABLE",
            actor_id=user_id,
            actor_role="patient",
        )

    updated = await db.fetch_row(
        "SELECT * FROM appointments WHERE id = $1",
        int(appointment_id),
    )
    return dict(updated) if updated else {}
