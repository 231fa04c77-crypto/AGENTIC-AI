from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config.config import settings
from app.config.db import db

router = APIRouter(tags=["Health"])


@router.api_route("/health", methods=["GET", "HEAD"])
async def health_liveness():
    """Liveness probe — process is up. Allows HEAD for uptime monitors."""
    return {
        "status": "ok",
        "service": "medclues-api",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready")
async def health_readiness():
    """Readiness probe — checks PostgreSQL connectivity."""
    checks: dict[str, str] = {"api": "ok"}
    db_ok = False
    try:
        if not db.pool:
            await db.connect()
        if db.pool:
            row = await db.fetch_row("SELECT 1 AS ok")
            db_ok = row is not None
        checks["database"] = "ok" if db_ok else "error"
    except Exception:
        checks["database"] = "error"

    ready = db_ok
    body = {
        "status": "ready" if ready else "not_ready",
        "checks": checks,
        "debug": settings.DEBUG,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if not ready:
        return JSONResponse(status_code=503, content=body)
    return body


@router.get("/health/deep")
async def health_deep():
    """Deep dependency check for load balancers / SRE dashboards."""
    checks: dict[str, str] = {"api": "ok"}
    try:
        if not db.pool:
            await db.connect()
        row = await db.fetch_row("SELECT 1 AS ok")
        checks["database"] = "ok" if row else "error"
        if db.pool:
            checks["db_pool_size"] = str(db.pool.get_size())
            checks["db_pool_free"] = str(db.pool.get_idle_size())
    except Exception as exc:
        checks["database"] = f"error:{type(exc).__name__}"

    try:
        from app.services.redis_client import get_redis

        r = await get_redis()
        if r is None:
            checks["redis"] = "skipped" if not (settings.REDIS_URL or "").strip() else "error"
        else:
            await r.ping()
            checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error:{type(exc).__name__}"

    checks["workers_in_api"] = "on" if settings.RUN_BACKGROUND_WORKERS_IN_API else "off"
    critical_ok = checks.get("database") == "ok"
    body = {
        "status": "ok" if critical_ok else "degraded",
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=200 if critical_ok else 503, content=body)


@router.get("/metrics")
async def prometheus_metrics():
    from app.middleware.metrics import metrics_response

    return metrics_response()
