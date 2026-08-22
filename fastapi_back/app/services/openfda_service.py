"""Async openFDA Drug Label client with retries and in-memory TTL cache."""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from typing import Any, Optional
import httpx

from app.config.config import settings

log = logging.getLogger("medclues.openfda")

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"
MAX_RETRIES = 3


class OpenFDAError(Exception):
    def __init__(self, message: str, status_code: int = 502, code: str = "openfda_error"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class _TTLCache:
    def __init__(self, ttl_seconds: int = 1800):
        self._ttl = max(60, int(ttl_seconds))
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            expires, value = item
            if time.monotonic() > expires:
                self._store.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            self._store[key] = (time.monotonic() + self._ttl, value)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


_cache = _TTLCache(getattr(settings, "OPENFDA_CACHE_TTL_SECONDS", 1800))


def _escape_search_term(term: str) -> str:
    """Escape openFDA search special characters."""
    cleaned = (term or "").strip()
    for ch in ('"', "\\", "+", "-", "&", "|", "!", "(", ")", "{", "}", "[", "]", "^", "~", "*", "?", ":", "/"):
        cleaned = cleaned.replace(ch, " ")
    return " ".join(cleaned.split())


def _first_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, list):
        for item in value:
            text = _first_str(item)
            if text:
                return text
        return None
    text = str(value).strip()
    return text or None


def _join_field(value: Any, sep: str = "\n\n") -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, list):
        parts = [str(v).strip() for v in value if v is not None and str(v).strip()]
        return sep.join(parts) if parts else None
    text = str(value).strip()
    return text or None


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if text:
                out.append(text)
        return out
    text = str(value).strip()
    return [text] if text else []


def infer_placeholder_type(dosage_form: Optional[str], route: Optional[str] = None) -> str:
    blob = f"{dosage_form or ''} {route or ''}".lower()
    mapping = [
        ("capsule", "capsule"),
        ("syrup", "syrup"),
        ("suspension", "syrup"),
        ("solution", "syrup"),
        ("injection", "injection"),
        ("injectable", "injection"),
        ("intravenous", "injection"),
        ("intramuscular", "injection"),
        ("drop", "drops"),
        ("ophthalmic", "drops"),
        ("cream", "cream"),
        ("ointment", "cream"),
        ("gel", "gel"),
        ("inhal", "inhaler"),
        ("aerosol", "inhaler"),
        ("tablet", "tablet"),
        ("oral", "tablet"),
    ]
    for needle, kind in mapping:
        if needle in blob:
            return kind
    return "tablet"


def medicine_key_from_result(result: dict[str, Any]) -> str:
    openfda = result.get("openfda") or {}
    brand = _first_str(openfda.get("brand_name")) or ""
    generic = _first_str(openfda.get("generic_name")) or ""
    set_id = _first_str(result.get("set_id")) or _first_str(result.get("id")) or ""
    raw = f"{brand}|{generic}|{set_id}".lower()
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]


def map_card(result: dict[str, Any]) -> dict[str, Any]:
    openfda = result.get("openfda") or {}
    brand = _first_str(openfda.get("brand_name"))
    generic = _first_str(openfda.get("generic_name"))
    manufacturer = _first_str(openfda.get("manufacturer_name"))
    dosage_form = _first_str(openfda.get("dosage_form")) or _first_str(openfda.get("product_type"))
    route = _first_str(openfda.get("route"))
    purpose = _join_field(result.get("purpose"))
    indications = _join_field(result.get("indications_and_usage"))
    short = purpose or indications
    if short and len(short) > 180:
        short = short[:177].rstrip() + "..."
    name = brand or generic or "Unknown medicine"
    return {
        "medicineKey": medicine_key_from_result(result),
        "medicineName": name,
        "brandName": brand,
        "genericName": generic,
        "manufacturer": manufacturer,
        "dosageForm": dosage_form,
        "route": route,
        "shortDescription": short,
        "placeholderType": infer_placeholder_type(dosage_form, route),
        "setId": _first_str(result.get("set_id")),
    }


