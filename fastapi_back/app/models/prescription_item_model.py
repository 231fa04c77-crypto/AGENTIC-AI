"""Structured prescription line items."""
from __future__ import annotations

from typing import Optional

from app.config.db import db


async def replace_for_consultation(consultation_id: int, items: list[dict]) -> list:
    """Replace all line items for a consultation."""
    await db.execute(
        "DELETE FROM prescription_items WHERE consultation_id = $1",
        consultation_id,
    )
    created = []
    for i, item in enumerate(items or []):
        name = (item.get("name") or item.get("medicine") or "").strip()
        if not name:
            continue
        row = await db.fetch_row(
            """
            INSERT INTO prescription_items (
                consultation_id, name, dosage, frequency, duration,
                quantity, instructions, sku, sort_order
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            """,
            consultation_id,
            name,
            item.get("dosage") or item.get("dose"),
            item.get("frequency"),
            item.get("duration"),
            item.get("quantity"),
            item.get("instructions") or item.get("notes"),
            item.get("sku"),
            item.get("sort_order", i),
        )
        if row:
            created.append(dict(row))
    return created


async def list_for_consultation(consultation_id: int) -> list:
    return await db.query(
        """
        SELECT * FROM prescription_items
        WHERE consultation_id = $1
        ORDER BY sort_order ASC, id ASC
        """,
        consultation_id,
    )


async def get_item(item_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        "SELECT * FROM prescription_items WHERE id = $1", item_id
    )
    return dict(row) if row else None
