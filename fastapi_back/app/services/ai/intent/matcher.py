"""Multi-intent pattern matcher — dictionary-driven with Python fallback."""
from __future__ import annotations

import re
from typing import NamedTuple

from app.utils.app_logger import get_logger

log = get_logger(__name__)


class MatchHit(NamedTuple):
    intent: str
    strength: str  # exact | phrase | keyword | weak


# Each rule: (intent, strength, compiled pattern)
_RULES: list[tuple[str, str, re.Pattern[str]]] = []
_BUILT_FROM: str = ""  # "dictionary" | "fallback"


def _add(intent: str, strength: str, pattern: str) -> None:
    _RULES.append((intent, strength, re.compile(pattern, re.I)))


def _escape_phrase(phrase: str) -> str:
    parts = [re.escape(p) for p in phrase.strip().split() if p]
    if not parts:
        return ""
    return r"\b" + r"\s+".join(parts) + r"\b"


def _build_from_dictionary() -> bool:
    """Build rules from Intent Dictionary patterns + synonym/example keyword boosts."""
    try:
        from app.services.ai.intent.dictionary import get_dictionary

        dictionary = get_dictionary(validate=True, raise_on_error=False)
    except Exception as exc:  # noqa: BLE001
        log.warning("intent matcher dictionary unavailable: %s", exc)
        return False

    if not dictionary.intents:
        return False

    count = 0
    for intent in dictionary.intents.values():
        if intent.id == "unknown_intent":
            continue
        for pattern in intent.patterns:
            try:
                _add(intent.id, pattern.strength, pattern.regex)
                count += 1
            except re.error as exc:
                log.warning(
                    "intent matcher bad regex intent=%s: %s", intent.id, exc
                )

        # Synonym / alias keyword boosts (YAML-only synonym recognition)
        for phrase in (
            *intent.synonyms,
            *intent.aliases,
            *intent.synonyms_hi,
        ):
            esc = _escape_phrase(phrase)
            if not esc:
                continue
            # keyword so typical confidence_threshold (0.5–0.6) still accepts
            try:
                _add(intent.id, "keyword", esc)
                count += 1
            except re.error:
                continue

        # Short exact-ish example boosts (EN + TE romanized)
        for example in (*intent.examples[:5], *intent.examples_te[:8]):
            esc = _escape_phrase(example)
            if not esc or len(example.strip()) < 3:
                continue
            try:
                _add(intent.id, "phrase", rf"^\s*{esc}\s*[!.]?\s*$")
                count += 1
                # Also keyword hit for TE phrases inside longer messages
                if example in intent.examples_te:
                    _add(intent.id, "keyword", esc)
                    count += 1
            except re.error:
                continue

    if count == 0:
        return False
    log.info("intent matcher built from dictionary rules=%s", count)
    return True


