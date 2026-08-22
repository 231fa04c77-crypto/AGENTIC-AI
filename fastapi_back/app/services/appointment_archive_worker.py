"""Archive old completed/cancelled appointments into appointments_archive."""
from __future__ import annotations

import asyncio

from app.config.config import settings
from app.config.db import db
from app.services.appointment_lifecycle_service import CLOSED_FOR_CAPACITY
from app.utils.app_logger import get_logger

log = get_logger(__name__)
_RUNNING = False


async def start_appointment_archive_worker() -> None:
    global _RUNNING
    if _RUNNING:
        return
    _RUNNING = True
    log.info("Appointment archive worker started")
    asyncio.create_task(_loop())


async def _loop() -> None:
    # Run once shortly after start, then daily
    await asyncio.sleep(30)
    while True:
        try:
            await archive_old_appointments()
            await _ensure_archive_partitions()
        except Exception as exc:
            log.error("Appointment archive error: %s", exc)
        await asyncio.sleep(24 * 3600)


async def archive_old_appointments(batch_size: int | None = None) -> int:
    """Move closed appointments older than APPOINTMENT_ARCHIVE_DAYS into archive table."""
    days = int(getattr(settings, "APPOINTMENT_ARCHIVE_DAYS", 365) or 365)
    limit = int(batch_size or getattr(settings, "APPOINTMENT_ARCHIVE_BATCH", 500) or 500)
    if days < 30:
        days = 30

    if not db.pool:
        await db.connect()

    closed = list(CLOSED_FOR_CAPACITY)

    async with db.pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                SELECT id FROM appointments
                WHERE (
                      cancelled = true
                   OR is_completed = true
                   OR lifecycle_status = ANY($3::varchar[])
                )
                  AND created_at < NOW() - ($1 || ' days')::interval
                ORDER BY created_at ASC
                LIMIT $2
                FOR UPDATE SKIP LOCKED
                """,
                str(days),
                limit,
                closed,
            )
            ids = [int(r["id"]) for r in rows]
            if not ids:
                return 0

            await conn.execute(
                """
                INSERT INTO appointments_archive
                SELECT a.*, NOW()
                FROM appointments a
                WHERE a.id = ANY($1::int[])
                  AND NOT EXISTS (
                    SELECT 1 FROM appointments_archive ar WHERE ar.id = a.id
                  )
                """,
                ids,
            )
            await conn.execute(
                "DELETE FROM appointments WHERE id = ANY($1::int[])",
                ids,
            )

    log.info("Archived %d appointments older than %d days", len(ids), days)
    return len(ids)


async def _ensure_archive_partitions() -> None:
    """Pre-create next archive month partitions when parent is partitioned (migration 044)."""
    try:
        await db.execute(
            """
            SELECT ensure_appointments_archive_partition(
              (date_trunc('month', NOW()) + (g || ' month')::interval)::date
            )
            FROM generate_series(0, 2) AS g
            """
        )
    except Exception as exc:
        log.debug("archive partition ensure skipped: %s", exc)
