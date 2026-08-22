"""Spelling correction orchestrator."""
from __future__ import annotations

import re
import time

from app.services.ai.spelling.matcher import correct_token
from app.services.ai.spelling.schemas import CorrectResult, SpellingCorrection
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_TOKEN = re.compile(r"[A-Za-z][A-Za-z0-9\-']*")


def correct_message(text: str | None) -> CorrectResult:
    """
    Correct spelling mistakes in a message (healthcare lexicon safe).

    Low-confidence candidates are left unchanged; requires_confirmation may
    be set when uncertain near-misses are detected but not applied.
    """
    started = time.perf_counter()
    original = text if text is not None else ""
    if not str(original).strip():
        return CorrectResult(
            original=original,
            corrected=original,
            corrections=[],
            requires_confirmation=False,
            processing_ms=(time.perf_counter() - started) * 1000,
        )

    working = str(original)
    corrections: list[SpellingCorrection] = []
    uncertain = False

    # Collect tokens with positions, replace from end
    spans = [(m.group(0), m.start(), m.end()) for m in _TOKEN.finditer(working)]
    for token, start, end in reversed(spans):
        hit = correct_token(token)
        if hit is None:
            # Near-miss detection for confirmation flag only
            if len(token) >= 5 and token.isalpha():
                from difflib import get_close_matches
                from app.services.ai.spelling.dictionary_loader import get_dictionary

                dictionary = get_dictionary(validate=True, raise_on_error=False)
                near = get_close_matches(
                    token.lower(),
                    [c.lower() for c in dictionary.lexicon],
                    n=1,
                    cutoff=0.75,
                )
                if near and near[0] != token.lower() and not any(
                    near[0] == c.lower() for c in dictionary.lexicon if abs(len(c) - len(token)) <= 1
                ):
                    # borderline — do not change
                    if 0.75 <= (1.0) and near[0] != token.lower():
                        # only mark confirmation if close but below apply threshold
                        from difflib import SequenceMatcher

                        ratio = SequenceMatcher(None, token.lower(), near[0]).ratio()
                        if 0.75 <= ratio < 0.88:
                            uncertain = True
            continue
        corrections.append(hit)
        working = working[:start] + hit.corrected + working[end:]

    corrections.reverse()
    ms = (time.perf_counter() - started) * 1000
    log.info(
        "spelling_correct corrections=%s confirm=%s ms=%.2f msg=%r",
        len(corrections),
        uncertain,
        ms,
        original[:80],
    )
    return CorrectResult(
        original=original,
        corrected=working,
        corrections=corrections,
        requires_confirmation=uncertain,
        processing_ms=ms,
    )
