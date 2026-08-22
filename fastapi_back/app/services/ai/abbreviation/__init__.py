"""Module 6 — Abbreviation Engine."""
from __future__ import annotations

from app.services.ai.abbreviation.loader import config_dir, get_index, reload
from app.services.ai.abbreviation.matcher import expand_term
from app.services.ai.abbreviation.resolver import expand_message
from app.services.ai.abbreviation.schemas import AbbreviationMatch, ExpandResult
from app.services.ai.abbreviation.validator import (
    AbbreviationValidationError,
    ValidationResult,
    try_validate_on_startup,
    validate_index,
)

__all__ = [
    "AbbreviationMatch",
    "AbbreviationValidationError",
    "ExpandResult",
    "ValidationResult",
    "config_dir",
    "expand_message",
    "expand_term",
    "get_index",
    "reload",
    "try_validate_on_startup",
    "validate_index",
]
