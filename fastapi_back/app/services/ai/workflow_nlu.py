"""Deterministic NLU helpers for workflow follow-ups — not LLM business logic."""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any


_MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

_WEEKDAYS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

_SPECIALTIES = {
    "dermatologist": "Dermatologist",
    "dermatology": "Dermatologist",
    "cardiologist": "Cardiologist",
    "cardiology": "Cardiologist",
    "pediatrician": "Pediatrician",
    "pediatric": "Pediatrician",
    "pediatrics": "Pediatrician",
    "gynecologist": "Gynecologist",
    "gynaecologist": "Gynecologist",
    "gynecology": "Gynecologist",
    "orthopedic": "Orthopedics",
    "orthopaedic": "Orthopedics",
    "orthopedics": "Orthopedics",
    "neurologist": "Neurology",
    "neurology": "Neurology",
    "general physician": "General Physician",
    "physician": "General Physician",
    "gp": "General Physician",
    "dentist": "Dentistry",
    "psychiatrist": "Psychiatry",
    "ent": "ENT",
}

# Symptom / complaint → suggested specialty (not a diagnosis)
_SYMPTOM_SPECIALTY: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(chest pain|difficulty breathing|can'?t breathe|heart attack)\b", re.I), "Cardiologist"),
    (re.compile(r"\b(migraine|severe headache|neurolog)\b", re.I), "Neurology"),
    (re.compile(r"\b(joint pain|knee pain|back pain|orthop|arthritis)\b", re.I), "Orthopedics"),
    (re.compile(r"\b(skin|rash|acne|dermat)\b", re.I), "Dermatologist"),
    (re.compile(r"\b(pregnan|gynec|period pain|pcos)\b", re.I), "Gynecologist"),
    (re.compile(r"\b(child|baby|pediatric)\b", re.I), "Pediatrician"),
    (re.compile(r"\b(tooth|dental|dentist)\b", re.I), "Dentistry"),
    (re.compile(r"\b(ear|nose|throat|ent|sore throat)\b", re.I), "ENT"),
    (re.compile(r"\b(thyroid)\b", re.I), "General Physician"),
    (re.compile(r"\b(asthma|wheez)\b", re.I), "General Physician"),
    (re.compile(r"\b(diabetes|sugar|blood pressure|hypertension|bp)\b", re.I), "General Physician"),
    (re.compile(r"\b(stomach|abdomen|abdominal|gastric|vomit|diarrhea|diarrhoea|nausea)\b", re.I), "General Physician"),
    (re.compile(r"\b(fever|cough|cold|body pain|flu|infection)\b", re.I), "General Physician"),
    (re.compile(r"\b(dizzy|dizziness|vertigo)\b", re.I), "General Physician"),
    (re.compile(r"\b(stress|anxiety|sleep|depres)\b", re.I), "Psychiatry"),
]


def suggest_specialty_from_symptoms(message: str) -> str | None:
    """Map natural-language complaints to a booking specialty suggestion."""
    text = message or ""
    for pattern, specialty in _SYMPTOM_SPECIALTY:
        if pattern.search(text):
            return specialty
    return None


def extract_specialty(message: str, entities: dict[str, Any] | None = None) -> str | None:
    entities = entities or {}
    supplied = str(entities.get("specialty") or "").strip()
    if supplied:
        return supplied[:80]
    lower = (message or "").lower()

    # Prefer Entity Dictionary (Module 4) when available
    try:
        from app.services.ai.entity.dictionary import resolve, resolve_in_message

        hit = resolve(lower, categories=["Specialty"], allow_fuzzy=True)
        if hit:
            return hit.normalized[:80]
        for found in resolve_in_message(lower, categories=["Specialty"]):
            return found.normalized[:80]
    except Exception:  # noqa: BLE001
        pass

    for key, value in _SPECIALTIES.items():
        if re.search(rf"\b{re.escape(key)}\b", lower):
            return value
    from_symptom = suggest_specialty_from_symptoms(message)
    if from_symptom:
        return from_symptom
    # Bare specialty-like token while waiting for specialty step
    clean = re.sub(
        r"\b(book|appointment|doctor|specialist|with|for|on|today|tomorrow|please|a|an|the|"
        r"want|see|consult|having|been|days?|morning|evening)\b",
        " ",
        lower,
    )
    clean = " ".join(clean.split())
    if clean and len(clean.split()) <= 3 and not clean.isdigit() and not re.search(r"\d", clean):
        if clean not in {"yes", "no", "ok", "morning", "evening", "pain"}:
            return clean.title()
    return None


