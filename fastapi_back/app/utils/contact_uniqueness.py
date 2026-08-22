"""Role-scoped contact uniqueness (email/phone unique within a role table only)."""
from __future__ import annotations

import re
from typing import Optional

from app.config.db import db


def normalize_phone(phone: Optional[str]) -> str:
    digits = re.sub(r"[^0-9]", "", str(phone or ""))
    # Keep last 10 for IN mobiles when longer with country code
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    return digits


async def phone_taken_in_table(
    table: str,
    phone: Optional[str],
    *,
    exclude_id: Optional[int] = None,
) -> bool:
    digits = normalize_phone(phone)
    if not digits:
        return False
    allowed = {"users", "doctors", "deans", "receptionists"}
    if table not in allowed:
        raise ValueError(f"Unsupported table for phone uniqueness: {table}")
    if exclude_id is not None:
        row = await db.fetch_row(
            f"""
            SELECT id FROM {table}
            WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
              AND id <> $2
            LIMIT 1
            """,
            digits,
            int(exclude_id),
        )
    else:
        row = await db.fetch_row(
            f"""
            SELECT id FROM {table}
            WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
            LIMIT 1
            """,
            digits,
        )
    return row is not None


async def email_taken_in_table(
    table: str,
    email: Optional[str],
    *,
    exclude_id: Optional[int] = None,
) -> bool:
    em = (email or "").strip().lower()
    if not em:
        return False
    allowed = {"users", "doctors", "deans", "receptionists", "admins"}
    if table not in allowed:
        raise ValueError(f"Unsupported table for email uniqueness: {table}")
    if exclude_id is not None:
        row = await db.fetch_row(
            f"SELECT id FROM {table} WHERE lower(email) = $1 AND id <> $2 LIMIT 1",
            em,
            int(exclude_id),
        )
    else:
        row = await db.fetch_row(
            f"SELECT id FROM {table} WHERE lower(email) = $1 LIMIT 1",
            em,
        )
    return row is not None


def conflict_message(role: str, field: str = "email") -> dict:
    return {
        "success": False,
        "message": f"This {field} is already registered for another {role}.",
        "status_code": 409,
    }
