"""Telegram linking from MedClues mobile app (no password in chat)."""

import os
import secrets
from datetime import datetime, timedelta, timezone

from app.models import telegram_model
from app.services.telegram_api import get_telegram_api


async def create_app_link_code(user_id: int) -> dict:
    await telegram_model.ensure_telegram_schema()
    code = secrets.token_urlsafe(16)
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    await telegram_model.create_link_code(user_id, code, expires)

    username = (os.getenv("TELEGRAM_BOT_USERNAME") or "").strip().lstrip("@")
    if not username:
        api = get_telegram_api()
        if api:
            try:
                me = await api.get_me()
                username = (me.get("result") or {}).get("username") or ""
            except Exception:
                username = ""

    deep_link = (
        f"https://t.me/{username}?start=link_{code}" if username else None
    )
    existing = await telegram_model.get_link_by_user_id(user_id)
    return {
        "success": True,
        "code": code,
        "expiresInMinutes": 15,
        "botUsername": username or None,
        "deepLink": deep_link,
        "linked": existing is not None,
        "telegramUsername": (existing or {}).get("telegram_username"),
    }


async def unlink_telegram_from_app(user_id: int) -> dict:
    await telegram_model.ensure_telegram_schema()
    removed = await telegram_model.unlink_user(user_id)
    if not removed:
        return {"success": False, "message": "Telegram is not linked to this account"}
    return {"success": True, "message": "Telegram disconnected", "linked": False}


async def get_telegram_link_status(user_id: int) -> dict:
    await telegram_model.ensure_telegram_schema()
    link = await telegram_model.get_link_by_user_id(user_id)
    return {
        "success": True,
        "linked": link is not None,
        "telegramUsername": (link or {}).get("telegram_username"),
        "linkedAt": str((link or {}).get("linked_at") or ""),
    }


async def link_chat_with_code(
    chat_id: int,
    code: str,
    telegram_username: str | None,
) -> tuple[bool, str]:
    user_id = await telegram_model.consume_link_code(code)
    if not user_id:
        return False, (
            "❌ Link expired or invalid.\n\n"
            "Open MedClues app → Settings → Connect Telegram and tap the button again."
        )

    from app.models import user_model

    user = await user_model.get_user_by_id(user_id)
    if not user:
        return False, "❌ Account not found. Please register in the app first."

    role = (user.get("role") or "patient").lower()
    if role != "patient":
        return False, f"❌ Only patient accounts can use this bot (role: {role})."

    await telegram_model.link_chat_to_user(chat_id, user_id, telegram_username)
    return True, user.get("name") or "Patient"
