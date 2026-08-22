"""Validate Intent Dictionary integrity."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.ai.intent.dictionary.intent_schema import IntentDictionary
from app.utils.app_logger import get_logger

log = get_logger(__name__)

# Known tools from Module 3 router + permissions catalog (+ none)
_KNOWN_TOOLS: frozenset[str] = frozenset(
    {
        "none",
        "search_doctors",
        "list_my_appointments",
        "search_hospitals",
        "search_medicine",
        "medicine_info",
        "track_medicine_order",
        "search_labs",
        "list_lab_bookings",
        "explain_lab_report",
        "search_community",
        "propose_create_support_ticket",
        "get_ticket_status",
        "knowledge_search",
        "health_education",
        "symptom_guidance",
        "wellness_info",
        "find_nearest_emergency_hospital",
        "navigate_app",
        "get_my_profile",
        # reserved / mutating names referenced only as metadata
        "book_appointment",
        "cancel_appointment",
        "create_support_ticket",
    }
)

_VALID_STRENGTHS = frozenset({"exact", "phrase", "keyword", "weak"})


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


class IntentDictionaryValidationError(ValueError):
    def __init__(self, result: ValidationResult):
        self.result = result
        msg = "; ".join(result.errors) if result.errors else "validation failed"
        super().__init__(msg)


def validate_dictionary(
    dictionary: IntentDictionary,
    *,
    raise_on_error: bool = True,
    known_tools: frozenset[str] | None = None,
) -> ValidationResult:
    """Validate duplicates, ranges, fallbacks, and tool allowlist."""
    result = ValidationResult()
    tools = known_tools or _KNOWN_TOOLS
    intents = dictionary.intents
    ids = set(intents.keys())

    if "unknown_intent" not in ids:
        result.errors.append("missing required intent: unknown_intent")

    synonym_owners: dict[str, str] = {}

    for intent_id, intent in intents.items():
        if intent.id != intent_id:
            result.errors.append(f"id mismatch key={intent_id!r} id={intent.id!r}")

        if not intent.category:
            result.errors.append(f"{intent_id}: missing category")
        if not intent.workflow:
            result.errors.append(f"{intent_id}: missing workflow")
        if not intent.tool:
            result.errors.append(f"{intent_id}: missing tool")

        if not (0 <= intent.priority <= 100):
            result.errors.append(f"{intent_id}: priority {intent.priority} out of range 0–100")
        if not (0.0 <= intent.confidence_threshold <= 1.0):
            result.errors.append(
                f"{intent_id}: confidence_threshold {intent.confidence_threshold} out of range 0–1"
            )

        if intent.fallback_intent and intent.fallback_intent not in ids:
            result.errors.append(
                f"{intent_id}: unknown fallback_intent={intent.fallback_intent!r}"
            )

        if intent.tool not in tools:
            result.errors.append(f"{intent_id}: unknown tool={intent.tool!r}")

        for pattern in intent.patterns:
            if pattern.strength not in _VALID_STRENGTHS:
                result.errors.append(
                    f"{intent_id}: invalid pattern strength={pattern.strength!r}"
                )
            if not pattern.regex:
                result.errors.append(f"{intent_id}: empty pattern regex")

        for syn in intent.synonyms:
            key = syn.strip().lower()
            if not key:
                continue
            prev = synonym_owners.get(key)
            if prev and prev != intent_id:
                result.warnings.append(
                    f"duplicate synonym {syn!r} on {prev} and {intent_id}"
                )
            else:
                synonym_owners[key] = intent_id

    # Duplicate IDs are prevented by dict load; still check list length if re-parsed
    if len(intents) != len(set(intents.keys())):
        result.errors.append("duplicate intent ids detected")

    for w in result.warnings:
        log.warning("intent_dictionary: %s", w)
    for e in result.errors:
        log.error("intent_dictionary: %s", e)

    if raise_on_error and result.errors:
        raise IntentDictionaryValidationError(result)
    return result


def try_validate_on_startup() -> ValidationResult | None:
    """
    Soft startup validation — never raises.
    Returns ValidationResult or None if load failed.
    """
    try:
        from app.services.ai.intent.dictionary.intent_loader import load_dictionary, default_path

        dictionary = load_dictionary(default_path(), validate=False)
        result = validate_dictionary(dictionary, raise_on_error=False)
        if result.ok:
            log.info(
                "intent_dictionary startup validation ok count=%s",
                len(dictionary.intents),
            )
        else:
            log.error(
                "intent_dictionary startup validation errors=%s",
                len(result.errors),
            )
        return result
    except Exception as exc:  # noqa: BLE001
        log.error("intent_dictionary startup validation failed (soft): %s", exc)
        return None
