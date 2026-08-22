from datetime import date, timedelta

from app.services.patient_journey_service import (
    _consultation_label,
    _followup_label,
    _investigation_labels,
    _pharmacy_label,
    _referral_labels,
    finding_still_valid,
    _journey_status,
    _dedupe_findings,
)


def test_consultation_completed_from_flag():
    assert _consultation_label({"is_completed": True}) == "COMPLETED"


def test_investigation_report_pending_review():
    inv, report = _investigation_labels({"status": "REPORT_AVAILABLE", "report_review_status": "PENDING"})
    assert inv == "COMPLETED"
    assert report == "PENDING_REVIEW"
    inv2, report2 = _investigation_labels({"status": "REPORT_AVAILABLE", "report_review_status": "REVIEWED"})
    assert report2 == "REVIEWED"


def test_investigation_ordered_and_in_progress():
    inv, report = _investigation_labels({"status": "ORDERED"})
    assert inv == "ORDERED"
    inv2, _ = _investigation_labels({"status": "ACCEPTED"})
    assert inv2 == "IN_PROGRESS"


def test_referral_appointment_pending_without_date():
    ref, spec = _referral_labels({"status": "ACCEPTED"})
    assert spec == "APPOINTMENT_PENDING"
    ref2, spec2 = _referral_labels({"status": "ACCEPTED", "appointment_date": "2026-08-23T10:00:00"})
    assert spec2 == "SCHEDULED"


def test_followup_upcoming_tomorrow():
    tomorrow = date.today() + timedelta(days=1)
    assert _followup_label({"status": "SCHEDULED", "due_date": tomorrow}, today=date.today()) == "UPCOMING"


def test_report_review_pending_requires_live_db_state():
    finding = {"finding_type": "REPORT_REVIEW_PENDING"}
    assert finding_still_valid(finding, {"status": "REPORT_AVAILABLE", "report_review_status": "PENDING"}) is True
    assert finding_still_valid(finding, {"status": "REPORT_AVAILABLE", "report_review_status": "REVIEWED"}) is False


def test_referral_finding_resolves_when_booked():
    finding = {"finding_type": "REFERRAL_APPOINTMENT_PENDING"}
    assert finding_still_valid(finding, {"status": "ACCEPTED"}) is True
    assert finding_still_valid(finding, {"status": "APPOINTMENT_BOOKED", "appointment_date": "x"}) is False


def test_journey_attention_when_report_pending():
    journey = {
        "consultation": "COMPLETED",
        "investigation": "COMPLETED",
        "report": "PENDING_REVIEW",
        "referral": "ACCEPTED",
        "specialist_appointment": "APPOINTMENT_PENDING",
        "followup": "UPCOMING",
    }
    findings = [{"priority": "HIGH", "message": "report"}]
    assert _journey_status(journey, findings) == "ATTENTION_REQUIRED"
    assert _journey_status(journey, []) == "ATTENTION_REQUIRED"
    assert _journey_status({**journey, "report": "REVIEWED", "specialist_appointment": "CONFIRMED", "followup": "COMPLETED"}, []) == "ON_TRACK"


def test_dedupe_findings_by_type_and_entity():
    rows = [
        {"finding_type": "REPORT_REVIEW_PENDING", "entity_type": "investigation", "entity_id": 1, "message": "a"},
        {"finding_type": "REPORT_REVIEW_PENDING", "entity_type": "investigation", "entity_id": 1, "message": "b"},
        {"finding_type": "FOLLOWUP_UPCOMING", "entity_type": "followup", "entity_id": 2, "message": "c"},
    ]
    out = _dedupe_findings(rows)
    assert len(out) == 2


def test_pharmacy_label_stages():
    assert _pharmacy_label({"status": "placed"}) == "ORDERED"
    assert _pharmacy_label({"status": "billed"}) == "PAYMENT_PENDING"
    assert _pharmacy_label({"status": "ready"}) == "READY"
    assert _pharmacy_label({"status": "delivered"}) == "DELIVERED"


def test_investigation_pending_still_valid():
    finding = {"finding_type": "INVESTIGATION_PENDING", "entity_type": "investigation"}
    assert finding_still_valid(finding, {"status": "ORDERED"}) is True
    assert finding_still_valid(finding, {"status": "REPORT_AVAILABLE"}) is False


def test_referral_no_specialist_still_valid():
    finding = {"finding_type": "REFERRAL_NO_SPECIALIST", "entity_type": "referral"}
    assert finding_still_valid(finding, {"status": "CREATED", "assigned_to": None}) is True
    assert finding_still_valid(finding, {"status": "ACCEPTED", "assigned_to": 42}) is False


def test_pharmacy_payment_pending_still_valid():
    finding = {"finding_type": "PHARMACY_PAYMENT_PENDING", "entity_type": "pharmacy"}
    assert finding_still_valid(finding, {"status": "billed"}) is True
    assert finding_still_valid(finding, {"status": "paid"}) is False


def test_appointment_awaiting_confirmation_still_valid():
    finding = {"finding_type": "APPOINTMENT_AWAITING_CONFIRMATION", "entity_type": "appointment"}
    assert finding_still_valid(finding, {"lifecycle_status": "BOOKED", "is_completed": False}) is True
    assert finding_still_valid(finding, {"lifecycle_status": "CONFIRMED", "is_completed": False}) is False
