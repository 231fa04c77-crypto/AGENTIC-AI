"""Load Synonym Engine YAML configs into an inverted index."""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

import yaml

from app.services.ai.synonym.schemas import SynonymIndex, SynonymRecord
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_CONFIG_DIR = Path(__file__).resolve().parent / "config"
_cache: SynonymIndex | None = None
_last_load_ms: float = 0.0

# Base files always loaded (regional_* merged by region)
_BASE_FILES = (
    "specialties.yaml",
    "medicines.yaml",
    "symptoms.yaml",
    "diseases.yaml",
    "laboratories.yaml",
    "navigation.yaml",
    "appointment.yaml",
    "emergency.yaml",
    "general.yaml",
    "spelling.yaml",
)


def _as_tuple(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,)
    return tuple(str(x) for x in value)


def _region() -> str:
    try:
        from app.config.config import Config as settings

        return (getattr(settings, "AI_SYNONYM_REGION", None) or "IN").strip().upper() or "IN"
    except Exception:  # noqa: BLE001
        return (os.getenv("AI_SYNONYM_REGION") or "IN").strip().upper() or "IN"


def _parse_record(raw: dict[str, Any], default_category: str) -> SynonymRecord | None:
    rid = str(raw.get("id") or "").strip()
    canonical = str(raw.get("canonical") or "").strip()
    if not rid or not canonical:
        return None
    return SynonymRecord(
        id=rid,
        canonical=canonical,
        category=str(raw.get("category") or default_category).strip() or default_category,
        synonyms=_as_tuple(raw.get("synonyms")),
        aliases=_as_tuple(raw.get("aliases")),
        abbreviations=_as_tuple(raw.get("abbreviations")),
        misspellings=_as_tuple(raw.get("misspellings")),
        plurals=_as_tuple(raw.get("plurals")),
        regions=tuple(r.upper() for r in _as_tuple(raw.get("regions"))),
    )


def _index_record(index: SynonymIndex, record: SynonymRecord) -> None:
    index.records[record.id] = record
    index.canonical_to_id[record.canonical.lower()] = record.id

    def _add(term: str, kind: str) -> None:
        key = term.strip().lower()
        if not key:
            return
        bucket = index.term_to_ids.setdefault(key, [])
        if record.id not in bucket:
            bucket.append(record.id)
        # Prefer more specific kinds if already set
        prev = index.term_kind.get(key)
        rank = {
            "abbreviation": 5,
            "misspelling": 4,
            "plural": 3,
            "synonym": 2,
            "alias": 2,
            "exact": 1,
        }
        if prev is None or rank.get(kind, 0) >= rank.get(prev, 0):
            index.term_kind[key] = kind

    _add(record.canonical, "exact")
    for t in record.synonyms:
        _add(t, "synonym")
    for t in record.aliases:
        _add(t, "alias")
    for t in record.abbreviations:
        _add(t, "abbreviation")
    for t in record.misspellings:
        _add(t, "misspelling")
    for t in record.plurals:
        _add(t, "plural")


def load_index(
    config_dir: Path | str | None = None,
    *,
    region: str | None = None,
    validate: bool = True,
) -> SynonymIndex:
    root = Path(config_dir) if config_dir else _CONFIG_DIR
    started = time.perf_counter()
    reg = (region or _region()).upper()
    index = SynonymIndex(version=1, region=reg)

    if not root.is_dir():
        log.error("synonym_engine config dir missing: %s", root)
        index.load_ms = (time.perf_counter() - started) * 1000
        return index

    files = list(_BASE_FILES) + [f"regional_{reg}.yaml"]
    for name in files:
        path = root / name
        if not path.is_file():
            if name.startswith("regional_"):
                continue
            log.warning("synonym_engine missing config file: %s", name)
            continue
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except Exception as exc:  # noqa: BLE001
            log.error("synonym_engine parse failed %s: %s", name, exc)
            continue
        default_cat = str(data.get("category") or path.stem).strip()
        for item in data.get("entries") or []:
            if not isinstance(item, dict):
                continue
            record = _parse_record(item, default_cat)
            if record is None:
                continue
            if record.regions and reg not in record.regions:
                continue
            # Later files (regional) override same id
            _index_record(index, record)

    index.all_terms = sorted(index.term_to_ids.keys())
    index.load_ms = (time.perf_counter() - started) * 1000
    log.info(
        "synonym_engine loaded region=%s records=%s terms=%s ms=%.2f",
        reg,
        index.count(),
        len(index.all_terms),
        index.load_ms,
    )

    if validate:
        from app.services.ai.synonym.validator import (
            SynonymValidationError,
            validate_index,
        )

        result = validate_index(index, raise_on_error=False)
        if result.errors:
            raise SynonymValidationError(result)

    return index


def get_index(
    *,
    force_reload: bool = False,
    validate: bool = True,
    raise_on_error: bool = False,
) -> SynonymIndex:
    global _cache, _last_load_ms
    if _cache is not None and not force_reload:
        return _cache

    started = time.perf_counter()
    try:
        index = load_index(_CONFIG_DIR, validate=False)
        if validate:
            from app.services.ai.synonym.validator import validate_index

            validate_index(index, raise_on_error=raise_on_error)
        _cache = index
    except Exception as exc:  # noqa: BLE001
        log.error("synonym_engine load failed: %s", exc)
        if raise_on_error:
            raise
        _cache = SynonymIndex(version=0, region=_region())
    _last_load_ms = (time.perf_counter() - started) * 1000
    return _cache


def reload(config_dir: Path | str | None = None) -> SynonymIndex:
    global _cache
    _cache = None
    if config_dir is not None:
        index = load_index(config_dir, validate=True)
        _cache = index
    else:
        index = get_index(force_reload=True, validate=True, raise_on_error=True)

    try:
        from app.config.config import Config as settings

        if getattr(settings, "AI_SYNONYM_REDIS_CACHE", False):
            log.info(
                "synonym_engine redis cache flag on; using in-process index count=%s",
                index.count(),
            )
    except Exception:  # noqa: BLE001
        pass
    return index


def last_load_ms() -> float:
    return _last_load_ms


def config_dir() -> Path:
    return _CONFIG_DIR
