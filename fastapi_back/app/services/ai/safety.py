"""Medical safety rules — escalate urgency; soft-redirect clinical asks to education."""
from __future__ import annotations

import re
from typing import Any, Optional

from app.services.ai.constants import DISCLAIMER, URGENCY_HINT

# Cheap TE / romanized → English cues before pattern match
_TE_URGENCY_MAP = (
    (re.compile(r"\bchest\s*pain\b|\bgunde\s*noppi\b|\bheart\s*pain\b", re.I), "chest pain"),
    (re.compile(r"\b(upaasa|upasa)\s*ragaledu\b|\bswasa\s*(raadu|ragaledu)\b|\bcant?\s*breathe\b", re.I), "cannot breathe"),
    (re.compile(r"\b(severe|ekkuva)\s*(bleeding|raktam)\b|\braktam\s*aagaledu\b", re.I), "severe bleeding"),
    (re.compile(r"\bunconscious\b|\bconsciousness\s*ledhu\b|\bpadipoyadu\b", re.I), "unconscious"),
    (re.compile(r"\bstroke\b|\blakshanalu\s*stroke\b", re.I), "stroke"),
    (re.compile(r"\bheart\s*attack\b|\bgunde\s*attack\b", re.I), "heart attack"),
)


def _expand_te_urgency(msg: str) -> str:
    out = msg or ""
    for pattern, english in _TE_URGENCY_MAP:
        if pattern.search(out):
            out = f"{out} {english}"
    return out


# Hard refuse: personal diagnosis / prescribe-for-me / self-medicate / dying
_HARD_CLINICAL = re.compile(
    r"\b(diagnos(e|is|ing)( me| what)|do i have (a |an )?(disease|condition|cancer|infection)|"
    r"what disease (do )?i have|is this cancer|prescribe( me)?|prescription for me|"
    r"am i dying|self[- ]medicat)\b",
    re.I,
)

# Soft: general “what should I take” → education + CTAs (not a personal Rx)
_SOFT_CLINICAL = re.compile(
    r"\b(what medicine should i take|which medicine (should|can) i|"
    r"what (should|do) i take for|what (can|should) i take for|"
    r"can you (diagnose|prescribe)|tell me (my )?diagnosis|"
    r"what disease (do i have|is this)|"
    r"(fever|headache|cold|cough|jwaram)\s+(tablet|medicine|pill)|"
    r"tablet\s+(for|ki)\s+(fever|jwaram|headache))\b",
    re.I,
)

_URGENCY = re.compile(
    r"\b(chest pain|can'?t breathe|cannot breathe|severe bleeding|unconscious|stroke|"
    r"heart attack|suicidal|overdose|choking|seizure)\b",
    re.I,
)

_MEDICINE_CUE = re.compile(
    r"\b(medicine|tablet|pill|drug|paracetamol|ibuprofen|antibiotic|dose|take for)\b",
    re.I,
)


def safety_block(message: str) -> Optional[dict]:
    """Urgency is terminal. Soft clinical returns a redirect hint. Hard clinical refuses with CTAs."""
    msg = _expand_te_urgency(message or "")
    if _URGENCY.search(msg):
        return {
            "success": True,
            "intent": "emergency_help",
            "reply": URGENCY_HINT + " I can help you find nearby hospitals if you want.",
            "tool": "find_nearest_emergency_hospital",
            "proposeTool": "find_nearest_emergency_hospital",
            "disclaimer": DISCLAIMER,
            "safety": "urgency",
        }

    # Prefer soft education path over hard refuse when the ask is “what should I take…”
    soft = clinical_soft_redirect(msg)
    if soft:
        return soft

    if _HARD_CLINICAL.search(msg):
        return {
            "success": True,
            "intent": "refuse_clinical",
            "reply": (
                "I can’t diagnose your condition or prescribe medicines for you. "
                "I can share general health information, help you book a doctor, "
                "or open Medical Community for verified doctor answers. "
                "Seek emergency care if you feel unsafe."
            ),
            "tool": None,
            "disclaimer": DISCLAIMER,
            "safety": "clinical_refuse",
            "suggestions": ["Book appointment", "Search Medical Community", "What is fever?"],
            "actions": [
                {"label": "Book a doctor", "message": "Book appointment"},
                {"label": "Medical Community", "message": "Open Medical Community"},
            ],
        }
    return None


def clinical_soft_redirect(message: str) -> Optional[dict[str, Any]]:
    """Map prescribe/diagnose-style asks to education tools instead of a blank refuse."""
    msg = message or ""
    if not _SOFT_CLINICAL.search(msg):
        return None

    # True “diagnose me / am I dying / prescribe me” without soft phrasing → hard path
    if _HARD_CLINICAL.search(msg) and not re.search(
        r"\b(what medicine should i take|what (should|do|can) i take for)\b", msg, re.I
    ):
        return None

    if _MEDICINE_CUE.search(msg) or re.search(r"\b(take|medicine|tablet)\b", msg, re.I):
        intent, tool = "medicine_info", "medicine_info"
    elif re.search(r"\b(symptom|fever|pain|cough|rash)\b", msg, re.I):
        intent, tool = "symptom_guidance", "symptom_guidance"
    else:
        intent, tool = "health_education", "health_education"

    return {
        "success": True,
        "intent": intent,
        "suggested_tool": tool,
        "safety": "clinical_soft",
        "softRedirect": True,
        "disclaimer": DISCLAIMER,
        "prefix": (
            "I can’t prescribe or diagnose for you personally. "
            "Here is general information, then you can book a doctor if needed. "
        ),
    }


def attach_disclaimer(payload: dict) -> dict:
    payload = dict(payload or {})
    payload.setdefault("disclaimer", DISCLAIMER)
    return payload
