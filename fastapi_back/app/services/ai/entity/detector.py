"""Entity Extraction orchestrator — Module 2 (no tools / APIs / LLM)."""
from __future__ import annotations

import time
from typing import Any, Optional, Union

from app.services.ai.entity.extractors import extract_all, missing_booking_slots
from app.services.ai.entity.schemas import EntityError, EntityResult
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def extract_entities(
    message: Optional[str] = None,
    *,
    context: dict[str, Any] | None = None,
) -> EntityResult:
    """
    Extract structured entities from a user message.

    Pipeline (library path only): Synonym -> Abbreviation -> Spelling -> extractors.
    Never calls backends, invents doctors/slots, or executes workflows.
    """
    _ = context
    started = time.perf_counter()
    try:
        if message is None or (isinstance(message, str) and not message.strip()):
            elapsed = (time.perf_counter() - started) * 1000
            result = EntityResult(
                entities={},
                spans=[],
                missing_for_booking=["specialty_or_doctor", "date", "time_or_slot_preference"],
                processing_ms=elapsed,
                error=EntityError(code="empty_input", message="Message is empty or null"),
                original_message=message or "",
            )
            _log(result, original=message)
            return result

        if not isinstance(message, str):
            message = str(message)

        original = message
        synonym_resolutions: list[dict[str, Any]] = []
        abbreviation_expansions: list[dict[str, Any]] = []
        spelling_corrections: list[dict[str, Any]] = []
        extract_input = message

        try:
            from app.services.ai.synonym import normalize_message

            norm = normalize_message(extract_input)
            extract_input = norm.normalized_text or extract_input
            synonym_resolutions = [r.to_dict() for r in norm.resolutions]
        except Exception as exc:  # noqa: BLE001
            log.debug("synonym_normalize skip: %s", type(exc).__name__)

        try:
            from app.services.ai.abbreviation import expand_message

            abbr = expand_message(extract_input)
            extract_input = abbr.expanded_text or extract_input
            abbreviation_expansions = [e.to_dict() for e in abbr.expansions]
        except Exception as exc:  # noqa: BLE001
            log.debug("abbreviation_expand skip: %s", type(exc).__name__)

        try:
            from app.services.ai.spelling import correct_message

            spell = correct_message(extract_input)
            extract_input = spell.corrected or extract_input
            spelling_corrections = [c.to_dict() for c in spell.corrections]
        except Exception as exc:  # noqa: BLE001
            log.debug("spelling_correct skip: %s", type(exc).__name__)

        entities, spans, normalized, language = extract_all(extract_input)
        elapsed = (time.perf_counter() - started) * 1000
        result = EntityResult(
            entities=entities,
            spans=spans,
            missing_for_booking=missing_booking_slots(entities),
            processing_ms=elapsed,
            normalized_message=normalized,
            language=language,
            error=None,
            original_message=original,
            synonym_resolutions=synonym_resolutions,
            abbreviation_expansions=abbreviation_expansions,
            spelling_corrections=spelling_corrections,
        )
        _log(result, original=message)
        return result

    except Exception as exc:  # noqa: BLE001
        elapsed = (time.perf_counter() - started) * 1000
        result = EntityResult(
            processing_ms=elapsed,
            error=EntityError(code="unexpected_error", message=type(exc).__name__),
            original_message=str(message) if message is not None else "",
        )
        log.exception("entity_engine unexpected_error")
        _log(result, original=message)
        return result


def _log(result: EntityResult, *, original: Union[str, None]) -> None:
    log.info(
        "entity_engine keys=%s missing=%s syn=%s abbr=%s spell=%s ms=%.2f msg=%r",
        list((result.entities or {}).keys()),
        result.missing_for_booking,
        len(result.synonym_resolutions or []),
        len(result.abbreviation_expansions or []),
        len(result.spelling_corrections or []),
        result.processing_ms,
        (original or "")[:120],
    )
