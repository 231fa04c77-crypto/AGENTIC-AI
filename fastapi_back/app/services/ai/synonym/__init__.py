"""Module 5 — Synonym Engine (language normalization only)."""
from __future__ import annotations

from app.services.ai.synonym.loader import config_dir, get_index, last_load_ms, reload
from app.services.ai.synonym.normalizer import normalize_message
from app.services.ai.synonym.resolver import resolve_synonyms, resolve_term
from app.services.ai.synonym.schemas import NormalizeResult, SynonymMatch, SynonymRecord
from app.services.ai.synonym.validator import (
    SynonymValidationError,
    ValidationResult,
    try_validate_on_startup,
    validate_index,
)

__all__ = [
    "NormalizeResult",
    "SynonymMatch",
    "SynonymRecord",
    "SynonymValidationError",
    "ValidationResult",
    "config_dir",
    "get_index",
    "last_load_ms",
    "normalize_message",
    "reload",
    "resolve_synonyms",
    "resolve_term",
    "try_validate_on_startup",
    "validate_index",
]
