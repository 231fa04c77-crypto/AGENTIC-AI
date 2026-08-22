"""Background archive job for resolved community questions."""
from __future__ import annotations

import asyncio

from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def start_community_archive_worker(interval_hours: int = 24, older_than_days: int = 90) -> None:
    await asyncio.sleep(30)
    while True:
        try:
            from app.services import community_service as svc
            result = await svc.run_archive_job(older_than_days)
            log.info("Community archive job: %s", result)
        except Exception as exc:
            log.warning("Community archive job failed: %s", exc)
        await asyncio.sleep(max(3600, interval_hours * 3600))
