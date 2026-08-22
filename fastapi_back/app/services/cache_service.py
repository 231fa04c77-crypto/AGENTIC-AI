"""Cache-aside helpers over optional Redis (graceful no-op when REDIS_URL unset)."""
from __future__ import annotations

import json
from typing import Any, Awaitable, Callable, Optional

from app.services import cache_keys as keys
from app.services.redis_client import get_redis
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_hits = 0
_misses = 0


def stats() -> dict:
    total = _hits + _misses
    return {
        "hits": _hits,
        "misses": _misses,
        "hit_ratio": round(_hits / total, 4) if total else None,
    }


async def get_json(key: str) -> Optional[Any]:
    global _hits, _misses
    r = await get_redis()
    if not r:
        return None
    try:
        raw = await r.get(key)
        if raw is None:
            _misses += 1
            return None
        _hits += 1
        return json.loads(raw)
    except Exception as exc:
        log.debug("cache get failed %s: %s", key, exc)
        return None


async def set_json(key: str, value: Any, ttl: int) -> bool:
    r = await get_redis()
    if not r:
        return False
    try:
        await r.set(key, json.dumps(value, default=str), ex=max(1, int(ttl)))
        return True
    except Exception as exc:
        log.debug("cache set failed %s: %s", key, exc)
        return False


async def delete(*cache_key: str) -> int:
    r = await get_redis()
    if not r or not cache_key:
        return 0
    try:
        return int(await r.delete(*cache_key))
    except Exception:
        return 0


async def delete_prefix(prefix: str, count: int = 200) -> int:
    """Best-effort SCAN + DELETE for key prefixes (invalidation)."""
    r = await get_redis()
    if not r or not prefix:
        return 0
    deleted = 0
    try:
        cursor = 0
        while True:
            cursor, batch = await r.scan(cursor=cursor, match=f"{prefix}*", count=count)
            if batch:
                deleted += int(await r.delete(*batch))
            if cursor == 0:
                break
        return deleted
    except Exception as exc:
        log.debug("cache delete_prefix %s failed: %s", prefix, exc)
        return deleted


async def cache_aside(
    key: str,
    ttl: int,
    loader: Callable[[], Awaitable[Any]],
    *,
    skip_cache: bool = False,
) -> Any:
    """Cache-aside: read Redis → miss → load Postgres → set Redis.

    Skips caching dict responses where success is explicitly False.
    """
    if not skip_cache:
        cached = await get_json(key)
        if cached is not None:
            return cached
    data = await loader()
    if data is not None and not skip_cache:
        if isinstance(data, dict) and data.get("success") is False:
            return data
        await set_json(key, data, ttl)
    return data


# --- Domain invalidation helpers ---

async def invalidate_doctors() -> None:
    await delete_prefix(keys.PREFIX_DOCTOR)
    await delete_prefix(keys.PREFIX_DASHBOARD)
    await delete_prefix(keys.PREFIX_SEARCH)


async def invalidate_hospitals() -> None:
    await delete_prefix(keys.PREFIX_HOSPITAL)
    await delete_prefix(keys.PREFIX_DASHBOARD)
    await delete_prefix(keys.PREFIX_SEARCH)


async def invalidate_specialties() -> None:
    await delete(keys.specialty_list())
    await delete_prefix(keys.PREFIX_SEARCH)
    await delete_prefix(keys.PREFIX_DOCTOR)


async def invalidate_system_config() -> None:
    await delete(keys.config_system())


async def invalidate_community() -> None:
    await delete_prefix(keys.PREFIX_COMMUNITY)


async def invalidate_labs() -> None:
    await delete(keys.lab_list())


async def invalidate_partner_catalog() -> None:
    await delete(keys.partner_catalog())


async def invalidate_queue(doctor_id: int | str, slot_date: str) -> None:
    await delete(keys.queue_snapshot(doctor_id, slot_date))


async def invalidate_dashboards() -> None:
    await delete_prefix(keys.PREFIX_DASHBOARD)
