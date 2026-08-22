"""Conversation memory — Redis primary, process-local fallback so workflows never reset."""
from __future__ import annotations

import json
import time
from typing import Any, Optional

from app.utils.app_logger import get_logger

log = get_logger(__name__)

_TTL = 60 * 60  # 1 hour
_MAX_TURNS = 20
_LOCAL: dict[str, tuple[float, dict[str, Any]]] = {}


def _empty_context() -> dict[str, Any]:
    return {"turns": [], "active_flow": None, "flow_data": {}, "prefs": {}}


def _key(user_id: int, session_id: str) -> str:
    return f"ai:conv:{int(user_id)}:{(session_id or 'default')[:64]}"


def _local_get(key: str) -> dict[str, Any]:
    item = _LOCAL.get(key)
    if not item:
        return _empty_context()
    expires, data = item
    if expires < time.time():
        _LOCAL.pop(key, None)
        return _empty_context()
    if not isinstance(data, dict):
        return _empty_context()
    return {**_empty_context(), **data}


def _local_set(key: str, payload: dict[str, Any]) -> None:
    _LOCAL[key] = (time.time() + _TTL, payload)


async def load_context(user_id: int, session_id: str = "default") -> dict[str, Any]:
    key = _key(user_id, session_id)
    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if r:
            raw = await r.get(key)
            if raw:
                data = json.loads(raw)
                if isinstance(data, dict):
                    merged = {**_empty_context(), **data}
                    _local_set(key, merged)
                    return merged
    except Exception as exc:
        log.debug("ai memory load redis skip: %s", type(exc).__name__)
    return _local_get(key)


async def save_context(
    user_id: int,
    session_id: str,
    *,
    turn: dict[str, Any],
    active_flow: Optional[str] = None,
    flow_data: Optional[dict[str, Any]] = None,
    prefs: Optional[dict] = None,
) -> None:
    key = _key(user_id, session_id)
    ctx = await load_context(user_id, session_id)
    turns = list(ctx.get("turns") or [])
    safe_turn = {
        "role": turn.get("role"),
        "intent": turn.get("intent"),
        "tool": turn.get("tool"),
        "text": str(turn.get("text") or "")[:500],
        "step": turn.get("step"),
    }
    turns.append(safe_turn)
    turns = turns[-_MAX_TURNS:]
    payload = {
        "turns": turns,
        "active_flow": active_flow if active_flow is not None else ctx.get("active_flow"),
        "flow_data": flow_data if flow_data is not None else (ctx.get("flow_data") or {}),
        "prefs": prefs if prefs is not None else (ctx.get("prefs") or {}),
    }
    _local_set(key, payload)
    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if r:
            await r.setex(key, _TTL, json.dumps(payload))
    except Exception as exc:
        log.debug("ai memory save redis skip: %s", type(exc).__name__)


async def clear_flow(user_id: int, session_id: str = "default") -> None:
    """Clear only action workflow state while retaining recent conversation turns."""
    key = _key(user_id, session_id)
    ctx = await load_context(user_id, session_id)
    payload = {
        "turns": list(ctx.get("turns") or [])[-_MAX_TURNS:],
        "active_flow": None,
        "flow_data": {},
        "prefs": ctx.get("prefs") or {},
    }
    _local_set(key, payload)
    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if r:
            await r.setex(key, _TTL, json.dumps(payload))
    except Exception as exc:
        log.debug("ai flow clear redis skip: %s", type(exc).__name__)


async def rate_limit_ok(user_id: int, *, limit: int = 30, window_sec: int = 60) -> bool:
    """Simple per-user RPM for assistant."""
    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if not r:
            return True
        k = f"ai:rl:{int(user_id)}"
        n = await r.incr(k)
        if n == 1:
            await r.expire(k, window_sec)
        return int(n) <= int(limit)
    except Exception:
        return True
