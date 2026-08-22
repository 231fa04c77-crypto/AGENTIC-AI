"""Meaning normalization for MEDCLUES Assistant (NLU, not keyword chat).

Uses the configured LLM (Cohere primary) to rewrite broken English /
Telugu-English / typos into clear English for intent + RAG. Never expose
the JSON payload to users. On LLM failure, fall back to synonym →
abbreviation → spelling compose.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from app.services.ai import provider
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_SYSTEM_PROMPT = """You are MEDCLUES meaning-normalization NLU.
Rewrite the user message into clear medical-platform English for intent routing.
Handle: broken English, Indian English, Telugu-English / romanized Telugu, typos, short forms.
Do NOT diagnose or prescribe. Do NOT invent clinical facts.
Return ONE JSON object with keys:
- intent_hint: string|null (e.g. symptom_guidance, book_appointment, medicine_info, emergency_help, unknown)
- symptoms: string[] (canonical English symptom names when present)
- duration: string|null (e.g. "2 days")
- severity: string|null (mild|moderate|severe|null)
- language_style: string (en|te-en|hi-en|typo|other)
- needs_clarification: boolean (true if key slot missing for booking/symptoms)
- emergency_risk: boolean (true for chest pain, can't breathe, severe bleeding, stroke, unconscious, etc.)
- normalized_english: string (short clear English paraphrase; keep medical meaning)
Examples:
"fevr" → fever; "naaku fever undi" → I have fever; "ninna nundi thala noppi" → headache since yesterday;
"doctor kavali" → I need a doctor / book appointment; "fever tablet?" → what medicine for fever (education, not prescribe).
"""


@dataclass
class MeaningNormalizeResult:
    intent_hint: str | None = None
    symptoms: list[str] = field(default_factory=list)
    duration: str | None = None
    severity: str | None = None
    language_style: str = "en"
    needs_clarification: bool = False
    emergency_risk: bool = False
    normalized_english: str = ""
    source: str = "fallback"  # llm | fallback | empty
    raw_original: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _local_fallback(text: str) -> MeaningNormalizeResult:
    """synonym → abbreviation → spelling compose (no hard fail)."""
    working = text
    try:
        from app.services.ai.synonym import normalize_message

        working = normalize_message(working).normalized_text or working
    except Exception as exc:  # noqa: BLE001
        log.debug("normalize_meaning synonym skip: %s", type(exc).__name__)
    try:
        from app.services.ai.abbreviation import expand_message

        working = expand_message(working).expanded_text or working
    except Exception as exc:  # noqa: BLE001
        log.debug("normalize_meaning abbrev skip: %s", type(exc).__name__)
    try:
        from app.services.ai.spelling import correct_message

        working = correct_message(working).corrected or working
    except Exception as exc:  # noqa: BLE001
        log.debug("normalize_meaning spelling skip: %s", type(exc).__name__)

    low = working.lower()
    emergency = any(
        cue in low
        for cue in (
            "chest pain",
            "heart attack",
            "cannot breathe",
            "can't breathe",
            "severe bleeding",
            "unconscious",
            "stroke",
            "overdose",
            "choking",
            "seizure",
            "suicidal",
        )
    )
    return MeaningNormalizeResult(
        normalized_english=(working or text).strip(),
        raw_original=text,
        source="fallback",
        emergency_risk=emergency,
        language_style="te-en"
        if any(
            t in low
            for t in ("undi", "kavali", "noppi", "jwaram", "naaku", "ninna", "thala")
        )
        else "en",
    )


def _history_blob(history: list[dict[str, Any]] | None) -> str:
    lines: list[str] = []
    for turn in (history or [])[-6:]:
        role = str(turn.get("role") or "user")
        text = str(turn.get("text") or turn.get("content") or "").strip()
        if text:
            lines.append(f"{role}: {text[:400]}")
    return "\n".join(lines)


def _from_payload(payload: dict[str, Any], *, original: str, fallback: MeaningNormalizeResult) -> MeaningNormalizeResult:
    normalized = str(payload.get("normalized_english") or "").strip()
    if not normalized:
        return fallback
    symptoms_raw = payload.get("symptoms") or []
    symptoms: list[str] = []
    if isinstance(symptoms_raw, list):
        symptoms = [str(s).strip() for s in symptoms_raw if str(s).strip()]
    elif isinstance(symptoms_raw, str) and symptoms_raw.strip():
        symptoms = [symptoms_raw.strip()]
    hint = payload.get("intent_hint")
    return MeaningNormalizeResult(
        intent_hint=str(hint).strip() if hint else None,
        symptoms=symptoms,
        duration=str(payload["duration"]).strip() if payload.get("duration") else None,
        severity=str(payload["severity"]).strip() if payload.get("severity") else None,
        language_style=str(payload.get("language_style") or "en").strip() or "en",
        needs_clarification=bool(payload.get("needs_clarification")),
        emergency_risk=bool(payload.get("emergency_risk")),
        normalized_english=normalized,
        source="llm",
        raw_original=original,
    )


async def normalize_meaning(
    text: str | None,
    *,
    history: list[dict[str, Any]] | None = None,
) -> MeaningNormalizeResult:
    original = (text or "").strip()
    if not original:
        return MeaningNormalizeResult(raw_original=original or "", source="empty")

    fallback = _local_fallback(original)
    if not provider.is_enabled():
        return fallback

    hist = _history_blob(history)
    user_payload = f"Recent turns:\n{hist}\n\nUser message:\n{original}" if hist else original
    try:
        payload = await provider.complete_json(
            system_prompt=_SYSTEM_PROMPT,
            user_message=user_payload[:2500],
            fallback={},
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("normalize_meaning llm failed: %s", type(exc).__name__)
        return fallback

    if not isinstance(payload, dict) or not payload:
        return fallback

    result = _from_payload(payload, original=original, fallback=fallback)
    if result.source == "llm":
        log.info(
            "normalize_meaning source=llm style=%s hint=%s emergency=%s",
            result.language_style,
            result.intent_hint,
            result.emergency_risk,
        )
    return result
