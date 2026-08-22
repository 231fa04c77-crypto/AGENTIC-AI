"""Unit tests for Medicine Information (openFDA) module.

Run from fastapi_back:
  python -m pytest tests/test_medicine_api.py -q
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.openfda_service import (
    OpenFDAError,
    OpenFDAService,
    map_card,
    map_details,
    _escape_search_term,
)
from app.services import medicine_service


SAMPLE_LABEL = {
    "set_id": "abc-123",
    "id": "label-1",
    "purpose": ["Pain reliever"],
    "indications_and_usage": ["For temporary relief of minor aches"],
    "warnings": ["Do not exceed recommended dose"],
    "boxed_warning": ["Serious liver damage may occur"],
    "adverse_reactions": ["Nausea"],
    "storage_and_handling": ["Store at room temperature"],
    "pregnancy": ["Ask a health professional"],
    "pediatric_use": ["Not for children under 2"],
    "geriatric_use": ["Use with caution"],
    "active_ingredient": ["Acetaminophen 500 mg"],
    "openfda": {
        "brand_name": ["TYLENOL"],
        "generic_name": ["ACETAMINOPHEN"],
        "manufacturer_name": ["Johnson & Johnson"],
        "substance_name": ["ACETAMINOPHEN"],
        "dosage_form": ["TABLET"],
        "route": ["ORAL"],
        "product_type": ["HUMAN OTC DRUG"],
    },
}


def test_escape_search_term_strips_specials():
    assert _escape_search_term('para+cetamol!') == "para cetamol"


def test_map_card_fields():
    card = map_card(SAMPLE_LABEL)
    assert card["brandName"] == "TYLENOL"
    assert card["genericName"] == "ACETAMINOPHEN"
    assert card["manufacturer"] == "Johnson & Johnson"
    assert card["placeholderType"] == "tablet"
    assert card["medicineKey"]
    assert "Pain" in (card["shortDescription"] or "")


def test_map_details_includes_warnings():
    details = map_details(SAMPLE_LABEL)
    assert details["boxedWarning"]
    assert details["sideEffects"] == "Nausea"
    assert any("Acetaminophen" in i for i in details["activeIngredients"])


@pytest.mark.asyncio
async def test_search_validation_min_length():
    with pytest.raises(OpenFDAError) as exc:
        await medicine_service.search_medicines("a", record_history=False)
    assert exc.value.status_code == 400
    assert exc.value.code == "validation_error"


@pytest.mark.asyncio
async def test_search_api_success():
    svc = OpenFDAService()
    payload = {"meta": {"results": {"total": 1}}, "results": [SAMPLE_LABEL]}

    with patch.object(svc, "_request", new=AsyncMock(return_value=(payload, False))):
        with patch("app.services.medicine_service.openfda_service", svc):
            with patch(
                "app.services.medicine_service.medicine_model.record_search",
                new=AsyncMock(),
            ):
                result = await medicine_service.search_medicines(
                    "Tylenol", user_id=1, record_history=True
                )

    assert result["success"] is True
    assert result["count"] == 1
    assert result["results"][0]["brandName"] == "TYLENOL"


@pytest.mark.asyncio
async def test_details_api_not_found():
    svc = OpenFDAService()
    empty = {"meta": {"results": {"total": 0}}, "results": []}

    with patch.object(svc, "_request", new=AsyncMock(return_value=(empty, False))):
        with patch("app.services.medicine_service.openfda_service", svc):
            with pytest.raises(OpenFDAError) as exc:
                await medicine_service.medicine_details("zzznomedicinexyz")

    assert exc.value.status_code == 404
    assert exc.value.code == "not_found"


@pytest.mark.asyncio
async def test_details_api_success():
    svc = OpenFDAService()
    payload = {"meta": {"results": {"total": 1}}, "results": [SAMPLE_LABEL]}

    with patch.object(svc, "_request", new=AsyncMock(return_value=(payload, False))):
        with patch("app.services.medicine_service.openfda_service", svc):
            result = await medicine_service.medicine_details("Tylenol")

    assert result["success"] is True
    assert result["data"]["medicineName"] == "TYLENOL"
    assert result["data"]["storage"]


@pytest.mark.asyncio
async def test_autocomplete_api():
    svc = OpenFDAService()
    payload = {"meta": {"results": {"total": 1}}, "results": [SAMPLE_LABEL]}

    with patch.object(svc, "_request", new=AsyncMock(return_value=(payload, True))):
        with patch("app.services.medicine_service.openfda_service", svc):
            result = await medicine_service.autocomplete("tyl")

    assert result["success"] is True
    assert result["cached"] is True
    assert any("TYLENOL" in s.upper() for s in result["suggestions"])


@pytest.mark.asyncio
async def test_search_empty_rejected():
    with pytest.raises(OpenFDAError) as exc:
        await medicine_service.search_medicines("", record_history=False)
    assert exc.value.status_code == 400
