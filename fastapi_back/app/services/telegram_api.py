"""Low-level Telegram Bot API client."""

from typing import Any, Dict, List, Optional

import httpx

from app.config.config import settings

API_BASE = "https://api.telegram.org"


class TelegramApi:
    def __init__(self, token: str):
        self._token = token
        self._base = f"{API_BASE}/bot{token}"

    async def get_me(self) -> Dict[str, Any]:
        return await self._post("getMe", {})

    async def send_message(
        self,
        chat_id: int,
        text: str,
        *,
        parse_mode: Optional[str] = None,
        disable_web_page_preview: bool = True,
        reply_markup: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "text": text[:4096],
            "disable_web_page_preview": disable_web_page_preview,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return await self._post("sendMessage", payload)

    async def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
        *,
        show_alert: bool = False,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text[:200]
        payload["show_alert"] = show_alert
        return await self._post("answerCallbackQuery", payload)

    async def set_my_commands(self, commands: List[Dict[str, str]]) -> Dict[str, Any]:
        return await self._post("setMyCommands", {"commands": commands})

    async def get_updates(
        self,
        offset: Optional[int] = None,
        timeout: int = 30,
    ) -> List[Dict[str, Any]]:
        payload: Dict[str, Any] = {"timeout": timeout}
        if offset is not None:
            payload["offset"] = offset
        data = await self._post("getUpdates", payload)
        return data.get("result", [])

    async def delete_webhook(self, drop_pending_updates: bool = False) -> Dict[str, Any]:
        """Clear any webhook so long-polling (getUpdates) doesn't conflict."""
        return await self._post(
            "deleteWebhook", {"drop_pending_updates": drop_pending_updates}
        )

    async def _post(self, method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            res = await client.post(f"{self._base}/{method}", json=payload)
            res.raise_for_status()
            data = res.json()
            if not data.get("ok"):
                raise RuntimeError(data.get("description", "Telegram API error"))
            return data


def get_telegram_api() -> Optional[TelegramApi]:
    token = (settings.TELEGRAM_BOT_TOKEN or "").strip()
    if not token:
        return None
    return TelegramApi(token)


async def register_bot_commands() -> None:
    api = get_telegram_api()
    if not api:
        return
    commands = [
        {"command": "start", "description": "Welcome & main menu"},
        {"command": "dashboard", "description": "Open app home page"},
        {"command": "upcoming", "description": "Next appointments"},
        {"command": "records", "description": "Health records"},
        {"command": "profile", "description": "Your profile"},
        {"command": "help", "description": "Help & support"},
        {"command": "logout", "description": "Unlink account"},
    ]
    try:
        await api.set_my_commands(commands)
        print("[Telegram] Bot commands menu registered")
    except Exception as e:
        print(f"[WARNING] Telegram setMyCommands failed: {e}")
