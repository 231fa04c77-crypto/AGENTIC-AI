"""Phase 2 AI Assistant: Hindi/Telugu intents, family booking, labs, language."""
from __future__ import annotations

from app.services.ai.intents import detect_intent
from app.services.ai.language import detect_language
from app.services.ai.workflow_nlu import (
    build_actual_patient,
    extract_booking_relationship,
    is_confirm,
    match_saved_profile,
)


def test_detect_hindi_script():
    assert detect_language("मुझे डॉक्टर चाहिए") == "hi"


def test_detect_telugu_script():
    assert detect_language("నాకు డాక్టర్ కావాలి") == "te"


def test_detect_hindi_romanized():
    assert detect_language("mujhe bukhar hai doctor chahiye") == "hi"


def test_detect_telugu_romanized():
    assert detect_language("naku jwaram undi doctor kavali") == "te"


def test_intent_hindi_book():
    d = detect_intent("मुझे डॉक्टर चाहिए")
    assert d["intent"] == "book_appointment"


def test_intent_telugu_book():
    d = detect_intent("నాకు డాక్టర్ కావాలి")
    assert d["intent"] == "book_appointment"


def test_intent_hindi_roman_book():
    d = detect_intent("mujhe doctor dikhana hai")
    assert d["intent"] == "book_appointment"


def test_intent_telugu_roman_book():
    d = detect_intent("naku doctor appointment kavali")
    assert d["intent"] == "book_appointment"


def test_intent_explain_lab():
    d = detect_intent("Explain my lab report")
    assert d["intent"] == "explain_lab_report"
    assert d["suggested_tool"] == "explain_lab_report"


def test_family_relationship_mother():
    assert extract_booking_relationship("Book appointment for my mother") == "Mother"
    assert extract_booking_relationship("maa ke liye doctor") == "Mother"
    assert extract_booking_relationship("amma doctor") == "Mother"


def test_family_actual_patient_from_profile():
    profile = {
        "id": 7,
        "name": "Lakshmi",
        "age": 55,
        "gender": "Female",
        "relationship": "Mother",
        "phone": "99999",
    }
    ap = build_actual_patient(relationship="Mother", profile=profile, is_self=False)
    assert ap["isSelf"] is False
    assert ap["name"] == "Lakshmi"
    assert ap["savedProfileId"] == 7


def test_match_saved_profile_by_relationship():
    profiles = [
        {"id": 1, "name": "Ravi", "relationship": "Father"},
        {"id": 2, "name": "Lakshmi", "relationship": "Mother"},
    ]
    matched = match_saved_profile(profiles, relationship="Mother", message="")
    assert matched and matched["id"] == 2


def test_confirm_hindi_telugu():
    assert is_confirm("haan")
    assert is_confirm("avunu")
    assert is_confirm("हाँ")


def test_medicine_info_permissions_include_lab_explain():
    from app.services.ai.permissions import can_use_tool

    assert can_use_tool("patient", "explain_lab_report")
    assert can_use_tool("patient", "list_saved_profiles")
    assert can_use_tool("patient", "medicine_info")
