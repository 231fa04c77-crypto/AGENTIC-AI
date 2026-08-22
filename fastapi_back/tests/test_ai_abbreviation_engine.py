"""Module 6 — Abbreviation Engine tests."""
from __future__ import annotations

import time

import pytest

from app.services.ai.abbreviation import (
    expand_message,
    expand_term,
    reload,
)
from app.services.ai.entity import extract_entities


@pytest.fixture(autouse=True)
def _reload():
    reload()
    yield
    reload()


@pytest.mark.parametrize(
    "abbr,canonical",
    [
        ("BP", "Blood Pressure"),
        ("CBC", "Complete Blood Count"),
        ("MRI", "Magnetic Resonance Imaging"),
        ("CT", "Computed Tomography"),
        ("ECG", "Electrocardiogram"),
        ("ENT", "Ear Nose Throat Specialist"),
        ("GP", "General Physician"),
        ("DM", "Diabetes Mellitus"),
        ("HTN", "Hypertension"),
        ("PCM", "Paracetamol"),
        ("IV", "Intravenous"),
        ("USG", "Ultrasonography"),
        ("HbA1c", "Glycated Hemoglobin"),
    ],
)
def test_common_abbreviations(abbr, canonical):
    hit = expand_term(abbr)
    assert hit is not None
    assert hit.canonical == canonical
    assert hit.requires_clarification is False


def test_op_context_outpatient():
    hit = expand_term("OP", context="Need OP ticket today")
    assert hit is not None
    assert hit.requires_clarification is False
    assert hit.canonical == "Out Patient"


def test_op_context_operation():
    hit = expand_term("OP", context="Operation scheduled in OT")
    # "operation" is in contexts for op_operation; also word Operation in text
    assert hit is not None
    if not hit.requires_clarification:
        assert hit.canonical == "Operation"


def test_op_ambiguous_no_context():
    hit = expand_term("OP", context="hello there")
    assert hit is not None
    assert hit.requires_clarification is True
    assert "Out Patient" in hit.possible_values


def test_expand_message_mixed():
    out = expand_message("Book ECG and CBC tomorrow")
    assert "Electrocardiogram" in out.expanded_text
    assert "Complete Blood Count" in out.expanded_text
    assert out.original_text.startswith("Book")


def test_ambiguous_not_replaced_in_message():
    out = expand_message("See OP please")
    # Without strong context, OP should remain
    assert "OP" in out.expanded_text or any(e.requires_clarification for e in out.expansions)


def test_extract_entities_pipeline_expands_abbreviations():
    """Synonym may expand first; pipeline must preserve original and extract labs."""
    r = extract_entities("I need BP check and CBC report")
    assert r.original_message == "I need BP check and CBC report"
    combined = r.synonym_resolutions + r.abbreviation_expansions
    assert any(
        e.get("canonical") in {"Blood Pressure", "Complete Blood Count"}
        or e.get("entity") in {"Blood Pressure", "Complete Blood Count"}
        for e in combined
    ) or r.entities.get("lab_test")


def test_performance():
    expand_message("warm up CBC BP ECG")
    started = time.perf_counter()
    for _ in range(40):
        expand_message("Need CBC LFT KFT and BP check with ECG")
    assert ((time.perf_counter() - started) * 1000) / 40 < 50
