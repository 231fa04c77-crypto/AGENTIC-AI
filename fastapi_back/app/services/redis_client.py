"""Optional Redis client for OTP, rate limits, and Socket.IO adapter."""
from __future__ import annotations

from typing import Any, Optional

from app.config.config import settings
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_redis: Any = None
_tried = False


async def get_redis():
    """Return async Redis client or None when REDIS_URL unset / unavailable."""
    global _redis, _tried
    if _redis is not None:
        return _redis
    if _tried:
        return None
    _tried = True
    url = (getattr(settings, "REDIS_URL", None) or "").strip()
    if not url:
        return None
    try:
        import redis.asyncio as redis

        # protocol=2 (RESP2) works with Redis 3.x (Windows) and Redis 7+; avoids HELLO/RESP3.
        client = redis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            protocol=2,
        )
        await client.ping()
        _redis = client
        log.info("Redis connected")
        return _redis
    except Exception as exc:
        log.warning("Redis unavailable (%s) — falling back to in-process stores", exc)
        _redis = None
        return None


async def close_redis() -> None:
    global _redis, _tried
    if _redis is not None:
        try:
            await _redis.close()
        except Exception:
            pass
    _redis = None
    _tried = False
