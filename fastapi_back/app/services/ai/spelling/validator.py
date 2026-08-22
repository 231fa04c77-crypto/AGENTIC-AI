"""Validate spelling dictionaries."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.ai.spelling.schemas import SpellingDictionary
from app.utils.app_logger import get_logger

log = get_logger(__name__)


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


class SpellingValidationError(ValueError):
    def __init__(self, result: ValidationResult):
        self.result = result
        super().__init__("; ".join(result.errors) if result.errors else "validation failed")


def validate_dictionary(dictionary: SpellingDictionary, *, raise_on_error: bool = True) -> ValidationResult:
    result = ValidationResult()
    owners: dict[str, str] = {}
    for eid, entry in dictionary.entries.items():
        if not entry.canonical:
            result.errors.append(f"{eid}: missing canonical")
        for m in entry.misspellings:
            key = m.strip().lower()
            if not key:
                continue
            if key == entry.canonical.lower():
                result.warnings.append(f"{eid}: misspelling equals canonical")
                continue
            prev = owners.get(key)
            if prev and prev != eid:
                prev_c = dictionary.entries[prev].canonical
                if prev_c.lower() != entry.canonical.lower():
                    result.errors.append(
                        f"duplicate correction {m!r}: {prev}->{prev_c} and {eid}->{entry.canonical}"
                    )
                else:
                    result.warnings.append(f"duplicate misspelling {m!r} on {prev} and {eid}")
            else:
                owners[key] = eid

    # Circular: A misspells to B's misspelling form incorrectly — skip if rare

    for w in result.warnings:
        log.warning("spelling_engine: %s", w)
    for e in result.errors:
        log.error("spelling_engine: %s", e)
    if raise_on_error and result.errors:
        raise SpellingValidationError(result)
    return result


def try_validate_on_startup() -> ValidationResult | None:
    try:
        from app.services.ai.spelling.dictionary_loader import config_dir, load_dictionary

        dictionary = load_dictionary(config_dir(), validate=False)
        result = validate_dictionary(dictionary, raise_on_error=False)
        if result.ok:
            log.info("spelling_engine startup ok count=%s", dictionary.count())
        else:
            log.error("spelling_engine startup errors=%s", len(result.errors))
        return result
    except Exception as exc:  # noqa: BLE001
        log.error("spelling_engine startup failed (soft): %s", type(exc).__name__)
        return None
