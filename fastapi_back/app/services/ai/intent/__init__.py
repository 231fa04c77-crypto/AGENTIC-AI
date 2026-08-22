"""Module 1 — Intent Engine (pure detection, no business actions)."""
from app.services.ai.intent.adapter import LEGACY_INTENT_MAP, to_legacy_intent
from app.services.ai.intent.detector import detect_intents
from app.services.ai.intent.schemas import IntentError, IntentHit, IntentResult

__all__ = [
    "detect_intents",
    "to_legacy_intent",
    "LEGACY_INTENT_MAP",
    "IntentResult",
    "IntentHit",
    "IntentError",
]
