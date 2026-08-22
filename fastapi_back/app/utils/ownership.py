"""Resource ownership helpers — always use JWT user id, never email/phone from clients."""

from __future__ import annotations

from typing import Any, Mapping, MutableMapping, Optional


def coerce_user_id(value: Any) -> Optional[int]:
    """Parse a stable numeric user id from JWT claims or DB fields."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    text = str(value).strip()
    if not text.isdigit():
        return None
    parsed = int(text)
    return parsed if parsed > 0 else None


def patient_user_id_from_jwt(payload: Mapping[str, Any]) -> Optional[int]:
    """
    Extract patient user id from access-token claims.
    Rejects tokens that only carry email/phone without a numeric id.
    """
    role = (payload.get("role") or "patient").strip().lower()
    if role not in ("patient", "doctor"):
        return None
    uid = coerce_user_id(payload.get("id"))
    if uid is None:
        uid = coerce_user_id(payload.get("userId"))
    if uid is None:
        return None
    # Do not treat email/phone as identity when id is absent
    if payload.get("email") and uid is None:
        return None
    return uid


def row_owned_by(
    row: Optional[Mapping[str, Any]],
    user_id: int,
    *,
    field: str = "user_id",
) -> bool:
    if not row:
        return False
    owner = coerce_user_id(row.get(field))
    auth = coerce_user_id(user_id)
    return owner is not None and auth is not None and owner == auth


def unauthorized(message: str = "Unauthorized") -> dict:
    return {"success": False, "message": message}


def reject_client_user_override(
    body: Optional[MutableMapping[str, Any]],
    auth_user_id: int,
    *,
    keys: tuple[str, ...] = ("userId", "user_id", "patientId", "patient_id"),
) -> Optional[dict]:
    """
    If the client sent a different user id in the body, reject the request.
    Strips identity keys so downstream code cannot accidentally use them.
    """
    if not body:
        return None
    auth = coerce_user_id(auth_user_id)
    if auth is None:
        return unauthorized("Invalid session")
    for key in keys:
        if key not in body:
            continue
        client = coerce_user_id(body.get(key))
        if client is not None and client != auth:
            return unauthorized("Cannot act on behalf of another user")
        body.pop(key, None)
    return None


async def load_appointment_for_user(appointment_id: int, user_id: int):
    from app.models import appointment_model

    apt = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not row_owned_by(apt, user_id):
        return None, unauthorized("Appointment not found or unauthorized")
    return apt, None


async def load_payment_for_user(order_id: str, user_id: int):
    from app.models import payment_transaction_model as pt_model

    row = await pt_model.get_by_order_id(order_id)
    if not row:
        return None, None
    owner = row.get("user_id")
    if owner is not None and not row_owned_by(row, user_id):
        return None, unauthorized("Unauthorized")
    return row, None
