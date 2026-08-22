"""Rank intents by confidence and domain priority (emergency first)."""
from __future__ import annotations

from app.services.ai.intent.catalog import emergency_intents, priority_rank_map
from app.services.ai.intent.schemas import IntentHit


def rank_hits(hits: list[IntentHit]) -> list[IntentHit]:
    """Sort: emergency boost, then confidence desc, then priority rank desc."""
    if not hits:
        return []

    emergencies = emergency_intents()
    priority = priority_rank_map()

    boosted: list[IntentHit] = []
    for h in hits:
        conf = h.confidence
        if h.intent in emergencies:
            conf = min(0.99, conf + 0.12)
        boosted.append(
            IntentHit(intent=h.intent, confidence=round(conf, 3), strength=h.strength)
        )

    boosted.sort(
        key=lambda h: (
            1 if h.intent in emergencies else 0,
            h.confidence,
            priority.get(h.intent, 0),
        ),
        reverse=True,
    )
    return boosted
