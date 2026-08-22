"""Support tickets for AI complaint automation — accessed only via AI tools / controller."""
from __future__ import annotations

from typing import Any, Optional

from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def create_ticket(
    *,
    user_id: Optional[int],
    role: str,
    hospital_id: Optional[int],
    subject: str,
    body: str,
    category: str = "general",
) -> dict[str, Any]:
    if not user_id:
        return {"success": False, "message": "Login required to create a ticket"}
    try:
        from app.config.db import db

        if not getattr(db, "pool", None):
            return {"success": False, "message": "Database unavailable"}
        row = await db.fetch_row(
            """
            INSERT INTO ai_support_tickets (user_id, role, hospital_id, subject, body, category, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'open')
            RETURNING id, status, category, created_at
            """,
            int(user_id),
            (role or "patient")[:32],
            hospital_id,
            subject[:200],
            body[:4000],
            (category or "general")[:64],
        )
        return {
            "success": True,
            "ticketId": row["id"],
            "status": row["status"],
            "category": row["category"],
            "message": f"Support ticket #{row['id']} created. Use get_ticket_status to track it.",
        }
    except Exception as exc:
        log.warning("create_ticket failed: %s", type(exc).__name__)
        return {
            "success": False,
            "message": "Could not create ticket (table missing?). Contact Help Center.",
            "error": type(exc).__name__,
        }


async def get_ticket(*, ticket_id: Any, user_id: Optional[int]) -> dict[str, Any]:
    if not ticket_id:
        # list recent for user
        if not user_id:
            return {"success": False, "message": "ticketId or login required"}
        try:
            from app.config.db import db

            rows = await db.fetch_all(
                """
                SELECT id, subject, category, status, created_at, updated_at
                FROM ai_support_tickets
                WHERE user_id = $1
                ORDER BY id DESC
                LIMIT 10
                """,
                int(user_id),
            )
            return {"success": True, "tickets": [dict(r) for r in (rows or [])]}
        except Exception as exc:
            return {"success": False, "message": type(exc).__name__}
    try:
        from app.config.db import db

        row = await db.fetch_row(
            """
            SELECT id, user_id, subject, body, category, status, created_at, updated_at
            FROM ai_support_tickets
            WHERE id = $1
            """,
            int(ticket_id),
        )
        if not row:
            return {"success": False, "message": "Ticket not found"}
        if user_id and int(row["user_id"]) != int(user_id):
            return {"success": False, "message": "Not authorized for this ticket"}
        return {"success": True, "ticket": dict(row)}
    except Exception as exc:
        return {"success": False, "message": type(exc).__name__}
