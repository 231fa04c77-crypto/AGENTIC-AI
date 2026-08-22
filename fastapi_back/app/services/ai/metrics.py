"""AI assistant metrics / audit logging + continuous-improvement feedback."""
from __future__ import annotations

import hashlib
from typing import Any, Optional

from app.utils.app_logger import get_logger

log = get_logger(__name__)


def _query_hash(text: str | None) -> str | None:
    if not text:
        return None
    return hashlib.sha256(str(text).strip().lower().encode()).hexdigest()[:32]


async def record_event(
    *,
    intent: str | None,
    tool: str | None,
    role: str,
    latency_ms: float,
    success: bool,
    fallback: bool = False,
    safety: str | None = None,
    grounded: bool | None = None,
    user_id: int | None = None,
    query: str | None = None,
) -> None:
    log.info(
        "ai_assistant intent=%s tool=%s role=%s latency_ms=%.1f success=%s fallback=%s safety=%s grounded=%s",
        intent,
        tool,
        role,
        latency_ms,
        success,
        fallback,
        safety,
        grounded,
    )
    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if r:
            pipe = r.pipeline()
            pipe.incr("ai:metrics:requests")
            if success:
                pipe.incr("ai:metrics:success")
            else:
                pipe.incr("ai:metrics:fail")
            if fallback:
                pipe.incr("ai:metrics:fallback")
            if grounded is False:
                pipe.incr("ai:metrics:ungrounded")
            if tool:
                pipe.incr(f"ai:metrics:tool:{tool}")
            if intent:
                pipe.incr(f"ai:metrics:intent:{intent}")
            await pipe.execute()
    except Exception:
        pass

    try:
        from app.config.db import db

        if getattr(db, "pool", None):
            await db.execute(
                """
                INSERT INTO ai_assistant_events (
                    user_id, role, intent, tool, success, grounded, fallback,
                    safety, latency_ms, query_hash
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                """,
                user_id,
                role,
                intent,
                tool,
                success,
                grounded,
                fallback,
                safety,
                float(latency_ms),
                _query_hash(query),
            )
    except Exception as exc:
        log.debug("ai event persist skip: %s", type(exc).__name__)


async def record_feedback(
    *,
    user_id: Optional[int],
    role: str | None,
    session_id: str | None,
    intent: str | None,
    tool: str | None,
    rating: int,
    comment: str | None = None,
    query: str | None = None,
    grounded: bool | None = None,
) -> dict[str, Any]:
    if rating not in (-1, 1):
        return {"success": False, "message": "rating must be 1 or -1"}
    try:
        from app.config.db import db

        row = await db.fetch_row(
            """
            INSERT INTO ai_assistant_feedback (
                user_id, role, session_id, intent, tool, rating, comment, query_hash, grounded
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id
            """,
            user_id,
            role,
            (session_id or "")[:64],
            intent,
            tool,
            int(rating),
            (comment or "")[:1000] or None,
            _query_hash(query),
            grounded,
        )
        try:
            from app.services.redis_client import get_redis

            r = await get_redis()
            if r:
                await r.incr("ai:metrics:feedback_pos" if rating > 0 else "ai:metrics:feedback_neg")
        except Exception:
            pass
        return {"success": True, "id": row.get("id") if row else None}
    except Exception as exc:
        log.warning("ai feedback failed: %s", type(exc).__name__)
        return {"success": False, "message": "Could not store feedback"}


async def snapshot() -> dict:
    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if not r:
            return {"redis": False}
        keys = [
            "ai:metrics:requests",
            "ai:metrics:success",
            "ai:metrics:fail",
            "ai:metrics:fallback",
            "ai:metrics:ungrounded",
            "ai:metrics:feedback_pos",
            "ai:metrics:feedback_neg",
        ]
        vals = await r.mget(keys)
        return {
            "redis": True,
            "requests": int(vals[0] or 0),
            "success": int(vals[1] or 0),
            "fail": int(vals[2] or 0),
            "fallback": int(vals[3] or 0),
            "ungrounded": int(vals[4] or 0),
            "feedbackPositive": int(vals[5] or 0),
            "feedbackNegative": int(vals[6] or 0),
        }
    except Exception:
        return {"redis": False}
