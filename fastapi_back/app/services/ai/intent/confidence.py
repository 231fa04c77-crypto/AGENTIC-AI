"""Confidence scoring for matched intents."""
from __future__ import annotations

from app.services.ai.intent.catalog import confidence_threshold_for
from app.services.ai.intent.schemas import IntentHit

_BASE = {
    "exact": 0.95,
    "phrase": 0.88,
    "keyword": 0.72,
    "weak": 0.45,
}


def score_hit(intent: str, strength: str, *, message_len: int, hit_count: int) -> IntentHit:
    base = float(_BASE.get(strength, 0.5))
    # Slight boost for longer, more specific messages
    if message_len >= 40:
        base = min(0.99, base + 0.04)
    elif message_len >= 20:
        base = min(0.99, base + 0.02)
    # Mild penalty when many intents fire (ambiguity dampening)
    if hit_count >= 4:
        base = max(0.35, base - 0.05)
    elif hit_count >= 3:
        base = max(0.4, base - 0.02)
    return IntentHit(intent=intent, confidence=round(base, 3), strength=strength)


def passes_threshold(hit: IntentHit) -> bool:
    """Accept hit when confidence meets per-intent dictionary threshold."""
    return hit.confidence >= confidence_threshold_for(hit.intent)


def filter_by_threshold(hits: list[IntentHit]) -> list[IntentHit]:
    return [h for h in hits if passes_threshold(h)]
