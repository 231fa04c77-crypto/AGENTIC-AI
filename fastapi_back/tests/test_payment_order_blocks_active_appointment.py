"""Active appointment policy: pre-pay block + self vs dependent booking."""
from __future__ import annotations

import pytest

from app.services.appointment_lifecycle_service import AppointmentPolicyError


@pytest.mark.asyncio
async def test_create_appointment_order_blocks_before_razorpay(monkeypatch):
    from app.controllers import payments_controller as pc

    monkeypatch.setattr(pc, "razorpay_client", object())
    monkeypatch.setattr(pc, "_require_client", lambda: None)

    async def boom(*_a, **_k):
        raise AppointmentPolicyError(
            "Please complete, cancel, or close your existing appointment "
            "before creating another one for yourself."
        )

    monkeypatch.setattr(
        "app.services.appointment_lifecycle_service.assert_can_book",
        boom,
    )

    result = await pc.create_appointment_order(
        7,
        {
            "doctor_id": "1",
            "amount": 50000,
            "appointment_date": "2026-07-25",
            "appointment_time": "10:00",
            "mode": "online",
            "actualPatient": {"isSelf": True, "phone": "9999999999"},
        },
    )

    assert result["success"] is False
    assert "existing appointment" in result["message"].lower()


@pytest.mark.asyncio
async def test_assert_can_book_allows_other_when_self_active(monkeypatch):
    from app.services import appointment_lifecycle_service as life

    monkeypatch.setattr(life, "lifecycle_enforced", lambda: True)

    async def no_trust(_uid):
        return None

    monkeypatch.setattr(
        "app.services.trust_score_service.assert_can_book",
        no_trust,
    )

    async def self_active(_uid):
        return 1

    async def no_dependent(**_k):
        return 0

    async def noop_heal(*_a, **_k):
        return "OK"

    monkeypatch.setattr(life, "count_active_self_for_user", self_active)
    monkeypatch.setattr(life, "count_active_by_patient", no_dependent)
    monkeypatch.setattr(life.db, "execute", noop_heal)

    # Self blocked
    with pytest.raises(AppointmentPolicyError):
        await life.assert_can_book(
            7, actual_patient={"isSelf": True, "name": "Me", "phone": "9000000000"}
        )

    # Other allowed while self has active visit
    await life.assert_can_book(
        7,
        actual_patient={
            "isSelf": False,
            "name": "Mother",
            "phone": "9000000000",
            "age": "55",
            "gender": "Female",
        },
    )
