"""Load and cache intent_dictionary.yaml."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import yaml

from app.services.ai.intent.dictionary.intent_schema import (
    IntentDefinition,
    IntentDictionary,
    IntentPattern,
)
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_DEFAULT_PATH = Path(__file__).resolve().parent / "intent_dictionary.yaml"

_cache: IntentDictionary | None = None
_cache_path: Path | None = None
_last_load_ms: float = 0.0


def _as_tuple_str(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,)
    return tuple(str(x) for x in value)


def _parse_patterns(raw: Any) -> tuple[IntentPattern, ...]:
    if not raw:
        return ()
    out: list[IntentPattern] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        strength = str(item.get("strength") or "keyword").strip().lower()
        regex = str(item.get("regex") or "").strip()
        if not regex:
            continue
        out.append(IntentPattern(strength=strength, regex=regex))
    return tuple(out)


def _parse_intent(raw: dict[str, Any]) -> IntentDefinition:
    intent_id = str(raw.get("id") or "").strip()
    output_category = str(raw.get("output_category") or "information").strip()
    message_type = str(raw.get("message_type") or output_category).strip()
    return IntentDefinition(
        id=intent_id,
        name=str(raw.get("name") or intent_id).strip(),
        description=str(raw.get("description") or "").strip(),
        category=str(raw.get("category") or "").strip(),
        priority=int(raw.get("priority") if raw.get("priority") is not None else 0),
        confidence_threshold=float(
            raw.get("confidence_threshold") if raw.get("confidence_threshold") is not None else 0.5
        ),
        synonyms=_as_tuple_str(raw.get("synonyms")),
        aliases=_as_tuple_str(raw.get("aliases")),
        examples=_as_tuple_str(raw.get("examples")),
        workflow=str(raw.get("workflow") or "").strip(),
        required_entities=_as_tuple_str(raw.get("required_entities")),
        tool=str(raw.get("tool") or "none").strip(),
        requires_auth=bool(raw.get("requires_auth", False)),
        requires_confirmation=bool(raw.get("requires_confirmation", False)),
        supports_followup=bool(raw.get("supports_followup", True)),
        emergency=bool(raw.get("emergency", False)),
        fallback_intent=str(raw.get("fallback_intent") or "unknown_intent").strip(),
        output_category=output_category,
        message_type=message_type,
        patterns=_parse_patterns(raw.get("patterns")),
        synonyms_hi=_as_tuple_str(raw.get("synonyms_hi")),
        examples_te=_as_tuple_str(raw.get("examples_te")),
    )


def load_dictionary(path: Path | str | None = None, *, validate: bool = True) -> IntentDictionary:
    """Load YAML from disk (does not mutate module cache — use get_dictionary/reload)."""
    yaml_path = Path(path) if path else _DEFAULT_PATH
    started = time.perf_counter()
    with yaml_path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}

    intents_raw = data.get("intents") or []
    intents: dict[str, IntentDefinition] = {}
    duplicate_ids: list[str] = []
    for item in intents_raw:
        if not isinstance(item, dict):
            continue
        definition = _parse_intent(item)
        if not definition.id:
            continue
        if definition.id in intents:
            duplicate_ids.append(definition.id)
        intents[definition.id] = definition

    dictionary = IntentDictionary(
        version=int(data.get("version") or 1),
        description=str(data.get("description") or ""),
        intents=intents,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    log.info(
        "intent_dictionary loaded path=%s count=%s ms=%.2f",
        yaml_path,
        len(intents),
        elapsed_ms,
    )

    if validate:
        from app.services.ai.intent.dictionary.intent_validator import (
            IntentDictionaryValidationError,
            validate_dictionary,
        )

        result = validate_dictionary(dictionary, raise_on_error=False)
        for dup in duplicate_ids:
            result.errors.append(f"duplicate intent id: {dup}")
        if result.errors:
            raise IntentDictionaryValidationError(result)

    elif duplicate_ids:
        log.warning("intent_dictionary duplicate ids ignored: %s", duplicate_ids)

    return dictionary


def get_dictionary(
    *,
    force_reload: bool = False,
    validate: bool = True,
    raise_on_error: bool = False,
) -> IntentDictionary:
    """
    Return cached dictionary; load on first use.

    Validation runs by default. Production callers keep raise_on_error=False so
    bad metadata is logged without crashing the process.
    """
    global _cache, _cache_path, _last_load_ms
    if _cache is not None and not force_reload:
        return _cache

    started = time.perf_counter()
    try:
        dictionary = load_dictionary(_DEFAULT_PATH, validate=False)
        if validate:
            from app.services.ai.intent.dictionary.intent_validator import validate_dictionary

            validate_dictionary(dictionary, raise_on_error=raise_on_error)
        _cache = dictionary
    except Exception as exc:  # noqa: BLE001
        log.error("intent_dictionary load failed: %s", exc)
        if raise_on_error:
            raise
        # Soft empty dictionary — engine falls back to Python rules
        _cache = IntentDictionary(version=0, description="load_failed", intents={})
    _cache_path = _DEFAULT_PATH
    _last_load_ms = (time.perf_counter() - started) * 1000
    return _cache


def get_intent(intent_id: str) -> IntentDefinition | None:
    return get_dictionary().get(intent_id)


def list_intents() -> list[IntentDefinition]:
    return list(get_dictionary().intents.values())


def reload(path: Path | str | None = None) -> IntentDictionary:
    """Clear cache and reload (optionally from a custom path); refresh engine caches."""
    global _cache, _cache_path
    _cache = None
    _cache_path = None
    if path is not None:
        dictionary = load_dictionary(path, validate=True)
        _cache = dictionary
        _cache_path = Path(path)
    else:
        dictionary = get_dictionary(force_reload=True, validate=True, raise_on_error=True)

    try:
        from app.services.ai.intent.catalog import refresh_catalog_caches
        from app.services.ai.intent.matcher import rebuild_rules

        refresh_catalog_caches()
        rebuild_rules()
    except Exception as exc:  # noqa: BLE001
        log.warning("intent_dictionary reload engine refresh failed: %s", exc)

    return dictionary


def last_load_ms() -> float:
    return _last_load_ms


def default_path() -> Path:
    return _DEFAULT_PATH
