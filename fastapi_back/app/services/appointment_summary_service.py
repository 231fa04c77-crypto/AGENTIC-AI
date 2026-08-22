"""Public visit-summary payload for signed QR scans."""
from __future__ import annotations

import json
from typing import Any

from app.config.db import db
from app.models import appointment_model
from app.utils.appointment_summary_qr import (
    build_appointment_summary_url,
    verify_appointment_summary_sig,
)
from app.utils.booking_id import is_valid_booking_id, normalize_booking_id


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


async def _prescription_ready(appointment_id: int) -> bool:
    if not db.pool:
        await db.connect()
    row = await db.fetch_row(
        """
        SELECT 1 AS ok
        FROM consultations c
        WHERE c.appointment_id = $1
          AND (
            EXISTS (SELECT 1 FROM prescription_items pi WHERE pi.consultation_id = c.id)
            OR (c.prescription IS NOT NULL AND TRIM(c.prescription) <> '')
          )
        LIMIT 1
        """,
        appointment_id,
    )
    return bool(row)


def _safe_summary(appointment: dict, *, prescription_ready: bool) -> dict:
    user_data = _as_dict(appointment.get("user_data"))
    doc_data = _as_dict(appointment.get("doctor_data"))

    patient_name = (
        appointment.get("actual_patient_name")
        or user_data.get("name")
        or "Patient"
    )
    if appointment.get("actual_patient_is_self") and user_data.get("name"):
        patient_name = user_data["name"]

    status = appointment.get("status") or "pending"
    if appointment.get("cancelled"):
        status = "cancelled"
    elif appointment.get("is_completed"):
        status = "completed"

    lifecycle = (appointment.get("lifecycle_status") or "").upper() or None
    completed_at = None
    if appointment.get("is_completed") or lifecycle == "COMPLETED":
        completed_at = _iso(appointment.get("updated_at") or appointment.get("actual_end_time"))

    booking_id = normalize_booking_id(appointment.get("booking_id") or "")
    return {
        "bookingId": booking_id or None,
        "publicId": appointment.get("public_id"),
        "status": status,
        "lifecycleStatus": lifecycle,
        "slotDate": appointment.get("slot_date"),
        "slotTime": appointment.get("slot_time"),
        "doctorName": doc_data.get("name") or "Doctor",
        "specialization": doc_data.get("speciality") or doc_data.get("specialization"),
        "hospitalName": doc_data.get("hospital_name") or doc_data.get("hospitalName"),
        "patientName": patient_name,
        "tokenNumber": appointment.get("token_number"),
        "visitType": appointment.get("mode"),
        "isCompleted": bool(appointment.get("is_completed")),
        "cancelled": bool(appointment.get("cancelled")),
        "completedAt": completed_at,
        "prescriptionReady": prescription_ready,
        "summaryQrUrl": build_appointment_summary_url(booking_id) if booking_id else None,
    }


async def get_public_appointment_summary(booking_id: str, sig: str | None) -> dict:
    code = normalize_booking_id(booking_id)
    if not is_valid_booking_id(code):
        return {"success": False, "message": "Invalid booking ID format"}
    if not verify_appointment_summary_sig(code, sig):
        return {"success": False, "message": "Invalid or missing signature"}

    appointment = await appointment_model.get_appointment_by_booking_id(code)
    if not appointment:
        return {"success": False, "message": "Appointment not found"}

    prescription_ready = await _prescription_ready(int(appointment["id"]))
    return {
        "success": True,
        "appointment": _safe_summary(appointment, prescription_ready=prescription_ready),
    }


def summary_qr_url_for_booking(booking_id: str | None) -> str | None:
    if not booking_id or not is_valid_booking_id(booking_id):
        return None
    return build_appointment_summary_url(booking_id)
