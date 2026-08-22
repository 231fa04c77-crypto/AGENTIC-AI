"""Postgres persistence for medicine search history, favorites, and popularity."""
from __future__ import annotations

from typing import Any, Optional

from app.config.db import db


async def ensure_medicine_tables() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS medicine_search_history (
            id           BIGSERIAL PRIMARY KEY,
            user_id      BIGINT NOT NULL,
            query        VARCHAR(255) NOT NULL,
            result_count INT NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_medicine_search_history_user_created
            ON medicine_search_history (user_id, created_at DESC)
        """
    )
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS medicine_favorites (
            id              BIGSERIAL PRIMARY KEY,
            user_id         BIGINT NOT NULL,
            medicine_key    VARCHAR(255) NOT NULL,
            brand_name      VARCHAR(255),
            generic_name    VARCHAR(255),
            manufacturer    VARCHAR(255),
            dosage_form     VARCHAR(120),
            short_description TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, medicine_key)
        )
        """
    )
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS medicine_popular (
            query        VARCHAR(255) PRIMARY KEY,
            search_count BIGINT NOT NULL DEFAULT 1,
            last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


async def record_search(user_id: Optional[int], query: str, result_count: int) -> None:
    q = (query or "").strip()[:255]
    if len(q) < 2:
        return
    if user_id:
        await db.execute(
            """
            INSERT INTO medicine_search_history (user_id, query, result_count)
            VALUES ($1, $2, $3)
            """,
            int(user_id),
            q,
            int(result_count or 0),
        )
    await db.execute(
        """
        INSERT INTO medicine_popular (query, search_count, last_searched_at)
        VALUES ($1, 1, NOW())
        ON CONFLICT (query) DO UPDATE SET
            search_count = medicine_popular.search_count + 1,
            last_searched_at = NOW()
        """,
        q.lower(),
    )


async def list_recent_searches(user_id: int, limit: int = 10) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT query, result_count, created_at FROM (
            SELECT DISTINCT ON (lower(query))
                query, result_count, created_at
            FROM medicine_search_history
            WHERE user_id = $1
            ORDER BY lower(query), created_at DESC
        ) t
        ORDER BY created_at DESC
        LIMIT $2
        """,
        int(user_id),
        int(limit),
    )
    return [
        {
            "query": r["query"],
            "resultCount": int(r["result_count"] or 0),
            "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


async def list_search_history(user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT id, query, result_count, created_at
        FROM medicine_search_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        int(user_id),
        int(limit),
    )
    return [
        {
            "id": int(r["id"]),
            "query": r["query"],
            "resultCount": int(r["result_count"] or 0),
            "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


async def clear_search_history(user_id: int) -> None:
    await db.execute(
        "DELETE FROM medicine_search_history WHERE user_id = $1",
        int(user_id),
    )


async def list_popular(limit: int = 10) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT query, search_count, last_searched_at
        FROM medicine_popular
        ORDER BY search_count DESC, last_searched_at DESC
        LIMIT $1
        """,
        int(limit),
    )
    return [
        {
            "query": r["query"],
            "searchCount": int(r["search_count"] or 0),
            "lastSearchedAt": r["last_searched_at"].isoformat() if r["last_searched_at"] else None,
        }
        for r in rows
    ]


async def list_trending(limit: int = 10, hours: int = 72) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT lower(query) AS query, COUNT(*) AS hits, MAX(created_at) AS last_at
        FROM medicine_search_history
        WHERE created_at >= NOW() - ($1 || ' hours')::interval
        GROUP BY lower(query)
        ORDER BY hits DESC, last_at DESC
        LIMIT $2
        """,
        str(int(hours)),
        int(limit),
    )
    return [
        {
            "query": r["query"],
            "searchCount": int(r["hits"] or 0),
            "lastSearchedAt": r["last_at"].isoformat() if r["last_at"] else None,
        }
        for r in rows
    ]


async def add_favorite(user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    key = (payload.get("medicineKey") or payload.get("medicine_key") or "").strip()[:255]
    if not key:
        raise ValueError("medicineKey is required")
    await db.execute(
        """
        INSERT INTO medicine_favorites (
            user_id, medicine_key, brand_name, generic_name,
            manufacturer, dosage_form, short_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, medicine_key) DO UPDATE SET
            brand_name = EXCLUDED.brand_name,
            generic_name = EXCLUDED.generic_name,
            manufacturer = EXCLUDED.manufacturer,
            dosage_form = EXCLUDED.dosage_form,
            short_description = EXCLUDED.short_description
        """,
        int(user_id),
        key,
        (payload.get("brandName") or payload.get("brand_name") or "")[:255] or None,
        (payload.get("genericName") or payload.get("generic_name") or "")[:255] or None,
        (payload.get("manufacturer") or "")[:255] or None,
        (payload.get("dosageForm") or payload.get("dosage_form") or "")[:120] or None,
        (payload.get("shortDescription") or payload.get("short_description") or None),
    )
    row = await db.fetch_row(
        """
        SELECT * FROM medicine_favorites
        WHERE user_id = $1 AND medicine_key = $2
        """,
        int(user_id),
        key,
    )
    return _favorite_row(row)


async def remove_favorite(user_id: int, medicine_key: str) -> None:
    await db.execute(
        "DELETE FROM medicine_favorites WHERE user_id = $1 AND medicine_key = $2",
        int(user_id),
        (medicine_key or "").strip()[:255],
    )


async def list_favorites(user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    rows = await db.query(
        """
        SELECT * FROM medicine_favorites
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        int(user_id),
        int(limit),
    )
    return [_favorite_row(r) for r in rows]


def _favorite_row(row) -> dict[str, Any]:
    if not row:
        return {}
    return {
        "id": int(row["id"]),
        "medicineKey": row["medicine_key"],
        "brandName": row["brand_name"],
        "genericName": row["generic_name"],
        "manufacturer": row["manufacturer"],
        "dosageForm": row["dosage_form"],
        "shortDescription": row["short_description"],
        "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
    }
