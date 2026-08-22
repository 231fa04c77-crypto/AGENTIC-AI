"""Ops / chaos endpoints — only when CHAOS_ENABLED=true (never in prod accidentally)."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.config.config import settings
from app.config.db import db
from app.middleware.auth import auth_admin

router = APIRouter(prefix="/api/ops", tags=["Ops / Chaos"])


def _chaos_guard():
    if not getattr(settings, "CHAOS_ENABLED", False):
        raise HTTPException(status_code=404, detail="Not found")


@router.get("/slo")
async def slo_snapshot(_admin=Depends(auth_admin)):
    """Admin SLO snapshot for dashboard (availability + dependency health)."""
    checks: dict = {}
    try:
        if not db.pool:
            await db.connect()
        row = await db.fetch_row("SELECT 1 AS ok")
        checks["database"] = "ok" if row else "error"
        if db.pool:
            checks["db_pool_size"] = db.pool.get_size()
            checks["db_pool_idle"] = db.pool.get_idle_size()
    except Exception as exc:
        checks["database"] = f"error:{type(exc).__name__}"

    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        checks["redis"] = "ok" if r else ("skipped" if not settings.REDIS_URL else "error")
        if r:
            await r.ping()
            checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error:{type(exc).__name__}"

    checks["workers_in_api"] = bool(settings.RUN_BACKGROUND_WORKERS_IN_API)
    checks["opensearch"] = "configured" if getattr(settings, "OPENSEARCH_URL", "") else "postgres-fallback"
    checks["chaos_enabled"] = bool(getattr(settings, "CHAOS_ENABLED", False))

    try:
        from app.services import cache_service as cache
        checks["cache"] = cache.stats()
    except Exception:
        checks["cache"] = {}

    try:
        from app.services.circuit_breaker import snapshot
        checks["circuits"] = snapshot()
    except Exception:
        checks["circuits"] = {}

    checks["ai_assistant_enabled"] = bool(getattr(settings, "AI_ASSISTANT_ENABLED", False))

    return {
        "success": True,
        "slos": {
            "availability_target": "99.5%",
            "booking_p95_target_ms": 500,
            "queue_p95_target_ms": 800,
            "rpo_minutes": 15,
            "rto_minutes": 60,
        },
        "checks": checks,
        "scrape": "/metrics",
        "deep_health": "/health/deep",
    }


@router.post("/chaos/latency")
async def chaos_latency(
    ms: int = Query(default=2000, ge=100, le=30000),
    _admin=Depends(auth_admin),
):
    _chaos_guard()
    await asyncio.sleep(ms / 1000.0)
    return {"success": True, "slept_ms": ms}


@router.post("/chaos/error")
async def chaos_error(_admin=Depends(auth_admin)):
    _chaos_guard()
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Chaos induced 500"},
    )


@router.post("/chaos/db-query")
async def chaos_db_query(
    sleep_seconds: float = Query(default=2.0, ge=0.1, le=10.0),
    _admin=Depends(auth_admin),
):
    _chaos_guard()
    await db.fetch_row("SELECT pg_sleep($1)", float(sleep_seconds))
    return {"success": True, "slept_seconds": sleep_seconds}
