"""Webhook retry worker — background task that re-fires failed deliveries.

Run automatically at startup (registered in main.py lifespan).
Scans webhook_deliveries every 60 seconds for rows where:
  - status IN ('failed', 'pending')
  - next_retry_at <= NOW()

This implements the exponential backoff retry schedule set by partner_webhook_service.py.
"""
from __future__ import annotations

import asyncio
import json
import time

import httpx

from app.config.db import db
from app.services.partner_auth_service import build_webhook_signature
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_RUNNING = False


async def start_webhook_retry_worker() -> None:
    """Launch the background retry loop as an asyncio task."""
    global _RUNNING
    if _RUNNING:
        return
    _RUNNING = True
    log.info("Webhook retry worker started")
    asyncio.create_task(_retry_loop())


async def _retry_loop() -> None:
    while True:
        try:
            await _process_pending_retries()
        except Exception as exc:
            log.error("Webhook retry worker error: %s", exc)
        await asyncio.sleep(60)


async def _process_pending_retries() -> None:
    from app.models import partner_model

    if not db.pool:
        await db.connect()

    async with db.pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                SELECT wd.*, p.webhook_url
                FROM webhook_deliveries wd
                JOIN partners p ON p.id = wd.partner_id
                WHERE wd.status IN ('failed', 'pending')
                  AND wd.next_retry_at <= NOW()
                  AND wd.attempts < 5
                ORDER BY wd.next_retry_at ASC
                LIMIT 20
                FOR UPDATE OF wd SKIP LOCKED
                """,
            )
            claimed_ids = [int(r["id"]) for r in rows]
            # Push next_retry_at forward so other workers skip these rows if TX ends early
            if claimed_ids:
                await conn.execute(
                    """
                    UPDATE webhook_deliveries
                    SET next_retry_at = NOW() + interval '5 minutes',
                        last_attempt_at = NOW()
                    WHERE id = ANY($1::int[])
                    """,
                    claimed_ids,
                )
            row_dicts = [dict(r) for r in rows]

    if not row_dicts:
        return

    log.info("Webhook retry: processing %d pending deliveries", len(row_dicts))

    for row in row_dicts:
        delivery_id = row["id"]
        url = row.get("webhook_url") or ""
        if not url:
            await _mark_dead(delivery_id, "No webhook URL")
            continue

        payload_raw = row["payload"]
        body_bytes = (
            payload_raw.encode() if isinstance(payload_raw, str)
            else json.dumps(payload_raw).encode()
        )
        secret = await partner_model.get_webhook_secret(int(row["partner_id"]))
        if not secret:
            secret = f"unset_webhook_secret_{row['partner_id']}"
        signature = build_webhook_signature(secret, body_bytes)
        attempt = (row["attempts"] or 0) + 1

        headers = {
            "Content-Type": "application/json",
            "X-MedClues-Event": row["event_type"],
            "X-MedClues-Signature": signature,
            "X-MedClues-Timestamp": str(int(time.time())),
            "X-MedClues-Delivery": str(row.get("delivery_id", "")),
            "User-Agent": "MedClues-Webhook/1.0",
        }

        await db.execute(
            "UPDATE webhook_deliveries SET attempts=$1, last_attempt_at=NOW() WHERE id=$2",
            attempt, delivery_id,
        )

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, content=body_bytes, headers=headers)
            status_code = resp.status_code
            body_text = resp.text[:500]

            if 200 <= status_code < 300:
                await db.execute(
                    """
                    UPDATE webhook_deliveries
                    SET status='delivered', response_code=$1,
                        response_body=$2, next_retry_at=NULL
                    WHERE id=$3
                    """,
                    status_code, body_text, delivery_id,
                )
                log.info("Retry succeeded: delivery=%s event=%s", delivery_id, row["event_type"])
            else:
                await _schedule_next_retry(delivery_id, attempt, status_code, body_text)

        except Exception as exc:
            log.warning("Retry exception: delivery=%s err=%s", delivery_id, exc)
            await _schedule_next_retry(delivery_id, attempt, 0, str(exc)[:255])


_BACKOFF = [60, 300, 1800, 7200, 86400]


async def _schedule_next_retry(delivery_id: int, attempt: int,
                               code: int, body: str) -> None:
    if attempt >= len(_BACKOFF):
        await _mark_dead(delivery_id, body)
        return
    backoff = _BACKOFF[attempt - 1]
    await db.execute(
        """
        UPDATE webhook_deliveries
        SET status='failed', response_code=$1, response_body=$2,
            next_retry_at = NOW() + ($3 || ' seconds')::interval
        WHERE id=$4
        """,
        code, body, str(backoff), delivery_id,
    )


async def _mark_dead(delivery_id: int, reason: str) -> None:
    await db.execute(
        """
        UPDATE webhook_deliveries
        SET status='permanently_failed', response_body=$1, next_retry_at=NULL
        WHERE id=$2
        """,
        reason[:255], delivery_id,
    )
    log.error("Webhook permanently failed: delivery=%s reason=%s", delivery_id, reason)
