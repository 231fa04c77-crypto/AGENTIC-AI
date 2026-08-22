"""Refund calculation and persistence for appointment cancellations."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Optional

from app.config.db import db
from app.models import hospital_policy_model
from app.services import audit_service, trust_score_service


def _as_date(value: Any) -> Optional[date]:
    """Coerce an ISO date string to a date for asyncpg DATE columns."""
    if value is None or isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def _add_working_days(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


async def compute_refund(
    user_id: int,
    appointment: dict,
) -> dict[str, Any]:
    amount_inr = float(appointment.get("amount") or 0)
    amount_paise = int(round(amount_inr * 100))
    paid = bool(appointment.get("payment") or appointment.get("paid_at_booking"))
    if not paid:
        return {
            "refundAmountPaise": 0,
            "platformFeePaise": 0,
            "isFirstRefund": False,
            "eligible": False,
        }

    user = await db.fetch_row(
        "SELECT first_refund_used FROM users WHERE id = $1",
        int(user_id),
    )
    first_refund = not bool(user and user.get("first_refund_used"))

    policy = await hospital_policy_model.get_policy_for_doctor(
        int(appointment["doctor_id"])
    )
    fee_pct = float(policy.get("platform_fee_percent") or 5.0)
    platform_fee_paise = int(round(amount_paise * fee_pct / 100))

    if first_refund:
        refund_paise = amount_paise
        platform_fee_paise = 0
    else:
        refund_count = await db.fetch_row(
            "SELECT COUNT(*)::int AS c FROM appointment_refunds WHERE user_id = $1",
            int(user_id),
        )
        grants = int(refund_count["c"]) if refund_count else 0
        if grants >= 2:
            platform_fee_paise = int(round(amount_paise * min(fee_pct * 2, 25) / 100))
        refund_paise = max(0, amount_paise - platform_fee_paise)

    return {
        "refundAmountPaise": refund_paise,
        "platformFeePaise": platform_fee_paise,
        "isFirstRefund": first_refund,
        "eligible": True,
        "expectedBy": _add_working_days(date.today(), 4).isoformat(),
    }


async def create_refund_record(
    appointment_id: int,
    user_id: int,
    *,
    reason: str,
    payment_transaction_id: Optional[int] = None,
) -> dict:
    appointment = await db.fetch_row(
        "SELECT * FROM appointments WHERE id = $1",
        int(appointment_id),
    )
    if not appointment:
        raise ValueError("Appointment not found")

    calc = await compute_refund(user_id, appointment)
    if not calc.get("eligible"):
        return calc

    row = await db.fetch_row(
        """
        INSERT INTO appointment_refunds (
            appointment_id, user_id, payment_transaction_id,
            refund_amount_paise, platform_fee_paise, refund_reason,
            refund_status, is_first_refund, expected_by
        ) VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7,$8)
        RETURNING *
        """,
        int(appointment_id),
        int(user_id),
        payment_transaction_id,
        int(calc["refundAmountPaise"]),
        int(calc["platformFeePaise"]),
        reason,
        bool(calc["isFirstRefund"]),
        _as_date(calc.get("expectedBy")),
    )

    if calc["isFirstRefund"]:
        await db.execute(
            "UPDATE users SET first_refund_used = true WHERE id = $1",
            int(user_id),
        )
    await trust_score_service.apply_event(
        user_id, "REFUND_REQUEST", metadata={"appointmentId": appointment_id}
    )
    await audit_service.log_access(
        action="REFUND_REQUESTED",
        resource="appointment",
        resource_id=appointment_id,
        actor_id=user_id,
        actor_role="patient",
        metadata=calc,
    )
    return dict(row) if row else calc


async def mark_refund_completed(refund_id: int, *, actor_id: Optional[int] = None) -> dict:
    row = await db.fetch_row(
        """
        UPDATE appointment_refunds SET
            refund_status = 'COMPLETED',
            refund_processed_at = NOW()
        WHERE id = $1
        RETURNING *
        """,
        int(refund_id),
    )
    if row:
        await db.execute(
            "UPDATE users SET refunds_granted = refunds_granted + 1 WHERE id = $1",
            int(row["user_id"]),
        )
        from app.services import appointment_lifecycle_service
        await appointment_lifecycle_service.transition(
            int(row["appointment_id"]),
            "REFUNDED",
            actor_id=actor_id,
            actor_role="admin",
        )
        await appointment_lifecycle_service.transition(
            int(row["appointment_id"]),
            "CLOSED",
            actor_id=actor_id,
            actor_role="admin",
        )
    return dict(row) if row else {}


async def list_pending_refunds(limit: int = 50) -> list[dict]:
    rows = await db.query(
        """
        SELECT r.*, a.public_id, a.booking_id, u.name AS patient_name
        FROM appointment_refunds r
        JOIN appointments a ON a.id = r.appointment_id
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.refund_status = 'PENDING'
        ORDER BY r.created_at ASC
        LIMIT $1
        """,
        int(limit),
    )
    return [dict(r) for r in rows]