def _build_fallback() -> None:
    """Hardcoded rules — used when dictionary is missing or empty."""
    # --- Emergency (highest priority category) ---
    _add(
        "emergency_help",
        "phrase",
        r"\b(chest pain|heart attack|can'?t breathe|cannot breathe|stroke|"
        r"severe bleeding|heavy bleeding|unconscious|poison|overdose|choking|"
        r"seizure|suicidal)\b",
    )
    _add("emergency_help", "keyword", r"\b(emergency|casualty|urgent care)\b")
    _add("ambulance", "phrase", r"\b(need|call|want)\s+(an?\s+)?ambulance\b|\bambulance\b")
    _add(
        "nearest_emergency_hospital",
        "phrase",
        r"\b(nearest|nearby)\b.*\b(emergency|er)\b.*\b(hospital|clinic)\b|"
        r"\bemergency hospital\b",
    )

    # --- Greetings / conversation (exact-ish) ---
    _add(
        "greeting",
        "exact",
        r"^\s*(hi|hello|hey|good\s+(morning|afternoon|evening)|namaste|"
        r"namaskaram|greetings)\s*[!.]?\s*$",
    )
    _add("thank_you", "exact", r"^\s*(thanks|thank\s+you|thx|ty)\s*[!.]?\s*$")
    _add(
        "goodbye",
        "exact",
        r"^\s*(bye|goodbye|good\s+night|see\s+you|take\s+care)\s*[!.]?\s*$",
    )
    _add(
        "small_talk",
        "phrase",
        r"^\s*(how\s+are\s+you|how'?s\s+it\s+going|what'?s\s+up)\s*[?.!]?\s*$",
    )
    _add("help", "exact", r"^\s*(help|i\s+need\s+help|need\s+help)\s*[!.]?\s*$")
    _add("faq", "keyword", r"\b(faq|frequently asked|how (do|to) (i )?use)\b")

    # --- Appointment ---
    _add(
        "book_appointment",
        "phrase",
        r"\b(book|schedule)\b.*\b(appoint(ment)?|doctor|visit|slot|"
        r"dermatolog\w*|cardiolog\w*|specialist)\b|"
        r"\b(need|want)\s+(an?\s+)?(appointment|doctor)\b|"
        r"\b(see|visit)\s+a\s+(doctor|dermatolog\w*|specialist)\b|"
        r"\bbook\s+(for\s+)?(my\s+)?(mother|father|mom|dad)\b|"
        r"\bbook\s+(first\s+)?doctor\b|"
        r"\bneed\s+dermatolog\w*\b|"
        r"\btomorrow\s+(morning|evening)?\b.*\b(book|appoint|doctor)\b|"
        r"\b(book|appoint|doctor).*\btomorrow\b",
    )
    _add(
        "cancel_appointment",
        "phrase",
        r"\b(cancel|cancle)\b.*\b(appoint|booking|visit)\b|"
        r"\bcancel\s+(my\s+)?booking\b",
    )
    _add(
        "reschedule_appointment",
        "phrase",
        r"\b(reschedule|change)\b.*\b(appoint|slot|time|booking)\b|"
        r"\bchange\s+appointment\b",
    )
    _add(
        "view_appointment",
        "phrase",
        r"\b(my|show|list|view|upcoming)\b.*\bappointments?\b|"
        r"\bopen\s+appointments?\b|"
        r"\bwhat appointments?\b",
    )
    _add(
        "check_appointment_status",
        "phrase",
        r"\b(appointment|booking)\s+status\b|\bstatus\s+of\s+(my\s+)?(appointment|booking)\b",
    )
    _add(
        "check_doctor_availability",
        "phrase",
        r"\b(doctor|slot)\s+availability\b|\bavailable\s+(slots?|doctors?)\b|"
        r"\bis\s+(the\s+)?doctor\s+available\b",
    )

    # --- Doctor ---
    _add(
        "search_specialist",
        "phrase",
        r"\b(find|search|need|looking for)\b.*\b(dermatolog\w*|cardiolog\w*|"
        r"pediatric\w*|gynecolog\w*|orthop\w*|neurolog\w*|specialist)\b|"
        r"\bneed\s+dermatolog\w*\b",
    )
    _add(
        "search_doctor",
        "phrase",
        r"\b(find|search|looking for)\b.*\bdoctor\b",
    )
    _add(
        "doctor_details",
        "phrase",
        r"\b(doctor|dr\.?)\s+(details|profile|info|information)\b|"
        r"\btell me about (the |this )?doctor\b",
    )

    # --- Hospital ---
    _add(
        "nearby_hospital",
        "phrase",
        r"\b(nearest|nearby)\b.*\bhospital\b|\bhospital\s+near\s+me\b",
    )
    _add(
        "search_hospital",
        "phrase",
        r"\b(find|search)\b.*\bhospital\b",
    )
    _add(
        "hospital_information",
        "phrase",
        r"\bhospital\s+(info|information|details|about)\b",
    )

    # --- Pharmacy ---
    _add(
        "order_medicine",
        "phrase",
        r"\b(order|buy)\b.*\b(medicine|drug|paracetamol|tablet)\b|"
        r"\bwhere can i (get|buy)\b.*\b(medicine|paracetamol)\b",
    )
    _add(
        "track_medicine_order",
        "phrase",
        r"\b(track|where is)\b.*\b(order|medicine|delivery|pharmacy)\b|"
        r"\bpharmacy order\b",
    )
    _add(
        "medicine_information",
        "phrase",
        r"\bwhat (is|are)\b.*\b(paracetamol|medicine|tablet|ibuprofen|metformin)\b|"
        r"\b(paracetamol|ibuprofen|metformin)\b.*\b(for|use|used|side effects?)\b|"
        r"\b(uses?|side effects?)\b.*\b(medicine|tablet|paracetamol)\b|"
        r"\bmedicine information\b|\bneed medicine\b(?!.*\b(order|buy|track)\b)",
    )
    _add(
        "search_medicine",
        "keyword",
        r"\b(search|find)\b.*\b(medicine|pharmacy|drug)\b|\bneed medicine\b",
    )

    # --- Lab ---
    _add(
        "book_lab_test",
        "phrase",
        r"\b(book|need)\b.*\b(lab|blood test|cbc|hba1c)\b|"
        r"\bbook\s+blood\s+test\b|\bblood test\b",
    )
    _add(
        "explain_reports",
        "phrase",
        r"\b(explain|what does|mean)\b.*\b(lab|report|cbc|hemoglobin|result)\b|"
        r"\bexplain\s+(my\s+)?(lab\s+)?reports?\b",
    )
    _add(
        "view_reports",
        "phrase",
        r"\b(show|view|my|open)\b.*\b(lab\s+)?reports?\b|\bshow reports\b|"
        r"\bview reports\b",
    )
    _add(
        "search_laboratory",
        "keyword",
        r"\b(find|search)\b.*\b(lab|laboratory)\b",
    )

    # --- Community ---
    _add(
        "ask_community_question",
        "phrase",
        r"\b(ask|post)\b.*\b(community|forum)\b|\bcommunity question\b",
    )
    _add(
        "read_community_answers",
        "phrase",
        r"\b(read|doctor answered)\b.*\bcommunity\b",
    )
    _add(
        "search_community",
        "keyword",
        r"\b(community|forum|health question)\b",
    )

    # --- Support ---
    _add(
        "raise_complaint",
        "phrase",
        r"\b(raise|file|make|submit)\b.*\b(complaint|ticket)\b|"
        r"\b(wasn'?t delivered|not delivered|support ticket)\b",
    )
    _add(
        "track_complaint",
        "phrase",
        r"\b(ticket status|track\b.*\b(ticket|complaint)|my complaint)\b|"
        r"\btrack complaint\b",
    )
    _add("feedback", "keyword", r"\b(feedback|rate (the )?app|review)\b")

    # --- Health education ---
    _add(
        "disease_information",
        "phrase",
        r"\bwhat (is|are)\b.*(diabetes|asthma|thyroid|migraine|hypertension|"
        r"anemia|fever|infection|covid)|"
        r"\b(symptoms? of|causes? of|tell me about)\b.*"
        r"\b(diabetes|asthma|thyroid|migraine)\b|"
        r"\bknow what diabetes is\b|\bwhat diabetes is\b",
    )
    _add(
        "symptom_guidance",
        "phrase",
        r"\b(i (have|feel)|feeling|suffering from)\b.*"
        r"\b(fever|cough|pain|rash|dizzy|headache)\b|"
        r"\b(fever|body pain|sore throat)\b.*\b(reason|why|what)\b",
    )
    _add(
        "mental_health",
        "phrase",
        r"\b(mental health|anxiety|depres|stress)\b.*"
        r"\b(help|advice|unable to sleep|insomnia)\b|"
        r"\bunable to sleep\b",
    )
    _add("nutrition", "keyword", r"\b(nutrition|diet|foods? to eat|healthy food)\b")
    _add("exercise", "keyword", r"\b(exercise|workout|fitness|yoga)\b")
    _add(
        "wellness_advice",
        "keyword",
        r"\b(wellness|healthy (routine|lifestyle)|improve my health)\b",
    )

    # --- Navigation ---
    _add("open_pharmacy", "phrase", r"\b(open|go to|take me to)\b.*\bpharmacy\b|\bopen pharmacy\b")
    _add("open_reports", "phrase", r"\b(open|go to)\b.*\breports?\b|\bopen reports\b")
    _add(
        "open_appointments",
        "phrase",
        r"\b(open|go to)\b.*\bappointments?\b",
    )
    _add("open_dashboard", "phrase", r"\b(open|go to)\b.*\bdashboard\b")
    _add("open_profile", "phrase", r"\b(open|go to)\b.*\bprofile\b")
    _add("open_settings", "phrase", r"\b(open|go to)\b.*\bsettings?\b")
    log.info("intent matcher built from Python fallback rules=%s", len(_RULES))


