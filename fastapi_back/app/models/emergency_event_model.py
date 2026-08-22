import json
from typing import Any, Optional

from app.config.db import db


async def ensure_emergency_events_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS emergency_events (
            id              BIGSERIAL PRIMARY KEY,
            user_id         INTEGER,
            event_type      VARCHAR(64) NOT NULL,
            severity        VARCHAR(32),
            latitude        DOUBLE PRECISION,
            longitude       DOUBLE PRECISION,
            location_text   TEXT,
            symptoms        JSONB NOT NULL DEFAULT '[]'::jsonb,
            recipient_phone VARCHAR(20),
            metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
            source          VARCHAR(32),
            ip_address      VARCHAR(45),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_emergency_events_user_created
            ON emergency_events (user_id, created_at DESC)
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_emergency_events_type_created
            ON emergency_events (event_type, created_at DESC)
        """
    )


async def log_event(
    *,
    event_type: str,
    user_id: Optional[int] = None,
    severity: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    location_text: Optional[str] = None,
    symptoms: Optional[list] = None,
    recipient_phone: Optional[str] = None,
    metadata: Optional[dict] = None,
    source: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    await db.execute(
        """
        INSERT INTO emergency_events (
            user_id, event_type, severity, latitude, longitude, location_text,
            symptoms, recipient_phone, metadata, source, ip_address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11)
        """,
        user_id,
        event_type,
        severity,
        latitude,
        longitude,
        location_text,
        json.dumps(symptoms or []),
        recipient_phone,
        json.dumps(metadata or {}),
        source,
        ip_address,
    )
