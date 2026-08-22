"""Load and cache Entity Dictionary YAML catalogs."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import yaml

from app.services.ai.entity.dictionary.schemas import EntityCatalog, EntityRecord
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_CATALOGS_DIR = Path(__file__).resolve().parent / "catalogs"

_cache: EntityCatalog | None = None
_last_load_ms: float = 0.0

# File stem → category label used in records / search filters
FILE_CATEGORY_MAP: dict[str, str] = {
    "specialties": "Specialty",
    "medicines": "Medicine",
    "medicine_brands": "MedicineBrand",
    "symptoms": "Symptom",
    "diseases": "Disease",
    "laboratories": "Laboratory",
    "hospitals": "Hospital",
    "doctors": "Doctor",
    "cities": "City",
    "states": "State",
    "countries": "Country",
    "abbreviations": "Abbreviation",
    "medical_abbreviations": "MedicalAbbreviation",
    "relationships": "Relationship",
    "roles": "Role",
    "genders": "Gender",
    "appointment_statuses": "AppointmentStatus",
    "payment_methods": "PaymentMethod",
    "emergency_keywords": "EmergencyKeyword",
    "departments": "Department",
    "body_parts": "BodyPart",
    "allergies": "Allergy",
    "languages": "Language",
    "healthcare_terms": "HealthcareTerm",
}


def _as_tuple_str(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,)
    return tuple(str(x) for x in value)


def _parse_record(raw: dict[str, Any], default_category: str) -> EntityRecord | None:
    entity_id = str(raw.get("id") or "").strip()
    canonical = str(raw.get("canonical") or "").strip()
    if not entity_id or not canonical:
        return None
    category = str(raw.get("category") or default_category).strip() or default_category
    normalized = str(raw.get("normalized") or canonical).strip() or canonical
    meta = raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {}
    return EntityRecord(
        id=entity_id,
        canonical=canonical,
        category=category,
        normalized=normalized,
        aliases=_as_tuple_str(raw.get("aliases")),
        synonyms=_as_tuple_str(raw.get("synonyms")),
        abbreviations=_as_tuple_str(raw.get("abbreviations")),
        misspellings=_as_tuple_str(raw.get("misspellings")),
        plurals=_as_tuple_str(raw.get("plurals")),
        metadata=dict(meta),
        aliases_hi=_as_tuple_str(raw.get("aliases_hi")),
        aliases_te=_as_tuple_str(raw.get("aliases_te")),
    )


def _build_index(catalog: EntityCatalog) -> None:
    index: dict[str, list[tuple[str, str]]] = {}
    all_terms: list[str] = []
    for category, records in catalog.by_category.items():
        for entity_id, record in records.items():
            for term in record.all_terms():
                key = term.lower().strip()
                if not key:
                    continue
                bucket = index.setdefault(key, [])
                ref = (category, entity_id)
                if ref not in bucket:
                    bucket.append(ref)
                all_terms.append(key)
    catalog.index = index
    catalog.all_terms = sorted(set(all_terms))


def load_catalog(
    catalogs_dir: Path | str | None = None,
    *,
    validate: bool = True,
) -> EntityCatalog:
    """Load all YAML files from catalogs directory."""
    root = Path(catalogs_dir) if catalogs_dir else _CATALOGS_DIR
    started = time.perf_counter()
    catalog = EntityCatalog(version=1)
    duplicate_ids: list[str] = []

    if not root.is_dir():
        log.error("entity_dictionary catalogs dir missing: %s", root)
        catalog.load_ms = (time.perf_counter() - started) * 1000
        return catalog

    for path in sorted(root.glob("*.yaml")):
        stem = path.stem
        default_cat = FILE_CATEGORY_MAP.get(stem, stem.replace("_", " ").title())
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except Exception as exc:  # noqa: BLE001
            log.error("entity_dictionary failed to parse %s: %s", path.name, exc)
            continue
        file_cat = str(data.get("category") or default_cat).strip() or default_cat
        bucket = catalog.by_category.setdefault(file_cat, {})
        for item in data.get("entities") or []:
            if not isinstance(item, dict):
                continue
            record = _parse_record(item, file_cat)
            if record is None:
                continue
            if record.id in bucket:
                duplicate_ids.append(f"{file_cat}:{record.id}")
            bucket[record.id] = record

    _build_index(catalog)
    catalog.load_ms = (time.perf_counter() - started) * 1000
    log.info(
        "entity_dictionary loaded categories=%s entities=%s index=%s ms=%.2f",
        len(catalog.by_category),
        catalog.count(),
        len(catalog.index),
        catalog.load_ms,
    )

    if validate:
        from app.services.ai.entity.dictionary.entity_validator import (
            EntityDictionaryValidationError,
            validate_catalog,
        )

        result = validate_catalog(catalog, raise_on_error=False)
        for dup in duplicate_ids:
            result.errors.append(f"duplicate entity id: {dup}")
        if result.errors:
            raise EntityDictionaryValidationError(result)
    elif duplicate_ids:
        log.warning("entity_dictionary duplicate ids: %s", duplicate_ids)

    return catalog


def get_catalog(
    *,
    force_reload: bool = False,
    validate: bool = True,
    raise_on_error: bool = False,
) -> EntityCatalog:
    """Return cached catalog; soft-fail to empty catalog in production."""
    global _cache, _last_load_ms
    if _cache is not None and not force_reload:
        return _cache

    started = time.perf_counter()
    try:
        catalog = load_catalog(_CATALOGS_DIR, validate=False)
        if validate:
            from app.services.ai.entity.dictionary.entity_validator import validate_catalog

            validate_catalog(catalog, raise_on_error=raise_on_error)
        _cache = catalog
    except Exception as exc:  # noqa: BLE001
        log.error("entity_dictionary load failed: %s", exc)
        if raise_on_error:
            raise
        _cache = EntityCatalog(version=0)
    _last_load_ms = (time.perf_counter() - started) * 1000
    return _cache


def reload(catalogs_dir: Path | str | None = None) -> EntityCatalog:
    """Clear cache and reload; rebuild search indexes."""
    global _cache
    _cache = None
    if catalogs_dir is not None:
        catalog = load_catalog(catalogs_dir, validate=True)
        _cache = catalog
    else:
        catalog = get_catalog(force_reload=True, validate=True, raise_on_error=True)

    try:
        from app.services.ai.entity.dictionary.entity_search import clear_search_cache

        clear_search_cache()
    except Exception as exc:  # noqa: BLE001
        log.warning("entity_dictionary search cache clear failed: %s", exc)

    # Optional Redis warm (no-op unless enabled)
    try:
        from app.config.config import Config as settings

        if getattr(settings, "AI_ENTITY_DICTIONARY_REDIS_CACHE", False):
            _maybe_redis_warm(catalog)
    except Exception as exc:  # noqa: BLE001
        log.debug("entity_dictionary redis warm skip: %s", type(exc).__name__)

    return catalog


def last_load_ms() -> float:
    return _last_load_ms


def catalogs_dir() -> Path:
    return _CATALOGS_DIR


def _maybe_redis_warm(catalog: EntityCatalog) -> None:
    """Best-effort note — Redis client is async; in-process index is the primary cache."""
    log.info(
        "entity_dictionary redis cache flag on; using in-process index count=%s",
        catalog.count(),
    )
