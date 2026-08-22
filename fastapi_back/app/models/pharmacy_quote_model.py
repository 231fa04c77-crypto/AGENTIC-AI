"""Short-lived pharmacy availability / price quote cache."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.config.db import db

QUOTE_TTL_MINUTES = 5


async def get_valid_quote(consultation_id: int, pharmacy_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT * FROM pharmacy_availability_quotes
        WHERE consultation_id = $1 AND pharmacy_id = $2 AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        """,
        consultation_id, pharmacy_id,
    )
    return dict(row) if row else None


async def upsert_quote(
    consultation_id: int,
    pharmacy_id: int,
    partner_id: int,
    items: list[dict],
    source: str = "probe",
) -> dict:
    expires = datetime.now(timezone.utc) + timedelta(minutes=QUOTE_TTL_MINUTES)
    row = await db.fetch_row(
        """
        INSERT INTO pharmacy_availability_quotes
            (consultation_id, pharmacy_id, partner_id, items, source, expires_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        RETURNING *
        """,
        consultation_id,
        pharmacy_id,
        partner_id,
        json.dumps(items),
        source,
        expires,
    )
    return dict(row)
