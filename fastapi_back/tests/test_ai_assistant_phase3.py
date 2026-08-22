"""Phase 3: softer safety, phrasing helper, knowledge expand, language/TTS helpers."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.ai.language import detect_language
from app.services.ai.rag.retriever import education_ui, format_answer
from app.services.ai.safety import clinical_soft_redirect, safety_block


def test_soft_medicine_not_dead_end():
    blocked = safety_block("What medicine should I take for fever?")
    assert blocked is not None
    assert blocked.get("softRedirect") is True
    assert blocked["safety"] == "clinical_soft"
    assert blocked["suggested_tool"] == "medicine_info"
    assert "reply" not in blocked or not blocked.get("reply")  # gateway runs tool


def test_soft_redirect_helper():
    soft = clinical_soft_redirect("what should I take for fever")
    assert soft and soft["softRedirect"] is True


def test_hard_diagnose_still_refuses():
    blocked = safety_block("Please diagnose what disease I have")
    assert blocked is not None
    assert blocked["safety"] == "clinical_refuse"
    assert blocked.get("actions")


def test_urgency_unchanged():
    blocked = safety_block("I have chest pain and difficulty breathing")
    assert blocked is not None
    assert blocked["safety"] == "urgency"


def test_weak_retrieval_answer_has_ctas():
    text = format_answer([])
    assert "book" in text.lower() or "Medical Community" in text
    ui = education_ui([], suggested_specialty="General Physician")
    assert ui["weakRetrieval"] is True
    assert any("Book" in (a.get("label") or "") for a in ui["actions"])


def test_seed_titles_in_migration_050():
    from pathlib import Path

    sql = Path(__file__).resolve().parents[1] / "migrations" / "050_ai_education_knowledge_expand.sql"
    body = sql.read_text(encoding="utf-8")
    assert "Dengue overview" in body
    assert "What is anemia" in body
    assert "Fever overview" in body
    assert "CBC report basics" in body


@pytest.mark.asyncio
async def test_phrase_reply_uses_llm_when_enabled():
    from app.services.ai.gateway import _phrase_reply

    fake = AsyncMock()
    fake.success = True
    fake.content = (
        "Please confirm Dr Sharma on 2026-07-24 at 5:00 PM. Reply Yes to proceed."
    )

    with (
        patch("app.services.ai.gateway.provider.is_enabled", return_value=True),
        patch("app.services.ai.gateway.provider.complete_text", new=AsyncMock(return_value=fake)),
    ):
        out = await _phrase_reply(
            "Please confirm: Dr Sharma on 2026-07-24 at 5:00 PM. Reply Yes to proceed.",
            message="book it",
            history=[],
            grounding={"doctor": "Dr Sharma", "time": "5:00 PM"},
            language="en",
        )
    assert "Dr Sharma" in out
    assert "5:00 PM" in out
    assert out != "Please confirm: Dr Sharma on 2026-07-24 at 5:00 PM. Reply Yes to proceed."


@pytest.mark.asyncio
async def test_phrase_reply_falls_back_when_llm_off():
    from app.services.ai.gateway import _phrase_reply

    template = "Which specialty or type of doctor would you like to book?"
    with patch("app.services.ai.gateway.provider.is_enabled", return_value=False):
        out = await _phrase_reply(
            template,
            message="book doctor",
            history=[],
            grounding={},
            language="en",
        )
    assert out == template


def test_language_for_tts_mapping():
    assert detect_language("मुझे बुखार है") == "hi"
    assert detect_language("నాకు జ్వరం ఉంది") == "te"
