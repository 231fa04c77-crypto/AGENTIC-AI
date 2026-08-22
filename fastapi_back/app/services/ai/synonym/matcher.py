"""Synonym matching strategies."""
from __future__ import annotations

from difflib import get_close_matches
from typing import Iterable

from app.services.ai.synonym.loader import get_index
from app.services.ai.synonym.schemas import SynonymMatch, SynonymRecord
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_FUZZY_CUTOFF = 0.86

_CONF = {
    "exact": 0.99,
    "abbreviation": 0.97,
    "synonym": 0.98,
    "alias": 0.96,
    "plural": 0.94,
    "misspelling": 0.9,
    "fuzzy": 0.8,
    "entity_dictionary": 0.92,
}


def _allowed(categories: Iterable[str] | None) -> set[str] | None:
    if not categories:
        return None
    return {str(c).strip().lower() for c in categories if str(c).strip()}


def _pick_record(
    record_ids: list[str],
    *,
    allowed: set[str] | None,
    index_records: dict[str, SynonymRecord],
) -> SynonymRecord | None:
    for rid in record_ids:
        rec = index_records.get(rid)
        if rec is None:
            continue
        if allowed is not None and rec.category.lower() not in allowed:
            continue
        return rec
    return None


def match_term(
    text: str,
    categories: Iterable[str] | None = None,
    *,
    allow_fuzzy: bool = True,
    use_entity_dictionary: bool = True,
) -> SynonymMatch | None:
    """Resolve a single phrase to a synonym match."""
    phrase = (text or "").strip()
    if not phrase:
        return None

    index = get_index(validate=True, raise_on_error=False)
    allowed = _allowed(categories)
    key = phrase.lower()

    # Exact / synonym / alias / abbrev / misspelling / plural via index
    ids = index.term_to_ids.get(key) or []
    if ids:
        rec = _pick_record(ids, allowed=allowed, index_records=index.records)
        if rec:
            kind = index.term_kind.get(key, "synonym")
            if key == rec.canonical.lower():
                kind = "exact"
            return SynonymMatch(
                original=phrase,
                canonical=rec.canonical,
                category=rec.category,
                confidence=_CONF.get(kind, 0.9),
                matched_by=kind,
                record_id=rec.id,
            )

    # Simple plural: strip trailing s
    if key.endswith("s") and len(key) > 3:
        stem = key[:-1]
        ids = index.term_to_ids.get(stem) or []
        rec = _pick_record(ids, allowed=allowed, index_records=index.records)
        if rec:
            return SynonymMatch(
                original=phrase,
                canonical=rec.canonical,
                category=rec.category,
                confidence=_CONF["plural"],
                matched_by="plural",
                record_id=rec.id,
            )

    if allow_fuzzy and len(key) >= 4:
        pool = index.all_terms
        if allowed is not None:
            pool = [
                t
                for t, rids in index.term_to_ids.items()
                if any(
                    (index.records.get(rid) and index.records[rid].category.lower() in allowed)
                    for rid in rids
                )
            ]
        close = get_close_matches(key, pool, n=1, cutoff=_FUZZY_CUTOFF)
        if close:
            ids = index.term_to_ids.get(close[0]) or []
            rec = _pick_record(ids, allowed=allowed, index_records=index.records)
            if rec:
                return SynonymMatch(
                    original=phrase,
                    canonical=rec.canonical,
                    category=rec.category,
                    confidence=_CONF["fuzzy"],
                    matched_by="fuzzy",
                    record_id=rec.id,
                )

    # Fallback: Entity Dictionary for entity-like categories
    if use_entity_dictionary:
        hit = _entity_dictionary_fallback(phrase, allowed)
        if hit:
            return hit

    return None


def _entity_dictionary_fallback(
    phrase: str,
    allowed: set[str] | None,
) -> SynonymMatch | None:
    try:
        from app.services.ai.entity.dictionary import resolve

        # Map synonym categories → entity categories
        cat_map = {
            "specialty": "Specialty",
            "medicine": "Medicine",
            "disease": "Disease",
            "symptom": "Symptom",
            "laboratory": "Laboratory",
            "abbreviation": "Abbreviation",
            "emergency": "EmergencyKeyword",
            "general": None,
        }
        cats = None
        if allowed:
            cats = []
            for a in allowed:
                mapped = cat_map.get(a)
                if mapped:
                    cats.append(mapped)
            if not cats:
                return None
        hit = resolve(phrase, categories=cats, allow_fuzzy=True)
        if hit is None:
            return None
        # If allowed set restricts and entity category doesn't map back, skip
        entity_to_syn = {
            "Specialty": "specialty",
            "Medicine": "medicine",
            "MedicineBrand": "medicine",
            "Disease": "disease",
            "Symptom": "symptom",
            "Laboratory": "laboratory",
            "Abbreviation": "abbreviation",
            "EmergencyKeyword": "emergency",
        }
        syn_cat = entity_to_syn.get(hit.category, hit.category.lower())
        if allowed is not None and syn_cat not in allowed and hit.category.lower() not in allowed:
            return None
        matched = {
            "exact": "exact",
            "alias": "alias",
            "synonym": "synonym",
            "abbreviation": "abbreviation",
            "misspelling": "misspelling",
            "fuzzy": "fuzzy",
            "partial": "synonym",
        }.get(hit.match_type, "entity_dictionary")
        return SynonymMatch(
            original=phrase,
            canonical=hit.normalized or hit.entity,
            category=syn_cat,
            confidence=_CONF.get(matched, _CONF["entity_dictionary"]),
            matched_by=matched if matched != "exact" else "entity_dictionary",
            record_id=hit.record_id,
        )
    except Exception as exc:  # noqa: BLE001
        log.debug("synonym entity_dictionary fallback skip: %s", type(exc).__name__)
        return None
