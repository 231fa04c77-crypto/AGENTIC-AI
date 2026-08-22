"""Lightweight message normalization for intent matching only."""
from __future__ import annotations

import re
from dataclasses import dataclass

MAX_MESSAGE_CHARS = 2000

# Common misspellings → canonical token (match-only)
_SPELLING: dict[str, str] = {
    "dermotologist": "dermatologist",
    "dermatolgist": "dermatologist",
    "cardiolgist": "cardiologist",
    "paracetmol": "paracetamol",
    "paracetamol": "paracetamol",
    "tomorow": "tomorrow",
    "tommorow": "tomorrow",
    "hospitl": "hospital",
    "hospitle": "hospital",
    "appointmnt": "appointment",
    "appoinment": "appointment",
    "appoitment": "appointment",
    "medicne": "medicine",
    "medcine": "medicine",
    "labratory": "laboratory",
    "diabetis": "diabetes",
    "diabeties": "diabetes",
    "ambulence": "ambulance",
    "recieve": "receive",
    "cancle": "cancel",
    "reshedule": "reschedule",
    "reschedual": "reschedule",
    "fevr": "fever",
    "feaver": "fever",
    "feber": "fever",
    "headche": "headache",
    "hedache": "headache",
    "stomak": "stomach",
    "stomack": "stomach",
    "jwaram": "fever",
    "jwaramu": "fever",
}

# Abbreviations expanded for matching (do not explain here)
_ABBREV: dict[str, str] = {
    "bp": "blood pressure",
    "cbc": "complete blood count blood test",
    "mri": "mri scan lab",
    "ct": "ct scan lab",
    "hba1c": "hba1c blood sugar lab test",
    "ecg": "ecg heart test",
    "ent": "ent specialist",
    "gp": "general physician doctor",
    "opd": "appointment doctor",
}


@dataclass(frozen=True)
class PreprocessResult:
    original: str
    normalized: str
    language: str
    truncated: bool


def detect_language_hint(text: str) -> str:
    """Modular language hook — script ranges only; full NLU later."""
    if re.search(r"[\u0C00-\u0C7F]", text or ""):
        return "te"
    if re.search(r"[\u0900-\u097F]", text or ""):
        return "hi"
    return "en"


def preprocess(message: str | None) -> PreprocessResult:
    raw = "" if message is None else str(message)
    truncated = False
    if len(raw) > MAX_MESSAGE_CHARS:
        raw = raw[:MAX_MESSAGE_CHARS]
        truncated = True

    text = raw.strip().lower()
    text = re.sub(r"[^\w\s'%\-+/]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()

    tokens = text.split()
    fixed: list[str] = []
    for tok in tokens:
        key = tok.strip("'")
        if key in _SPELLING:
            fixed.append(_SPELLING[key])
        elif key in _ABBREV:
            fixed.append(_ABBREV[key])
        else:
            fixed.append(tok)
    normalized = " ".join(fixed)
    return PreprocessResult(
        original=raw,
        normalized=normalized,
        language=detect_language_hint(raw),
        truncated=truncated,
    )
