"""Unit tests for Module 2 Entity Extraction."""
from __future__ import annotations

from datetime import date, timedelta

from app.services.ai.entity import analyze_message, extract_entities


def test_extract_specialty_and_date():
    r = extract_entities("Book a dermatologist tomorrow morning")
    assert r.entities.get("specialty") == "Dermatologist"
    assert r.entities.get("date") == (date.today() + timedelta(days=1)).isoformat()
    assert r.entities.get("time_hint") == "morning"
    assert r.error is None


def test_extract_medicine():
    r = extract_entities("What is paracetamol used for?")
    assert r.entities.get("medicine_name") == "paracetamol"


def test_extract_lab_cbc():
    r = extract_entities("Book CBC tomorrow")
    assert r.entities.get("lab_test") in {"cbc", "complete blood count"}
    assert r.entities.get("date")


def test_extract_relationship_mother():
    r = extract_entities("Book appointment for my mother tomorrow")
    assert r.entities.get("relationship") == "Mother"
    assert r.entities.get("booking_for_other") is True


def test_extract_disease():
    r = extract_entities("What is diabetes?")
    assert r.entities.get("disease_name") == "diabetes"


def test_symptom_suggests_specialty():
    r = extract_entities("I have stomach pain for 3 days")
    assert r.entities.get("specialty") == "General Physician"


def test_missing_booking_fields():
    r = extract_entities("I want to see a doctor")
    assert "date" in r.missing_for_booking


def test_empty_input():
    r = extract_entities("")
    assert r.error is not None
    assert r.error.code == "empty_input"


def test_analyze_message_compose():
    out = analyze_message(
        "I want to book a dermatologist tomorrow and also know what diabetes is."
    )
    assert out["intent"]["primary_intent"] == "book_appointment"
    assert "disease_information" in out["intent"]["secondary_intents"]
    assert out["entities"]["entities"].get("specialty") == "Dermatologist"
    assert out["entities"]["entities"].get("disease_name") == "diabetes"
    assert out["handoff"]["primary_intent"] == "book_appointment"


def test_doctor_name():
    r = extract_entities("Book with Dr Sharma tomorrow")
    assert r.entities.get("doctor_name")
    assert "Sharma" in str(r.entities.get("doctor_name"))


def test_mode_online():
    r = extract_entities("Book online dermatologist tomorrow")
    assert r.entities.get("mode") == "online"


def test_fast():
    r = extract_entities("Book cardiologist next Monday evening")
    assert r.processing_ms < 100
