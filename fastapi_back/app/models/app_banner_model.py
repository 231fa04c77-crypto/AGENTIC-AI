"""App home promo banners for Flutter carousel."""
from __future__ import annotations

from typing import Any, Optional

from app.config.db import db


async def ensure_schema() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS app_home_banners (
            id              SERIAL PRIMARY KEY,
            title           VARCHAR(120) NOT NULL,
            subtitle        VARCHAR(240),
            cta_label       VARCHAR(80) NOT NULL DEFAULT 'Explore →',
            route_key       VARCHAR(64) NOT NULL DEFAULT 'hospitals',
            image_url       TEXT,
            gradient_start  VARCHAR(16) DEFAULT '#002855',
            gradient_mid    VARCHAR(16) DEFAULT '#1565C0',
            gradient_end    VARCHAR(16) DEFAULT '#7DD3FC',
            icon_key        VARCHAR(64) DEFAULT 'hospital',
            sort_order      INTEGER NOT NULL DEFAULT 0,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            starts_at       TIMESTAMPTZ,
            ends_at         TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    # Seed defaults once so Flutter has slides before admin edits.
    existing = await db.fetch_row("SELECT id FROM app_home_banners LIMIT 1")
    if not existing:
        await db.execute(
            """
            INSERT INTO app_home_banners
              (title, subtitle, cta_label, route_key, gradient_start, gradient_mid, gradient_end, icon_key, sort_order)
            VALUES
              ('Explore hospitals', 'Care finds you when you need it most.', 'Explore Now →', 'hospitals', '#002855', '#1565C0', '#7DD3FC', 'hospital', 0),
              ('Pharmacy', 'The right medicine, right when you need it.', 'Shop Now →', 'pharmacy', '#0F766E', '#009F93', '#99F6E4', 'pharmacy', 1),
              ('Find doctors', 'Good health begins with the right doctor.', 'Browse Doctors →', 'doctors', '#0D9488', '#14B8A6', '#57D2E8', 'doctors', 2),
              ('Health Protection', 'Protect today. Peace of mind tomorrow.', 'Protect Now →', 'healthProtection', '#1E3A5F', '#3B82A8', '#A5B4FC', 'health', 3)
            """
        )


def _row_public(row: dict) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row.get("title") or "",
        "subtitle": row.get("subtitle") or "",
        "ctaLabel": row.get("cta_label") or "Explore →",
        "routeKey": row.get("route_key") or "hospitals",
        "imageUrl": row.get("image_url"),
        "gradientStart": row.get("gradient_start") or "#002855",
        "gradientMid": row.get("gradient_mid") or "#1565C0",
        "gradientEnd": row.get("gradient_end") or "#7DD3FC",
        "iconKey": row.get("icon_key") or "hospital",
        "sortOrder": int(row.get("sort_order") or 0),
        "isActive": bool(row.get("is_active", True)),
        "startsAt": row["starts_at"].isoformat() if row.get("starts_at") else None,
        "endsAt": row["ends_at"].isoformat() if row.get("ends_at") else None,
    }


async def list_active_public() -> list[dict[str, Any]]:
    await ensure_schema()
    rows = await db.query(
        """
        SELECT * FROM app_home_banners
        WHERE COALESCE(is_active, true) = true
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at >= NOW())
        ORDER BY sort_order ASC, id ASC
        """
    )
    return [_row_public(dict(r)) for r in rows]


async def list_all_admin() -> list[dict[str, Any]]:
    await ensure_schema()
    rows = await db.query(
        "SELECT * FROM app_home_banners ORDER BY sort_order ASC, id ASC"
    )
    return [_row_public(dict(r)) for r in rows]


async def create_banner(data: dict[str, Any]) -> dict[str, Any]:
    await ensure_schema()
    row = await db.fetch_row(
        """
        INSERT INTO app_home_banners (
            title, subtitle, cta_label, route_key, image_url,
            gradient_start, gradient_mid, gradient_end, icon_key,
            sort_order, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
        """,
        (data.get("title") or "").strip()[:120],
        (data.get("subtitle") or "").strip()[:240] or None,
        (data.get("ctaLabel") or data.get("cta_label") or "Explore →").strip()[:80],
        (data.get("routeKey") or data.get("route_key") or "hospitals").strip()[:64],
        (data.get("imageUrl") or data.get("image_url") or None),
        data.get("gradientStart") or data.get("gradient_start") or "#002855",
        data.get("gradientMid") or data.get("gradient_mid") or "#1565C0",
        data.get("gradientEnd") or data.get("gradient_end") or "#7DD3FC",
        data.get("iconKey") or data.get("icon_key") or "hospital",
        int(
            data.get("sortOrder")
            if data.get("sortOrder") is not None
            else data.get("sort_order") or 0
        ),
        bool(
            data.get("isActive")
            if data.get("isActive") is not None
            else data.get("is_active", True)
        ),
    )
    return _row_public(dict(row)) if row else {}


async def update_banner(banner_id: int, data: dict[str, Any]) -> Optional[dict[str, Any]]:
    await ensure_schema()
    existing = await db.fetch_row(
        "SELECT * FROM app_home_banners WHERE id = $1", int(banner_id)
    )
    if not existing:
        return None
    merged = dict(existing)
    field_map = {
        "title": "title",
        "subtitle": "subtitle",
        "ctaLabel": "cta_label",
        "cta_label": "cta_label",
        "routeKey": "route_key",
        "route_key": "route_key",
        "imageUrl": "image_url",
        "image_url": "image_url",
        "gradientStart": "gradient_start",
        "gradient_start": "gradient_start",
        "gradientMid": "gradient_mid",
        "gradient_mid": "gradient_mid",
        "gradientEnd": "gradient_end",
        "gradient_end": "gradient_end",
        "iconKey": "icon_key",
        "icon_key": "icon_key",
        "sortOrder": "sort_order",
        "sort_order": "sort_order",
        "isActive": "is_active",
        "is_active": "is_active",
    }
    for src, col in field_map.items():
        if src in data and data[src] is not None:
            merged[col] = data[src]
    row = await db.fetch_row(
        """
        UPDATE app_home_banners SET
            title = $2,
            subtitle = $3,
            cta_label = $4,
            route_key = $5,
            image_url = $6,
            gradient_start = $7,
            gradient_mid = $8,
            gradient_end = $9,
            icon_key = $10,
            sort_order = $11,
            is_active = $12,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        """,
        int(banner_id),
        str(merged.get("title") or "")[:120],
        (str(merged.get("subtitle") or "")[:240] or None),
        str(merged.get("cta_label") or "Explore →")[:80],
        str(merged.get("route_key") or "hospitals")[:64],
        merged.get("image_url"),
        merged.get("gradient_start") or "#002855",
        merged.get("gradient_mid") or "#1565C0",
        merged.get("gradient_end") or "#7DD3FC",
        merged.get("icon_key") or "hospital",
        int(merged.get("sort_order") or 0),
        bool(merged.get("is_active", True)),
    )
    return _row_public(dict(row)) if row else None


async def delete_banner(banner_id: int) -> bool:
    await ensure_schema()
    await db.execute("DELETE FROM app_home_banners WHERE id = $1", int(banner_id))
    return True
