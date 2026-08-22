"""Cohere NLU / meaning-normalize golden tests (mocked LLM — no live key)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.ai.normalize_meaning import MeaningNormalizeResult, normalize_meaning
from app.services.ai.safety import safety_block
from app.services.ai.synonym import normalize_message


def test_cohere_provider_configuration(monkeypatch):
    from app.services.ai import provider

    monkeypatch.setattr(provider.settings, "AI_LLM_PROVIDER", "cohere")
    monkeypatch.setattr(provider.settings, "AI_LLM_MODEL", "command-r-plus")
    monkeypatch.setattr(provider.settings, "COHERE_API_KEY", "test-only-key")
    assert provider.provider_name() == "cohere"
    assert provider.model_name() == "command-r-plus"
    assert provider.is_configured() is True


def test_cohere_provider_not_configured_without_key(monkeypatch):
    from app.services.ai import provider

    monkeypatch.setattr(provider.settings, "AI_LLM_PROVIDER", "cohere")
    monkeypatch.setattr(provider.settings, "COHERE_API_KEY", "")
    assert provider.is_configured() is False


@pytest.mark.parametrize(
    "raw,expect_substr",
    [
        ("fevr", "Fever"),
        ("thala noppi", "Headache"),
        ("jwaram", "Fever"),
        ("doctor kavali", "Book Appointment"),
        ("stomak", "Stomach"),
    ],
)
def test_te_en_synonym_catalog(raw, expect_substr):
    out = normalize_message(raw)
    assert expect_substr.lower() in out.normalized_text.lower()


def test_safety_urgency_te_romanized():
    blocked = safety_block("gunde noppi severe")
    assert blocked is not None
    assert blocked["safety"] == "urgency"


def test_safety_fever_tablet_soft():
    blocked = safety_block("fever tablet?")
    assert blocked is not None
    assert blocked["safety"] == "clinical_soft"
    assert blocked.get("intent") == "medicine_info"


@pytest.mark.asyncio
async def test_normalize_meaning_uses_llm_json(monkeypatch):
    from app.services.ai import provider

    monkeypatch.setattr(provider, "is_enabled", lambda: True)

    async def fake_json(**_kwargs):
        return {
            "intent_hint": "symptom_guidance",
            "symptoms": ["fever"],
            "duration": None,
            "severity": None,
            "language_style": "te-en",
            "needs_clarification": False,
            "emergency_risk": False,
            "normalized_english": "I have fever",
        }

    monkeypatch.setattr(provider, "complete_json", fake_json)
    result = await normalize_meaning("naaku fever undi")
    assert result.source == "llm"
    assert result.normalized_english == "I have fever"
    assert result.intent_hint == "symptom_guidance"
    assert "fever" in [s.lower() for s in result.symptoms]


@pytest.mark.asyncio
async def test_normalize_meaning_fallback_without_llm(monkeypatch):
    from app.services.ai import provider

    monkeypatch.setattr(provider, "is_enabled", lambda: False)
    result = await normalize_meaning("fevr")
    assert result.source == "fallback"
    assert "fever" in result.normalized_english.lower() or "Fever" in result.normalized_english


@pytest.mark.asyncio
async def test_normalize_meaning_emergency_flag(monkeypatch):
    from app.services.ai import provider

    monkeypatch.setattr(provider, "is_enabled", lambda: True)

    async def fake_json(**_kwargs):
        return {
            "intent_hint": "emergency_help",
            "symptoms": ["chest pain"],
            "duration": None,
            "severity": "severe",
            "language_style": "en",
            "needs_clarification": False,
            "emergency_risk": True,
            "normalized_english": "I have severe chest pain",
        }

    monkeypatch.setattr(provider, "complete_json", fake_json)
    result = await normalize_meaning("chest pain bad")
    assert result.emergency_risk is True


@pytest.mark.asyncio
async def test_gateway_uses_normalized_english_for_intent(monkeypatch):
    from app.services.ai import gateway

    async def allow_rate(*_a, **_k):
        return True

    async def load_context(*_a, **_k):
        return {"turns": [], "active_flow": None, "flow_data": {}}

    async def no_op(*_a, **_k):
        return None

    async def fake_normalize(text, *, history=None):
        return MeaningNormalizeResult(
            intent_hint="symptom_guidance",
            symptoms=["fever"],
            normalized_english="I have fever",
            source="llm",
            raw_original=text or "",
        )

    async def fake_tool(name, args, **_k):
        assert "fever" in str(args.get("q") or "").lower()
        return {
            "success": True,
            "resultType": "education",
            "documents": [{"title": "Fever", "body": "General fever info."}],
            "answer": "General fever information.",
            "grounded": True,
        }

    monkeypatch.setattr(gateway, "is_enabled", lambda: True)
    monkeypatch.setattr(gateway.provider, "is_enabled", lambda: False)
    monkeypatch.setattr(gateway.ai_memory, "rate_limit_ok", allow_rate)
    monkeypatch.setattr(gateway.ai_memory, "load_context", load_context)
    monkeypatch.setattr(gateway.ai_memory, "save_context", no_op)
    monkeypatch.setattr(gateway.ai_metrics, "record_event", no_op)
    monkeypatch.setattr(gateway, "execute_tool", fake_tool)
    monkeypatch.setattr(
        "app.services.ai.normalize_meaning.normalize_meaning",
        fake_normalize,
    )

    result = await gateway.assistant_chat(
        message="naaku fever undi",
        role="patient",
        user_id=11,
    )
    assert result["success"] is True
    assert result.get("intent") in {"symptom_guidance", "health_education", "medicine_info"}


@pytest.mark.asyncio
async def test_gateway_emergency_from_normalize(monkeypatch):
    from app.services.ai import gateway

    async def allow_rate(*_a, **_k):
        return True

    async def load_context(*_a, **_k):
        return {"turns": [], "active_flow": None, "flow_data": {}}

    async def no_op(*_a, **_k):
        return None

    async def fake_normalize(text, *, history=None):
        return MeaningNormalizeResult(
            intent_hint="emergency_help",
            emergency_risk=True,
            normalized_english="I have chest pain",
            source="llm",
            raw_original=text or "",
        )

    async def fake_tool(name, *_a, **_k):
        assert name == "find_nearest_emergency_hospital"
        return {"success": True, "hospitals": []}

    monkeypatch.setattr(gateway, "is_enabled", lambda: True)
    monkeypatch.setattr(gateway.provider, "is_enabled", lambda: False)
    monkeypatch.setattr(gateway.ai_memory, "rate_limit_ok", allow_rate)
    monkeypatch.setattr(gateway.ai_memory, "load_context", load_context)
    monkeypatch.setattr(gateway.ai_memory, "save_context", no_op)
    monkeypatch.setattr(gateway.ai_metrics, "record_event", no_op)
    monkeypatch.setattr(gateway, "execute_tool", fake_tool)
    monkeypatch.setattr(
        "app.services.ai.normalize_meaning.normalize_meaning",
        fake_normalize,
    )

    result = await gateway.assistant_chat(
        message="gunde noppi bad",
        role="patient",
        user_id=12,
    )
    assert result["success"] is True
    assert result.get("safety") == "urgency" or result.get("intent") == "emergency_help"


@pytest.mark.asyncio
async def test_cohere_complete_v2_http(monkeypatch):
    from app.services.ai import provider

    monkeypatch.setattr(provider.settings, "AI_LLM_PROVIDER", "cohere")
    monkeypatch.setattr(provider.settings, "AI_LLM_MODEL", "command-r-plus")
    monkeypatch.setattr(provider.settings, "COHERE_API_KEY", "test-only-key")
    monkeypatch.setattr(provider.settings, "AI_LLM_BASE_URL", "")

    class _Resp:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "message": {
                    "role": "assistant",
                    "content": [{"type": "text", "text": "Hello from Cohere"}],
                },
                "usage": {"tokens": {"input_tokens": 3, "output_tokens": 4}},
            }

    def fake_post(*_a, **_k):
        return _Resp()

    with patch("httpx.post", fake_post):
        content, usage = provider._sync_cohere_complete(
            [{"role": "user", "content": "hi"}],
            temperature=0.2,
            max_tokens=40,
        )
    assert content == "Hello from Cohere"
    assert usage["promptTokens"] == 3
