"""Outbound PharmaSync pharmacy provisioning — MedClues → PharmaSync."""
from __future__ import annotations

import json
import secrets
import time
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config.config import settings
from app.services.partner_auth_service import compute_request_signature
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def _resolve_base_url(partner: dict | None) -> str:
    explicit = (settings.PHARMASYNC_BASE_URL or "").strip().rstrip("/")
    if explicit:
        return explicit
    webhook = ((partner or {}).get("webhook_url") or "").strip()
    if webhook:
        parsed = urlparse(webhook)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return ""


def _local_pharmacy_ref(hospital_id: int) -> str:
    suffix = secrets.token_hex(3).upper()
    return f"PHARM{hospital_id:04d}{suffix}"


def _provision_path() -> str:
    path = (settings.PHARMASYNC_PROVISION_PATH or "/api/integration/pharmacies").strip()
    if not path.startswith("/"):
        path = f"/{path}"
    return path


def _build_auth_headers(method: str, path: str, body_bytes: bytes) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    api_key = (settings.PHARMASYNC_PUBLIC_API_KEY or "").strip()
    secret_key = (settings.PHARMASYNC_PRIVATE_SECRET_KEY or "").strip()
    if api_key:
        headers["X-Api-Key"] = api_key
        headers["Authorization"] = f"Bearer {api_key}"
    timestamp = str(int(time.time()))
    headers["X-Timestamp"] = timestamp
    if secret_key:
        headers["X-Signature"] = compute_request_signature(
            secret_key, timestamp, method, path, body_bytes,
        )
    return headers


async def provision_pharmacy(
    *,
    partner: dict,
    hospital_id: int,
    hospital_name: str,
    hospital_address: str | None,
    pharmacy_name: str,
    manager_name: str,
    email: str,
    phone: str,
    address: str | None,
    license_number: str | None,
) -> dict[str, Any]:
    """
    Call PharmaSync POST /api/integration/pharmacies (or PHARMASYNC_PROVISION_PATH).
    Uses pk_/sk_ HMAC when configured. Falls back to local ref when base URL unset.
    """
    base_url = _resolve_base_url(partner)
    path = _provision_path()
    payload: dict[str, Any] = {
        "hospitalId": str(hospital_id),
        "hospitalName": hospital_name,
        "pharmacyName": pharmacy_name,
        "managerName": manager_name,
        "email": email,
        "phone": phone,
        "address": address or hospital_address or "",
        "licenseNumber": license_number or "",
    }
    hospital_code = (settings.PHARMASYNC_HOSPITAL_CODE or "").strip()
    if hospital_code:
        payload["hospitalCode"] = hospital_code

    if not base_url:
        ref = _local_pharmacy_ref(hospital_id)
        log.info(
            "PharmaSync base URL not configured — local provision ref=%s hospital=%s",
            ref,
            hospital_id,
        )
        return {
            "success": True,
            "pharmacyId": ref,
            "status": "CONNECTED",
            "mode": "local",
        }

    body_bytes = json.dumps(payload, separators=(",", ":"), default=str).encode()
    url = f"{base_url}{path}"
    headers = _build_auth_headers("POST", path, body_bytes)

    from app.services.circuit_breaker import get_breaker

    br = get_breaker("pharmasync_provision")
    if not br.allow():
        return {"success": False, "message": "PharmaSync temporarily unavailable (circuit open)"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, content=body_bytes, headers=headers)
        if resp.status_code >= 500:
            br.record_failure()
        else:
            br.record_success()
        if resp.status_code >= 400:
            detail = resp.text[:500]
            log.warning("PharmaSync provision failed %s %s: %s", resp.status_code, url, detail)
            return {
                "success": False,
                "message": f"PharmaSync returned {resp.status_code}",
                "detail": detail,
            }
        data = resp.json() if resp.content else {}
        pharmacy_id = (
            data.get("pharmacyId")
            or data.get("pharmacy_id")
            or data.get("id")
        )
        status = (data.get("status") or "CONNECTED").upper()
        if not pharmacy_id:
            return {
                "success": False,
                "message": "PharmaSync did not return pharmacyId",
                "detail": data,
            }
        return {
            "success": True,
            "pharmacyId": str(pharmacy_id),
            "status": status,
            "mode": "remote",
        }
    except httpx.TimeoutException:
        br.record_failure()
        return {"success": False, "message": "PharmaSync request timed out"}
    except Exception as exc:
        br.record_failure()
        log.exception("PharmaSync provision error")
        return {"success": False, "message": str(exc)}
