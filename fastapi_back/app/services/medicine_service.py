"""Medicine Information module — orchestration over openFDA + local history."""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

from app.models import medicine_model
from app.services.openfda_service import OpenFDAError, openfda_service

log = logging.getLogger("medclues.medicine")

# Curated fallbacks when popularity tables are empty (common OTC / reference names)
DEFAULT_POPULAR = [
    "Acetaminophen",
    "Ibuprofen",
    "Amoxicillin",
    "Metformin",
    "Omeprazole",
    "Atorvastatin",
    "Lisinopril",
    "Amlodipine",
    "Losartan",
    "Albuterol",
]


def _validate_query(q: Optional[str], *, field: str = "q") -> str:
    text = (q or "").strip()
    if not text:
        raise OpenFDAError(f"{field} must not be empty", status_code=400, code="validation_error")
    if len(text) < 2:
        raise OpenFDAError(
            f"{field} must be at least 2 characters",
            status_code=400,
            code="validation_error",
        )
    return text


def _ok_list(
    results: list[dict[str, Any]],
    *,
    count: Optional[int] = None,
    page: int = 1,
    limit: int = 10,
    cached: bool = False,
    response_time_ms: Optional[float] = None,
    message: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "success": True,
        "count": int(count if count is not None else len(results)),
        "results": results,
        "page": page,
        "limit": limit,
        "cached": cached,
        "responseTimeMs": response_time_ms,
        "message": message,
    }


async def search_medicines(
    q: str,
    *,
    user_id: Optional[int] = None,
    page: int = 1,
    limit: int = 10,
    record_history: bool = True,
) -> dict[str, Any]:
    query = _validate_query(q)
    started = time.perf_counter()
    log.info("medicine.search query=%r user_id=%s", query, user_id)
    try:
        results, total, cached = await openfda_service.search_by_name(
            query, limit=limit, page=page
        )
    except OpenFDAError:
        raise
    elapsed = (time.perf_counter() - started) * 1000
    log.info(
        "medicine.search done query=%r count=%s cached=%s ms=%.1f",
        query,
        total,
        cached,
        elapsed,
    )
    if record_history:
        try:
            await medicine_model.record_search(user_id, query, total)
        except Exception:
            log.exception("Failed to persist medicine search history")
    return _ok_list(
        results,
        count=total,
        page=page,
        limit=limit,
        cached=cached,
        response_time_ms=round(elapsed, 1),
    )


async def medicine_details(medicine_name: str) -> dict[str, Any]:
    name = _validate_query(medicine_name, field="medicine_name")
    started = time.perf_counter()
    details, cached = await openfda_service.details_by_name(name)
    elapsed = (time.perf_counter() - started) * 1000
    if not details:
        raise OpenFDAError(
            f'No medicine found for "{name}"',
            status_code=404,
            code="not_found",
        )
    log.info("medicine.details name=%r cached=%s ms=%.1f", name, cached, elapsed)
    return {
        "success": True,
        "data": details,
        "cached": cached,
        "responseTimeMs": round(elapsed, 1),
    }


async def autocomplete(q: str, *, limit: int = 10) -> dict[str, Any]:
    query = _validate_query(q)
    from app.services import cache_keys as ck
    from app.services import cache_service as cache

    async def _load():
        suggestions, cached = await openfda_service.autocomplete(query, limit=limit)
        return {
            "success": True,
            "count": len(suggestions),
            "suggestions": suggestions,
            "cached": cached,
        }

    result = await cache.cache_aside(ck.medicine_suggest(query), ck.TTL_MEDICINE_SUGGEST, _load)
    if isinstance(result, dict) and result.get("success"):
        result = {**result, "cached": True if result.get("cached") else result.get("cached", False)}
    return result


async def by_manufacturer(manufacturer: str, *, page: int = 1, limit: int = 10) -> dict[str, Any]:
    name = _validate_query(manufacturer, field="manufacturer")
    results, total, cached = await openfda_service.by_manufacturer(
        name, limit=limit, page=page
    )
    return _ok_list(results, count=total, page=page, limit=limit, cached=cached)


async def by_ingredient(ingredient: str, *, page: int = 1, limit: int = 10) -> dict[str, Any]:
    name = _validate_query(ingredient, field="ingredient")
    results, total, cached = await openfda_service.by_ingredient(
        name, limit=limit, page=page
    )
    return _ok_list(results, count=total, page=page, limit=limit, cached=cached)


async def recent_searches(user_id: int, limit: int = 10) -> dict[str, Any]:
    items = await medicine_model.list_recent_searches(user_id, limit=limit)
    return {"success": True, "count": len(items), "results": items}


async def search_history(user_id: int, limit: int = 50) -> dict[str, Any]:
    items = await medicine_model.list_search_history(user_id, limit=limit)
    return {"success": True, "count": len(items), "results": items}


async def clear_history(user_id: int) -> dict[str, Any]:
    await medicine_model.clear_search_history(user_id)
    return {"success": True, "message": "Search history cleared"}


async def popular_medicines(limit: int = 10) -> dict[str, Any]:
    items = await medicine_model.list_popular(limit=limit)
    if not items:
        items = [{"query": q, "searchCount": 0, "lastSearchedAt": None} for q in DEFAULT_POPULAR[:limit]]
    return {"success": True, "count": len(items), "results": items}


async def trending_searches(limit: int = 10) -> dict[str, Any]:
    items = await medicine_model.list_trending(limit=limit)
    if not items:
        return await popular_medicines(limit=limit)
    return {"success": True, "count": len(items), "results": items}


async def list_favorites(user_id: int) -> dict[str, Any]:
    items = await medicine_model.list_favorites(user_id)
    return {"success": True, "count": len(items), "results": items}


async def add_favorite(user_id: int, body: dict[str, Any]) -> dict[str, Any]:
    try:
        fav = await medicine_model.add_favorite(user_id, body or {})
    except ValueError as exc:
        raise OpenFDAError(str(exc), status_code=400, code="validation_error") from exc
    return {"success": True, "data": fav}


async def remove_favorite(user_id: int, medicine_key: str) -> dict[str, Any]:
    await medicine_model.remove_favorite(user_id, medicine_key)
    return {"success": True, "message": "Removed from favorites"}
