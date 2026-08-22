"""Enterprise search — Postgres FTS/trgm by default; OpenSearch when configured."""
from __future__ import annotations

from typing import Any, Optional

import httpx

from app.config.config import settings
from app.config.db import db
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def _opensearch_url() -> str:
    return (getattr(settings, "OPENSEARCH_URL", None) or "").strip().rstrip("/")


async def search_all(
    q: str,
    *,
    types: Optional[list[str]] = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    term = (q or "").strip()
    if not term:
        return {"success": True, "query": "", "results": {}, "backend": "none"}

    wanted = set(t.lower() for t in (types or ["doctor", "hospital", "patient", "community"]))
    lim = max(1, min(int(limit), 50))
    off = max(0, int(offset))

    # Cache short suggestion-style searches (no patient PII in public types)
    cacheable = off == 0 and lim <= 20 and "patient" not in wanted
    if cacheable:
        from app.services import cache_keys as ck
        from app.services import cache_service as cache

        kind = "+".join(sorted(wanted)) or "all"
        cache_key = f"{ck.search_suggest(kind, term)}:{lim}"

        async def _load():
            return await _search_all_uncached(term, wanted, lim, off)

        return await cache.cache_aside(cache_key, ck.TTL_SEARCH_SUGGEST, _load)

    return await _search_all_uncached(term, wanted, lim, off)


async def _search_all_uncached(term: str, wanted: set[str], lim: int, off: int) -> dict[str, Any]:
    if _opensearch_url():
        try:
            return await _search_opensearch(term, wanted, lim, off)
        except Exception as exc:
            log.warning("OpenSearch failed (%s) — falling back to Postgres", exc)

    return await _search_postgres(term, wanted, lim, off)


async def _search_postgres(term: str, wanted: set[str], lim: int, off: int) -> dict[str, Any]:
    results: dict[str, list] = {}
    like = f"%{term}%"
    pool = await _read_pool()

    if "doctor" in wanted:
        rows = await pool(
            """
            SELECT d.id, d.name, d.speciality, h.name AS hospital_name
            FROM doctors d
            LEFT JOIN hospital_tieups h ON h.id = d.hospital_id
            WHERE d.name ILIKE $1
               OR COALESCE(d.speciality, '') ILIKE $1
               OR COALESCE(h.name, '') ILIKE $1
            ORDER BY d.name ASC
            LIMIT $2 OFFSET $3
            """,
            like,
            lim,
            off,
        )
        results["doctors"] = [
            {
                "id": r["id"],
                "type": "doctor",
                "title": r["name"],
                "subtitle": r.get("speciality") or "",
                "meta": {"hospitalName": r.get("hospital_name")},
            }
            for r in rows
        ]

    if "hospital" in wanted:
        rows = await pool(
            """
            SELECT id, name, address, city
            FROM hospital_tieups
            WHERE name ILIKE $1 OR COALESCE(address, '') ILIKE $1 OR COALESCE(city, '') ILIKE $1
            ORDER BY name ASC
            LIMIT $2 OFFSET $3
            """,
            like,
            lim,
            off,
        )
        results["hospitals"] = [
            {
                "id": r["id"],
                "type": "hospital",
                "title": r["name"],
                "subtitle": r.get("city") or r.get("address") or "",
            }
            for r in rows
        ]

    if "patient" in wanted:
        rows = await pool(
            """
            SELECT id, public_id, name, phone, email
            FROM users
            WHERE role = 'patient'
              AND (
                name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
                OR COALESCE(public_id, '') ILIKE $1
              )
            ORDER BY name ASC
            LIMIT $2 OFFSET $3
            """,
            like,
            lim,
            off,
        )
        results["patients"] = [
            {
                "id": r["id"],
                "type": "patient",
                "title": r["name"],
                "subtitle": r.get("public_id") or r.get("phone") or "",
            }
            for r in rows
        ]

    if "community" in wanted:
        try:
            rows = await pool(
                """
                SELECT id, title, specialty
                FROM community_questions
                WHERE moderation_status = 'published'
                  AND (
                    search_vector @@ plainto_tsquery('english', $1)
                    OR title ILIKE $2
                  )
                ORDER BY
                  CASE WHEN search_vector @@ plainto_tsquery('english', $1)
                       THEN ts_rank(search_vector, plainto_tsquery('english', $1))
                       ELSE 0 END DESC,
                  created_at DESC
                LIMIT $3 OFFSET $4
                """,
                term,
                like,
                lim,
                off,
            )
            results["community"] = [
                {
                    "id": r["id"],
                    "type": "community",
                    "title": r["title"],
                    "subtitle": r.get("specialty") or "",
                }
                for r in rows
            ]
        except Exception:
            results["community"] = []

    return {"success": True, "query": term, "results": results, "backend": "postgres"}


async def _search_opensearch(term: str, wanted: set[str], lim: int, off: int) -> dict[str, Any]:
    base = _opensearch_url()
    index = getattr(settings, "OPENSEARCH_INDEX", None) or "medclues"
    auth = None
    user = getattr(settings, "OPENSEARCH_USER", None) or ""
    password = getattr(settings, "OPENSEARCH_PASSWORD", None) or ""
    if user:
        auth = (user, password)

    type_filter = list(wanted)
    body = {
        "from": off,
        "size": lim,
        "query": {
            "bool": {
                "must": [
                    {
                        "multi_match": {
                            "query": term,
                            "fields": ["title^3", "subtitle", "body", "name", "speciality"],
                        }
                    }
                ],
                "filter": [{"terms": {"type": type_filter}}] if type_filter else [],
            }
        },
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.post(
            f"{base}/{index}/_search",
            json=body,
            auth=auth,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

    _BUCKET = {
        "doctor": "doctors",
        "doctors": "doctors",
        "hospital": "hospitals",
        "hospitals": "hospitals",
        "patient": "patients",
        "patients": "patients",
        "community": "community",
        "communities": "community",
    }
    results: dict[str, list] = {
        "doctors": [],
        "hospitals": [],
        "patients": [],
        "community": [],
    }
    for hit in data.get("hits", {}).get("hits", []):
        src = hit.get("_source") or {}
        raw_type = str(src.get("type") or "other").lower().strip()
        bucket = _BUCKET.get(raw_type)
        if not bucket:
            continue
        results[bucket].append(
            {
                "id": src.get("id") or hit.get("_id"),
                "type": raw_type.rstrip("s") if raw_type != "community" else "community",
                "title": src.get("title") or src.get("name") or "",
                "subtitle": src.get("subtitle") or "",
                "score": hit.get("_score"),
            }
        )
    return {"success": True, "query": term, "results": results, "backend": "opensearch"}


async def _read_pool():
    """Use read replica when configured."""
    from app.config.db import db as primary

    async def _q(sql: str, *args):
        read = getattr(primary, "read_pool", None)
        if read:
            async with read.acquire() as conn:
                return await conn.fetch(sql, *args)
        return await primary.query(sql, *args)

    return _q
