"""Unit tests for Enterprise AI Assistant — intents, safety, permissions (no DB)."""
from __future__ import annotations

import pytest

from app.services.ai.intents import detect_intent
from app.services.ai.permissions import can_use_tool, tools_for_role
from app.services.ai.safety import safety_block


def test_intent_book_appointment():
    d = detect_intent("Book a dermatologist tomorrow")
    assert d["intent"] == "book_appointment"


def test_intent_pharmacy():
    d = detect_intent("Where can I buy Paracetamol?")
    assert d["intent"] == "find_pharmacy"


def test_intent_complaint():
    d = detect_intent("My medicine wasn't delivered")
    assert d["intent"] == "raise_complaint"


def test_intent_basic_conversation():
    assert detect_intent("Hi")["intent"] == "basic_conversation"


def test_intent_authenticated_profile():
    assert detect_intent("What is my name?")["intent"] == "get_my_profile"


def test_intent_today_appointments():
    assert (
        detect_intent("What appointments do I have today?")["intent"]
        == "get_today_appointments"
    )


def test_safety_refuse_diagnose():
    blocked = safety_block("Please diagnose what disease I have")
    assert blocked is not None
    assert blocked["safety"] == "clinical_refuse"


def test_safety_urgency():
    blocked = safety_block("I have severe chest pain")
    assert blocked is not None
    assert blocked["safety"] == "urgency"


def test_patient_cannot_analytics_tool():
    assert not can_use_tool("patient", "hospital_analytics_hint")
    assert can_use_tool("dean", "hospital_analytics_hint")


def test_mutating_confirm_catalog():
    names = {t["name"] for t in tools_for_role("patient")}
    assert "book_appointment" in names
    assert "search_doctors" in names
    assert "get_my_profile" in names
    assert "get_today_appointments" in names


def test_openai_provider_configuration(monkeypatch):
    from app.services.ai import provider

    monkeypatch.setattr(provider.settings, "AI_LLM_PROVIDER", "openai")
    monkeypatch.setattr(provider.settings, "AI_LLM_MODEL", "gpt-4.1-mini")
    monkeypatch.setattr(provider.settings, "OPENAI_API_KEY", "test-only-key")
    assert provider.provider_name() == "openai"
    assert provider.model_name() == "gpt-4.1-mini"
    assert provider.is_configured() is True


@pytest.mark.asyncio
async def test_gateway_profile_is_grounded(monkeypatch):
    from app.services.ai import gateway

    async def allow_rate(*_args, **_kwargs):
        return True

    async def load_context(*_args, **_kwargs):
        return {"turns": [], "active_flow": None, "flow_data": {}}

    async def no_op(*_args, **_kwargs):
        return None

    async def fake_tool(name, *_args, **_kwargs):
        assert name == "get_my_profile"
        return {
            "success": True,
            "resultType": "profile",
            "profile": {"id": 7, "name": "Asha"},
        }

    monkeypatch.setattr(gateway, "is_enabled", lambda: True)
    monkeypatch.setattr(gateway.provider, "is_enabled", lambda: False)
    monkeypatch.setattr(gateway.ai_memory, "rate_limit_ok", allow_rate)
    monkeypatch.setattr(gateway.ai_memory, "load_context", load_context)
    monkeypatch.setattr(gateway.ai_memory, "save_context", no_op)
    monkeypatch.setattr(gateway.ai_metrics, "record_event", no_op)
    monkeypatch.setattr(gateway, "execute_tool", fake_tool)

    result = await gateway.assistant_chat(
        message="What is my name?",
        role="patient",
        user_id=7,
    )
    assert result["success"] is True
    assert result["reply"] == "Your name is Asha."
    assert result["ui"]["type"] == "profile"


@pytest.mark.asyncio
async def test_booking_flow_requests_doctor_choice(monkeypatch):
    from app.services.ai import gateway

    async def no_op(*_args, **_kwargs):
        return None

    async def fake_tool(name, *_args, **_kwargs):
        assert name == "search_doctors"
        return {
            "success": True,
            "doctors": [
                {"id": 4, "name": "Dr Rao", "speciality": "Dermatology"}
            ],
        }

    monkeypatch.setattr(gateway.ai_memory, "save_context", no_op)
    monkeypatch.setattr(gateway, "execute_tool", fake_tool)
    result = await gateway._booking_flow(
        message="Book a dermatologist tomorrow",
        user_id=7,
        role="patient",
        hospital_id=None,
        session_id="test",
        context={"turns": [], "active_flow": None, "flow_data": {}},
        entities={},
    )
    assert result["ui"]["type"] == "doctors"
    assert result["ui"]["items"][0]["name"] == "Dr Rao"
    assert result["tool"] == "search_doctors"