def map_details(result: dict[str, Any]) -> dict[str, Any]:
    card = map_card(result)
    openfda = result.get("openfda") or {}
    substances = _as_list(openfda.get("substance_name"))
    active = _as_list(result.get("active_ingredient")) or substances
    return {
        **card,
        "purpose": _join_field(result.get("purpose")),
        "uses": _join_field(result.get("indications_and_usage")),
        "indications": _join_field(result.get("indications_and_usage")),
        "activeIngredients": active,
        "inactiveIngredients": _as_list(result.get("inactive_ingredient")),
        "warnings": _join_field(result.get("warnings")),
        "boxedWarning": _join_field(result.get("boxed_warning")),
        "pregnancyWarning": _join_field(result.get("pregnancy") or result.get("pregnancy_or_breast_feeding")),
        "pediatricUse": _join_field(result.get("pediatric_use")),
        "geriatricUse": _join_field(result.get("geriatric_use")),
        "drugAbuse": _join_field(result.get("drug_abuse_and_dependence")),
        "drugInteractions": _join_field(result.get("drug_interactions")),
        "contraindications": _join_field(result.get("contraindications")),
        "sideEffects": _join_field(result.get("adverse_reactions")),
        "storage": _join_field(result.get("storage_and_handling")),
        "howSupplied": _join_field(result.get("how_supplied")),
        "packageLabel": _join_field(result.get("package_label_principal_display_panel")),
        "stopUse": _join_field(result.get("stop_use")),
        "askDoctor": _join_field(result.get("ask_doctor") or result.get("ask_doctor_or_pharmacist")),
        "doNotUse": _join_field(result.get("do_not_use")),
        "dosageAndAdministration": _join_field(result.get("dosage_and_administration")),
        "rawOpenFda": {
            "brand_name": openfda.get("brand_name"),
            "generic_name": openfda.get("generic_name"),
            "manufacturer_name": openfda.get("manufacturer_name"),
            "substance_name": openfda.get("substance_name"),
            "product_type": openfda.get("product_type"),
            "route": openfda.get("route"),
            "dosage_form": openfda.get("dosage_form"),
        },
    }


def _build_name_search(query: str) -> str:
    term = _escape_search_term(query)
    # Phrase match on brand / generic / substance (httpx encodes params)
    return (
        f'(openfda.brand_name:"{term}"'
        f' OR openfda.generic_name:"{term}"'
        f' OR openfda.substance_name:"{term}")'
    )


