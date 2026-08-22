"""Partner webhook service — fire-and-forget outbound delivery with DB logging."""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx

from app.config.db import db
from app.models import partner_model
from app.services.partner_auth_service import build_webhook_signature
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_BACKOFF_SCHEDULE = [60, 300, 1800, 7200, 86400]


async def _resolve_webhook_secret(partner_id: int, explicit: str | None = None) -> str:
    if explicit and explicit != "default_sandbox_secret":
        return explicit
    secret = await partner_model.get_webhook_secret(partner_id)
    if secret:
        return secret
    from app.config.config import settings
    env_secret = (settings.PHARMASYNC_WEBHOOK_SIGNING_SECRET or "").strip()
    if env_secret:
        return env_secret
    log.warning(
        "Partner %s has no webhook signing secret — using ephemeral fallback (rotate secret)",
        partner_id,
    )
    return f"unset_webhook_secret_{partner_id}"


async def enqueue_webhook_event(
    partner_id: int,
    case_id: int | None,
    event_type: str,
    payload: dict[str, Any],
    webhook_url: str,
    webhook_secret: str | None = None,
) -> None:
    """Insert a delivery record and fire the first attempt asynchronously."""
    if not webhook_url:
        log.warning("Skipping webhook %s — no URL for partner %s", event_type, partner_id)
        return

    secret = await _resolve_webhook_secret(partner_id, webhook_secret)
    body_bytes = json.dumps(payload, default=str).encode()
    signature = build_webhook_signature(secret, body_bytes)

    row = await db.fetch_row(
        """
        INSERT INTO webhook_deliveries
            (partner_id, case_id, event_type, payload, status, next_retry_at)
        VALUES ($1, $2, $3, $4::jsonb, 'pending', NOW())
        RETURNING id, delivery_id::text
        """,
        partner_id, case_id, event_type, json.dumps(payload, default=str),
    )
    if not row:
        log.error("Failed to create webhook_delivery record for event=%s", event_type)
        return

    delivery_id = int(row["id"])
    asyncio.create_task(
        _attempt_delivery(
            delivery_id=delivery_id,
            partner_id=partner_id,
            case_id=case_id,
            event_type=event_type,
            url=webhook_url,
            body_bytes=body_bytes,
            signature=signature,
        )
    )


