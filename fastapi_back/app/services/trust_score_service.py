"""Patient trust score and booking restrictions."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from app.config.config import _env_bool, settings
from app.config.db import db
from app.services import audit_service
from app.services.appointment_lifecycle_service import AppointmentPolicyError
from app.utils.app_logger import get_logger

log = get_logger(__name__)

TRUST_EVENTS = {
    "COMPLETED_VISIT": 2,
    "FOLLOWUP_VISIT": 1,
    "NO_SHOW": -15,
    "LATE_CANCEL": -10,
    "REFUND_REQUEST": -5,
    "REFUND_ABUSE": -20,
}


def trust_enforced() -> bool:
    return _env_bool("TRUST_SCORE_ENFORCED", True)


def trust_level_for(score: int) -> str:
    if score >= 80:
        return "NORMAL"
    if score >= 60:
        return "ADVANCE_PAYMENT"
    if score >= 40:
        return "MAX_ONE_ACTIVE"
    return "ADMIN_REVIEW"


async def get_profile(user_id: int) -> dict:
    row = await db.fetch_row(
        """
        SELECT trust_score, total_bookings, completed_visits, total_no_shows,
               total_cancellations, late_cancellations, refund_requests,
               refunds_granted, first_refund_used, booking_restricted_until,
               trust_level
        FROM users WHERE id = $1
        """,
        int(user_id),
    )
    if not row:
        return {}
    score = int(row.get("trust_score") or 100)
    level = row.get("trust_level") or trust_level_for(score)
    return {
        "trustScore": score,
        "trustLevel": level,
        "riskLevel": level,
        "totalBookings": int(row.get("total_bookings") or 0),
        "completedVisits": int(row.get("completed_visits") or 0),
        "noShows": int(row.get("total_no_shows") or 0),
        "totalCancellations": int(row.get("total_cancellations") or 0),
        "lateCancellations": int(row.get("late_cancellations") or 0),
        "refundRequests": int(row.get("refund_requests") or 0),
        "refundsGranted": int(row.get("refunds_granted") or 0),
        "firstRefundUsed": bool(row.get("first_refund_used")),
        "bookingRestrictedUntil": (
            row["booking_restricted_until"].isoformat()
            if row.get("booking_restricted_until") and hasattr(row["booking_restricted_until"], "isoformat")
            else row.get("booking_restricted_until")
        ),
    }


async def apply_event(
    user_id: int,
    event_type: str,
    *,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> int:
    delta = TRUST_EVENTS.get(event_type, 0)
    if delta == 0:
        row = await db.fetch_row("SELECT trust_score FROM users WHERE id = $1", int(user_id))
        return int(row["trust_score"]) if row else 100

    row = await db.fetch_row(
        """
        UPDATE users SET
            trust_score = GREATEST(0, LEAST(100, trust_score + $2)),
            trust_level = NULL,
            total_no_shows = total_no_shows + CASE WHEN $3 = 'NO_SHOW' THEN 1 ELSE 0 END,
            completed_visits = completed_visits + CASE WHEN $3 IN ('COMPLETED_VISIT', 'FOLLOWUP_VISIT') THEN 1 ELSE 0 END,
            total_cancellations = total_cancellations + CASE WHEN $3 = 'LATE_CANCEL' THEN 1 ELSE 0 END,
            late_cancellations = late_cancellations + CASE WHEN $3 = 'LATE_CANCEL' THEN 1 ELSE 0 END,
            refund_requests = refund_requests + CASE WHEN $3 = 'REFUND_REQUEST' THEN 1 ELSE 0 END,
            booking_restricted_until = CASE
                WHEN $3 = 'NO_SHOW' AND total_no_shows + 1 >= 4
                THEN NOW() + INTERVAL '7 days'
                ELSE booking_restricted_until
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING trust_score, total_no_shows
        """,
        int(user_id),
        int(delta),
        event_type,
    )
    score = int(row["trust_score"]) if row else 100
    level = trust_level_for(score)
    await db.execute(
        "UPDATE users SET trust_level = $2 WHERE id = $1",
        int(user_id),
        level,
    )
    await audit_service.log_access(
        action="TRUST_SCORE_CHANGE",
        resource="user",
        resource_id=user_id,
        actor_id=actor_id,
        actor_role=actor_role,
        metadata={
            "event": event_type,
            "delta": delta,
            "newScore": score,
            "trustLevel": level,
            **(metadata or {}),
        },
    )
    return score


async def assert_can_book(user_id: int) -> None:
    if not trust_enforced():
        return
    row = await db.fetch_row(
        """
        SELECT trust_score, booking_restricted_until, total_no_shows
        FROM users WHERE id = $1
        """,
        int(user_id),
    )
    if not row:
        return
    restricted = row.get("booking_restricted_until")
    if restricted and isinstance(restricted, datetime) and restricted > datetime.utcnow():
        raise AppointmentPolicyError(
            "Temporary booking restriction is active. Please try again later or contact support."
        )
    score = int(row.get("trust_score") or 100)
    if score < 40:
        raise AppointmentPolicyError(
            "Your account requires admin review before new bookings. Please contact reception."
        )


def advance_payment_enforced() -> bool:
    if not trust_enforced():
        return False
    return settings.ADVANCE_PAYMENT_ENFORCED


def requires_advance_payment(score: int) -> bool:
    if not advance_payment_enforced():
        return False
    return 60 <= score < 80


async def booking_constraints(user_id: int) -> dict:
    profile = await get_profile(user_id)
    score = int(profile.get("trustScore") or 100)
    from app.services.appointment_lifecycle_service import lifecycle_enforced

    # Server source of truth: when lifecycle is enforced, assert_can_book
    # always blocks a second active appointment (BLOCKING_STATUSES), so
    # advertised maxActiveBookings must be 1 for every trust band.
    lifecycle_one_active = lifecycle_enforced()
    if lifecycle_one_active:
        max_active = 1
    else:
        max_active = 1 if score < 80 else None

    return {
        **profile,
        "advancePaymentRequired": requires_advance_payment(score),
        "maxActiveBookings": max_active,
        "lifecycleOneActiveEnforced": lifecycle_one_active,
    }
