from datetime import datetime
from typing import Any, Dict, List, Optional

from app.config.db import db

ACTIVE_STATUSES = ("requested", "ringing", "accepted", "ongoing")


async def ensure_call_sessions_table():
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS call_sessions (
            id SERIAL PRIMARY KEY,
            appointment_id INTEGER NOT NULL,
            consultation_id INTEGER,
            patient_user_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'requested',
            requested_at TIMESTAMPTZ DEFAULT NOW(),
            accepted_at TIMESTAMPTZ,
            rejected_at TIMESTAMPTZ,
            ended_at TIMESTAMPTZ,
            reject_reason VARCHAR(64),
            agora_channel VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_call_sessions_appointment ON call_sessions (appointment_id)"
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_call_sessions_doctor_status ON call_sessions (doctor_id, status)"
    )


async def get_by_appointment(appointment_id: int) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        "SELECT * FROM call_sessions WHERE appointment_id = $1 ORDER BY id DESC LIMIT 1",
        int(appointment_id),
    )


async def get_by_id(session_id: int) -> Optional[Dict[str, Any]]:
    return await db.fetch_row("SELECT * FROM call_sessions WHERE id = $1", int(session_id))


async def create_session(data: Dict[str, Any]) -> Dict[str, Any]:
    return await db.fetch_row(
        """
        INSERT INTO call_sessions (
            appointment_id, consultation_id, patient_user_id, doctor_id,
            status, agora_channel, requested_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
        """,
        data["appointment_id"],
        data.get("consultation_id"),
        data["patient_user_id"],
        data["doctor_id"],
        data.get("status", "requested"),
        data.get("agora_channel"),
    )


async def update_status(
    session_id: int,
    status: str,
    *,
    reject_reason: Optional[str] = None,
    consultation_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    # Cast $2/$3 so asyncpg does not mix text vs varchar for the same parameter.
    return await db.fetch_row(
        """
        UPDATE call_sessions
        SET status = $2::varchar,
            updated_at = NOW(),
            accepted_at = CASE WHEN $2::varchar = 'accepted' THEN NOW() ELSE accepted_at END,
            rejected_at = CASE WHEN $2::varchar IN ('rejected', 'busy', 'cancelled', 'missed') THEN NOW() ELSE rejected_at END,
            ended_at = CASE WHEN $2::varchar IN ('completed', 'cancelled', 'rejected', 'busy', 'missed') THEN NOW() ELSE ended_at END,
            reject_reason = COALESCE($3::varchar, reject_reason),
            consultation_id = COALESCE($4, consultation_id)
        WHERE id = $1
        RETURNING *
        """,
        int(session_id),
        status,
        reject_reason,
        consultation_id,
    )


async def list_incoming_for_doctor(doctor_id: int) -> List[Dict[str, Any]]:
    return await db.query(
        """
        SELECT cs.id, cs.appointment_id, cs.status, cs.requested_at,
               u.name AS patient_name, a.slot_date, a.slot_time, a.token_number
        FROM call_sessions cs
        JOIN users u ON u.id = cs.patient_user_id
        JOIN appointments a ON a.id = cs.appointment_id
        WHERE cs.doctor_id = $1 AND cs.status IN ('requested', 'ringing')
        ORDER BY cs.requested_at ASC
        LIMIT 10
        """,
        int(doctor_id),
    )
