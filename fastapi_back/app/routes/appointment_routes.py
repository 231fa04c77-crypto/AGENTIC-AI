"""Public appointment lookup by Booking ID (staff QR / signed deep link).

Shares prefix `/api/appointments` with Super Admin CRUD
(`super_appointment_routes.py`). Public GET `/{booking_id}` requires
HMAC `sig` query param (see sign_booking_lookup). Admin list/create use
auth_admin on the same prefix — do not merge blindly.
"""
from fastapi import APIRouter, Query
from app.controllers import user_controller

router = APIRouter(prefix="/api/appointments", tags=["Appointments — public BK lookup"])


@router.get("/{booking_id}")
async def get_appointment_by_booking_id(
    booking_id: str,
    sig: str | None = Query(default=None, description="HMAC from sign_booking_lookup"),
):
    """Signed BK lookup — bare id without sig is rejected."""
    return await user_controller.get_appointment_by_booking_id(booking_id, sig=sig)
