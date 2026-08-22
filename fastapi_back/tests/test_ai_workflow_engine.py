"""Unit tests for Module 3 Workflow Engine / Tool Router."""
from __future__ import annotations

from datetime import date, timedelta

from app.services.ai.workflow import plan_from_handoff, plan_message


def test_booking_asks_specialty_when_missing():
    plan = plan_from_handoff(
        {
            "primary_intent": "book_appointment",
            "secondary_intents": [],
            "entities": {},
            "message_type": "workflow",
            "requires_clarification": True,
        },
        message="Book appointment",
    )
    assert plan.workflow == "book_appointment"
    assert plan.step == "await_specialty"
    assert plan.requires_clarification is True
    assert plan.proposed_tools == []


def test_booking_proposes_search_doctors_with_specialty_and_date():
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    out = plan_message(f"Book a dermatologist on {tomorrow}")
    plan = out["plan"]
    assert plan["workflow"] == "book_appointment"
    assert plan["step"] == "propose_search_doctors"
    assert plan["proposed_tools"][0]["name"] == "search_doctors"
    assert plan["proposed_tools"][0]["args"].get("q") == "Dermatologist"
    assert "doctors" in plan["never_invent"]
    assert plan["proposed_tools"][0]["needs_confirm"] is False


def test_booking_never_invents_slot_without_doctor_id():
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    plan = plan_from_handoff(
        {
            "primary_intent": "book_appointment",
            "entities": {"specialty": "Cardiologist", "date": tomorrow},
            "message_type": "workflow",
            "requires_clarification": False,
            "secondary_intents": [],
        },
        message="Book cardiologist tomorrow",
        flow_data={},
    )
    names = [t.name for t in plan.proposed_tools]
    assert "book_appointment" not in names
    assert "search_doctors" in names


def test_booking_confirm_only_when_facts_present():
    plan = plan_from_handoff(
        {
            "primary_intent": "book_appointment",
            "entities": {},
            "message_type": "workflow",
            "secondary_intents": [],
            "requires_clarification": False,
        },
        message="Yes",
        flow_data={
            "doctorId": 42,
            "doctorName": "Dr Test",
            "date": "2026-07-24",
            "slotTime": "10:00",
            "slotDate": "24_7_2026",
        },
    )
    assert plan.step == "await_confirm"
    assert plan.proposed_tools[0].name == "book_appointment"
    assert plan.proposed_tools[0].needs_confirm is True
    assert plan.proposed_tools[0].args["docId"] == 42


def test_emergency_priority_proposes_hospital_tool():
    out = plan_message("I have chest pain and want to book tomorrow")
    plan = out["plan"]
    assert plan["workflow"] == "emergency"
    assert plan["proposed_tools"][0]["name"] == "find_nearest_emergency_hospital"


def test_education_routes_to_health_education():
    out = plan_message("What is diabetes?")
    plan = out["plan"]
    assert plan["proposed_tools"][0]["name"] == "health_education"


def test_mixed_intent_keeps_secondary():
    out = plan_message(
        "I want to book a dermatologist tomorrow and also know what diabetes is."
    )
    plan = out["plan"]
    assert plan["workflow"] == "book_appointment"
    assert "disease_information" in plan["secondary_intents"]


def test_greeting_no_tools():
    out = plan_message("Hi")
    plan = out["plan"]
    assert plan["workflow"] == "none"
    assert plan["proposed_tools"] == []


def test_open_pharmacy_navigate():
    out = plan_message("Open pharmacy")
    plan = out["plan"]
    assert plan["proposed_tools"][0]["name"] == "navigate_app"
    assert plan["proposed_tools"][0]["args"].get("route") == "/pharmacy"


def test_cancel_lists_appointments_first():
    out = plan_message("Cancel my booking")
    plan = out["plan"]
    assert plan["workflow"] == "cancel_appointment"
    assert plan["proposed_tools"][0]["name"] == "list_my_appointments"
    assert plan["requires_clarification"] is True


def test_plan_does_not_execute_and_is_fast():
    out = plan_message("Book dermatologist tomorrow morning")
    assert out["plan"]["processing_ms"] < 100
    assert "analysis" in out
