import time
from datetime import date, timedelta
from typing import Any, Dict, Optional, Tuple

from app.services import cache_keys as ck
from app.services import cache_service as cache
from app.services import doctor_slot_service

# Short in-process TTL so booking screen polls / prefetch stay cheap.
_SLOTS_TTL_SEC = 120.0
_slots_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _cache_key(doc_id: str, mode: str) -> str:
    return f"{doc_id}:{(mode or 'offline').lower()}:{date.today().isoformat()}"


def invalidate_slots_cache(doc_id: Optional[str] = None) -> None:
    """Clear in-process + schedule Redis invalidation (best-effort)."""
    if not doc_id:
        _slots_cache.clear()
    else:
        prefix = f"{doc_id}:"
        for key in list(_slots_cache.keys()):
            if key.startswith(prefix):
                _slots_cache.pop(key, None)
    try:
        import asyncio

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_invalidate_slots_redis(doc_id))
        except RuntimeError:
            # No running loop (sync context) — skip Redis; next GET will miss in-process.
            pass
    except Exception:
        pass


async def invalidate_slots_cache_async(doc_id: Optional[str] = None) -> None:
    invalidate_slots_cache(doc_id)
    await _invalidate_slots_redis(doc_id)


async def _invalidate_slots_redis(doc_id: Optional[str] = None) -> None:
    try:
        if not doc_id:
            await cache.delete_prefix(ck.PREFIX_DOCTOR_SLOTS)
            return
        today = date.today()
        for mode in ("offline", "online"):
            for offset in range(0, 2):
                d = today - timedelta(days=offset)
                await cache.delete(ck.doctor_slots(doc_id, mode, d.isoformat()))
    except Exception:
        pass


async def get_doctor_slots(doc_id: str, mode: str = "offline"):
    key = _cache_key(doc_id, mode)
    now = time.monotonic()
    hit = _slots_cache.get(key)
    if hit and (now - hit[0]) < _SLOTS_TTL_SEC:
        return hit[1]

    async def _load():
        from app.config.db import db

        doctor_ref, num = doctor_slot_service.normalize_doctor_ref(doc_id)
        if str(doctor_ref).startswith("emb_"):
            exists = await db.fetch_row(
                "SELECT 1 FROM hospital_tieup_doctors WHERE id = $1",
                int(num),
            )
        else:
            exists = await db.fetch_row(
                "SELECT 1 FROM doctors WHERE id = $1",
                int(num),
            )
        if not exists:
            return {"success": False, "message": "Doctor not found"}
        return await doctor_slot_service.get_public_slots(doctor_ref, mode)

    redis_key = ck.doctor_slots(doc_id, mode, date.today().isoformat())
    data = await cache.cache_aside(redis_key, ck.TTL_DOCTOR_SLOTS, _load)

    if isinstance(data, dict) and data.get("success"):
        _slots_cache[key] = (now, data)
        if len(_slots_cache) > 200:
            oldest = sorted(_slots_cache.items(), key=lambda kv: kv[1][0])[:50]
            for k, _ in oldest:
                _slots_cache.pop(k, None)
    return data
