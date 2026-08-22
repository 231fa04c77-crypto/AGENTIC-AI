"""Intent Dictionary public API — Module 2 knowledge layer for Intent Engine."""
from __future__ import annotations

from app.services.ai.intent.dictionary.intent_loader import (
    default_path,
    get_dictionary,
    get_intent,
    last_load_ms,
    list_intents,
    load_dictionary,
    reload,
)
from app.services.ai.intent.dictionary.intent_schema import (
    IntentDefinition,
    IntentDictionary,
    IntentPattern,
)
from app.services.ai.intent.dictionary.intent_validator import (
    IntentDictionaryValidationError,
    ValidationResult,
    try_validate_on_startup,
    validate_dictionary,
)

__all__ = [
    "IntentDefinition",
    "IntentDictionary",
    "IntentPattern",
    "IntentDictionaryValidationError",
    "ValidationResult",
    "default_path",
    "get_dictionary",
    "get_intent",
    "last_load_ms",
    "list_intents",
    "load_dictionary",
    "reload",
    "try_validate_on_startup",
    "validate_dictionary",
]
