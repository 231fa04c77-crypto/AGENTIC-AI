"""Unit tests for Health Protection score, recommend ranking, eligibility, risk."""
from __future__ import annotations

import pytest

from app.services.health_protection_service import (
    HPError,
    check_eligibility,
    compare_plans,
    compute_medical_risk,
    compute_score_from_signals,
    _rank_plans,
)


def test_score_full_signals():
    score, factors, suggestions = compute_score_from_signals(
        {
            "hasInsurance": True,
            "hasEmergencyContact": True,
            "hasBloodGroup": True,
            "hasMedicalRecords": True,
            "hasVaccination": True,
            "hasAnnualCheckup": True,
            "hasFamilyCoverage": True,
            "hasCriticalIllness": True,
        }
    )
    assert score == 100
    assert not suggestions


def test_score_empty_has_suggestions():
    score, factors, suggestions = compute_score_from_signals({})
    assert score == 0
    assert len(suggestions) >= 5


def test_rank_plans_respects_budget():
    plans = [
        {
            "id": 1,
            "name": "Cheap",
            "monthlyPremium": 500,
            "coverageAmount": 300000,
            "cashlessHospitals": 5000,
            "pedWaitingDays": 48,
            "maternity": False,
            "criticalIllness": False,
            "pros": [],
            "cons": [],
        },
        {
            "id": 2,
            "name": "Premium",
            "monthlyPremium": 5000,
            "coverageAmount": 2000000,
            "cashlessHospitals": 12000,
            "pedWaitingDays": 24,
            "maternity": True,
            "criticalIllness": True,
            "pros": [],
            "cons": [],
        },
    ]
    top = _rank_plans(plans, {"budget": 800, "familyMembers": 1})
    assert top[0]["name"] == "Cheap"
    assert "aiRecommendationScore" in top[0]


@pytest.mark.asyncio
async def test_compare_requires_two_plans():
    with pytest.raises(HPError) as exc:
        await compare_plans({"planIds": [1]})
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_eligibility_student():
    res = await check_eligibility({"age": 20, "student": True, "monthlyIncome": 5000, "state": "TS"})
    schemes = {r["scheme"]: r["eligible"] for r in res["data"]["results"]}
    assert schemes["Student Insurance"] is True


def test_medical_risk_high_for_smoker_elderly():
    result = compute_medical_risk(
        {
            "age": 55,
            "bmi": 32,
            "bloodPressure": "high",
            "sugar": "diabetic",
            "familyHistory": True,
            "smoking": True,
            "exercise": "none",
            "sleepHours": 5,
        }
    )
    assert result["level"] == "High"
    assert result["score"] >= 60
