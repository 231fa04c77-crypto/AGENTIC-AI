"""Reception QR scan and check-in with visit increment."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from app.config.db import db
from app.models import appointment_model
from app.services import appointment_lifecycle_service, audit_service
from app.utils.booking_id import (
    extract_booking_id,
    looks_like_visit_summary_payload,
)


def _patient_display_name(appointment: dict) -> str:
    user_data = appointment.get("user_data")
    if isinstance(user_data, str):
        try:
            user_data = json.loads(user_data) if user_data else {}
        except Exception:
            user_data = {}
    if not isinstance(user_data, dict):
        user_data = {}
    name = (appointment.get("actual_patient_name") or "").strip()
    if not name:
        name = (user_data.get("name") or "").strip()
    return name or "Patient"


def _doctor_display_name(appointment: dict) -> str | None:
    doc_data = appointment.get("doctor_data")
    if isinstance(doc_data, str):
        try:
            doc_data = json.loads(doc_data) if doc_data else {}
        except Exception:
            doc_data = {}
    if isinstance(doc_data, dict):
        return doc_data.get("name")
    return None


async def scan_and_checkin(
    booking_id: str,
    *,
    scanner_id: Optional[int] = None,
    scanner_role: Optional[str] = None,
    hospital_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    scan_method: str = "QR",
) -> dict[str, Any]:
    raw = booking_id
    # Reject visit-summary payloads before BK extract (summary URLs embed BK…).
    if looks_like_visit_summary_payload(raw):
        return {
            "success": False,
            "message": "This is a visit-summary QR, not a check-in booking code. Use the Scan at reception QR (BK…).",
        }

    code = extract_booking_id(booking_id)
    if not code:
        return {"success": False, "message": "Invalid booking ID format"}

    # Fail closed: desk must be hospital-scoped for QR check-in.
    if hospital_id is None:
        return {
            "success": False,
            "message": "Hospital scope required for check-in. Sign in at a hospital desk.",
        }

    appointment = await appointment_model.get_appointment_by_booking_id(code)
    if not appointment:
        return {"success": False, "message": "Appointment not found"}

    ls = (appointment.get("lifecycle_status") or "BOOKED").upper()
    closed_for_qr = appointment_lifecycle_service.TERMINAL_STATUSES | frozenset({
        "COMPLETED",
        "FOLLOWUP_AVAILABLE",
        "FOLLOWUP_USED",
        "FOLLOWUP_EXPIRED",
        "REFUND_PENDING",
    })
    if ls in closed_for_qr or appointment.get("is_completed") or appointment.get("cancelled"):
        return {"success": False, "message": "Appointment is no longer active for check-in."}

    apt_hospital = appointment.get("hospital_id")
    if apt_hospital is None:
        return {
            "success": False,
            "message": "Appointment has no hospital assigned — cannot check in at this desk.",
        }
    if int(apt_hospital) != int(hospital_id):
        return {"success": False, "message": "Hospital does not match this appointment."}

    if doctor_id is not None and int(appointment["doctor_id"]) != int(doctor_id):
        return {"success": False, "message": "Doctor does not match this appointment."}

    valid_until = appointment.get("valid_until")
    if valid_until and isinstance(valid_until, datetime):
        if datetime.utcnow() > valid_until:
            await appointment_lifecycle_service.transition(
                int(appointment["id"]),
                "EXPIRED",
                actor_id=scanner_id,
                actor_role=scanner_role,
                reason="Validity expired",
            )
            return {"success": False, "message": "Appointment has expired."}

    visit_count = int(appointment.get("visit_count") or 0)
    max_visits = int(appointment.get("max_visits") or 3)
    if visit_count >= max_visits:
        await appointment_lifecycle_service.transition(
            int(appointment["id"]),
            "EXPIRED",
            actor_id=scanner_id,
            actor_role=scanner_role,
            reason="Visit limit reached",
        )
        return {
            "success": False,
            "message": "Maximum visits reached. Patient must book again.",
        }

    new_visit = visit_count + 1
    if not db.pool:
        await db.connect()
    async with db.pool.acquire() as conn:
        async with conn.transaction():
            updated = await conn.fetchrow(
                """
                UPDATE appointments SET
                    visit_count = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
                """,
                int(appointment["id"]),
                new_visit,
            )
            await conn.execute(
                """
                INSERT INTO appointment_visit_log (
                    appointment_id, visit_number, scanned_by_id, scanned_by_role,
                    hospital_id, doctor_id, scan_method, metadata
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
                """,
                int(appointment["id"]),
                new_visit,
                scanner_id,
                scanner_role,
                apt_hospital,
                appointment.get("doctor_id"),
                scan_method,
                '{"source":"reception_scan"}',
            )

    if ls in ("BOOKED", "CONFIRMED", "RESCHEDULED_ONCE"):
        await appointment_lifecycle_service.transition(
            int(appointment["id"]),
            "CHECKED_IN",
            actor_id=scanner_id,
            actor_role=scanner_role,
        )

    await audit_service.log_access(
        action="APPOINTMENT_CHECKIN",
        resource="appointment",
        resource_id=appointment["id"],
        actor_id=scanner_id,
        actor_role=scanner_role,
        metadata={"visitNumber": new_visit, "bookingId": code},
    )

    apt_dict = dict(updated) if updated else dict(appointment)
    patient_name = _patient_display_name(appointment)
    return {
        "success": True,
        "message": f"Check-in successful. Visit {new_visit} of {max_visits}.",
        "visitNumber": new_visit,
        "maxVisits": max_visits,
        "bookingId": code,
        "patientName": patient_name,
        "doctorName": _doctor_display_name(appointment),
        "tokenNumber": appointment.get("token_number"),
        "appointment": appointment_lifecycle_service.lifecycle_payload(apt_dict),
    }
