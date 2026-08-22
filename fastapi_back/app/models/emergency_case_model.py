"""Emergency case model — CRUD and status history for emergency cases."""
from __future__ import annotations

import json
from typing import Optional

from app.config.db import db

# Allowed status transitions (state machine)
VALID_TRANSITIONS: dict[str, list[str]] = {
    "CREATED":             ["HOSPITAL_ASSIGNED", "CANCELLED"],
    "HOSPITAL_ASSIGNED":   ["HOSPITAL_ACCEPTED", "HOSPITAL_REJECTED", "CANCELLED"],
    "HOSPITAL_REJECTED":   ["HOSPITAL_ASSIGNED", "CANCELLED"],
    "HOSPITAL_ACCEPTED":   ["AMBULANCE_ASSIGNED", "CANCELLED"],
    "AMBULANCE_ASSIGNED":  ["AMBULANCE_STARTED", "CANCELLED"],
    "AMBULANCE_STARTED":   ["PATIENT_PICKED", "CANCELLED"],
    "PATIENT_PICKED":      ["HOSPITAL_REACHED"],
    "HOSPITAL_REACHED":    ["TREATMENT_STARTED"],
    "TREATMENT_STARTED":   ["COMPLETED"],
    "COMPLETED":           [],
    "CANCELLED":           [],
}

TERMINAL_STATUSES = {"COMPLETED", "CANCELLED"}


# ── Cases ─────────────────────────────────────────────────────────────────────

async def create_case(data: dict) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO emergency_cases (
            public_id, partner_id, partner_request_id,
            patient_name, patient_phone, user_id,
            latitude, longitude, location_text,
            emergency_type, additional_info, partner_metadata,
            hospital_id, hospital_name, hospital_address, hospital_distance_km,
            ambulance_eta_minutes, tracking_token, tracking_url, is_sandbox
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20
        ) RETURNING *
        """,
        data["public_id"],
        data["partner_id"],
        data["partner_request_id"],
        data["patient_name"],
        data["patient_phone"],
        data.get("user_id"),
        data["latitude"],
        data["longitude"],
        data.get("location_text"),
        data.get("emergency_type", "MEDICAL_EMERGENCY"),
        json.dumps(data.get("additional_info", {})),
        json.dumps(data.get("partner_metadata", {})),
        data.get("hospital_id"),
        data.get("hospital_name"),
        data.get("hospital_address"),
        data.get("hospital_distance_km"),
        data.get("ambulance_eta_minutes"),
        data.get("tracking_token"),
        data.get("tracking_url"),
        data.get("is_sandbox", True),
    )
    return dict(row)


async def get_case_by_public_id(public_id: str) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT ec.*, p.name AS partner_name
        FROM emergency_cases ec
        JOIN partners p ON p.id = ec.partner_id
        WHERE ec.public_id = $1
        """,
        public_id,
    )
    return dict(row) if row else None


async def get_case_by_id(case_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        "SELECT * FROM emergency_cases WHERE id = $1", case_id,
    )
    return dict(row) if row else None


async def get_case_by_partner_request(partner_id: int, partner_request_id: str) -> Optional[dict]:
    """Used for idempotency — returns the existing case if request was already processed."""
    row = await db.fetch_row(
        "SELECT * FROM emergency_cases WHERE partner_id=$1 AND partner_request_id=$2",
        partner_id, partner_request_id,
    )
    return dict(row) if row else None


async def list_cases_for_partner(partner_id: int, limit: int = 50, offset: int = 0) -> list:
    return await db.query(
        """
        SELECT * FROM emergency_cases
        WHERE partner_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        partner_id, limit, offset,
    )


async def list_all_cases(limit: int = 100, offset: int = 0) -> list:
    return await db.query(
        """
        SELECT ec.*, p.name AS partner_name
        FROM emergency_cases ec
        JOIN partners p ON p.id = ec.partner_id
        ORDER BY ec.created_at DESC
        LIMIT $1 OFFSET $2
        """,
        limit, offset,
    )


async def transition_status(case_id: int, to_status: str,
                             actor_id: int | None = None,
                             actor_role: str | None = None,
                             notes: str | None = None) -> Optional[dict]:
    """Transition status and log to history. Returns updated case."""
    current = await get_case_by_id(case_id)
    if not current:
        return None
    from_status = current["status"]
    allowed = VALID_TRANSITIONS.get(from_status, [])
    if to_status not in allowed:
        raise ValueError(f"Invalid transition: {from_status} → {to_status}")

    extra_fields = ""
    if to_status == "COMPLETED":
        extra_fields = ", completed_at = NOW()"
    elif to_status == "CANCELLED":
        extra_fields = ", cancelled_at = NOW()"

    updated = await db.fetch_row(
        f"""
        UPDATE emergency_cases
        SET status = $1, updated_at = NOW() {extra_fields}
        WHERE id = $2 RETURNING *
        """,
        to_status, case_id,
    )
    # Log transition
    await db.execute(
        """
        INSERT INTO emergency_status_history
            (case_id, from_status, to_status, actor_id, actor_role, notes)
        VALUES ($1,$2,$3,$4,$5,$6)
        """,
        case_id, from_status, to_status, actor_id, actor_role, notes,
    )
    return dict(updated) if updated else None


async def cancel_case(case_id: int, reason: str | None = None) -> Optional[dict]:
    return await transition_status(case_id, "CANCELLED", notes=reason)


async def get_status_history(case_id: int) -> list:
    return await db.query(
        "SELECT * FROM emergency_status_history WHERE case_id = $1 ORDER BY created_at ASC",
        case_id,
    )


async def update_hospital_assignment(case_id: int, hospital_id: int | None,
                                     hospital_name: str, hospital_address: str,
                                     distance_km: float, eta_minutes: int) -> None:
    await db.execute(
        """
        UPDATE emergency_cases
        SET hospital_id=$1, hospital_name=$2, hospital_address=$3,
            hospital_distance_km=$4, ambulance_eta_minutes=$5, updated_at=NOW()
        WHERE id=$6
        """,
        hospital_id, hospital_name, hospital_address, distance_km, eta_minutes, case_id,
    )


async def log_hospital_notification(case_id: int, hospital_id: int | None,
                                    hospital_name: str, hospital_phone: str | None,
                                    contact_method: str = "dashboard") -> None:
    await db.execute(
        """
        INSERT INTO hospital_notifications
            (case_id, hospital_id, hospital_name, hospital_phone, contact_method)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING
        """,
        case_id, hospital_id, hospital_name, hospital_phone, contact_method,
    )
