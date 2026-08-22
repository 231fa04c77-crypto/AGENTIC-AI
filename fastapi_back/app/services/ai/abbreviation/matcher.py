"""Abbreviation matching with context-aware disambiguation."""
from __future__ import annotations

import re
from difflib import get_close_matches

from app.services.ai.abbreviation.loader import get_index
from app.services.ai.abbreviation.schemas import AbbreviationMatch, AbbreviationRecord
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_AMBIGUITY_MARGIN = 0.15


def _score_context(rec: AbbreviationRecord, context: str) -> float:
    if not rec.contexts:
        return 0.0
    text = (context or "").lower()
    hits = sum(1 for c in rec.contexts if c.lower() in text)
    if hits == 0:
        return 0.0
    return min(1.0, hits / max(1, len(rec.contexts)) + 0.35 * hits)


def _match_from(rec: AbbreviationRecord, abbr: str, *, confidence: float, matched_by: str) -> AbbreviationMatch:
    return AbbreviationMatch(
        abbreviation=abbr,
        expanded=rec.expanded,
        canonical=rec.canonical,
        category=rec.category,
        confidence=round(confidence, 3),
        matched_by=matched_by,
        record_id=rec.id,
    )


def expand_term(
    abbreviation: str,
    *,
    context: str = "",
    allow_fuzzy: bool = True,
) -> AbbreviationMatch | None:
    """Expand one abbreviation; return clarification payload when ambiguous."""
    token = (abbreviation or "").strip()
    if not token:
        return None

    index = get_index(validate=True, raise_on_error=False)
    key = token.lower()
    ids = list(index.by_abbr.get(key) or [])

    if not ids and allow_fuzzy and len(token) >= 2:
        close = get_close_matches(key, list(index.by_abbr.keys()), n=1, cutoff=0.9)
        if close:
            ids = list(index.by_abbr.get(close[0]) or [])
            key = close[0]

    if not ids:
        # Secondary: Entity Dictionary abbreviation category
        try:
            from app.services.ai.entity.dictionary import resolve

            hit = resolve(token, categories=["Abbreviation", "Laboratory", "Specialty"], allow_fuzzy=False)
            if hit:
                return AbbreviationMatch(
                    abbreviation=token,
                    expanded=hit.normalized,
                    canonical=hit.normalized,
                    category=hit.category,
                    confidence=0.9,
                    matched_by="entity_dictionary",
                    record_id=hit.record_id,
                )
        except Exception:  # noqa: BLE001
            pass
        return None

    recs = [index.records[i] for i in ids if i in index.records]
    if len(recs) == 1:
        return _match_from(recs[0], token, confidence=0.99, matched_by="exact")

    # Multi-sense: score by context
    scored: list[tuple[float, AbbreviationRecord]] = []
    for rec in recs:
        scored.append((_score_context(rec, context), rec))
    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    second = scored[1][0] if len(scored) > 1 else 0.0

    if best_score <= 0 or (best_score - second) < _AMBIGUITY_MARGIN:
        possibles = sorted({r.canonical for r in recs})
        return AbbreviationMatch(
            abbreviation=token,
            expanded="",
            canonical="",
            category=best.category,
            confidence=0.0,
            matched_by="ambiguous",
            record_id="",
            requires_clarification=True,
            possible_values=possibles,
        )

    return _match_from(
        best,
        token,
        confidence=min(0.98, 0.7 + best_score * 0.25),
        matched_by="context",
    )


def find_abbreviation_tokens(text: str) -> list[tuple[str, int, int]]:
    """Find candidate abbreviation spans in text (known keys + ALLCAPS tokens)."""
    index = get_index(validate=True, raise_on_error=False)
    text = text or ""
    found: list[tuple[str, int, int]] = []
    claimed: list[tuple[int, int]] = []

    # Prefer longer known keys first (HbA1c, SpO2, PPBS)
    keys = sorted(index.by_abbr.keys(), key=len, reverse=True)
    lower = text.lower()
    for key in keys:
        if len(key) < 2:
            continue
        pattern = re.compile(rf"(?<!\w){re.escape(key)}(?!\w)", re.I)
        for m in pattern.finditer(text):
            start, end = m.start(), m.end()
            if any(start < ce and end > cs for cs, ce in claimed):
                continue
            claimed.append((start, end))
            found.append((m.group(0), start, end))

    return found
