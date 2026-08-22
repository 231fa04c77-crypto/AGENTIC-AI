"""Unit tests for Module 1 Intent Engine."""
from __future__ import annotations

from app.services.ai.intent import detect_intents, to_legacy_intent
from app.services.ai.intent.catalog import EMERGENCY_INTENTS


def test_book_appointment_tomorrow():
    r = detect_intents("Book appointment tomorrow")
    assert r.primary_intent == "book_appointment"
    assert r.message_type == "workflow"
    assert r.confidence[r.primary_intent] >= 0.7
    assert r.error is None


def test_cancel_booking():
    r = detect_intents("Cancel my booking")
    assert r.primary_intent == "cancel_appointment"


def test_need_dermatologist():
    r = detect_intents("Need dermatologist")
    assert r.primary_intent in {"search_specialist", "book_appointment"}


def test_search_medicine():
    r = detect_intents("Search medicine for fever")
    assert r.primary_intent in {"search_medicine", "medicine_information", "order_medicine"}


def test_what_is_diabetes():
    r = detect_intents("What is diabetes?")
    assert r.primary_intent == "disease_information"
    assert r.message_type == "education"


def test_greeting_hi():
    r = detect_intents("Hi")
    assert r.primary_intent == "greeting"
    assert r.message_type == "conversation"


def test_thank_you():
    r = detect_intents("Thank you")
    assert r.primary_intent == "thank_you"


def test_open_pharmacy():
    r = detect_intents("Open pharmacy")
    assert r.primary_intent == "open_pharmacy"
    assert r.message_type == "navigation"


def test_book_blood_test():
    r = detect_intents("Book blood test")
    assert r.primary_intent == "book_lab_test"


def test_chest_pain_emergency():
    r = detect_intents("I have chest pain")
    assert r.primary_intent in EMERGENCY_INTENTS
    assert r.message_type == "emergency"


def test_ambulance():
    r = detect_intents("Need ambulance")
    assert r.primary_intent == "ambulance"


def test_track_complaint():
    r = detect_intents("Track complaint")
    assert r.primary_intent == "track_complaint"
    assert r.message_type == "support"


def test_unknown_message():
    r = detect_intents("purple zebra quantum flute")
    assert r.primary_intent == "unknown_intent"
    assert r.requires_clarification is True


def test_mixed_intent_book_and_diabetes():
    r = detect_intents(
        "I want to book a dermatologist and also know what diabetes is."
    )
    assert r.primary_intent == "book_appointment"
    assert "disease_information" in r.secondary_intents
    assert r.confidence["book_appointment"] >= r.confidence.get(
        "disease_information", 0
    )


def test_emergency_beats_booking():
    r = detect_intents("I have chest pain and want to book tomorrow.")
    assert r.primary_intent in EMERGENCY_INTENTS
    assert "book_appointment" in r.secondary_intents or "book_appointment" in r.confidence


def test_typo_dermatologist():
    r = detect_intents("Need dermotologist")
    assert r.primary_intent in {"search_specialist", "book_appointment"}


def test_typo_paracetamol_medicine_info():
    r = detect_intents("What is paracetmol used for?")
    assert r.primary_intent == "medicine_information"


def test_abbreviation_cbc_lab():
    r = detect_intents("Book CBC")
    assert r.primary_intent == "book_lab_test"


def test_ambiguous_book_alone():
    r = detect_intents("Book.")
    assert r.requires_clarification is True


def test_ambiguous_doctor_alone():
    r = detect_intents("Doctor.")
    assert r.requires_clarification is True


def test_empty_input():
    r = detect_intents("")
    assert r.primary_intent == "unknown_intent"
    assert r.error is not None
    assert r.error.code == "empty_input"


def test_null_input():
    r = detect_intents(None)
    assert r.error is not None


def test_to_dict_shape():
    r = detect_intents("Hello")
    d = r.to_dict()
    assert "primary_intent" in d
    assert "secondary_intents" in d
    assert "confidence" in d
    assert "requires_clarification" in d
    assert "message_type" in d


def test_adapter_legacy_map():
    r = detect_intents("What is diabetes?")
    legacy = to_legacy_intent(r)
    assert legacy["intent"] == "health_education"
    assert legacy["source"] == "intent_engine_v2"
    assert legacy["v2_primary"] == "disease_information"


def test_view_reports():
    r = detect_intents("Show reports")
    assert r.primary_intent == "view_reports"


def test_goodbye():
    r = detect_intents("Good night")
    assert r.primary_intent == "goodbye"


def test_no_api_side_effects_fast():
    r = detect_intents("Book doctor tomorrow morning")
    assert r.processing_ms < 100
