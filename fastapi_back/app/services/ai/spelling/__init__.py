"""Module 7 — Spelling Correction Engine."""
from __future__ import annotations

from app.services.ai.spelling.corrector import correct_message
from app.services.ai.spelling.dictionary_loader import config_dir, get_dictionary, reload
from app.services.ai.spelling.matcher import correct_token
from app.services.ai.spelling.schemas import CorrectResult, SpellingCorrection
from app.services.ai.spelling.validator import (
    SpellingValidationError,
    ValidationResult,
    try_validate_on_startup,
    validate_dictionary,
)

__all__ = [
    "CorrectResult",
    "SpellingCorrection",
    "SpellingValidationError",
    "ValidationResult",
    "config_dir",
    "correct_message",
    "correct_token",
    "get_dictionary",
    "reload",
    "try_validate_on_startup",
    "validate_dictionary",
]