def is_confirm(message: str) -> bool:
    return bool(
        re.fullmatch(
            r"\s*(yes|y|yeah|yep|ok|okay|sure|yes\s*,?\s*please|confirm|confirmed|"
            r"book it|book now|proceed|go ahead|do it|"
            r"haan|haa|ji|theek|thik|sahi|"
            r"avunu|sare|sari|okey|"
            r"हाँ|हां|जी|ठीक|"
            r"అవును|సరే)\s*[!.]?\s*",
            message or "",
            re.I,
        )
    )


def is_abort(message: str) -> bool:
    return bool(
        re.fullmatch(
            r"\s*(cancel|stop|never mind|nevermind|abort|quit|"
            r"nahi|nahin|mat|"
            r"vaddu|ledhu|ledu|"
            r"नहीं|मत|"
            r"వద్దు|లేదు)\s*[!.]?\s*",
            message or "",
            re.I,
        )
    )


_FAMILY_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(mother|mom|mummy|maa|amma|మా|माँ|माता)\b", re.I), "Mother"),
    (re.compile(r"\b(father|dad|daddy|papa|baap|nanna|నాన్న|पिता|पापा)\b", re.I), "Father"),
    (re.compile(r"\b(wife|spouse|biwi|patni|bharya|భార్య|पत्नी)\b", re.I), "Wife"),
    (re.compile(r"\b(husband|pati|bharta|భర్త|पति)\b", re.I), "Husband"),
    (re.compile(r"\b(son|beta|కొడుకు|बेटा)\b", re.I), "Son"),
    (re.compile(r"\b(daughter|beti|kuthuru|కూతురు|बेटी)\b", re.I), "Daughter"),
    (re.compile(r"\b(child|kid|baby|bachcha|పిల్ల|बच्चा)\b", re.I), "Child"),
]


def extract_booking_relationship(message: str) -> str | None:
    """Detect family relationship for non-self booking."""
    text = message or ""
    for pattern, rel in _FAMILY_PATTERNS:
        if pattern.search(text):
            return rel
    return None


def build_actual_patient(
    *,
    relationship: str | None = None,
    profile: dict[str, Any] | None = None,
    is_self: bool = True,
) -> dict[str, Any]:
    """Shape matching POST /api/user/book-appointment actualPatient."""
    if is_self and not relationship and not profile:
        return {"isSelf": True}
    if profile:
        return {
            "isSelf": False,
            "name": profile.get("name") or relationship or "Family member",
            "age": profile.get("age"),
            "gender": profile.get("gender"),
            "relationship": profile.get("relationship") or relationship or "Other",
            "phone": profile.get("phone") or "",
            "savedProfileId": profile.get("id"),
        }
    return {
        "isSelf": False,
        "name": relationship or "Family member",
        "relationship": relationship or "Other",
        "phone": "",
    }


def match_saved_profile(
    profiles: list[dict[str, Any]],
    *,
    relationship: str | None = None,
    message: str = "",
) -> dict[str, Any] | None:
    """Pick a saved family profile by relationship or name mention."""
    if not profiles:
        return None
    lower = (message or "").lower()
    rel_l = (relationship or "").lower()
    if rel_l:
        matches = [
            p
            for p in profiles
            if rel_l in str(p.get("relationship") or "").lower()
            or rel_l in str(p.get("name") or "").lower()
        ]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            # Prefer exact relationship label
            exact = [p for p in matches if str(p.get("relationship") or "").lower() == rel_l]
            return exact[0] if exact else matches[0]
    for p in profiles:
        name = str(p.get("name") or "").strip()
        if name and len(name) >= 2 and name.lower() in lower:
            return p
    return None


