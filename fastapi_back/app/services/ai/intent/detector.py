"""Intent Engine orchestrator — pure detection, no APIs / tools / LLM."""
from __future__ import annotations

import time
from typing import Any, Optional, Union

from app.services.ai.intent.ambiguity import requires_clarification
from app.services.ai.intent.catalog import message_type_for
from app.services.ai.intent.confidence import filter_by_threshold, score_hit
from app.services.ai.intent.matcher import match_all
from app.services.ai.intent.preprocess import preprocess
from app.services.ai.intent.ranking import rank_hits
from app.services.ai.intent.schemas import IntentError, IntentResult
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def detect_intents(
    message: Optional[str] = None,
    *,
    context: dict[str, Any] | None = None,
) -> IntentResult:
    """
    Analyze a user message and return structured multi-intent output.

    Does not call backends, tools, Redis, or LLMs.
    `context` is accepted for future modules and ignored for matching today.
    """
    _ = context  # reserved for entity / workflow modules
    started = time.perf_counter()

    try:
        if message is None or (isinstance(message, str) and not message.strip()):
            elapsed = (time.perf_counter() - started) * 1000
            result = IntentResult(
                primary_intent="unknown_intent",
                secondary_intents=[],
                confidence={"unknown_intent": 0.0},
                requires_clarification=True,
                message_type="unknown",
                processing_ms=elapsed,
                normalized_message="",
                language="en",
                error=IntentError(
                    code="empty_input",
                    message="Message is empty or null",
                ),
            )
            _log(result, original=message)
            return result

        if not isinstance(message, str):
            message = str(message)

        prep = preprocess(message)
        hits = match_all(prep.normalized)
        scored = [
            score_hit(
                h.intent,
                h.strength,
                message_len=len(prep.normalized),
                hit_count=len(hits),
            )
            for h in hits
        ]
        accepted = filter_by_threshold(scored)
        ranked = rank_hits(accepted)

        if not ranked:
            conf_map = {"unknown_intent": 0.3}
            primary = "unknown_intent"
            secondary: list[str] = []
            msg_type = "unknown"
            clarify = True
        else:
            primary = ranked[0].intent
            secondary = [h.intent for h in ranked[1:4]]
            conf_map = {h.intent: h.confidence for h in ranked}
            msg_type = message_type_for(primary)
            clarify = requires_clarification(prep.original, prep.normalized, ranked)

        elapsed = (time.perf_counter() - started) * 1000
        result = IntentResult(
            primary_intent=primary,
            secondary_intents=secondary,
            confidence=conf_map,
            requires_clarification=clarify,
            message_type=msg_type,
            processing_ms=elapsed,
            normalized_message=prep.normalized,
            language=prep.language,
            error=None,
            truncated=prep.truncated,
        )
        _log(result, original=message)
        return result

    except Exception as exc:  # noqa: BLE001 — always return structured error
        elapsed = (time.perf_counter() - started) * 1000
        result = IntentResult(
            primary_intent="unknown_intent",
            secondary_intents=[],
            confidence={"unknown_intent": 0.0},
            requires_clarification=True,
            message_type="unknown",
            processing_ms=elapsed,
            normalized_message="",
            language="en",
            error=IntentError(code="unexpected_error", message=type(exc).__name__),
        )
        log.exception("intent_engine unexpected_error")
        _log(result, original=message)
        return result


def _log(result: IntentResult, *, original: Union[str, None]) -> None:
    log.info(
        "intent_engine primary=%s secondary=%s clarify=%s type=%s ms=%.2f msg=%r",
        result.primary_intent,
        result.secondary_intents,
        result.requires_clarification,
        result.message_type,
        result.processing_ms,
        (original or "")[:120],
    )
