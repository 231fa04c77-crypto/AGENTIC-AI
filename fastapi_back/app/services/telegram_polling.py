"""Long-polling loop for Telegram bot (runs with FastAPI lifespan)."""

import asyncio
from typing import Optional

import httpx

from app.config.config import settings
from app.controllers.telegram_bot_controller import handle_update
from app.models import telegram_model
from app.services.telegram_api import get_telegram_api, register_bot_commands

_polling_task: Optional[asyncio.Task] = None
_stop_event: Optional[asyncio.Event] = None


async def start_telegram_bot() -> None:
    global _polling_task, _stop_event

    if not settings.TELEGRAM_BOT_ENABLED:
        print("[Telegram] Bot disabled (TELEGRAM_BOT_ENABLED=false)")
        return

    api = get_telegram_api()
    if not api:
        print("[Telegram] TELEGRAM_BOT_TOKEN not set — bot not started")
        return

    await telegram_model.ensure_telegram_schema()

    try:
        me = await api.get_me()
        username = me.get("result", {}).get("username", "?")
        print(f"[Telegram] Bot started: @{username}")
        # Clear any webhook so long-polling doesn't conflict (409).
        try:
            await api.delete_webhook(drop_pending_updates=False)
        except Exception as wh_err:
            print(f"[Telegram] deleteWebhook skipped: {wh_err}")
        await register_bot_commands()
    except Exception as e:
        print(f"[Telegram] Failed to verify bot token: {e}")
        return

    _stop_event = asyncio.Event()

    async def _poll() -> None:
        offset: Optional[int] = None
        conflict_logged = False
        while _stop_event and not _stop_event.is_set():
            try:
                updates = await api.get_updates(offset=offset, timeout=25)
                conflict_logged = False
                for upd in updates:
                    upd_id = upd.get("update_id")
                    if upd_id is not None:
                        offset = int(upd_id) + 1
                    try:
                        await handle_update(api, upd)
                    except Exception as handler_err:
                        print(f"[Telegram] Handler error: {handler_err}")
            except asyncio.CancelledError:
                break
            except httpx.HTTPStatusError as http_err:
                # 409 = another process is polling the same bot token. Back off
                # quietly (don't spam logs) — ensure only ONE instance polls.
                if http_err.response is not None and http_err.response.status_code == 409:
                    if not conflict_logged:
                        print(
                            "[Telegram] 409 Conflict — another instance is polling "
                            "this bot token. Run only ONE poller (single web worker, "
                            "and disable the bot locally with TELEGRAM_BOT_ENABLED=false)."
                        )
                        conflict_logged = True
                    await asyncio.sleep(15)
                else:
                    print(f"[Telegram] Poll error: {http_err}")
                    await asyncio.sleep(3)
            except Exception as poll_err:
                print(f"[Telegram] Poll error: {poll_err}")
                await asyncio.sleep(3)

    _polling_task = asyncio.create_task(_poll(), name="telegram-polling")


async def stop_telegram_bot() -> None:
    global _polling_task, _stop_event
    if _stop_event:
        _stop_event.set()
    if _polling_task:
        _polling_task.cancel()
        try:
            await _polling_task
        except asyncio.CancelledError:
            pass
        _polling_task = None
    _stop_event = None
    print("[Telegram] Bot stopped")
