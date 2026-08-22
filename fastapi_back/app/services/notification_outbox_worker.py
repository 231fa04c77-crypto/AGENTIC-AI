"""Notification outbox — durable queue for SMS / email / FCM with retries."""
from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

from app.config.db import db
from app.utils.app_logger import get_logger

log = get_logger(__name__)
_RUNNING = False


async def ensure_outbox_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_outbox (
            id              BIGSERIAL PRIMARY KEY,
            channel         VARCHAR(16) NOT NULL,
            recipient       VARCHAR(255) NOT NULL,
            payload         JSONB NOT NULL DEFAULT '{}',
            status          VARCHAR(32) NOT NULL DEFAULT 'pending',
            attempts        INT NOT NULL DEFAULT 0,
            next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_error      TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
        ON notification_outbox (status, next_retry_at)
        WHERE status IN ('pending', 'failed')
        """
    )


async def enqueue(
    channel: str,
    recipient: str,
    payload: dict[str, Any],
) -> Optional[int]:
    row = await db.fetch_row(
        """
        INSERT INTO notification_outbox (channel, recipient, payload)
        VALUES ($1, $2, $3::jsonb)
        RETURNING id
        """,
        channel,
        recipient,
        json.dumps(payload),
    )
    return int(row["id"]) if row else None


async def start_notification_outbox_worker() -> None:
    global _RUNNING
    if _RUNNING:
        return
    _RUNNING = True
    try:
        await ensure_outbox_table()
    except Exception as exc:
        log.warning("Outbox table ensure failed: %s", exc)
    log.info("Notification outbox worker started")
    asyncio.create_task(_loop())


async def _loop() -> None:
    while True:
        try:
            await _process_batch()
        except Exception as exc:
            log.error("Outbox worker error: %s", exc)
        await asyncio.sleep(15)


async def _process_batch() -> None:
    if not db.pool:
        await db.connect()
    async with db.pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                SELECT * FROM notification_outbox
                WHERE status IN ('pending', 'failed')
                  AND next_retry_at <= NOW()
                  AND attempts < 5
                ORDER BY next_retry_at ASC
                LIMIT 25
                FOR UPDATE SKIP LOCKED
                """
            )
            ids = [int(r["id"]) for r in rows]
            if ids:
                await conn.execute(
                    """
                    UPDATE notification_outbox
                    SET next_retry_at = NOW() + interval '2 minutes',
                        updated_at = NOW()
                    WHERE id = ANY($1::bigint[])
                    """,
                    ids,
                )
            batch = [dict(r) for r in rows]

    for row in batch:
        await _deliver(row)


async def _deliver(row: dict) -> None:
    delivery_id = int(row["id"])
    channel = (row.get("channel") or "").lower()
    recipient = row.get("recipient") or ""
    payload = row.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    attempt = int(row.get("attempts") or 0) + 1

    ok = False
    err = ""
    try:
        if channel == "sms":
            from app.services import sms_service

            result = await sms_service.send_sms(
                recipient, payload.get("message") or "", use_outbox=False
            )
            ok = bool(result.get("success"))
            err = result.get("message") or ""
        elif channel == "email":
            from app.services import email_service

            result = await email_service.send_email(
                recipient,
                payload.get("subject") or "MedClues",
                payload.get("html") or payload.get("message") or "",
            )
            ok = bool(result.get("success") if isinstance(result, dict) else result)
        elif channel == "whatsapp":
            from app.services import whatsapp_service

            result = await whatsapp_service.send_whatsapp_text(
                recipient, payload.get("message") or "", use_outbox=False
            )
            ok = bool(result.get("success"))
            err = result.get("message") or ""
        elif channel == "fcm":
            from app.services import fcm_service

            ok = await fcm_service.send_to_user(
                int(payload.get("user_id") or 0),
                payload.get("title") or "MedClues",
                payload.get("body") or "",
                data=payload.get("data") or {},
            )
        else:
            err = f"Unknown channel {channel}"
    except Exception as exc:
        err = str(exc)[:500]

    if ok:
        await db.execute(
            """
            UPDATE notification_outbox
            SET status = 'delivered', attempts = $1, last_error = NULL, updated_at = NOW()
            WHERE id = $2
            """,
            attempt,
            delivery_id,
        )
    else:
        backoff = [60, 300, 900, 3600, 86400][min(attempt - 1, 4)]
        await db.execute(
            """
            UPDATE notification_outbox
            SET status = CASE WHEN $1 >= 5 THEN 'permanently_failed' ELSE 'failed' END,
                attempts = $1,
                last_error = $2,
                next_retry_at = NOW() + ($3 || ' seconds')::interval,
                updated_at = NOW()
            WHERE id = $4
            """,
            attempt,
            err[:500],
            str(backoff),
            delivery_id,
        )
