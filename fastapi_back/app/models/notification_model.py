from typing import Any, Dict, List, Optional

from app.config.db import db


async def ensure_notifications_table():
    """Support legacy `message` column and newer `body` alias."""
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            doctor_id INTEGER,
            title TEXT NOT NULL,
            message TEXT,
            body TEXT,
            type VARCHAR(48) NOT NULL DEFAULT 'system',
            appointment_id INTEGER,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await db.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT")
    await db.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT")
    await db.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS appointment_id INTEGER")
    await db.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS doctor_id INTEGER")
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notifications_user_created
            ON notifications (user_id, created_at DESC)
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notifications_doctor_created
            ON notifications (doctor_id, created_at DESC) WHERE doctor_id IS NOT NULL
        """
    )


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(row)
    out["body"] = out.get("body") or out.get("message") or ""
    return out


async def create(
    user_id: int,
    title: str,
    body: str = "",
    type: str = "system",
    appointment_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    await ensure_notifications_table()
    text = body or ""
    if appointment_id is not None:
        row = await db.fetch_row(
            """
            INSERT INTO notifications (user_id, title, message, body, type, appointment_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, title, COALESCE(body, message) AS body, type, appointment_id, is_read, created_at
            """,
            int(user_id),
            title,
            text,
            text,
            (type or "system")[:48],
            int(appointment_id),
        )
    else:
        row = await db.fetch_row(
            """
            INSERT INTO notifications (user_id, title, message, body, type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, user_id, title, COALESCE(body, message) AS body, type, is_read, created_at
            """,
            int(user_id),
            title,
            text,
            text,
            (type or "system")[:48],
        )
    return _normalize_row(dict(row)) if row else None


async def list_for_user(user_id: int, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    await ensure_notifications_table()
    rows = await db.query(
        """
        SELECT id, user_id, title, COALESCE(body, message) AS body, type, appointment_id, is_read, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        int(user_id),
        int(limit),
        int(offset),
    )
    return [_normalize_row(dict(r)) for r in rows]


async def list_for_doctor(doctor_id: int, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    await ensure_notifications_table()
    rows = await db.query(
        """
        SELECT id, doctor_id, title, COALESCE(body, message) AS body, type, appointment_id, is_read, created_at
        FROM notifications
        WHERE doctor_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        int(doctor_id),
        int(limit),
        int(offset),
    )
    return [_normalize_row(dict(r)) for r in rows]


async def create_for_doctor(
    doctor_id: int,
    title: str,
    body: str = "",
    type: str = "system",
    appointment_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    await ensure_notifications_table()
    text = body or ""
    row = await db.fetch_row(
        """
        INSERT INTO notifications (doctor_id, title, message, body, type, appointment_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, doctor_id, title, COALESCE(body, message) AS body, type, appointment_id, is_read, created_at
        """,
        int(doctor_id),
        title,
        text,
        text,
        (type or "system")[:48],
        int(appointment_id) if appointment_id is not None else None,
    )
    return _normalize_row(dict(row)) if row else None


async def unread_count(user_id: int) -> int:
    row = await db.fetch_row(
        "SELECT COUNT(*) AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        int(user_id),
    )
    return int(row["c"]) if row else 0


async def mark_read(user_id: int, notification_id: int) -> None:
    await db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
        int(notification_id),
        int(user_id),
    )


async def mark_all_read(user_id: int) -> None:
    await db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
        int(user_id),
    )