class OpenFDAService:
    def __init__(self) -> None:
        self._timeout = float(getattr(settings, "OPENFDA_TIMEOUT_SECONDS", 10.0) or 10.0)

    def _api_key(self) -> Optional[str]:
        key = (getattr(settings, "OPENFDA_API_KEY", None) or "").strip()
        return key or None

    async def _request(
        self,
        *,
        search: Optional[str] = None,
        limit: int = 10,
        skip: int = 0,
    ) -> tuple[dict[str, Any], bool]:
        cache_key = f"label|{search}|{limit}|{skip}"
        cached = await _cache.get(cache_key)
        if cached is not None:
            return cached, True

        params: dict[str, Any] = {"limit": max(1, min(int(limit), 100))}
        if skip:
            params["skip"] = max(0, int(skip))
        if search:
            params["search"] = search
        api_key = self._api_key()
        if api_key:
            params["api_key"] = api_key

        last_error: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    started = time.perf_counter()
                    resp = await client.get(OPENFDA_LABEL_URL, params=params)
                    elapsed_ms = (time.perf_counter() - started) * 1000
                    log.info(
                        "openFDA request status=%s attempt=%s ms=%.1f search=%s",
                        resp.status_code,
                        attempt,
                        elapsed_ms,
                        (search or "")[:80],
                    )

                    if resp.status_code == 404:
                        empty = {"meta": {"results": {"total": 0}}, "results": []}
                        await _cache.set(cache_key, empty)
                        return empty, False

                    if resp.status_code == 429:
                        raise OpenFDAError(
                            "openFDA rate limit exceeded. Please try again shortly.",
                            status_code=429,
                            code="rate_limit",
                        )

                    if resp.status_code >= 500:
                        raise OpenFDAError(
                            "openFDA service is temporarily unavailable.",
                            status_code=502,
                            code="upstream_error",
                        )

                    if resp.status_code >= 400:
                        detail = resp.text[:200]
                        raise OpenFDAError(
                            f"openFDA request failed ({resp.status_code}): {detail}",
                            status_code=502,
                            code="upstream_error",
                        )

                    data = resp.json()
                    await _cache.set(cache_key, data)
                    return data, False

            except OpenFDAError:
                raise
            except httpx.TimeoutException as exc:
                last_error = exc
                log.warning("openFDA timeout attempt=%s: %s", attempt, exc)
            except httpx.ConnectError as exc:
                last_error = exc
                log.warning("openFDA connection error attempt=%s: %s", attempt, exc)
            except Exception as exc:
                last_error = exc
                log.exception("openFDA unexpected error attempt=%s", attempt)

            if attempt < MAX_RETRIES:
                await asyncio.sleep(0.4 * attempt)

        raise OpenFDAError(
            "Unable to reach openFDA. Check your internet connection and try again.",
            status_code=503,
            code="connection_error",
        ) from last_error

    async def search_by_name(
        self, query: str, *, limit: int = 10, page: int = 1
    ) -> tuple[list[dict[str, Any]], int, bool]:
        limit = max(1, min(int(limit), 50))
        page = max(1, int(page))
        skip = (page - 1) * limit
        data, cached = await self._request(search=_build_name_search(query), limit=limit, skip=skip)
        results = [map_card(r) for r in (data.get("results") or [])]
        total = int(((data.get("meta") or {}).get("results") or {}).get("total") or len(results))
        return results, total, cached

    async def autocomplete(self, query: str, *, limit: int = 10) -> tuple[list[str], bool]:
        results, _, cached = await self.search_by_name(query, limit=limit, page=1)
        seen: set[str] = set()
        suggestions: list[str] = []
        for item in results:
            for candidate in (item.get("brandName"), item.get("genericName"), item.get("medicineName")):
                if not candidate:
                    continue
                key = candidate.strip().lower()
                if key in seen:
                    continue
                seen.add(key)
                suggestions.append(candidate.strip())
                if len(suggestions) >= limit:
                    return suggestions, cached
        return suggestions, cached

    async def details_by_name(self, medicine_name: str) -> tuple[Optional[dict[str, Any]], bool]:
        data, cached = await self._request(search=_build_name_search(medicine_name), limit=1, skip=0)
        results = data.get("results") or []
        if not results:
            return None, cached
        return map_details(results[0]), cached

    async def by_manufacturer(
        self, manufacturer: str, *, limit: int = 10, page: int = 1
    ) -> tuple[list[dict[str, Any]], int, bool]:
        term = _escape_search_term(manufacturer)
        search = f'openfda.manufacturer_name:"{term}"'
        limit = max(1, min(int(limit), 50))
        page = max(1, int(page))
        skip = (page - 1) * limit
        data, cached = await self._request(search=search, limit=limit, skip=skip)
        results = [map_card(r) for r in (data.get("results") or [])]
        total = int(((data.get("meta") or {}).get("results") or {}).get("total") or len(results))
        return results, total, cached

    async def by_ingredient(
        self, ingredient: str, *, limit: int = 10, page: int = 1
    ) -> tuple[list[dict[str, Any]], int, bool]:
        term = _escape_search_term(ingredient)
        search = (
            f'(openfda.substance_name:"{term}"'
            f' OR active_ingredient:"{term}")'
        )
        limit = max(1, min(int(limit), 50))
        page = max(1, int(page))
        skip = (page - 1) * limit
        data, cached = await self._request(search=search, limit=limit, skip=skip)
        results = [map_card(r) for r in (data.get("results") or [])]
        total = int(((data.get("meta") or {}).get("results") or {}).get("total") or len(results))
        return results, total, cached


openfda_service = OpenFDAService()
