"""Intent catalog — Module 1 Intent Engine (dictionary-backed with Python fallback)."""
from __future__ import annotations

from typing import Any

# Full Module-1 taxonomy (snake_case) — fallback when YAML unavailable
INTENT_IDS: tuple[str, ...] = (
    # Appointment
    "book_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "view_appointment",
    "check_appointment_status",
    "check_doctor_availability",
    # Doctor
    "search_doctor",
    "nearby_doctor",
    "doctor_details",
    "search_specialist",
    # Hospital
    "search_hospital",
    "nearby_hospital",
    "hospital_information",
    # Pharmacy
    "search_medicine",
    "medicine_information",
    "order_medicine",
    "track_medicine_order",
    # Laboratory
    "search_laboratory",
    "book_lab_test",
    "view_reports",
    "explain_reports",
    # Community
    "search_community",
    "ask_community_question",
    "read_community_answers",
    # Support
    "raise_complaint",
    "track_complaint",
    "feedback",
    # Health / education
    "disease_information",
    "symptom_guidance",
    "wellness_advice",
    "nutrition",
    "exercise",
    "mental_health",
    # Emergency
    "emergency_help",
    "ambulance",
    "nearest_emergency_hospital",
    # Navigation
    "open_pharmacy",
    "open_reports",
    "open_appointments",
    "open_dashboard",
    "open_profile",
    "open_settings",
    # General / conversation
    "greeting",
    "small_talk",
    "thank_you",
    "goodbye",
    "help",
    "faq",
    # Unknown
    "unknown_intent",
)

# Higher = more important when scores are close (fallback order)
PRIORITY_ORDER: tuple[str, ...] = (
    "emergency_help",
    "ambulance",
    "nearest_emergency_hospital",
    "book_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "view_appointment",
    "check_appointment_status",
    "check_doctor_availability",
    "raise_complaint",
    "track_complaint",
    "feedback",
    "search_medicine",
    "medicine_information",
    "order_medicine",
    "track_medicine_order",
    "search_laboratory",
    "book_lab_test",
    "view_reports",
    "explain_reports",
    "search_community",
    "ask_community_question",
    "read_community_answers",
    "search_doctor",
    "nearby_doctor",
    "doctor_details",
    "search_specialist",
    "search_hospital",
    "nearby_hospital",
    "hospital_information",
    "disease_information",
    "symptom_guidance",
    "wellness_advice",
    "nutrition",
    "exercise",
    "mental_health",
    "open_pharmacy",
    "open_reports",
    "open_appointments",
    "open_dashboard",
    "open_profile",
    "open_settings",
    "help",
    "faq",
    "greeting",
    "small_talk",
    "thank_you",
    "goodbye",
    "unknown_intent",
)

_FALLBACK_PRIORITY_RANK: dict[str, int] = {
    name: (len(PRIORITY_ORDER) - i) for i, name in enumerate(PRIORITY_ORDER)
}

_FALLBACK_MESSAGE_TYPE: dict[str, str] = {
    "book_appointment": "workflow",
    "cancel_appointment": "workflow",
    "reschedule_appointment": "workflow",
    "view_appointment": "workflow",
    "check_appointment_status": "workflow",
    "check_doctor_availability": "workflow",
    "search_doctor": "information",
    "nearby_doctor": "information",
    "doctor_details": "information",
    "search_specialist": "information",
    "search_hospital": "information",
    "nearby_hospital": "information",
    "hospital_information": "information",
    "search_medicine": "information",
    "medicine_information": "education",
    "order_medicine": "workflow",
    "track_medicine_order": "workflow",
    "search_laboratory": "information",
    "book_lab_test": "workflow",
    "view_reports": "information",
    "explain_reports": "education",
    "search_community": "information",
    "ask_community_question": "workflow",
    "read_community_answers": "information",
    "raise_complaint": "support",
    "track_complaint": "support",
    "feedback": "support",
    "disease_information": "education",
    "symptom_guidance": "education",
    "wellness_advice": "education",
    "nutrition": "education",
    "exercise": "education",
    "mental_health": "education",
    "emergency_help": "emergency",
    "ambulance": "emergency",
    "nearest_emergency_hospital": "emergency",
    "open_pharmacy": "navigation",
    "open_reports": "navigation",
    "open_appointments": "navigation",
    "open_dashboard": "navigation",
    "open_profile": "navigation",
    "open_settings": "navigation",
    "greeting": "conversation",
    "small_talk": "conversation",
    "thank_you": "conversation",
    "goodbye": "conversation",
    "help": "conversation",
    "faq": "information",
    "unknown_intent": "unknown",
}

_FALLBACK_EMERGENCY = frozenset(
    {"emergency_help", "ambulance", "nearest_emergency_hospital"}
)

_FALLBACK_THRESHOLDS: dict[str, float] = {
    "emergency_help": 0.55,
    "ambulance": 0.6,
    "nearest_emergency_hospital": 0.6,
    "greeting": 0.7,
    "thank_you": 0.7,
    "goodbye": 0.7,
    "unknown_intent": 0.0,
}


def _dictionary_or_none() -> Any:
    try:
        from app.services.ai.intent.dictionary import get_dictionary

        dictionary = get_dictionary(validate=True, raise_on_error=False)
        if dictionary and dictionary.intents:
            return dictionary
    except Exception:  # noqa: BLE001
        return None
    return None


def priority_rank_map() -> dict[str, int]:
    """Priority rank derived from dictionary `priority` (0–100), else fallback."""
    dictionary = _dictionary_or_none()
    if dictionary is None:
        return dict(_FALLBACK_PRIORITY_RANK)
    # Use YAML priority directly as rank (higher wins)
    return {iid: int(defn.priority) for iid, defn in dictionary.intents.items()}


def message_type_map() -> dict[str, str]:
    dictionary = _dictionary_or_none()
    if dictionary is None:
        return dict(_FALLBACK_MESSAGE_TYPE)
    return {
        iid: (defn.message_type or defn.output_category or "unknown")
        for iid, defn in dictionary.intents.items()
    }


def message_type_for(intent: str) -> str:
    return message_type_map().get(intent, "unknown")


def confidence_threshold_for(intent: str) -> float:
    dictionary = _dictionary_or_none()
    if dictionary is not None and intent in dictionary.intents:
        return float(dictionary.intents[intent].confidence_threshold)
    return float(_FALLBACK_THRESHOLDS.get(intent, 0.45))


def emergency_intents() -> frozenset[str]:
    dictionary = _dictionary_or_none()
    if dictionary is None:
        return _FALLBACK_EMERGENCY
    found = {iid for iid, d in dictionary.intents.items() if d.emergency}
    return frozenset(found) if found else _FALLBACK_EMERGENCY


# Back-compat module attributes (refreshed lazily via helpers preferred)
PRIORITY_RANK: dict[str, int] = dict(_FALLBACK_PRIORITY_RANK)
MESSAGE_TYPE_BY_INTENT: dict[str, str] = dict(_FALLBACK_MESSAGE_TYPE)
EMERGENCY_INTENTS = _FALLBACK_EMERGENCY


def refresh_catalog_caches() -> None:
    """Update module-level maps after dictionary reload."""
    global PRIORITY_RANK, MESSAGE_TYPE_BY_INTENT, EMERGENCY_INTENTS
    PRIORITY_RANK = priority_rank_map()
    MESSAGE_TYPE_BY_INTENT = message_type_map()
    EMERGENCY_INTENTS = emergency_intents()
