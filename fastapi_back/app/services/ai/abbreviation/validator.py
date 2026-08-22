"""Validate Abbreviation Engine index."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.ai.abbreviation.schemas import AbbreviationIndex
from app.utils.app_logger import get_logger

log = get_logger(__name__)


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


class AbbreviationValidationError(ValueError):
    def __init__(self, result: ValidationResult):
        self.result = result
        super().__init__("; ".join(result.errors) if result.errors else "validation failed")


def validate_index(index: AbbreviationIndex, *, raise_on_error: bool = True) -> ValidationResult:
    result = ValidationResult()
    for rid, rec in index.records.items():
        if not rec.id or rec.id != rid:
            result.errors.append(f"bad id {rid!r}")
        if not rec.abbreviation:
            result.errors.append(f"{rid}: missing abbreviation")
        if not rec.expanded or not rec.canonical:
            result.errors.append(f"{rid}: missing expanded/canonical")

    # Same abbr without sense/contexts and different expansions = conflict unless multi-sense
    for abbr, ids in index.by_abbr.items():
        if len(ids) < 2:
            continue
        recs = [index.records[i] for i in ids if i in index.records]
        canons = {r.canonical.lower() for r in recs}
        if len(canons) > 1:
            senseless = [r for r in recs if not r.contexts and not r.sense_id]
            if len(senseless) > 1:
                result.errors.append(
                    f"ambiguous abbreviation {abbr!r} without contexts: "
                    + ", ".join(r.id for r in senseless)
                )
            else:
                result.warnings.append(f"multi-sense abbreviation {abbr!r} senses={len(recs)}")

    # Circular: expanded equals another abbreviation that expands back
    abbr_map = {r.abbreviation.lower(): r for r in index.records.values()}
    for rec in index.records.values():
        other = abbr_map.get(rec.expanded.lower())
        if other and other.id != rec.id and other.expanded.lower() == rec.abbreviation.lower():
            result.errors.append(f"circular mapping: {rec.id} <-> {other.id}")

    for w in result.warnings:
        log.warning("abbreviation_engine: %s", w)
    for e in result.errors:
        log.error("abbreviation_engine: %s", e)
    if raise_on_error and result.errors:
        raise AbbreviationValidationError(result)
    return result


def try_validate_on_startup() -> ValidationResult | None:
    try:
        from app.services.ai.abbreviation.loader import config_dir, load_index

        index = load_index(config_dir(), validate=False)
        result = validate_index(index, raise_on_error=False)
        if result.ok:
            log.info("abbreviation_engine startup ok count=%s", index.count())
        else:
            log.error("abbreviation_engine startup errors=%s", len(result.errors))
        return result
    except Exception as exc:  # noqa: BLE001
        log.error("abbreviation_engine startup failed (soft): %s", type(exc).__name__)
        return None