def extract_date(message: str, entities: dict[str, Any] | None = None) -> str | None:
    """Return ISO date YYYY-MM-DD when parseable."""
    entities = entities or {}
    lower = (message or "").lower().strip()
    today = date.today()

    if re.search(r"\bday after tomorrow\b", lower):
        return (today + timedelta(days=2)).isoformat()
    if re.search(r"\btomorrow\b", lower):
        return (today + timedelta(days=1)).isoformat()
    if re.fullmatch(r"\s*today\s*", lower) or (
        re.search(r"\btoday\b", lower) and not re.search(r"\b(my|show|list|view)\b", lower)
    ):
        return today.isoformat()

    for name, weekday in _WEEKDAYS.items():
        if re.search(rf"\bnext\s+{name}\b", lower) or re.search(rf"\bon\s+{name}\b", lower) or re.fullmatch(rf"\s*{name}\s*", lower):
            delta = (weekday - today.weekday()) % 7
            if delta == 0:
                delta = 7
            return (today + timedelta(days=delta)).isoformat()

    supplied = str(entities.get("date") or "").strip()
    for value in (supplied, message or ""):
        match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", value)
        if match:
            try:
                return date.fromisoformat(match.group(1)).isoformat()
            except ValueError:
                pass
        # 24 July / 24th July / July 24 / 24/07/2026 / 24-07-2026
        m = re.search(
            r"\b(\d{1,2})(?:st|nd|rd|th)?[\s\-_/]+([A-Za-z]{3,9})(?:[\s\-_/]+(\d{2,4}))?\b",
            value,
            re.I,
        )
        if m:
            day = int(m.group(1))
            month = _MONTHS.get(m.group(2).lower())
            year = int(m.group(3)) if m.group(3) else today.year
            if year < 100:
                year += 2000
            if month and 1 <= day <= 31:
                try:
                    parsed = date(year, month, day)
                    if parsed < today and not m.group(3):
                        parsed = date(year + 1, month, day)
                    return parsed.isoformat()
                except ValueError:
                    pass
        m2 = re.search(
            r"\b([A-Za-z]{3,9})[\s\-_/]+(\d{1,2})(?:st|nd|rd|th)?(?:[\s\-_/]+(\d{2,4}))?\b",
            value,
            re.I,
        )
        if m2 and m2.group(1).lower() in _MONTHS:
            month = _MONTHS[m2.group(1).lower()]
            day = int(m2.group(2))
            year = int(m2.group(3)) if m2.group(3) else today.year
            if year < 100:
                year += 2000
            try:
                parsed = date(year, month, day)
                if parsed < today and not m2.group(3):
                    parsed = date(year + 1, month, day)
                return parsed.isoformat()
            except ValueError:
                pass
        m3 = re.search(r"\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b", value)
        if m3:
            d, mo = int(m3.group(1)), int(m3.group(2))
            year = int(m3.group(3)) if m3.group(3) else today.year
            if year < 100:
                year += 2000
            # Prefer DD/MM for India
            if mo <= 12 and d <= 31:
                try:
                    return date(year, mo, d).isoformat()
                except ValueError:
                    pass
    return None


def extract_time_hint(message: str) -> str | None:
    """Return normalized HH:MM or morning/evening preference."""
    lower = (message or "").lower().strip()
    if re.search(r"\b(morning)\b", lower):
        return "morning"
    if re.search(r"\b(evening|afternoon)\b", lower):
        return "evening"

    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", lower)
    if not m:
        # Bare HH:MM without am/pm
        m = re.search(r"\b(\d{1,2}):(\d{2})\b", lower)
        if not m:
            return None
        hour = int(m.group(1))
        minute = int(m.group(2))
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"
        return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    ampm = m.group(3)
    if ampm == "pm" and hour < 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    if 0 <= hour <= 23 and 0 <= minute <= 59:
        return f"{hour:02d}:{minute:02d}"
    return None


def pick_option(message: str, options: list[dict], *name_keys: str) -> dict | None:
    text = (message or "").strip().lower()
    if not options:
        return None

    ordinals = {
        "first": 0, "1st": 0, "one": 0,
        "second": 1, "2nd": 1, "two": 1,
        "third": 2, "3rd": 2, "three": 2,
        "fourth": 3, "4th": 3,
        "fifth": 4, "5th": 4,
        "last": len(options) - 1,
    }
    for word, idx in ordinals.items():
        if re.search(rf"\b{word}\b", text) or re.search(rf"\bbook\s+{word}\b", text):
            if 0 <= idx < len(options):
                return options[idx]

    if text.isdigit():
        index = int(text) - 1
        if 0 <= index < len(options):
            return options[index]

    # Morning / evening preference against slot labels
    if "morning" in text:
        for option in options:
            blob = " ".join(str(option.get(k) or "") for k in ("label", "displayTime", "time", "slot_type")).lower()
            if "morning" in blob or "morning_opd" in blob:
                return option
    if any(w in text for w in ("evening", "afternoon")):
        for option in options:
            blob = " ".join(str(option.get(k) or "") for k in ("label", "displayTime", "time", "slot_type")).lower()
            if "evening" in blob or "afternoon" in blob or "evening_opd" in blob:
                return option

    time_hint = extract_time_hint(message)
    if time_hint and time_hint not in {"morning", "evening"}:
        for option in options:
            for key in ("time", "displayTime", "start_time"):
                value = str(option.get(key) or "")
                if time_hint in value or value.startswith(time_hint[:2]):
                    return option

    for option in options:
        for key in name_keys:
            value = str(option.get(key) or "").strip().lower()
            if value and (text == value or value in text or text in value):
                return option
        aid = str(option.get("id") or "")
        if aid and aid == text:
            return option
    return None


def to_legacy_slot_date(iso_date: str | None) -> str | None:
    if not iso_date:
        return None
    try:
        d = date.fromisoformat(iso_date[:10])
        return d.strftime("%d_%m_%Y")
    except ValueError:
        return iso_date
