"""Smoke tests for enterprise remediation (M13)."""
from __future__ import annotations


def test_pharmacy_status_transitions_closed_set():
    from app.models.pharmacy_order_model import TRANSITIONS, VALID_STATUSES

    assert "placed" in VALID_STATUSES
    assert "delivered" in VALID_STATUSES
    for src, dests in TRANSITIONS.items():
        assert src in VALID_STATUSES
        for d in dests:
            assert d in VALID_STATUSES


def test_slot_occupancy_excludes_followup_available():
    from app.services.slot_capacity_service import OCCUPYING_STATUSES

    assert "FOLLOWUP_AVAILABLE" not in OCCUPYING_STATUSES
    assert "BOOKED" in OCCUPYING_STATUSES or "CONFIRMED" in OCCUPYING_STATUSES


def test_openapi_title_medclues():
    from main import app

    assert "MedClues" in (app.title or "")
