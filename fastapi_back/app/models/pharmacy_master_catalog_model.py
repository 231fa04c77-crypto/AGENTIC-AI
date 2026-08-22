"""Pharmacy master catalog — live inventory for patient All Medicines."""
from __future__ import annotations

from typing import Any

from app.config.db import db


async def ensure_pharmacy_master_catalog_schema() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS pharmacy_master_catalog (
            id              BIGSERIAL PRIMARY KEY,
            name            VARCHAR(255) NOT NULL,
            brand           VARCHAR(255),
            salt            VARCHAR(255),
            category        VARCHAR(120) NOT NULL DEFAULT 'General',
            price           NUMERIC(10,2) NOT NULL,
            mrp             NUMERIC(10,2) NOT NULL,
            stock           INTEGER NOT NULL DEFAULT 0,
            requires_rx     BOOLEAN NOT NULL DEFAULT FALSE,
            image           TEXT,
            hsn_code        VARCHAR(32),
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            external_id     VARCHAR(64),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def serialize_catalog_row(row: dict[str, Any]) -> dict[str, Any]:
    price = float(row["price"]) if row.get("price") is not None else 0.0
    mrp = float(row["mrp"]) if row.get("mrp") is not None else price
    discount = ""
    if mrp > 0 and price < mrp:
        pct = int(round((1 - price / mrp) * 100))
        if pct > 0:
            discount = f"{pct}% OFF"
    med_id = str(row.get("id") or row.get("_id") or "")
    return {
        "id": med_id,
        "_id": med_id,
        "name": row.get("name") or "Unnamed Medicine",
        "brand": row.get("brand") or row.get("distributor") or "",
        "salt": row.get("salt") or row.get("composition") or "",
        "category": row.get("category") or "General",
        "price": price,
        "mrp": mrp,
        "discount": discount,
        "requiresRx": bool(row.get("requires_rx") if "requires_rx" in row else row.get("requiresRx")),
        "stock": int(row["stock"]) if row.get("stock") is not None else 0,
        "image": row.get("image") or "",
        "hsnCode": row.get("hsn_code") or row.get("hsnCode") or "",
    }


async def search_master_catalog(query: str = "", *, limit: int = 100) -> list[dict[str, Any]]:
    await ensure_pharmacy_master_catalog_schema()
    q = (query or "").strip()
    if len(q) >= 2:
        like = f"%{q}%"
        rows = await db.fetch_all(
            """
            SELECT id, name, brand, salt, category, price, mrp, stock,
                   requires_rx, image, hsn_code
            FROM pharmacy_master_catalog
            WHERE is_active = TRUE
              AND stock > 0
              AND (
                name ILIKE $1 OR brand ILIKE $1 OR salt ILIKE $1
                OR category ILIKE $1
              )
            ORDER BY name ASC
            LIMIT $2
            """,
            like,
            limit,
        )
    else:
        rows = await db.fetch_all(
            """
            SELECT id, name, brand, salt, category, price, mrp, stock,
                   requires_rx, image, hsn_code
            FROM pharmacy_master_catalog
            WHERE is_active = TRUE AND stock > 0
            ORDER BY name ASC
            LIMIT $1
            """,
            limit,
        )
    return [serialize_catalog_row(dict(r)) for r in (rows or [])]


async def list_catalog_categories() -> list[str]:
    await ensure_pharmacy_master_catalog_schema()
    rows = await db.fetch_all(
        """
        SELECT DISTINCT category
        FROM pharmacy_master_catalog
        WHERE is_active = TRUE AND stock > 0 AND category IS NOT NULL AND category <> ''
        ORDER BY category ASC
        """
    )
    return [str(r["category"]) for r in (rows or []) if r.get("category")]
