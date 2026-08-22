"""Temporary Redis slot holds (UX lock during checkout).

PostgreSQL claim_slot_* remains the authority for booking.
Redis SET NX EX prevents double-select races before / during payment.
"""
from __future__ import annotations

from typing import Optional

from app.services import cache_keys as keys
from app.services.redis_client import get_redis
from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def hold_slot(
    slot_id: int,
    holder: str,
    *,
    ttl: int | None = None,
) -> bool:
    """Acquire exclusive hold. Returns False if held by someone else."""
    r = await get_redis()
    if not r:
        return True  # no Redis → rely on PG claim only
    key = keys.slot_hold(slot_id)
    ttl_s = int(ttl or keys.TTL_SLOT_HOLD)
    try:
        ok = await r.set(key, str(holder), nx=True, ex=ttl_s)
        if ok:
            return True
        current = await r.get(key)
        return current == str(holder)
    except Exception as exc:
        log.debug("slot hold failed: %s", exc)
        return True


async def release_hold(slot_id: int, holder: str | None = None) -> None:
    r = await get_redis()
    if not r:
        return
    key = keys.slot_hold(slot_id)
    try:
        if holder is not None:
            current = await r.get(key)
            if current and current != str(holder):
                return
        await r.delete(key)
    except Exception as exc:
        log.debug("slot release failed: %s", exc)


async def get_holder(slot_id: int) -> Optional[str]:
    r = await get_redis()
    if not r:
        return None
    try:
        return await r.get(keys.slot_hold(slot_id))
    except Exception:
        return None


async def is_held_by_other(slot_id: int, holder: str) -> bool:
    current = await get_holder(slot_id)
    return bool(current and current != str(holder))
