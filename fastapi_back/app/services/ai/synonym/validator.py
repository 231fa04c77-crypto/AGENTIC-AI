"""Validate Synonym Engine index integrity."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.ai.synonym.schemas import SynonymIndex
from app.utils.app_logger import get_logger

log = get_logger(__name__)


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


class SynonymValidationError(ValueError):
    def __init__(self, result: ValidationResult):
        self.result = result
        super().__init__("; ".join(result.errors) if result.errors else "validation failed")


def validate_index(
    index: SynonymIndex,
    *,
    raise_on_error: bool = True,
) -> ValidationResult:
    result = ValidationResult()
    # term -> first owner id
    term_owners: dict[str, str] = {}

    for rid, record in index.records.items():
        if not record.id:
            result.errors.append("empty id")
        if record.id != rid:
            result.errors.append(f"id mismatch key={rid!r} id={record.id!r}")
        if not record.canonical:
            result.errors.append(f"{rid}: missing canonical")
        if not record.category:
            result.errors.append(f"{rid}: missing category")

        for term in record.all_source_terms():
            key = term.strip().lower()
            if not key:
                continue
            prev = term_owners.get(key)
            if prev and prev != rid:
                # Same canonical OK; different canonicals = duplicate mapping conflict
                prev_rec = index.records.get(prev)
                if prev_rec and prev_rec.canonical.lower() != record.canonical.lower():
                    result.errors.append(
                        f"duplicate mapping {term!r}: {prev}->{prev_rec.canonical} "
                        f"and {rid}->{record.canonical}"
                    )
                else:
                    result.warnings.append(f"duplicate synonym term {term!r} on {prev} and {rid}")
            else:
                term_owners[key] = rid

    # Circular mappings: A synonym lists B's canonical and B lists A's
    canons = {r.canonical.lower(): r.id for r in index.records.values()}
    for rid, record in index.records.items():
        for term in (*record.synonyms, *record.aliases):
            other_id = canons.get(term.strip().lower())
            if not other_id or other_id == rid:
                continue
            other = index.records[other_id]
            # If other maps back to this canonical via synonym/alias → cycle
            back = {t.lower() for t in (*other.synonyms, *other.aliases, other.canonical)}
            if record.canonical.lower() in back and other.canonical.lower() != record.canonical.lower():
                result.errors.append(
                    f"circular mapping: {rid}({record.canonical}) <-> "
                    f"{other_id}({other.canonical})"
                )

    for w in result.warnings:
        log.warning("synonym_engine: %s", w)
    for e in result.errors:
        log.error("synonym_engine: %s", e)

    if raise_on_error and result.errors:
        raise SynonymValidationError(result)
    return result


def try_validate_on_startup() -> ValidationResult | None:
    """Soft startup validation — never raises."""
    try:
        from app.services.ai.synonym.loader import config_dir, load_index

        index = load_index(config_dir(), validate=False)
        result = validate_index(index, raise_on_error=False)
        if result.ok:
            log.info("synonym_engine startup validation ok count=%s", index.count())
        else:
            log.error("synonym_engine startup validation errors=%s", len(result.errors))
        return result
    except Exception as exc:  # noqa: BLE001
        log.error("synonym_engine startup validation failed (soft): %s", type(exc).__name__)
        return None
