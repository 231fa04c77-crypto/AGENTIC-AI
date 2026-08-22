"""Load Abbreviation Engine YAML configs."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import yaml

from app.services.ai.abbreviation.schemas import AbbreviationIndex, AbbreviationRecord
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_CONFIG_DIR = Path(__file__).resolve().parent / "config"
_cache: AbbreviationIndex | None = None
_FILES = (
    "vitals.yaml",
    "laboratory.yaml",
    "radiology.yaml",
    "specialties.yaml",
    "diseases.yaml",
    "medicines.yaml",
    "departments.yaml",
    "navigation.yaml",
    "medical.yaml",
)


def _as_tuple(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,)
    return tuple(str(x) for x in value)


def _parse(raw: dict[str, Any], default_cat: str) -> AbbreviationRecord | None:
    rid = str(raw.get("id") or "").strip()
    abbr = str(raw.get("abbreviation") or "").strip()
    expanded = str(raw.get("expanded") or "").strip()
    if not rid or not abbr or not expanded:
        return None
    canonical = str(raw.get("canonical") or expanded).strip() or expanded
    return AbbreviationRecord(
        id=rid,
        abbreviation=abbr,
        expanded=expanded,
        canonical=canonical,
        category=str(raw.get("category") or default_cat).strip() or default_cat,
        aliases=_as_tuple(raw.get("aliases")),
        contexts=_as_tuple(raw.get("contexts")),
        sense_id=str(raw.get("sense_id") or "").strip(),
        aliases_hi=_as_tuple(raw.get("aliases_hi")),
        aliases_te=_as_tuple(raw.get("aliases_te")),
    )


def load_index(config_dir: Path | str | None = None, *, validate: bool = True) -> AbbreviationIndex:
    root = Path(config_dir) if config_dir else _CONFIG_DIR
    started = time.perf_counter()
    index = AbbreviationIndex(version=1)
    if not root.is_dir():
        log.error("abbreviation_engine config missing: %s", root)
        index.load_ms = (time.perf_counter() - started) * 1000
        return index

    for name in _FILES:
        path = root / name
        if not path.is_file():
            log.warning("abbreviation_engine missing %s", name)
            continue
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except Exception as exc:  # noqa: BLE001
            log.error("abbreviation_engine parse %s: %s", name, exc)
            continue
        default_cat = str(data.get("category") or path.stem).strip()
        for item in data.get("entries") or []:
            if not isinstance(item, dict):
                continue
            rec = _parse(item, default_cat)
            if rec is None:
                continue
            index.records[rec.id] = rec
            for key in rec.source_keys():
                low = key.lower()
                bucket = index.by_abbr.setdefault(low, [])
                if rec.id not in bucket:
                    bucket.append(rec.id)

    index.load_ms = (time.perf_counter() - started) * 1000
    log.info(
        "abbreviation_engine loaded records=%s keys=%s ms=%.2f",
        index.count(),
        len(index.by_abbr),
        index.load_ms,
    )
    if validate:
        from app.services.ai.abbreviation.validator import (
            AbbreviationValidationError,
            validate_index,
        )

        result = validate_index(index, raise_on_error=False)
        if result.errors:
            raise AbbreviationValidationError(result)
    return index


def get_index(*, force_reload: bool = False, validate: bool = True, raise_on_error: bool = False) -> AbbreviationIndex:
    global _cache
    if _cache is not None and not force_reload:
        return _cache
    try:
        index = load_index(_CONFIG_DIR, validate=False)
        if validate:
            from app.services.ai.abbreviation.validator import validate_index

            validate_index(index, raise_on_error=raise_on_error)
        _cache = index
    except Exception as exc:  # noqa: BLE001
        log.error("abbreviation_engine load failed: %s", exc)
        if raise_on_error:
            raise
        _cache = AbbreviationIndex(version=0)
    return _cache


def reload(config_dir: Path | str | None = None) -> AbbreviationIndex:
    global _cache
    _cache = None
    if config_dir is not None:
        _cache = load_index(config_dir, validate=True)
        return _cache
    return get_index(force_reload=True, validate=True, raise_on_error=True)


def config_dir() -> Path:
    return _CONFIG_DIR
