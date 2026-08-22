"""Partner Idempotency-Key support (Redis when available).

Clients may send header `Idempotency-Key` (or `X-Idempotency-Key`) on mutating
partner calls. Cached successful JSON responses are replayed for ~24h.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse

from app.services.redis_client import get_redis
from app.utils.app_logger import get_logger

log = get_logger(__name__)

TTL_SECONDS = 24 * 3600


def extract_idempotency_key(request: Request) -> Optional[str]:
    return (
        request.headers.get("Idempotency-Key")
        or request.headers.get("idempotency-key")
        or request.headers.get("X-Idempotency-Key")
    )


def _cache_key(partner_id: int, route: str, key: str) -> str:
    digest = hashlib.sha256(f"{partner_id}:{route}:{key}".encode()).hexdigest()[:40]
    return f"idempotency:partner:{digest}"


async def get_cached_response(partner_id: int, route: str, key: str) -> Optional[dict]:
    r = await get_redis()
    if not r:
        return None
    try:
        raw = await r.get(_cache_key(partner_id, route, key))
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def store_response(partner_id: int, route: str, key: str, body: dict, status_code: int = 200) -> None:
    r = await get_redis()
    if not r:
        return
    try:
        payload = {"status_code": status_code, "body": body}
        await r.set(_cache_key(partner_id, route, key), json.dumps(payload, default=str), ex=TTL_SECONDS)
    except Exception as exc:
        log.debug("idempotency store failed: %s", exc)


async def maybe_replay(partner_id: int, request: Request) -> Optional[JSONResponse]:
    key = extract_idempotency_key(request)
    if not key:
        return None
    route = f"{request.method}:{request.url.path}"
    cached = await get_cached_response(int(partner_id), route, key)
    if not cached:
        return None
    return JSONResponse(content=cached.get("body") or {}, status_code=int(cached.get("status_code") or 200))


async def remember(partner_id: int, request: Request, body: Any, status_code: int = 200) -> None:
    key = extract_idempotency_key(request)
    if not key or not isinstance(body, dict):
        return
    route = f"{request.method}:{request.url.path}"
    if body.get("success") is False:
        return
    await store_response(int(partner_id), route, key, body, status_code=status_code)
