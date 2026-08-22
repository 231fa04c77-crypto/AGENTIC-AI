"""Deterministic entity extractors — dictionary-backed where possible."""
from __future__ import annotations

import re
from typing import Any

from app.services.ai.entity.schemas import EntitySpan
from app.services.ai.intent.preprocess import preprocess
from app.services.ai.workflow_nlu import (
    extract_booking_relationship,
    extract_date,
    extract_specialty,
    extract_time_hint,
    suggest_specialty_from_symptoms,
)

_MODE = re.compile(r"\b(online|offline|video|in[- ]?person|clinic)\b", re.I)
_LOCATION = re.compile(
    r"\b(?:in|near|at)\s+([A-Za-z][a-zA-Z\s]{1,40}?)(?:\s+(?:please|tomorrow|today|hospital|clinic)|\s*$)",
    re.I,
)
_ORDINAL = re.compile(
    r"\b(first|second|third|1st|2nd|3rd|last)\b(?:\s+(?:doctor|slot|one))?",
    re.I,
)

# Fallback vocab if Entity Dictionary fails to load
_FALLBACK_MEDICINES = (
    "paracetamol",
    "acetaminophen",
    "ibuprofen",
    "metformin",
    "amoxicillin",
    "aspirin",
    "omeprazole",
    "cetirizine",
    "azithromycin",
)
_FALLBACK_LAB_TESTS = (
    "cbc",
    "complete blood count",
    "hba1c",
    "thyroid",
    "tsh",
    "lipid",
    "blood sugar",
    "glucose",
    "mri",
    "ct scan",
    "ecg",
    "xray",
    "x-ray",
    "urine",
)
_FALLBACK_DISEASES = (
    "diabetes",
    "asthma",
    "thyroid",
    "migraine",
    "hypertension",
    "anemia",
    "anaemia",
    "dengue",
    "covid",
    "uti",
)


def _dict_hits(message: str, categories: list[str]):
    try:
        from app.services.ai.entity.dictionary import resolve_in_message

        return resolve_in_message(message, categories=categories)
    except Exception:  # noqa: BLE001
        return []


