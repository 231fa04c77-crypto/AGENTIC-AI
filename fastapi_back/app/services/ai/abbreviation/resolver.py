"""Abbreviation Engine public resolver API."""
from __future__ import annotations

import time

from app.services.ai.abbreviation.matcher import expand_term, find_abbreviation_tokens
from app.services.ai.abbreviation.schemas import AbbreviationMatch, ExpandResult
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def expand_message(text: str | None) -> ExpandResult:
    """
    Expand known abbreviations in a message.

    Ambiguous abbreviations are left unchanged and recorded with
    requires_clarification=True (no guessing).
    """
    started = time.perf_counter()
    original = text if text is not None else ""
    if not str(original).strip():
        return ExpandResult(
            original_text=original,
            expanded_text=original,
            expansions=[],
            processing_ms=(time.perf_counter() - started) * 1000,
        )

    working = str(original)
    expansions: list[AbbreviationMatch] = []
    # Replace from end to preserve offsets
    spans = find_abbreviation_tokens(working)
    spans.sort(key=lambda s: s[1], reverse=True)

    for token, start, end in spans:
        hit = expand_term(token, context=working)
        if hit is None:
            continue
        expansions.append(hit)
        if hit.requires_clarification or not hit.canonical:
            continue
        working = working[:start] + hit.canonical + working[end:]

    ms = (time.perf_counter() - started) * 1000
    log.info(
        "abbreviation_expand expansions=%s clarify=%s ms=%.2f msg=%r",
        len(expansions),
        sum(1 for e in expansions if e.requires_clarification),
        ms,
        original[:80],
    )
    return ExpandResult(
        original_text=original,
        expanded_text=working,
        expansions=list(reversed(expansions)),
        processing_ms=ms,
    )