@pytest.mark.asyncio
async def test_booking_flow_accepts_typed_confirmation(monkeypatch):
    from app.services.ai import gateway

    called = {}

    async def no_op(*_args, **_kwargs):
        return None

    async def fake_tool(name, args, **kwargs):
        called.update(name=name, args=args, confirm=kwargs.get("confirm"))
        return {
            "success": True,
            "appointmentId": 101,
            "bookingId": "BK-101",
            "tokenNumber": 3,
        }

    monkeypatch.setattr(gateway.ai_memory, "clear_flow", no_op)
    monkeypatch.setattr(gateway, "execute_tool", fake_tool)
    result = await gateway._booking_flow(
        message="Yes, please!",
        user_id=7,
        role="patient",
        hospital_id=None,
        session_id="test",
        context={
            "turns": [],
            "active_flow": "book_appointment",
            "flow_data": {
                "specialty": "Dermatologist",
                "doctorId": 4,
                "doctorName": "Dr Rao",
                "date": "2026-07-22",
                "slotTime": "10:00",
                "proposedArgs": {
                    "docId": 4,
                    "slotDate": "22_07_2026",
                    "slotTime": "10:00",
                },
            },
        },
        entities={},
    )
    assert called == {
        "name": "book_appointment",
        "args": {
            "docId": 4,
            "slotDate": "22_07_2026",
            "slotTime": "10:00",
        },
        "confirm": True,
    }
    assert result["success"] is True
    assert result["ui"]["type"] == "bookingReceipt"


@pytest.mark.asyncio
async def test_cancel_flow_lists_appointments(monkeypatch):
    from app.services.ai import flows

    async def no_op(*_args, **_kwargs):
        return None

    async def fake_tool(name, *_args, **_kwargs):
        assert name == "list_my_appointments"
        return {
            "success": True,
            "appointments": [
                {
                    "id": 9,
                    "slotDate": "22_07_2026",
                    "slotTime": "10:00",
                    "cancelled": False,
                    "isCompleted": False,
                    "docData": {"name": "Dr Rao"},
                }
            ],
        }

    monkeypatch.setattr(flows.ai_memory, "save_context", no_op)
    monkeypatch.setattr(flows, "execute_tool", fake_tool)
    result = await flows.cancel_flow(
        message="Cancel my appointment",
        user_id=7,
        role="patient",
        hospital_id=None,
        session_id="test",
        context={"turns": [], "active_flow": None, "flow_data": {}},
    )
    assert result["ui"]["type"] == "appointments"
    assert result["ui"]["items"][0]["id"] == 9


def test_navigation_intent():
    assert detect_intent("Open Pharmacy")["intent"] == "navigation_help"
    assert detect_intent("Open Pharmacy")["suggested_tool"] == "navigate_app"


def test_intent_view_vs_book_appointments():
    assert detect_intent("Show my appointments")["intent"] == "view_appointments"
    assert detect_intent("What appointments do I have?")["intent"] == "view_appointments"
    assert detect_intent("Book an appointment")["intent"] == "book_appointment"
    assert detect_intent("I need a doctor")["intent"] == "book_appointment"


def test_intent_continues_booking_flow_for_followups():
    ctx = {"active_flow": "book_appointment", "flow_data": {"specialty": "Dermatologist"}}
    assert detect_intent("Tomorrow", context=ctx)["intent"] == "book_appointment"
    assert detect_intent("Yes", context=ctx)["intent"] == "book_appointment"
    assert detect_intent("Proceed", context=ctx)["intent"] == "book_appointment"
    assert detect_intent("5 PM", context=ctx)["intent"] == "book_appointment"
    # Explicit switch to viewing appointments escapes booking
    assert detect_intent("Show my appointments", context=ctx)["intent"] == "view_appointments"


