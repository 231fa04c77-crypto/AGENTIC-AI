"""Normalize free-text by replacing synonym phrases (longest-first)."""
from __future__ import annotations

import re
import time

from app.services.ai.synonym.loader import get_index
from app.services.ai.synonym.matcher import match_term
from app.services.ai.synonym.schemas import NormalizeResult, SynonymMatch
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def normalize_message(
    text: str | None,
    *,
    categories: list[str] | None = None,
) -> NormalizeResult:
    """
    Replace known synonym phrases in message with canonical forms.

    Preserves original_text. Applies longest source terms first to avoid
    partial collisions. Does not diagnose or execute business logic.
    """
    started = time.perf_counter()
    original = text if text is not None else ""
    if not str(original).strip():
        return NormalizeResult(
            original_text=original,
            normalized_text=original,
            resolutions=[],
            processing_ms=(time.perf_counter() - started) * 1000,
        )

    index = get_index(validate=True, raise_on_error=False)
    working = str(original)
    resolutions: list[SynonymMatch] = []
    claimed: list[tuple[int, int]] = []

    # Longest terms first
    terms = sorted(index.term_to_ids.keys(), key=len, reverse=True)
    allowed = {c.lower() for c in categories} if categories else None

    for term in terms:
        if len(term) < 2:
            continue
        rids = index.term_to_ids.get(term) or []
        if not rids:
            continue
        rec = index.records.get(rids[0])
        if rec is None:
            continue
        if allowed is not None and rec.category.lower() not in allowed:
            continue
        # Skip if already canonical (no rewrite needed)
        if term == rec.canonical.lower():
            continue

        pattern = re.compile(rf"(?<!\w){re.escape(term)}(?!\w)", re.I)

        def _repl(m: re.Match[str], *, _rec=rec, _term=term) -> str:
            start, end = m.start(), m.end()
            if any(start < ce and end > cs for cs, ce in claimed):
                return m.group(0)
            claimed.append((start, end))
            kind = index.term_kind.get(_term, "synonym")
            resolutions.append(
                SynonymMatch(
                    original=m.group(0),
                    canonical=_rec.canonical,
                    category=_rec.category,
                    confidence=0.98 if kind == "synonym" else 0.9,
                    matched_by=kind,
                    record_id=_rec.id,
                )
            )
            return _rec.canonical

        working = pattern.sub(_repl, working)

    # Also try unmatched short tokens via match_term (fuzzy / entity dict)
    # Only for leftover single tokens that look misspelled
    tokens = re.findall(r"[A-Za-z][A-Za-z\-]{3,}", working)
    for tok in tokens:
        if any(tok.lower() == r.canonical.lower() for r in resolutions):
            continue
        hit = match_term(tok, categories=categories, allow_fuzzy=True)
        if hit is None:
            continue
        if hit.canonical.lower() == tok.lower():
            continue
        if hit.matched_by not in {"misspelling", "fuzzy", "abbreviation"}:
            continue
        pattern = re.compile(rf"(?<!\w){re.escape(tok)}(?!\w)")
        if pattern.search(working):
            working = pattern.sub(hit.canonical, working, count=1)
            resolutions.append(hit)

    elapsed = (time.perf_counter() - started) * 1000
    if elapsed > 25:
        log.info(
            "synonym_normalize ms=%.2f resolutions=%s msg=%r",
            elapsed,
            len(resolutions),
            original[:80],
        )
    return NormalizeResult(
        original_text=original,
        normalized_text=working,
        resolutions=resolutions,
        processing_ms=elapsed,
    )
