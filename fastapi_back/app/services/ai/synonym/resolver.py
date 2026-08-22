"""Public Synonym Engine resolver API."""
from __future__ import annotations

import time
from typing import Iterable

from app.services.ai.synonym.matcher import match_term
from app.services.ai.synonym.normalizer import normalize_message
from app.services.ai.synonym.schemas import NormalizeResult, SynonymMatch
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def resolve_term(
    text: str,
    categories: Iterable[str] | None = None,
    *,
    allow_fuzzy: bool = True,
) -> SynonymMatch | None:
    """
    Resolve one phrase to a canonical synonym match.

    Returns structured match or None for unknown terms.
    """
    started = time.perf_counter()
    hit = match_term(
        text,
        categories=categories,
        allow_fuzzy=allow_fuzzy,
        use_entity_dictionary=True,
    )
    ms = (time.perf_counter() - started) * 1000
    if hit:
        log.info(
            "synonym_resolve original=%r canonical=%r category=%s matched_by=%s "
            "confidence=%.2f ms=%.2f",
            hit.original,
            hit.canonical,
            hit.category,
            hit.matched_by,
            hit.confidence,
            ms,
        )
    else:
        log.info("synonym_resolve original=%r miss ms=%.2f", (text or "")[:80], ms)
    return hit


def resolve_synonyms(text: str, categories: Iterable[str] | None = None) -> NormalizeResult:
    """Alias for normalize_message — full-message synonym normalization."""
    return normalize_message(text, categories=list(categories) if categories else None)
