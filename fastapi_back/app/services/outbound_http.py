"""Outbound HTTP helper with timeout + circuit breaker (partners / AI / SMS)."""
from __future__ import annotations

from typing import Any, Optional

import httpx

from app.services.circuit_breaker import get_breaker
from app.utils.app_logger import get_logger

log = get_logger(__name__)

DEFAULT_TIMEOUT = 15.0


class CircuitOpenError(RuntimeError):
    pass


async def request(
    method: str,
    url: str,
    *,
    breaker_name: str,
    timeout: float = DEFAULT_TIMEOUT,
    json: Any = None,
    data: Any = None,
    headers: Optional[dict] = None,
    auth: Any = None,
) -> httpx.Response:
    br = get_breaker(breaker_name)
    if not br.allow():
        raise CircuitOpenError(f"Circuit open: {breaker_name}")
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.request(
                method.upper(),
                url,
                json=json,
                data=data,
                headers=headers,
                auth=auth,
            )
        if resp.status_code >= 500:
            br.record_failure()
        else:
            br.record_success()
        return resp
    except CircuitOpenError:
        raise
    except Exception as exc:
        br.record_failure()
        log.warning("HTTP %s %s failed: %s", method, breaker_name, type(exc).__name__)
        raise
