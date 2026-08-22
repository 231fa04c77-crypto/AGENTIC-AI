"""Access-token blacklist + session helpers (Redis). Refresh tokens stay in PostgreSQL."""
from __future__ import annotations

import hashlib

from app.services import cache_keys as keys
from app.services.redis_client import get_redis


def _hash_token(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()[:40]


async def blacklist_access_token(token: str, ttl: int | None = None) -> None:
    r = await get_redis()
    if not r or not token:
        return
    key = keys.session_blacklist(_hash_token(token))
    await r.set(key, "1", ex=int(ttl or keys.TTL_SESSION_BLACKLIST))


async def is_access_token_blacklisted(token: str) -> bool:
    r = await get_redis()
    if not r or not token:
        return False
    try:
        return bool(await r.exists(keys.session_blacklist(_hash_token(token))))
    except Exception:
        return False
