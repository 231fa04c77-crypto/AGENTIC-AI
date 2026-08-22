"""Ambiguity / clarification detection."""
from __future__ import annotations

import re

from app.services.ai.intent.catalog import emergency_intents
from app.services.ai.intent.schemas import IntentHit

_VAGUE = re.compile(
    r"^\s*(help|i need help|need help|book|doctor|hospital|medicine|"
    r"appointment|need|please|something)\s*[!.]?\s*$",
    re.I,
)


def requires_clarification(
    original: str,
    normalized: str,
    ranked: list[IntentHit],
) -> bool:
    text = (original or "").strip()
    emergencies = emergency_intents()
    if not text:
        return True

    # Ultra-short / vague tokens
    if _VAGUE.match(text) or _VAGUE.match(normalized or ""):
        # If only weak/help or nothing strong
        if not ranked:
            return True
        top = ranked[0]
        if top.intent in {"help", "unknown_intent"} or top.confidence < 0.8:
            return True
        if top.intent not in emergencies and len(text) <= 12:
            return True

    # Two close top intents without clear winner (non-emergency)
    if len(ranked) >= 2:
        a, b = ranked[0], ranked[1]
        if (
            a.intent not in emergencies
            and abs(a.confidence - b.confidence) < 0.06
            and a.confidence < 0.9
        ):
            return True

    return False