def extract_all(message: str | None) -> tuple[dict[str, Any], list[EntitySpan], str, str]:
    """Return (entities_dict, spans, normalized, language)."""
    prep = preprocess(message or "")
    text = prep.normalized or (message or "").strip().lower()
    entities: dict[str, Any] = {}
    spans: list[EntitySpan] = []

    def _put(key: str, value: Any, *, confidence: float, source: str = "rules") -> None:
        if value is None or value == "":
            return
        entities[key] = value
        spans.append(
            EntitySpan(type=key, value=value, confidence=confidence, source=source)
        )

    # Specialty (explicit or symptom-suggested)
    specialty = extract_specialty(text)
    if specialty:
        _put("specialty", specialty, confidence=0.9, source="rules")
    else:
        suggested = suggest_specialty_from_symptoms(text)
        if suggested:
            _put("specialty", suggested, confidence=0.7, source="symptom_map")
            _put("specialty_suggested", True, confidence=0.7, source="symptom_map")

    date_iso = extract_date(text)
    if date_iso:
        _put("date", date_iso, confidence=0.92, source="rules")

    time_hint = extract_time_hint(text)
    if time_hint:
        _put("time_hint", time_hint, confidence=0.85, source="rules")

    clock = re.search(
        r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b",
        text,
        re.I,
    )
    if clock:
        _put("time", clock.group(0).strip(), confidence=0.88, source="rules")

    rel = extract_booking_relationship(text)
    if rel:
        _put("relationship", rel, confidence=0.9, source="rules")
        _put("booking_for_other", True, confidence=0.9, source="rules")

    med_hits = _dict_hits(text, ["Medicine", "MedicineBrand"])
    if med_hits:
        hit = med_hits[0]
        med_val = (
            hit.normalized.lower()
            if hit.category == "Medicine"
            else hit.normalized
        )
        # Prefer common id token when it matches expected extraction style
        if hit.record_id and hit.category == "Medicine":
            med_val = hit.record_id.replace("_", " ")
        _put(
            "medicine_name",
            med_val,
            confidence=hit.confidence,
            source=f"dictionary:{hit.match_type}",
        )
    else:
        for med in _FALLBACK_MEDICINES:
            if re.search(rf"\b{re.escape(med)}\b", text, re.I):
                _put("medicine_name", med, confidence=0.9, source="fallback")
                break

    lab_hits = _dict_hits(text, ["Laboratory"])
    if lab_hits:
        hit = lab_hits[0]
        if hit.record_id in {
            "cbc",
            "mri",
            "ct",
            "ecg",
            "hba1c",
            "lft",
            "kft",
            "tsh",
            "xray",
        }:
            lab_val = hit.record_id if hit.record_id != "xray" else "xray"
        else:
            lab_val = hit.normalized.lower()
        _put(
            "lab_test",
            lab_val,
            confidence=hit.confidence,
            source=f"dictionary:{hit.match_type}",
        )
    else:
        for lab in _FALLBACK_LAB_TESTS:
            if lab in text:
                _put(
                    "lab_test",
                    lab,
                    confidence=0.88,
                    source="abbrev" if len(lab) <= 4 else "fallback",
                )
                break

    disease_hits = _dict_hits(text, ["Disease"])
    if disease_hits:
        hit = disease_hits[0]
        if hit.record_id == "covid19":
            name = "covid"
        elif hit.record_id:
            name = hit.record_id.replace("_", " ")
            # single-token diseases stay as id (diabetes, asthma, …)
            if " " not in name:
                pass
            else:
                name = hit.normalized.lower()
        else:
            name = hit.normalized.lower()
        _put(
            "disease_name",
            name,
            confidence=hit.confidence,
            source=f"dictionary:{hit.match_type}",
        )
    else:
        for disease in _FALLBACK_DISEASES:
            if re.search(rf"\b{re.escape(disease)}\b", text, re.I):
                _put("disease_name", disease, confidence=0.85, source="fallback")
                break

    symptom_hits = _dict_hits(text, ["Symptom", "EmergencyKeyword"])
    for hit in symptom_hits:
        if hit.category == "Symptom":
            _put(
                "symptom",
                hit.normalized,
                confidence=hit.confidence,
                source=f"dictionary:{hit.match_type}",
            )
            if (hit.metadata or {}).get("emergency") is True:
                _put(
                    "emergency_symptom",
                    hit.normalized,
                    confidence=hit.confidence,
                    source="dictionary:emergency",
                )
            break
    else:
        for hit in symptom_hits:
            if hit.category == "EmergencyKeyword" and (hit.metadata or {}).get("emergency"):
                _put(
                    "emergency_symptom",
                    hit.normalized,
                    confidence=hit.confidence,
                    source="dictionary:emergency",
                )
                break

    # Hospital / city enrichment (optional slots)
    for hit in _dict_hits(text, ["Hospital"]):
        _put("hospital_name", hit.normalized, confidence=hit.confidence, source="dictionary")
        break
    for hit in _dict_hits(text, ["City"]):
        _put("city", hit.normalized, confidence=hit.confidence, source="dictionary")
        break

    # Known doctor from dictionary (higher confidence than heuristic)
    for hit in _dict_hits(message or text, ["Doctor"]):
        _put("doctor_name", hit.normalized, confidence=hit.confidence, source="dictionary")
        break

    mode_m = _MODE.search(text)
    if mode_m:
        raw = mode_m.group(1).lower().replace(" ", "-")
        if raw in {"video", "online"}:
            _put("mode", "online", confidence=0.85, source="rules")
        else:
            _put("mode", "offline", confidence=0.85, source="rules")

    loc_m = _LOCATION.search(text)
    if loc_m and "location" not in entities and "city" not in entities:
        city = loc_m.group(1).strip().title()
        if city.lower() not in {"the", "a", "an", "my", "our"}:
            _put("location", city, confidence=0.65, source="rules")

    ord_m = _ORDINAL.search(text)
    if ord_m:
        _put("ordinal", ord_m.group(1).lower(), confidence=0.8, source="rules")

    if "doctor_name" not in entities:
        doc_m = re.search(
            r"\b(?:dr\.?|doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b"
            r"|\b(?:dr\.?|doctor)\s+([a-z]{3,20})\b",
            message or "",
            re.I,
        )
        if doc_m:
            name = (doc_m.group(1) or doc_m.group(2) or "").strip().title()
            if name and name.lower() not in {"available", "near", "appointment"}:
                _put("doctor_name", name, confidence=0.75, source="rules")

    return entities, spans, prep.normalized, prep.language


def missing_booking_slots(entities: dict[str, Any]) -> list[str]:
    """Fields typically needed before a booking workflow can complete — not a decision."""
    missing: list[str] = []
    if not entities.get("specialty") and not entities.get("doctor_name"):
        missing.append("specialty_or_doctor")
    if not entities.get("date"):
        missing.append("date")
    if not entities.get("time") and not entities.get("time_hint") and not entities.get("ordinal"):
        missing.append("time_or_slot_preference")
    return missing
