"""Entity Dictionary search — exact, alias, abbreviation, misspelling, fuzzy."""
from __future__ import annotations

import re
import time
from difflib import get_close_matches
from typing import Iterable

from app.services.ai.entity.dictionary.entity_loader import get_catalog
from app.services.ai.entity.dictionary.schemas import EntityCatalog, EntityMatch, EntityRecord
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_FUZZY_CUTOFF = 0.86

# category filter aliases used by extractors
CATEGORY_ALIASES: dict[str, str] = {
    "specialty": "Specialty",
    "specialties": "Specialty",
    "medicine": "Medicine",
    "medicines": "Medicine",
    "disease": "Disease",
    "diseases": "Disease",
    "symptom": "Symptom",
    "symptoms": "Symptom",
    "laboratory": "Laboratory",
    "lab": "Laboratory",
    "laboratories": "Laboratory",
    "hospital": "Hospital",
    "hospitals": "Hospital",
    "doctor": "Doctor",
    "doctors": "Doctor",
    "city": "City",
    "cities": "City",
    "abbreviation": "Abbreviation",
    "abbreviations": "Abbreviation",
    "relationship": "Relationship",
    "relationships": "Relationship",
    "emergency": "EmergencyKeyword",
    "emergency_keyword": "EmergencyKeyword",
}


def clear_search_cache() -> None:
    """Hook for reload — search is catalog-backed, no separate cache today."""
    return


def _norm_categories(categories: Iterable[str] | None) -> set[str] | None:
    if not categories:
        return None
    out: set[str] = set()
    for c in categories:
        key = str(c).strip()
        if not key:
            continue
        out.add(CATEGORY_ALIASES.get(key.lower(), key))
    return out


def _match_from_record(
    record: EntityRecord,
    *,
    confidence: float,
    match_type: str,
) -> EntityMatch:
    return EntityMatch(
        entity=record.canonical,
        normalized=record.normalized or record.canonical,
        aliases=list(record.aliases) + list(record.abbreviations),
        misspellings=list(record.misspellings),
        category=record.category,
        confidence=round(confidence, 3),
        match_type=match_type,
        record_id=record.id,
        metadata=dict(record.metadata or {}),
    )


def _lookup_term(
    catalog: EntityCatalog,
    term: str,
    allowed: set[str] | None,
) -> EntityMatch | None:
    key = (term or "").strip().lower()
    if not key:
        return None
    refs = catalog.index.get(key) or []
    for category, entity_id in refs:
        if allowed is not None and category not in allowed:
            continue
        record = catalog.get(category, entity_id)
        if record is None:
            continue
        # Classify match type
        low_canonical = record.canonical.lower()
        low_norm = (record.normalized or "").lower()
        if key in {low_canonical, low_norm, record.id.lower().replace("_", " ")}:
            mtype = "exact"
            conf = 0.98
        elif key in {a.lower() for a in record.abbreviations}:
            mtype = "abbreviation"
            conf = 0.95
        elif key in {a.lower() for a in record.misspellings}:
            mtype = "misspelling"
            conf = 0.9
        elif key in {a.lower() for a in record.aliases} or key in {
            a.lower() for a in record.synonyms
        }:
            mtype = "alias"
            conf = 0.94
        else:
            mtype = "synonym"
            conf = 0.9
        return _match_from_record(record, confidence=conf, match_type=mtype)
    return None


