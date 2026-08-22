"""Compose Module 1 Intent + Module 2 Entities for downstream modules."""
from __future__ import annotations

from typing import Any, Optional

from app.services.ai.entity.detector import extract_entities
from app.services.ai.intent.detector import detect_intents


def analyze_message(
    message: Optional[str] = None,
    *,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Run Entity Extraction first (synonym/abbr/spell), then Intent Engine on
    the normalized/corrected text so intents see cleaned language.
    """
    entities = extract_entities(message, context=context)
    intent_text = (entities.normalized_message or "").strip() or message
    intent = detect_intents(intent_text, context=context)

    return {
        "intent": intent.to_dict(),
        "entities": entities.to_dict(),
        "handoff": {
            "primary_intent": intent.primary_intent,
            "secondary_intents": intent.secondary_intents,
            "requires_clarification": bool(intent.requires_clarification)
            or (
                bool(entities.missing_for_booking)
                and intent.primary_intent
                in {
                    "book_appointment",
                    "reschedule_appointment",
                    "check_doctor_availability",
                }
            ),
            "entities": entities.entities,
            "message_type": intent.message_type,
            "language": intent.language or entities.language,
            "original_message": entities.original_message or (message or ""),
            "normalized_message": entities.normalized_message or intent.normalized_message,
        },
    }
