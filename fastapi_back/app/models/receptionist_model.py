"""Receptionist accounts (hospital-scoped staff)."""
from __future__ import annotations

from typing import Any, Dict, Optional

from app.config.db import db


async def get_by_email(email: str):
    return await db.fetch_row(
        "SELECT * FROM receptionists WHERE LOWER(email) = LOWER($1)",
        (email or "").strip(),
    )


async def get_by_id(rec_id: int):
    return await db.fetch_row("SELECT * FROM receptionists WHERE id = $1", int(rec_id))


async def list_by_hospital(hospital_id: int):
    return await db.query(
        "SELECT * FROM receptionists WHERE hospital_id = $1 ORDER BY created_at DESC",
        int(hospital_id),
    )


async def list_all():
    return await db.query(
        """
        SELECT r.*, h.name AS hospital_name
        FROM receptionists r
        LEFT JOIN hospital_tieups h ON h.id = r.hospital_id
        ORDER BY r.created_at DESC
        """
    )


async def create(data: Dict[str, Any]):
    from app.services import public_id_service

    hospital_id = int(data["hospital_id"]) if data.get("hospital_id") is not None else None
    hospital_name = data.get("hospital_name")
    if hospital_id and not hospital_name:
        h = await db.fetch_row("SELECT name FROM hospital_tieups WHERE id = $1", hospital_id)
        hospital_name = h.get("name") if h else None

    try:
        public_id = await public_id_service.new_receptionist_public_id(hospital_id, hospital_name)
    except Exception:
        public_id = None

    return await db.fetch_row(
        """
        INSERT INTO receptionists (name, email, password, phone, hospital_id, public_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """,
        data.get("name"),
        (data.get("email") or "").strip().lower(),
        data.get("password"),
        data.get("phone"),
        hospital_id,
        public_id,
    )


async def set_public_id(rec_id: int, public_id: str):
    return await db.execute(
        "UPDATE receptionists SET public_id = $1, updated_at = NOW() WHERE id = $2",
        public_id,
        int(rec_id),
    )


async def backfill_public_ids() -> int:
    """Self-heal receptionists missing a hospital-coded public id (idempotent).

    Targets NULLs and legacy non-conforming ids (e.g. old ``PAT…`` values).
    Returns the number of rows updated.
    """
    from app.services import public_id_service

    rows = await db.query(
        """
        SELECT r.id, r.hospital_id, h.name AS hospital_name
        FROM receptionists r
        LEFT JOIN hospital_tieups h ON h.id = r.hospital_id
        WHERE r.public_id IS NULL OR r.public_id NOT LIKE '%-REC%'
        """
    )
    updated = 0
    for r in rows or []:
        try:
            pid = await public_id_service.new_receptionist_public_id(r.get("hospital_id"), r.get("hospital_name"))
            await set_public_id(r["id"], pid)
            updated += 1
        except Exception:
            continue
    return updated


async def update_password(rec_id: int, password_hash: str):
    return await db.execute(
        "UPDATE receptionists SET password = $1, updated_at = NOW() WHERE id = $2",
        password_hash,
        int(rec_id),
    )


async def set_active(rec_id: int, is_active: bool):
    return await db.execute(
        "UPDATE receptionists SET is_active = $1, updated_at = NOW() WHERE id = $2",
        bool(is_active),
        int(rec_id),
    )



async def delete(rec_id: int) -> None:
    return await db.execute("DELETE FROM receptionists WHERE id = $1", int(rec_id))


# ─── Permission Helpers ───────────────────────────────────────────────────────

async def get_permissions(rec_id: int) -> list:
    """Fetch the live permissions array from the DB for the given receptionist.
    Returns an empty list if the column is missing or the record is not found.
    """
    row = await db.fetch_row(
        "SELECT permissions FROM receptionists WHERE id = $1",
        int(rec_id),
    )
    if not row:
        return []
    perms = row.get("permissions") or []
    return [str(p).upper() for p in perms]


async def has_permission(rec_id: int, permission: str) -> bool:
    """Return True if the receptionist holds the given permission flag.

    Permission flags (case-insensitive): CHECK_IN, BILLING, RESCHEDULE,
    REFUND, REPORTS, OVERRIDE.
    """
    perms = await get_permissions(rec_id)
    return permission.upper() in perms


async def assert_permission(rec_id: int, permission: str) -> None:
    """Raise a fastapi HTTPException(403) if the receptionist does not hold the given permission.

    Usage (in a controller):
        await receptionist_model.assert_permission(rec_id, "REFUND")
    """
    from fastapi import HTTPException
    if not await has_permission(rec_id, permission):
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: '{permission.upper()}' access required.",
        )

