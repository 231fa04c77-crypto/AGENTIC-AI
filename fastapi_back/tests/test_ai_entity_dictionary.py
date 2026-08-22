"""Module 4 — Entity Dictionary tests."""
from __future__ import annotations

import copy
import time
from pathlib import Path

import pytest
import yaml

from app.services.ai.entity import extract_entities
from app.services.ai.entity.dictionary import (
    EntityDictionaryValidationError,
    get_catalog,
    load_catalog,
    lookup,
    reload,
    resolve,
    resolve_in_message,
    validate_catalog,
)
from app.services.ai.entity.dictionary.entity_loader import catalogs_dir
from app.services.ai.entity.dictionary.schemas import EntityCatalog, EntityRecord


@pytest.fixture(autouse=True)
def _reload_catalog():
    reload()
    yield
    reload()


def test_catalog_loads():
    catalog = get_catalog(force_reload=True, raise_on_error=True)
    assert catalog.count() >= 100
    assert "Specialty" in catalog.by_category
    assert "Medicine" in catalog.by_category


def test_specialty_lookup():
    hit = resolve("dermotologist", categories=["Specialty"])
    assert hit is not None
    assert hit.normalized == "Dermatologist"
    assert hit.match_type in {"misspelling", "fuzzy", "alias"}


def test_medicine_lookup_and_misspelling():
    hit = resolve("paracetmol", categories=["Medicine"])
    assert hit is not None
    assert hit.normalized == "Paracetamol"
    assert hit.match_type in {"misspelling", "fuzzy"}


def test_medicine_alias_pcm():
    hit = resolve("PCM", categories=["Medicine"])
    assert hit is not None
    assert hit.normalized == "Paracetamol"


def test_disease_lookup():
    hit = resolve("diabetes", categories=["Disease"])
    assert hit is not None
    assert hit.normalized == "Diabetes"


def test_symptom_emergency_flag():
    hit = resolve("chest pain", categories=["Symptom"])
    assert hit is not None
    assert hit.metadata.get("emergency") is True


def test_hospital_lookup():
    hit = resolve("city care", categories=["Hospital"])
    assert hit is not None
    assert "Hospital" in hit.normalized or "Care" in hit.normalized


def test_laboratory_and_abbreviation():
    lab = resolve("cbc", categories=["Laboratory"])
    assert lab is not None
    assert lab.normalized.upper() == "CBC"
    abbr = resolve("BP", categories=["Abbreviation"])
    assert abbr is not None
    assert "Blood Pressure" in abbr.normalized


def test_doctor_lookup():
    hit = resolve("Dr Ravi", categories=["Doctor"])
    assert hit is not None
    assert "Ravi" in hit.normalized


def test_fuzzy_search():
    hit = resolve("paracetamoll", categories=["Medicine"], allow_fuzzy=True)
    assert hit is not None
    assert hit.normalized == "Paracetamol"


def test_duplicate_id_fails(tmp_path: Path):
    src = catalogs_dir() / "medicines.yaml"
    raw = yaml.safe_load(src.read_text(encoding="utf-8"))
    raw["entities"].append(copy.deepcopy(raw["entities"][0]))
    bad_dir = tmp_path / "catalogs"
    bad_dir.mkdir()
    # Copy minimal set: medicines + empty hospitals for cross-ref ok
    (bad_dir / "medicines.yaml").write_text(yaml.dump(raw), encoding="utf-8")
    (bad_dir / "hospitals.yaml").write_text(
        yaml.dump({"version": 1, "category": "Hospital", "entities": []}),
        encoding="utf-8",
    )
    with pytest.raises(EntityDictionaryValidationError) as exc:
        load_catalog(bad_dir, validate=True)
    assert any("duplicate entity id" in e for e in exc.value.result.errors)


def test_broken_hospital_ref_fails():
    catalog = get_catalog(raise_on_error=True)
    bad_doc = EntityRecord(
        id="doc_broken",
        canonical="Dr Broken",
        category="Doctor",
        normalized="Dr Broken",
        metadata={"hospital_id": "does_not_exist"},
    )
    forged = EntityCatalog(
        version=1,
        by_category={
            "Hospital": dict(catalog.by_category.get("Hospital") or {}),
            "Doctor": {"doc_broken": bad_doc},
        },
    )
    with pytest.raises(EntityDictionaryValidationError):
        validate_catalog(forged, raise_on_error=True)


def test_extraction_uses_dictionary_misspelling():
    r = extract_entities("What is paracetmol used for?")
    assert r.entities.get("medicine_name") == "paracetamol"


def test_extraction_lab_cbc_still_works():
    r = extract_entities("Book CBC tomorrow")
    assert r.entities.get("lab_test") in {"cbc", "complete blood count", "CBC"}


def test_resolve_performance_seed_size():
    started = time.perf_counter()
    for _ in range(50):
        resolve_in_message(
            "book dermatologist and need paracetamol CBC in hyderabad",
            categories=["Specialty", "Medicine", "Laboratory", "City"],
        )
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms / 50 < 50


def test_lookup_by_id():
    rec = lookup("paracetamol", "Medicine")
    assert rec is not None
    assert rec.canonical == "Paracetamol"