async def _attempt_delivery(
    delivery_id: int,
    partner_id: int,
    case_id: int | None,
    event_type: str,
    url: str,
    body_bytes: bytes,
    signature: str,
    attempt: int = 1,
) -> None:
    headers = {
        "Content-Type": "application/json",
        "X-MedClues-Event": event_type,
        "X-MedClues-Signature": signature,
        "X-MedClues-Timestamp": str(int(time.time())),
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
        response_text = resp.text[:500]

        if 200 <= status_code < 300:
            await _mark_success(delivery_id, status_code, response_text)
            log.info("Webhook delivered: event=%s delivery=%s", event_type, delivery_id)
            return

        log.warning(
            "Webhook non-2xx: event=%s status=%s attempt=%s",
            event_type, status_code, attempt,
        )
        await _schedule_retry_or_fail(delivery_id, attempt, status_code, response_text)

    except Exception as exc:
        log.error("Webhook exception: event=%s delivery=%s err=%s", event_type, delivery_id, exc)
        await _schedule_retry_or_fail(delivery_id, attempt, 0, str(exc)[:255])


async def _mark_success(delivery_id: int, code: int, body: str) -> None:
    await db.execute(
        """
        UPDATE webhook_deliveries
        SET status='delivered', response_code=$1, response_body=$2, next_retry_at=NULL
        WHERE id=$3
        """,
        code, body, delivery_id,
    )


async def _schedule_retry_or_fail(delivery_id: int, attempt: int,
                                  code: int, body: str) -> None:
    if attempt >= len(_BACKOFF_SCHEDULE):
        await db.execute(
            """
            UPDATE webhook_deliveries
            SET status='permanently_failed', response_code=$1, response_body=$2, next_retry_at=NULL
            WHERE id=$3
            """,
            code, body, delivery_id,
        )
        log.error("Webhook permanently failed after %s attempts (delivery=%s)", attempt, delivery_id)
        return

    backoff = _BACKOFF_SCHEDULE[attempt - 1]
    await db.execute(
        """
        UPDATE webhook_deliveries
        SET status='failed', response_code=$1, response_body=$2,
            next_retry_at = NOW() + ($3 || ' seconds')::interval
        WHERE id=$4
        """,
        code, body, str(backoff), delivery_id,
    )


async def emit_case_created(partner_id: int, case_id: int, case_data: dict,
                            webhook_url: str, webhook_secret: str | None = None) -> None:
    payload = {
        "event": "emergency.case.created",
        "case_id": case_data.get("public_id"),
        "status": case_data.get("status"),
        "hospital": {
            "name": case_data.get("hospital_name"),
            "address": case_data.get("hospital_address"),
            "distance_km": case_data.get("hospital_distance_km"),
            "eta_minutes": case_data.get("ambulance_eta_minutes"),
            "is_tieup": case_data.get("hospital_id") is not None,
        },
        "tracking_url": case_data.get("tracking_url"),
        "timestamp": int(time.time()),
    }
    await enqueue_webhook_event(
        partner_id, case_id, "emergency.case.created", payload, webhook_url, webhook_secret,
    )


async def emit_status_changed(partner_id: int, case_id: int, case_data: dict,
                              webhook_url: str, webhook_secret: str | None = None) -> None:
    payload = {
        "event": "emergency.status.changed",
        "case_id": case_data.get("public_id"),
        "status": case_data.get("status"),
        "timestamp": int(time.time()),
    }
    await enqueue_webhook_event(
        partner_id, case_id, "emergency.status.changed", payload, webhook_url, webhook_secret,
    )


async def emit_pharmacy_event(
    partner_id: int,
    event_type: str,
    payload: dict[str, Any],
    webhook_url: str | None = None,
) -> None:
    """Enqueue a pharmacy-domain webhook (prescription.*, order.*, payment.*)."""
    from app.config.config import settings

    url = webhook_url
    if not url:
        partner = await partner_model.get_partner_by_id(partner_id)
        url = (partner or {}).get("webhook_url")
    if not url:
        url = (settings.PHARMASYNC_WEBHOOK_URL or "").strip()
    body = {**payload, "event": event_type, "timestamp": int(time.time())}
    hospital_code = (settings.PHARMASYNC_HOSPITAL_CODE or "").strip()
    if hospital_code and "hospital_code" not in body and "hospitalCode" not in body:
        body["hospitalCode"] = hospital_code
    await enqueue_webhook_event(partner_id, None, event_type, body, url or "")


async def emit_lab_event(
    partner_id: int,
    event_type: str,
    payload: dict[str, Any],
    webhook_url: str | None = None,
) -> None:
    """Enqueue a lab-domain webhook (lab.order.*, lab.result.*)."""
    url = webhook_url
    if not url:
        partner = await partner_model.get_partner_by_id(partner_id)
        url = (partner or {}).get("webhook_url")
    body = {**payload, "event": event_type, "timestamp": int(time.time())}
    await enqueue_webhook_event(partner_id, None, event_type, body, url or "")


async def emit_event(
    partner_id: int,
    event_type: str,
    payload: dict[str, Any],
    webhook_url: str | None = None,
) -> None:
    """Generic partner webhook emit (lab / pharmacy / future domains)."""
    et = (event_type or "").lower()
    if et.startswith("lab."):
        await emit_lab_event(partner_id, event_type, payload, webhook_url)
    elif et.startswith("pharmacy.") or et.startswith("prescription.") or et.startswith("order."):
        await emit_pharmacy_event(partner_id, event_type, payload, webhook_url)
    else:
        url = webhook_url
        if not url:
            partner = await partner_model.get_partner_by_id(partner_id)
            url = (partner or {}).get("webhook_url")
        body = {**payload, "event": event_type, "timestamp": int(time.time())}
        await enqueue_webhook_event(partner_id, None, event_type, body, url or "")
