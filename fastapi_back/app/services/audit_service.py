from typing import Any, Optional

from app.models import audit_log_model
from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def log_access(
    *,
    action: str,
    resource: str,
    resource_id: Optional[str | int] = None,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    try:
        from app.utils.ownership import coerce_user_id

        stable_actor_id = coerce_user_id(actor_id)
        await audit_log_model.insert_log(
            action=action,
            resource=resource,
            resource_id=str(resource_id) if resource_id is not None else None,
            actor_id=stable_actor_id,
            actor_role=actor_role,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )
    except Exception as exc:
        log.warning("Audit log write failed: %s", exc)


# ─── Named Hook Shortcuts ─────────────────────────────────────────────────────
# These provide single-line audit calls from controllers and avoid repeating
# the raw log_access signature for every event. All calls are fire-and-forget
# (exceptions are swallowed inside log_access).

async def log_schedule_edit(
    doctor_id: int,
    actor_id: int,
    actor_role: str,
    *,
    detail: Optional[str] = None,
) -> None:
    """Doctor or admin edited a weekly/override schedule."""
    await log_access(
        action="SCHEDULE_EDIT",
        resource="doctor_schedule",
        resource_id=doctor_id,
        actor_id=actor_id,
        actor_role=actor_role,
        metadata={"detail": detail} if detail else None,
    )


async def log_check_in(
    appointment_id: int,
    receptionist_id: int,
    hospital_id: Optional[int] = None,
) -> None:
    """Receptionist checked in a patient."""
    await log_access(
        action="CHECK_IN",
        resource="appointment",
        resource_id=appointment_id,
        actor_id=receptionist_id,
        actor_role="receptionist",
        metadata={"hospital_id": hospital_id},
    )


async def log_consultation_complete(
    appointment_id: int,
    doctor_id: int,
    *,
    had_prescription: bool = False,
) -> None:
    """Doctor completed a consultation (optionally with prescription update)."""
    await log_access(
        action="CONSULTATION_COMPLETE",
        resource="appointment",
        resource_id=appointment_id,
        actor_id=doctor_id,
        actor_role="doctor",
        metadata={"had_prescription": had_prescription},
    )


async def log_prescription_update(
    appointment_id: int,
    doctor_id: int,
) -> None:
    """Doctor added or updated a prescription."""
    await log_access(
        action="PRESCRIPTION_UPDATE",
        resource="appointment",
        resource_id=appointment_id,
        actor_id=doctor_id,
        actor_role="doctor",
    )


async def log_refund(
    appointment_id: int,
    actor_id: int,
    actor_role: str,
    *,
    amount: Optional[float] = None,
    reason: Optional[str] = None,
) -> None:
    """Admin or receptionist issued or requested a refund."""
    await log_access(
        action="REFUND_ISSUED",
        resource="appointment",
        resource_id=appointment_id,
        actor_id=actor_id,
        actor_role=actor_role,
        metadata={"amount": amount, "reason": reason},
    )

