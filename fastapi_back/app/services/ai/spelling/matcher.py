"""Spelling token matcher against dictionaries + healthcare lexicon."""
from __future__ import annotations

from difflib import get_close_matches

from app.services.ai.spelling.dictionary_loader import get_dictionary
from app.services.ai.spelling.ranking import rank_candidates
from app.services.ai.spelling.schemas import SpellingCorrection
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_FUZZY_CUTOFF = 0.88
_MIN_CONFIDENCE = 0.88


def correct_token(token: str) -> SpellingCorrection | None:
    """Correct a single token; return None if already correct or uncertain."""
    raw = (token or "").strip()
    if len(raw) < 3:
        return None

    dictionary = get_dictionary(validate=True, raise_on_error=False)
    key = raw.lower()

    # Exact misspelling dictionary
    eid = dictionary.misspell_index.get(key)
    if eid and eid in dictionary.entries:
        entry = dictionary.entries[eid]
        if entry.canonical.lower() != key:
            return SpellingCorrection(
                original=raw,
                corrected=entry.canonical,
                confidence=0.99,
                category=entry.category,
                matched_by="dictionary",
            )

    # Already a known canonical
    if any(c.lower() == key for c in dictionary.lexicon):
        return None

    # Entity Dictionary / Synonym misspellings
    try:
        from app.services.ai.entity.dictionary import resolve

        hit = resolve(raw, allow_fuzzy=True)
        if hit and hit.match_type in {"misspelling", "fuzzy"} and hit.normalized.lower() != key:
            if hit.confidence >= _MIN_CONFIDENCE:
                return SpellingCorrection(
                    original=raw,
                    corrected=hit.normalized,
                    confidence=hit.confidence,
                    category=hit.category,
                    matched_by="entity_dictionary",
                )
    except Exception:  # noqa: BLE001
        pass

    # Synonym misspellings only (avoid alias hits on short English words)
    if len(raw) >= 5:
        try:
            from app.services.ai.synonym import resolve_term

            syn = resolve_term(raw, allow_fuzzy=True)
            if syn and syn.matched_by in {"misspelling", "fuzzy"} and syn.canonical.lower() != key:
                if syn.confidence >= _MIN_CONFIDENCE:
                    return SpellingCorrection(
                        original=raw,
                        corrected=syn.canonical,
                        confidence=syn.confidence,
                        category=syn.category,
                        matched_by="synonym",
                    )
        except Exception:  # noqa: BLE001
            pass

    # Fuzzy against healthcare lexicon only
    close = get_close_matches(key, [c.lower() for c in dictionary.lexicon], n=3, cutoff=_FUZZY_CUTOFF)
    if not close:
        return None

    # Map back to proper casing
    lower_map = {c.lower(): c for c in dictionary.lexicon}
    candidates = [(lower_map[c], 0.9) for c in close if c in lower_map]
    ranked = rank_candidates(raw, candidates)
    if not ranked:
        return None
    best, score = ranked[0]
    if score < _MIN_CONFIDENCE:
        return None
    # Guard: do not invent unknown drug-like tokens with low similarity
    if len(raw) >= 8 and score < 0.92:
        return None
    return SpellingCorrection(
        original=raw,
        corrected=best,
        confidence=score,
        category="lexicon",
        matched_by="fuzzy",
    )
