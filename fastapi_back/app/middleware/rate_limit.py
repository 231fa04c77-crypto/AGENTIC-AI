"""Sliding-window rate limiter — Redis when available, else in-memory."""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request

_buckets: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def rate_limit_dependency(scope: str, max_calls: int, window_seconds: int) -> Callable:
    """FastAPI dependency — raises 429 when limit exceeded."""

    async def _check(request: Request) -> None:
        ip = _client_ip(request)
        key = f"rl:{scope}:{ip}"
        now = time.time()
        window_start = now - window_seconds

        try:
            from app.services.redis_client import get_redis

            r = await get_redis()
            if r is not None:
                pipe = r.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zcard(key)
                pipe.zadd(key, {str(now): now})
                pipe.expire(key, window_seconds + 1)
                results = await pipe.execute()
                count = int(results[1] or 0)
                if count >= max_calls:
                    raise HTTPException(
                        status_code=429,
                        detail="Too many requests. Please try again later.",
                    )
                return
        except HTTPException:
            raise
        except Exception:
            pass

        hits = [t for t in _buckets[key] if t >= window_start]
        if len(hits) >= max_calls:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
            )
        hits.append(now)
        _buckets[key] = hits

    return _check
