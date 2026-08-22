"""Entity Dictionary public API — Module 4 knowledge layer for Entity Extraction."""
from __future__ import annotations

from app.services.ai.entity.dictionary.entity_loader import (
    catalogs_dir,
    get_catalog,
    last_load_ms,
    load_catalog,
    reload,
)
from app.services.ai.entity.dictionary.entity_search import lookup, resolve, resolve_in_message
from app.services.ai.entity.dictionary.entity_validator import (
    EntityDictionaryValidationError,
    ValidationResult,
    try_validate_on_startup,
    validate_catalog,
)
from app.services.ai.entity.dictionary.schemas import EntityCatalog, EntityMatch, EntityRecord

__all__ = [
    "EntityCatalog",
    "EntityMatch",
    "EntityRecord",
    "EntityDictionaryValidationError",
    "ValidationResult",
    "catalogs_dir",
    "get_catalog",
    "last_load_ms",
    "load_catalog",
    "reload",
    "lookup",
    "resolve",
    "resolve_in_message",
    "try_validate_on_startup",
    "validate_catalog",
]
