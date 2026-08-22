"""Tests for MISSED → tomorrow-only reschedule → EOD auto-cancel."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.services import appointment_lifecycle_service as life
from app.services import no_show_scheduler as scheduler


IST = ZoneInfo("Asia/Kolkata")


def test_missed_transitions_allowed():
    assert life.can_transition("BOOKED", "MISSED")
    assert life.can_transition("CONFIRMED", "MISSED")
    assert life.can_transition("RESCHEDULED_ONCE", "MISSED")
    assert life.can_transition("MISSED", "RESCHEDULED_ONCE")
    assert life.can_transition("MISSED", "CANCELLED")
    assert not life.can_transition("MISSED", "NO_SHOW")
    assert "MISSED" in life.BLOCKING_STATUSES
    assert "MISSED" not in life.TERMINAL_STATUSES
    assert life._legacy_status_for("MISSED") == "missed"


def test_slot_has_ended_by_time():
    past = datetime.now(IST).replace(tzinfo=None) - timedelta(hours=2)
    apt = {
        "slot_date": past.strftime("%d_%m_%Y"),
        "slot_time": past.strftime("%H:%M"),
    }
    assert scheduler._slot_has_ended(apt, datetime.now(IST)) is True


def test_slot_has_ended_by_calendar_day():
    yesterday = date.today() - timedelta(days=1)
    apt = {
        "slot_date": yesterday.strftime("%d_%m_%Y"),
        "slot_time": "",
    }
    assert scheduler._slot_has_ended(apt, datetime.now(IST)) is True


def test_slot_not_ended_future():
    future = datetime.now(IST).replace(tzinfo=None) + timedelta(hours=3)
    apt = {
        "slot_date": future.strftime("%d_%m_%Y"),
        "slot_time": future.strftime("%H:%M"),
    }
    assert scheduler._slot_has_ended(apt, datetime.now(IST)) is False


def test_lifecycle_payload_can_confirm_flag():
    today = datetime.now(IST).date()
    payload = life.lifecycle_payload(
        {
            "lifecycle_status": "MISSED",
            "tomorrow_reschedule_offered": True,
            "tomorrow_reschedule_deadline": today,
            "cancelled": False,
            "is_completed": False,
        }
    )
    assert payload["lifecycleStatus"] == "MISSED"
    assert payload["canConfirmTomorrowReschedule"] is True
    assert payload["tomorrowRescheduleOffered"] is True


def test_lifecycle_payload_deadline_expired():
    yesterday = datetime.now(IST).date() - timedelta(days=1)
    payload = life.lifecycle_payload(
        {
            "lifecycle_status": "MISSED",
            "tomorrow_reschedule_offered": True,
            "tomorrow_reschedule_deadline": yesterday,
            "cancelled": False,
            "is_completed": False,
        }
    )
    assert payload["canConfirmTomorrowReschedule"] is False


@pytest.mark.asyncio
async def test_confirm_rejects_non_tomorrow(monkeypatch):
    from app.controllers import lifecycle_controller

    today = datetime.now(IST).date()
    tomorrow = today + timedelta(days=1)
    day_after = tomorrow + timedelta(days=1)

    async def fake_get(_id):
        return {
            "id": 1,
            "user_id": 7,
            "cancelled": False,
            "is_completed": False,
            "lifecycle_status": "MISSED",
            "tomorrow_reschedule_offered": True,
            "tomorrow_reschedule_deadline": today,
            "doctor_id": 4,
            "slot_time": "10:00",
            "mode": "offline",
            "doctor_data": {"name": "Dr Rao"},
        }

    monkeypatch.setattr(
        lifecycle_controller.appointment_model,
        "get_appointment_by_id",
        fake_get,
    )

    result = await lifecycle_controller.confirm_tomorrow_reschedule(
        7, 1, requested_date=day_after.isoformat()
    )
    assert result["success"] is False
    assert "tomorrow" in result["message"].lower()


@pytest.mark.asyncio
async def test_confirm_rejects_when_not_missed(monkeypatch):
    from app.controllers import lifecycle_controller

    async def fake_get(_id):
        return {
            "id": 1,
            "user_id": 7,
            "cancelled": False,
            "is_completed": False,
            "lifecycle_status": "BOOKED",
            "tomorrow_reschedule_offered": False,
            "doctor_id": 4,
        }

    monkeypatch.setattr(
        lifecycle_controller.appointment_model,
        "get_appointment_by_id",
        fake_get,
    )
    result = await lifecycle_controller.confirm_tomorrow_reschedule(7, 1)
    assert result["success"] is False
    assert "missed" in result["message"].lower()


@pytest.mark.asyncio
async def test_confirm_rejects_after_deadline(monkeypatch):
    from app.controllers import lifecycle_controller

    yesterday = datetime.now(IST).date() - timedelta(days=1)

    async def fake_get(_id):
        return {
            "id": 1,
            "user_id": 7,
            "cancelled": False,
            "is_completed": False,
            "lifecycle_status": "MISSED",
            "tomorrow_reschedule_offered": True,
            "tomorrow_reschedule_deadline": yesterday,
            "doctor_id": 4,
        }

    monkeypatch.setattr(
        lifecycle_controller.appointment_model,
        "get_appointment_by_id",
        fake_get,
    )
    result = await lifecycle_controller.confirm_tomorrow_reschedule(7, 1)
    assert result["success"] is False
    assert "expired" in result["message"].lower()


@pytest.mark.asyncio
async def test_mark_appointment_missed_sets_offer(monkeypatch):
    calls = {}

    async def fake_transition(apt_id, status, **kwargs):
        calls["status"] = status
        calls["extra"] = kwargs.get("extra_fields") or {}
        return {"id": apt_id, "lifecycle_status": status}

    async def fake_notify(*_a, **_k):
        calls["notified"] = True

    monkeypatch.setattr(scheduler.appointment_lifecycle_service, "transition", fake_transition)
    monkeypatch.setattr(scheduler.fcm_service, "notify_missed_tomorrow_offer", fake_notify)

    apt = {
        "id": 9,
        "user_id": 3,
        "doctor_data": {"name": "Dr Mehta"},
        "slot_date": "01_01_2020",
        "slot_time": "10:00",
    }
    ok = await scheduler.mark_appointment_missed(apt)
    assert ok is True
    assert calls["status"] == "MISSED"
    assert calls["extra"].get("tomorrow_reschedule_offered") is True
    assert calls["extra"].get("tomorrow_reschedule_deadline") == datetime.now(IST).date()
    assert calls.get("notified") is True


@pytest.mark.asyncio
async def test_process_expired_missed_offers_cancels(monkeypatch):
    yesterday = datetime.now(IST).date() - timedelta(days=1)
    transitions = []

    async def fake_query(*_a, **_k):
        return [
            {
                "id": 11,
                "user_id": 5,
                "lifecycle_status": "MISSED",
                "tomorrow_reschedule_deadline": yesterday,
                "doctor_data": {"name": "Dr Rao"},
                "slot_id": None,
            }
        ]

    async def fake_transition(apt_id, status, **kwargs):
        transitions.append(status)
        return {"id": apt_id}

    async def fake_notify(*_a, **_k):
        return None

    async def fake_release(_apt):
        return None

    monkeypatch.setattr(scheduler.db, "query", fake_query)
    monkeypatch.setattr(scheduler.appointment_lifecycle_service, "transition", fake_transition)
    monkeypatch.setattr(scheduler.fcm_service, "notify_missed_offer_expired", fake_notify)
    monkeypatch.setattr(
        "app.services.doctor_slot_service.release_slot_for_appointment",
        fake_release,
    )

    count = await scheduler.process_expired_missed_offers()
    assert count == 1
    assert transitions == ["CANCELLED", "CLOSED"]
