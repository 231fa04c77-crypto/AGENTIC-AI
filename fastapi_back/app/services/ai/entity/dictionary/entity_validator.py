"""Validate Entity Dictionary integrity."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.ai.entity.dictionary.schemas import EntityCatalog
from app.utils.app_logger import get_logger

log = get_logger(__name__)


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


class EntityDictionaryValidationError(ValueError):
    def __init__(self, result: ValidationResult):
        self.result = result
        msg = "; ".join(result.errors) if result.errors else "validation failed"
        super().__init__(msg)


def validate_catalog(
    catalog: EntityCatalog,
    *,
    raise_on_error: bool = True,
) -> ValidationResult:
    result = ValidationResult()
    hospitals = catalog.by_category.get("Hospital") or {}

    for category, records in catalog.by_category.items():
        alias_owners: dict[str, str] = {}
        for entity_id, record in records.items():
            if not record.id:
                result.errors.append(f"{category}: empty id")
            if record.id != entity_id:
                result.errors.append(f"{category}: id mismatch key={entity_id!r} id={record.id!r}")
            if not record.canonical:
                result.errors.append(f"{category}/{entity_id}: missing canonical")
            if not record.normalized:
                result.errors.append(f"{category}/{entity_id}: invalid normalization (empty)")
            if not record.category:
                result.errors.append(f"{category}/{entity_id}: missing category")

            for term in record.all_terms():
                key = term.strip().lower()
                if not key:
                    continue
                prev = alias_owners.get(key)
                if prev and prev != entity_id:
                    result.warnings.append(
                        f"{category}: duplicate alias {term!r} on {prev} and {entity_id}"
                    )
                else:
                    alias_owners[key] = entity_id

            # Doctor → hospital cross-ref
            if category == "Doctor":
                hid = str((record.metadata or {}).get("hospital_id") or "").strip()
                if hid and hid not in hospitals:
                    result.errors.append(
                        f"Doctor/{entity_id}: broken hospital_id={hid!r}"
                    )

            # Emergency flag must be bool if present
            if "emergency" in (record.metadata or {}):
                if not isinstance(record.metadata["emergency"], bool):
                    result.errors.append(
                        f"{category}/{entity_id}: metadata.emergency must be bool"
                    )

    for w in result.warnings:
        log.warning("entity_dictionary: %s", w)
    for e in result.errors:
        log.error("entity_dictionary: %s", e)

    if raise_on_error and result.errors:
        raise EntityDictionaryValidationError(result)
    return result


def try_validate_on_startup() -> ValidationResult | None:
    """Soft startup validation — never raises."""
    try:
        from app.services.ai.entity.dictionary.entity_loader import catalogs_dir, load_catalog

        catalog = load_catalog(catalogs_dir(), validate=False)
        result = validate_catalog(catalog, raise_on_error=False)
        if result.ok:
            log.info(
                "entity_dictionary startup validation ok count=%s",
                catalog.count(),
            )
        else:
            log.error(
                "entity_dictionary startup validation errors=%s",
                len(result.errors),
            )
        return result
    except Exception as exc:  # noqa: BLE001
        log.error("entity_dictionary startup validation failed (soft): %s", type(exc).__name__)
        return None
