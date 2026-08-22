"""Load spelling correction dictionaries."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import yaml

from app.services.ai.spelling.schemas import SpellingDictionary, SpellingEntry
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_CONFIG_DIR = Path(__file__).resolve().parent / "config"
_cache: SpellingDictionary | None = None
_FILES = (
    "specialties.yaml",
    "medicines.yaml",
    "diseases.yaml",
    "symptoms.yaml",
    "cities.yaml",
    "general_words.yaml",
    "medical_terms.yaml",
)


def _as_tuple(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,)
    return tuple(str(x) for x in value)


def load_dictionary(config_dir: Path | str | None = None, *, validate: bool = True) -> SpellingDictionary:
    root = Path(config_dir) if config_dir else _CONFIG_DIR
    started = time.perf_counter()
    dictionary = SpellingDictionary(version=1)
    if not root.is_dir():
        log.error("spelling_engine config missing: %s", root)
        dictionary.load_ms = (time.perf_counter() - started) * 1000
        return dictionary

    for name in _FILES:
        path = root / name
        if not path.is_file():
            continue
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except Exception as exc:  # noqa: BLE001
            log.error("spelling_engine parse %s: %s", name, exc)
            continue
        default_cat = str(data.get("category") or path.stem).strip()
        for item in data.get("entries") or []:
            if not isinstance(item, dict):
                continue
            eid = str(item.get("id") or "").strip()
            canonical = str(item.get("canonical") or "").strip()
            if not eid or not canonical:
                continue
            entry = SpellingEntry(
                id=eid,
                canonical=canonical,
                category=str(item.get("category") or default_cat).strip() or default_cat,
                misspellings=_as_tuple(item.get("misspellings")),
            )
            dictionary.entries[eid] = entry
            dictionary.lexicon.append(canonical)
            for m in entry.misspellings:
                key = m.strip().lower()
                if key and key != canonical.lower():
                    dictionary.misspell_index[key] = eid

    dictionary.lexicon = sorted(set(dictionary.lexicon))
    dictionary.load_ms = (time.perf_counter() - started) * 1000
    log.info(
        "spelling_engine loaded entries=%s misspells=%s ms=%.2f",
        dictionary.count(),
        len(dictionary.misspell_index),
        dictionary.load_ms,
    )
    if validate:
        from app.services.ai.spelling.validator import SpellingValidationError, validate_dictionary

        result = validate_dictionary(dictionary, raise_on_error=False)
        if result.errors:
            raise SpellingValidationError(result)
    return dictionary


def get_dictionary(*, force_reload: bool = False, validate: bool = True, raise_on_error: bool = False) -> SpellingDictionary:
    global _cache
    if _cache is not None and not force_reload:
        return _cache
    try:
        dictionary = load_dictionary(_CONFIG_DIR, validate=False)
        if validate:
            from app.services.ai.spelling.validator import validate_dictionary

            validate_dictionary(dictionary, raise_on_error=raise_on_error)
        _cache = dictionary
    except Exception as exc:  # noqa: BLE001
        log.error("spelling_engine load failed: %s", exc)
        if raise_on_error:
            raise
        _cache = SpellingDictionary(version=0)
    return _cache


def reload(config_dir: Path | str | None = None) -> SpellingDictionary:
    global _cache
    _cache = None
    if config_dir is not None:
        _cache = load_dictionary(config_dir, validate=True)
        return _cache
    return get_dictionary(force_reload=True, validate=True, raise_on_error=True)


def config_dir() -> Path:
    return _CONFIG_DIR