def resolve(
    text: str,
    categories: Iterable[str] | None = None,
    *,
    allow_fuzzy: bool = True,
) -> EntityMatch | None:
    """Resolve a phrase to a single entity (best match)."""
    started = time.perf_counter()
    catalog = get_catalog(validate=True, raise_on_error=False)
    if catalog.count() == 0:
        return None

    allowed = _norm_categories(categories)
    phrase = (text or "").strip()
    if not phrase:
        return None

    hit = _lookup_term(catalog, phrase, allowed)
    if hit:
        _log_perf(started, hit.match_type)
        return hit

    # Partial: multi-word catalog terms contained in phrase / vice versa
    low = phrase.lower()
    best: EntityMatch | None = None
    for term, refs in catalog.index.items():
        if " " not in term and len(term) < 4:
            continue
        if term in low or (len(term) > 5 and low in term):
            for category, entity_id in refs:
                if allowed is not None and category not in allowed:
                    continue
                record = catalog.get(category, entity_id)
                if record is None:
                    continue
                cand = _match_from_record(record, confidence=0.82, match_type="partial")
                if best is None or cand.confidence > best.confidence:
                    best = cand
    if best:
        _log_perf(started, "partial")
        return best

    if allow_fuzzy and len(phrase) >= 4:
        pool = catalog.all_terms
        if allowed is not None:
            pool = [
                t
                for t, refs in catalog.index.items()
                if any(c in allowed for c, _ in refs)
            ]
        close = get_close_matches(phrase.lower(), pool, n=1, cutoff=_FUZZY_CUTOFF)
        if close:
            hit = _lookup_term(catalog, close[0], allowed)
            if hit:
                fuzzy = _match_from_record(
                    catalog.get(hit.category, hit.record_id) or EntityRecord(
                        id=hit.record_id,
                        canonical=hit.entity,
                        category=hit.category,
                        normalized=hit.normalized,
                    ),
                    confidence=0.8,
                    match_type="fuzzy",
                )
                # Prefer real record metadata
                rec = catalog.get(hit.category, hit.record_id)
                if rec:
                    fuzzy = _match_from_record(rec, confidence=0.8, match_type="fuzzy")
                _log_perf(started, "fuzzy")
                return fuzzy

    _log_perf(started, "miss")
    return None


def resolve_in_message(
    message: str,
    categories: Iterable[str] | None = None,
) -> list[EntityMatch]:
    """Find dictionary entities mentioned in a free-text message (longest terms first)."""
    catalog = get_catalog(validate=True, raise_on_error=False)
    if catalog.count() == 0:
        return []

    allowed = _norm_categories(categories)
    text = (message or "").lower()
    if not text.strip():
        return []

    # Prefer longer terms to avoid short abbreviation collisions
    terms = sorted(catalog.index.keys(), key=len, reverse=True)
    hits: list[EntityMatch] = []
    claimed: list[tuple[int, int]] = []

    for term in terms:
        if len(term) < 2:
            continue
        refs = catalog.index.get(term) or []
        if allowed is not None and not any(c in allowed for c, _ in refs):
            continue
        # Word-boundary-ish search
        pattern = re.compile(rf"(?<!\w){re.escape(term)}(?!\w)", re.I)
        for m in pattern.finditer(text):
            start, end = m.start(), m.end()
            if any(start < ce and end > cs for cs, ce in claimed):
                continue
            for category, entity_id in refs:
                if allowed is not None and category not in allowed:
                    continue
                record = catalog.get(category, entity_id)
                if record is None:
                    continue
                hit = _lookup_term(catalog, term, allowed) or _match_from_record(
                    record, confidence=0.9, match_type="alias"
                )
                hits.append(hit)
                claimed.append((start, end))
                break
            break  # one match per term occurrence chain

    # Deduplicate by category+id keeping highest confidence
    best: dict[tuple[str, str], EntityMatch] = {}
    for h in hits:
        key = (h.category, h.record_id)
        prev = best.get(key)
        if prev is None or h.confidence > prev.confidence:
            best[key] = h
    return list(best.values())


def lookup(entity_id: str, category: str | None = None) -> EntityRecord | None:
    catalog = get_catalog(validate=True, raise_on_error=False)
    if category:
        cat = CATEGORY_ALIASES.get(category.lower(), category)
        return catalog.get(cat, entity_id)
    for cat, records in catalog.by_category.items():
        if entity_id in records:
            return records[entity_id]
    return None


def _log_perf(started: float, kind: str) -> None:
    ms = (time.perf_counter() - started) * 1000
    if ms > 20:
        log.info("entity_search kind=%s ms=%.2f", kind, ms)