def _build() -> None:
    global _BUILT_FROM
    if _RULES:
        return
    if _build_from_dictionary():
        _BUILT_FROM = "dictionary"
    else:
        _build_fallback()
        _BUILT_FROM = "fallback"


def rebuild_rules() -> str:
    """Clear and rebuild matcher rules (call after dictionary reload)."""
    global _BUILT_FROM
    _RULES.clear()
    _BUILT_FROM = ""
    _build()
    return _BUILT_FROM


def rules_source() -> str:
    _build()
    return _BUILT_FROM


def match_all(normalized_message: str) -> list[MatchHit]:
    """Return all intent hits (may include duplicates — caller dedupes by max strength)."""
    _build()
    text = normalized_message or ""
    if not text.strip():
        return []

    hits: list[MatchHit] = []
    seen_strength: dict[str, str] = {}
    strength_rank = {"exact": 4, "phrase": 3, "keyword": 2, "weak": 1}

    for intent, strength, pattern in _RULES:
        if not pattern.search(text):
            continue
        prev = seen_strength.get(intent)
        if prev is None or strength_rank[strength] > strength_rank[prev]:
            seen_strength[intent] = strength

    for intent, strength in seen_strength.items():
        hits.append(MatchHit(intent=intent, strength=strength))
    return hits
