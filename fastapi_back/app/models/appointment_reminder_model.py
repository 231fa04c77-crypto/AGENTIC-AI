"""Tracks 24h + 1h appointment reminder pushes (FCM / Telegram)."""
from typing import Any, Dict, List

from app.config.db import db


async def ensure_reminder_schema() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS appointment_reminder_sent (
            appointment_id INTEGER PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
            reminder_24h_sent_at TIMESTAMPTZ,
            reminder_1h_sent_at TIMESTAMPTZ
        )
        """
    )
    await db.execute(
        """
        ALTER TABLE appointment_reminder_sent
        ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ
        """
    )
    # Legacy installs had reminder_24h_sent_at NOT NULL DEFAULT NOW().
    try:
        await db.execute(
            """
            ALTER TABLE appointment_reminder_sent
            ALTER COLUMN reminder_24h_sent_at DROP NOT NULL
            """
        )
    except Exception:
        pass


async def mark_reminder_sent(appointment_id: int) -> None:
    await db.execute(
        """
        INSERT INTO appointment_reminder_sent (appointment_id, reminder_24h_sent_at)
        VALUES ($1, NOW())
        ON CONFLICT (appointment_id) DO UPDATE
        SET reminder_24h_sent_at = NOW()
        """,
        int(appointment_id),
    )


async def mark_1h_reminder_sent(appointment_id: int) -> None:
    await db.execute(
        """
        INSERT INTO appointment_reminder_sent (appointment_id, reminder_1h_sent_at)
        VALUES ($1, NOW())
        ON CONFLICT (appointment_id) DO UPDATE
        SET reminder_1h_sent_at = NOW()
        """,
        int(appointment_id),
    )


async def get_upcoming_for_24h_reminder() -> List[Dict[str, Any]]:
    """Appointments starting in ~24 hours (23h–25h window), not cancelled/completed."""
    sql = """
        SELECT a.id, a.user_id, a.slot_date, a.slot_time, a.doctor_data, a.token_number,
               a.mode, u.name AS patient_name
        FROM appointments a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN appointment_reminder_sent r ON r.appointment_id = a.id
        WHERE a.cancelled = false
          AND COALESCE(a.is_completed, false) = false
          AND r.reminder_24h_sent_at IS NULL
          AND a.slot_date IS NOT NULL
          AND a.slot_time IS NOT NULL
        ORDER BY a.id ASC
        LIMIT 200
    """
    rows = await db.query(sql)
    return rows or []


async def get_upcoming_for_1h_reminder() -> List[Dict[str, Any]]:
    """Appointments starting in ~1 hour, not yet reminded for 1h."""
    sql = """
        SELECT a.id, a.user_id, a.slot_date, a.slot_time, a.doctor_data, a.token_number,
               a.mode, u.name AS patient_name
        FROM appointments a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN appointment_reminder_sent r ON r.appointment_id = a.id
        WHERE a.cancelled = false
          AND COALESCE(a.is_completed, false) = false
          AND r.reminder_1h_sent_at IS NULL
          AND a.slot_date IS NOT NULL
          AND a.slot_time IS NOT NULL
        ORDER BY a.id ASC
        LIMIT 200
    """
    rows = await db.query(sql)
    return rows or []
