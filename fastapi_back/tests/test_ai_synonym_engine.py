"""Module 5 — Synonym Engine tests."""
from __future__ import annotations

import time
from pathlib import Path

import pytest
import yaml

from app.services.ai.entity import extract_entities
from app.services.ai.synonym import (
    SynonymValidationError,
    normalize_message,
    reload,
    resolve_term,
    validate_index,
)
from app.services.ai.synonym.loader import config_dir, load_index
from app.services.ai.synonym.schemas import SynonymIndex, SynonymRecord


@pytest.fixture(autouse=True)
def _reload():
    reload()
    yield
    reload()


def test_skin_doctor():
    hit = resolve_term("skin doctor")
    assert hit is not None
    assert hit.canonical == "Dermatologist"
    assert hit.matched_by in {"synonym", "alias"}


def test_heart_doctor():
    hit = resolve_term("heart doctor")
    assert hit is not None
    assert hit.canonical == "Cardiologist"


def test_pcm_and_crocin_and_tylenol():
    assert resolve_term("PCM").canonical == "Paracetamol"
    assert resolve_term("Crocin").canonical == "Paracetamol"
    assert resolve_term("Tylenol").canonical == "Paracetamol"


def test_bp_and_cbc():
    bp = resolve_term("BP")
    assert bp is not None
    assert bp.canonical == "Blood Pressure"
    cbc = resolve_term("CBC")
    assert cbc is not None
    assert cbc.canonical == "Complete Blood Count"


def test_misspellings():
    assert resolve_term("paracetmol").canonical == "Paracetamol"
    assert resolve_term("dermotologist").canonical == "Dermatologist"


def test_navigation():
    assert resolve_term("medicine store").canonical == "Pharmacy"
    assert resolve_term("health forum").canonical == "Community"
    assert resolve_term("my bookings").canonical == "Appointments"


def test_plural_forms():
    hit = resolve_term("headaches")
    assert hit is not None
    assert hit.canonical == "Headache"


def test_unknown_synonym():
    assert resolve_term("xyzzyfoobar") is None


def test_normalize_message_preserves_original():
    out = normalize_message("I need a skin doctor and PCM")
    assert out.original_text == "I need a skin doctor and PCM"
    assert "Dermatologist" in out.normalized_text
    assert "Paracetamol" in out.normalized_text
    assert len(out.resolutions) >= 2


def test_extract_entities_uses_synonyms():
    r = extract_entities("Book a skin doctor tomorrow morning")
    assert r.original_message.startswith("Book a skin doctor")
    assert r.entities.get("specialty") == "Dermatologist"
    assert any(x.get("canonical") == "Dermatologist" for x in r.synonym_resolutions)


def test_circular_mapping_fails(tmp_path: Path):
    bad = {
        "version": 1,
        "category": "test",
        "entries": [
            {
                "id": "a",
                "canonical": "Alpha",
                "category": "test",
                "synonyms": ["Beta"],
                "aliases": [],
                "abbreviations": [],
                "misspellings": [],
                "plurals": [],
            },
            {
                "id": "b",
                "canonical": "Beta",
                "category": "test",
                "synonyms": ["Alpha"],
                "aliases": [],
                "abbreviations": [],
                "misspellings": [],
                "plurals": [],
            },
        ],
    }
    d = tmp_path / "config"
    d.mkdir()
    (d / "general.yaml").write_text(yaml.dump(bad), encoding="utf-8")
    # Minimal empty others not required — loader only warns on missing base files
    index = load_index(d, region="IN", validate=False)
    with pytest.raises(SynonymValidationError) as exc:
        validate_index(index, raise_on_error=True)
    assert any("circular" in e for e in exc.value.result.errors)


def test_duplicate_conflicting_canonical_fails():
    index = SynonymIndex(
        records={
            "a": SynonymRecord(
                id="a",
                canonical="Alpha",
                category="test",
                synonyms=("shared",),
            ),
            "b": SynonymRecord(
                id="b",
                canonical="Beta",
                category="test",
                synonyms=("shared",),
            ),
        }
    )
    # Rebuild term owners via validate walking all_source_terms
    with pytest.raises(SynonymValidationError):
        validate_index(index, raise_on_error=True)


def test_performance_normalize():
    started = time.perf_counter()
    for _ in range(40):
        normalize_message("skin doctor heart doctor PCM CBC medicine store tomorow")
    assert ((time.perf_counter() - started) * 1000) / 40 < 50


def test_config_dir_exists():
    assert config_dir().is_dir()
    assert (config_dir() / "specialties.yaml").is_file()
