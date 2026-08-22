"""Map Module-1 intents → legacy gateway intent names (for Module 2 cutover)."""
from __future__ import annotations

from typing import Any

from app.services.ai.intent.schemas import IntentResult

# New catalog → existing intents.py / INTENT_TOOL keys
LEGACY_INTENT_MAP: dict[str, str] = {
    "book_appointment": "book_appointment",
    "cancel_appointment": "cancel_appointment",
    "reschedule_appointment": "reschedule_appointment",
    "view_appointment": "view_appointments",
    "check_appointment_status": "view_appointments",
    "check_doctor_availability": "find_doctor",
    "search_doctor": "find_doctor",
    "doctor_details": "find_doctor",
    "search_specialist": "find_doctor",
    "search_hospital": "find_hospital",
    "nearby_hospital": "find_hospital",
    "hospital_information": "find_hospital",
    "search_medicine": "find_pharmacy",
    "medicine_information": "medicine_info",
    "order_medicine": "find_pharmacy",
    "track_medicine_order": "track_medicine_order",
    "search_laboratory": "book_lab_test",
    "book_lab_test": "book_lab_test",
    "view_reports": "view_lab_report",
    "explain_reports": "explain_lab_report",
    "search_community": "community_search",
    "ask_community_question": "community_search",
    "read_community_answers": "community_search",
    "raise_complaint": "raise_complaint",
    "track_complaint": "track_complaint",
    "feedback": "platform_help",
    "disease_information": "health_education",
    "symptom_guidance": "symptom_guidance",
    "wellness_advice": "wellness_info",
    "nutrition": "wellness_info",
    "exercise": "wellness_info",
    "mental_health": "wellness_info",
    "emergency_help": "emergency_help",
    "ambulance": "emergency_help",
    "nearest_emergency_hospital": "emergency_help",
    "open_pharmacy": "navigation_help",
    "open_reports": "navigation_help",
    "open_appointments": "navigation_help",
    "open_dashboard": "navigation_help",
    "open_profile": "get_my_profile",
    "open_settings": "navigation_help",
    "greeting": "basic_conversation",
    "small_talk": "basic_conversation",
    "thank_you": "basic_conversation",
    "goodbye": "basic_conversation",
    "help": "platform_help",
    "faq": "platform_help",
    "unknown_intent": "unknown",
}


def to_legacy_intent(result: IntentResult | dict[str, Any]) -> dict[str, Any]:
    """Convert IntentResult to the shape expected by current gateway helpers."""
    if isinstance(result, IntentResult):
        data = result.to_dict()
    else:
        data = dict(result or {})

    primary = str(data.get("primary_intent") or "unknown_intent")
    legacy = LEGACY_INTENT_MAP.get(primary, "unknown")
    conf_map = data.get("confidence") or {}
    conf = float(conf_map.get(primary, 0.5) or 0.5)

    return {
        "intent": legacy,
        "confidence": conf,
        "source": "intent_engine_v2",
        "query": data.get("normalized_message") or "",
        "requires_clarification": bool(data.get("requires_clarification")),
        "message_type": data.get("message_type"),
        "secondary_intents": data.get("secondary_intents") or [],
        "v2_primary": primary,
        "v2_confidence": conf_map,
    }
