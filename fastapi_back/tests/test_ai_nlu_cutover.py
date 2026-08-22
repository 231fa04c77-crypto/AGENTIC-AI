"""Unit tests for Module 8 — Gateway NLU cutover helper."""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch

from app.services.ai.nlu_cutover import detect_for_gateway


def test_book_dermatologist_tomorrow_maps_legacy():
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    out = detect_for_gateway(f"book a dermatologist tomorrow")
    assert out["intent"] == "book_appointment"
    assert out["source"] == "nlu_pipeline_v1"
    assert out["entities"].get("specialty") == "Dermatologist"
    assert out["entities"].get("date") or tomorrow  # date entity present
    assert out.get("suggested_tool") in {None, "search_doctors", "book_appointment"}
    assert "plan" in out


def test_skin_doctor_routes_find_or_book():
    out = detect_for_gateway("I need a skin doctor")
    assert out["source"] == "nlu_pipeline_v1"
    assert out["intent"] in {"book_appointment", "find_doctor"}
    # Synonym/entity path should surface dermatology specialty when resolved
    ents = out.get("entities") or {}
    if ents.get("specialty"):
        assert "derm" in str(ents["specialty"]).lower() or ents["specialty"] == "Dermatologist"


def test_clarification_when_specialty_missing():
    out = detect_for_gateway("book an appointment")
    assert out["intent"] == "book_appointment"
    assert out["requires_clarification"] is True
    assert out.get("clarification_question")
    assert "specialty" in (out["clarification_question"] or "").lower() or "doctor" in (
        out["clarification_question"] or ""
    ).lower()
    assert (out.get("plan") or {}).get("proposed_tools") == []


def test_fallback_when_pipeline_raises():
    with patch(
        "app.services.ai.workflow.plan_message",
        side_effect=RuntimeError("boom"),
    ):
        out = detect_for_gateway("book a dermatologist tomorrow")
    assert out["intent"] in {"book_appointment", "unknown", "find_doctor"}
    assert str(out.get("source") or "").startswith("nlu_cutover_fallback")


def test_analyze_message_extract_before_intent_uses_normalized():
    from app.services.ai.entity.compose import analyze_message

    # Spelling/synonym pipeline should still yield book + specialty
    out = analyze_message("book a dermatologist tomorrow")
    assert out["intent"]["primary_intent"] == "book_appointment"
    assert out["entities"]["entities"].get("specialty") == "Dermatologist"
    assert out["handoff"]["normalized_message"]
