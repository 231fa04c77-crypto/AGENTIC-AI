"""WhatsApp Cloud API (Meta) — optional; falls back to outbox / stub."""
from __future__ import annotations

import httpx

from app.config.config import settings
from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def send_whatsapp_text(to: str, message: str, *, use_outbox: bool = True) -> dict:
    phone = "".join(c for c in (to or "") if c.isdigit())
    body = (message or "").strip()
    if not phone or not body:
        return {"success": False, "message": "Missing phone or message"}

    token = getattr(settings, "WHATSAPP_ACCESS_TOKEN", "") or ""
    phone_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "") or ""
    if token and phone_id:
        url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": body[:4096]},
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                )
            if resp.status_code in (200, 201):
                return {"success": True, "message": "WhatsApp sent", "provider": "meta"}
            return {
                "success": False,
                "message": f"WhatsApp API {resp.status_code}: {resp.text[:200]}",
                "provider": "meta",
            }
        except Exception as exc:
            return {"success": False, "message": str(exc), "provider": "meta"}

    if use_outbox:
        try:
            from app.services.notification_outbox_worker import enqueue

            await enqueue("whatsapp", phone, {"message": body})
            return {
                "success": True,
                "message": "WhatsApp queued (provider not configured)",
                "provider": "outbox",
            }
        except Exception as exc:
            log.warning("WhatsApp outbox enqueue failed: %s", exc)

    log.info("WhatsApp stub to=%s msg=%s", phone, body[:100])
    return {
        "success": True,
        "message": "WhatsApp logged (no Meta credentials)",
        "provider": "dev-mode",
    }