def test_workflow_nlu_dates_and_ordinals():
    from datetime import date, timedelta

    from app.services.ai import workflow_nlu as nlu

    assert nlu.extract_date("tomorrow") == (date.today() + timedelta(days=1)).isoformat()
    assert nlu.extract_date("day after tomorrow") == (date.today() + timedelta(days=2)).isoformat()
    assert nlu.extract_date("24 July 2026") == "2026-07-24"
    assert nlu.is_confirm("Yes")
    assert nlu.is_confirm("Proceed")
    assert nlu.is_confirm("Confirm")
    doctors = [{"id": 1, "name": "Dr A"}, {"id": 2, "name": "Dr B"}]
    assert nlu.pick_option("book first doctor", doctors, "name")["id"] == 1
    assert nlu.pick_option("second", doctors, "name")["id"] == 2
    slots = [
        {"label": "Morning OPD", "displayTime": "10:00 AM - 1:00 PM", "slot_type": "morning_opd"},
        {"label": "Evening OPD", "displayTime": "6:00 PM - 9:00 PM", "slot_type": "evening_opd"},
    ]
    assert nlu.pick_option("morning", slots, "label")["slot_type"] == "morning_opd"
    assert nlu.pick_option("evening appointment", slots, "label")["slot_type"] == "evening_opd"
    assert nlu.extract_specialty("Dermatologist") == "Dermatologist"


@pytest.mark.asyncio
async def test_memory_fallback_retains_workflow(monkeypatch):
    from app.services.ai import memory as ai_memory

    # Force Redis path to fail silently and use local store
    async def boom():
        raise RuntimeError("no redis")

    monkeypatch.setattr("app.services.redis_client.get_redis", boom, raising=False)
    try:
        import app.services.redis_client as rc

        async def fail_get():
            raise RuntimeError("no redis")

        monkeypatch.setattr(rc, "get_redis", fail_get)
    except Exception:
        pass

    await ai_memory.save_context(
        42,
        "sess-wf",
        turn={"role": "user", "intent": "book_appointment", "text": "Book"},
        active_flow="book_appointment",
        flow_data={"specialty": "Dermatologist", "step": "await_date"},
    )
    ctx = await ai_memory.load_context(42, "sess-wf")
    assert ctx["active_flow"] == "book_appointment"
    assert ctx["flow_data"]["specialty"] == "Dermatologist"


@pytest.mark.asyncio
async def test_booking_flow_ordinal_doctor_then_slot(monkeypatch):
    from app.services.ai import gateway

    async def no_op(*_args, **_kwargs):
        return None

    calls = []

    async def fake_tool(name, args=None, **kwargs):
        calls.append(name)
        if name == "get_doctor_slots":
            return {
                "success": True,
                "availableSlots": [
                    {
                        "date": "23_07_2026",
                        "isoDate": "2026-07-23",
                        "displayDate": "23 Jul 2026",
                        "slots": [
                            {
                                "date": "23_07_2026",
                                "isoDate": "2026-07-23",
                                "time": "Morning OPD",
                                "displayTime": "10:00 AM - 1:00 PM",
                                "label": "Morning OPD",
                                "slot_type": "morning_opd",
                                "slotId": 501,
                                "mode": "offline",
                            },
                            {
                                "date": "23_07_2026",
                                "isoDate": "2026-07-23",
                                "time": "Evening OPD",
                                "displayTime": "6:00 PM - 9:00 PM",
                                "label": "Evening OPD",
                                "slot_type": "evening_opd",
                                "slotId": 502,
                                "mode": "offline",
                            },
                        ],
                    }
                ],
            }
        raise AssertionError(f"unexpected tool {name}")

    monkeypatch.setattr(gateway.ai_memory, "save_context", no_op)
    monkeypatch.setattr(gateway, "execute_tool", fake_tool)

    # Step: pick first doctor from candidates
    mid = await gateway._booking_flow(
        message="Book first doctor",
        user_id=7,
        role="patient",
        hospital_id=None,
        session_id="test",
        context={
            "turns": [],
            "active_flow": "book_appointment",
            "flow_data": {
                "specialty": "Dermatologist",
                "date": "2026-07-23",
                "doctorCandidates": [
                    {"id": 4, "name": "Dr Rao"},
                    {"id": 5, "name": "Dr Mehta"},
                ],
            },
        },
        entities={},
    )
    assert mid["step"] == "await_slot"
    assert mid["ui"]["type"] == "slots"
    assert "get_doctor_slots" in calls

    # Step: pick evening slot
    saved = {
        "specialty": "Dermatologist",
        "date": "2026-07-23",
        "doctorId": 4,
        "doctorName": "Dr Rao",
        "slotCandidates": mid["ui"]["items"],
    }
    confirm_step = await gateway._booking_flow(
        message="Evening",
        user_id=7,
        role="patient",
        hospital_id=None,
        session_id="test",
        context={"turns": [], "active_flow": "book_appointment", "flow_data": saved},
        entities={},
    )
    assert confirm_step["step"] == "await_confirm"
    assert confirm_step["ui"]["type"] == "confirmation"
    assert confirm_step["ui"]["args"]["slotId"] == 502

