"""Tests for AI Assistant dual-lane accuracy + NL booking."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.services.ai.intents import detect_intent
from app.services.ai.safety import safety_block
from app.services.ai.workflow_nlu import (
    extract_date,
    extract_specialty,
    extract_time_hint,
    suggest_specialty_from_symptoms,
)


def test_intent_health_education_diabetes():
    d = detect_intent("What is diabetes?")
    assert d["intent"] == "health_education"
    assert d["suggested_tool"] == "health_education"


def test_intent_medicine_info_not_pharmacy():
    d = detect_intent("What is paracetamol used for?")
    assert d["intent"] == "medicine_info"
    assert d["suggested_tool"] == "medicine_info"


def test_intent_pharmacy_buy_still_works():
    d = detect_intent("Where can I buy Paracetamol?")
    assert d["intent"] == "find_pharmacy"


def test_intent_symptom_guidance():
    d = detect_intent("I have fever, body pain, and a sore throat. What could be the reason?")
    assert d["intent"] == "symptom_guidance"


def test_intent_wellness():
    d = detect_intent("I have been feeling stressed and unable to sleep properly.")
    assert d["intent"] == "wellness_info"


def test_intent_nl_booking_stomach_pain():
    d = detect_intent(
        "I have been having stomach pain for 3 days. I want to see a doctor tomorrow morning."
    )
    assert d["intent"] == "book_appointment"


def test_intent_view_vs_book_still_separated():
    assert detect_intent("Show my appointments")["intent"] == "view_appointments"
    assert detect_intent("Book an appointment")["intent"] == "book_appointment"


def test_symptom_maps_to_gp():
    assert suggest_specialty_from_symptoms("stomach pain for 3 days") == "General Physician"
    assert extract_specialty("stomach pain, want a doctor tomorrow") == "General Physician"


def test_nl_booking_extracts_date_and_morning():
    msg = "stomach pain for 3 days. see a doctor tomorrow morning"
    assert extract_date(msg) == (date.today() + timedelta(days=1)).isoformat()
    assert extract_time_hint(msg) == "morning"
    assert extract_specialty(msg) == "General Physician"


def test_urgency_chest_pain_still_blocks():
    blocked = safety_block("I have chest pain and difficulty breathing")
    assert blocked is not None
    assert blocked["safety"] == "urgency"


def test_education_ui_shape():
    from app.services.ai.rag import education_ui

    ui = education_ui(
        [{"title": "What is diabetes", "body": "Blood sugar stays high."}],
        suggested_specialty="General Physician",
    )
    assert ui["type"] == "education"
    assert ui["bullets"]
    assert any("General Physician" in (a.get("label") or "") for a in ui["actions"])


@pytest.mark.asyncio
async def test_medicine_info_tool_grounded_static(monkeypatch):
    from app.services.ai import tools as ai_tools

    async def fake_retrieve(q, **kwargs):
        assert "medicine_info" in (kwargs.get("categories") or [])
        return {
            "success": True,
            "documents": [
                {"title": "Paracetamol uses", "body": "Used for fever and mild pain.", "category": "medicine_info"}
            ],
            "grounded": True,
        }

    monkeypatch.setattr(ai_tools, "retrieve", fake_retrieve)
    result = await ai_tools._medicine_info({"message": "What is paracetamol used for?"})
    assert result["success"] is True
    assert result["grounded"] is True
    assert result["ui"]["type"] == "education"
    assert "fever" in result["answer"].lower() or "Paracetamol" in result["answer"]


@pytest.mark.asyncio
async def test_booking_flow_nl_specialty_from_symptoms(monkeypatch):
    from app.services.ai import gateway

    async def no_op(*_a, **_k):
        return None

    async def fake_tool(name, *_a, **_k):
        assert name == "search_doctors"
        return {"success": True, "doctors": [{"id": 1, "name": "Dr GP", "speciality": "General Physician"}]}

    monkeypatch.setattr(gateway.ai_memory, "save_context", no_op)
    monkeypatch.setattr(gateway, "execute_tool", fake_tool)

    result = await gateway._booking_flow(
        message="I have stomach pain for 3 days. I want to see a doctor tomorrow morning.",
        user_id=7,
        role="patient",
        hospital_id=None,
        session_id="t",
        context={"turns": [], "active_flow": None, "flow_data": {}},
        entities={},
    )
    assert result["tool"] == "search_doctors"
    assert result["ui"]["type"] == "doctors"
    assert "General Physician" in result["reply"] or "suitable" in result["reply"].lower()
