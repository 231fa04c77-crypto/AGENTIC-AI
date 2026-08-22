"""Module 7 — Spelling Correction Engine tests."""
from __future__ import annotations

import time

import pytest

from app.services.ai.entity import extract_entities
from app.services.ai.spelling import correct_message, correct_token, reload


@pytest.fixture(autouse=True)
def _reload():
    reload()
    yield
    reload()


def test_dermotologist():
    hit = correct_token("dermotologist")
    assert hit is not None
    assert hit.corrected == "Dermatologist"


def test_paracetmol():
    hit = correct_token("paracetmol")
    assert hit is not None
    assert hit.corrected == "Paracetamol"


def test_docter_and_appointmnt():
    assert correct_token("docter").corrected == "doctor"
    assert correct_token("appointmnt").corrected == "appointment"


def test_hydrabad():
    assert correct_token("hydrabad").corrected == "Hyderabad"


def test_cardialogist():
    assert correct_token("cardialogist").corrected == "Cardiologist"


def test_multiple_corrections():
    out = correct_message("Need dermotologist tomorow in hydrabad")
    assert out.original.startswith("Need")
    assert "Dermatologist" in out.corrected
    assert "tomorrow" in out.corrected
    assert "Hyderabad" in out.corrected
    assert len(out.corrections) >= 3
    assert out.requires_confirmation is False


def test_no_spelling_mistakes():
    out = correct_message("Book Dermatologist tomorrow")
    assert out.corrected == "Book Dermatologist tomorrow"
    assert out.corrections == []


def test_unknown_word_not_invented():
    out = correct_message("Need xyzzyfoobarz medicine")
    assert "xyzzyfoobarz" in out.corrected


def test_extract_entities_spelling_pipeline():
    r = extract_entities("Need dermotologist tomorow")
    assert r.original_message
    assert any(c.get("corrected") == "Dermatologist" for c in r.spelling_corrections) or r.entities.get(
        "specialty"
    ) == "Dermatologist"


def test_performance_warm():
    correct_message("warm dermotologist tomorow")
    started = time.perf_counter()
    for _ in range(40):
        correct_message("Need dermotologist tomorow in hydrabad")
    assert ((time.perf_counter() - started) * 1000) / 40 < 50
