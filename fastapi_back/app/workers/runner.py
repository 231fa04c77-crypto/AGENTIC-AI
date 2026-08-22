"""Background workers entrypoint.

Run separately from the API for horizontal scale:

  python -m app.workers.runner

Set RUN_BACKGROUND_WORKERS_IN_API=false on API replicas when using this process.
"""
from __future__ import annotations

import asyncio
import os
import sys

# Ensure fastapi_back is on path when run as module
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


async def _run() -> None:
    from app.config.config import settings, validate_settings
    from app.config.db import db
    from app.utils.app_logger import get_logger

    validate_settings()
    log = get_logger("medclues.workers")
    ok = await db.connect()
    if not ok:
        log.error("Workers failed to connect to PostgreSQL")
        sys.exit(1)

    log.info("Starting background workers (separate process)")

    from app.services.webhook_retry_worker import start_webhook_retry_worker
    from app.services.community_archive_worker import start_community_archive_worker
    from app.services.appointment_reminder_service import start_reminder_scheduler
    from app.services.no_show_scheduler import start_no_show_scheduler
    from app.services.notification_outbox_worker import start_notification_outbox_worker
    from app.services.appointment_archive_worker import start_appointment_archive_worker
    from app.services.order_monitoring_service import start_order_monitoring_worker

    await start_webhook_retry_worker()
    await start_community_archive_worker()
    await start_reminder_scheduler()
    await start_no_show_scheduler()
    await start_notification_outbox_worker()
    await start_appointment_archive_worker()
    # Schedule order monitoring to run in the background (using create_task as it does not return like the other awaitable services that run indefinitely inside tasks)
    asyncio.create_task(start_order_monitoring_worker())

    log.info("All workers scheduled — idle forever")
    while True:
        await asyncio.sleep(3600)


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
