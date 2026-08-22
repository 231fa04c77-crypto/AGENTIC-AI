"""Detect user language (en / hi / te) and optionally localize replies."""
from __future__ import annotations

import re
from typing import Any

# Devanagari (Hindi) and Telugu Unicode ranges
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
_TELUGU = re.compile(r"[\u0C00-\u0C7F]")

_HI_ROMAN = re.compile(
    r"\b(mujhe|mujhko|hai|hain|kya|bukhar|dard|kal|aaj|doctor|dawai|davai|"
    r"bukhaar|sardi|khansi|madad|chahiye|nahi|nahin|kripya|please)\b",
    re.I,
)
_TE_ROMAN = re.compile(
    r"\b(naku|nenu|undi|unnadi|emi|ela|doctor|mandulu|jwaram|noppi|"
    r"repu|ivvala|cheppandi|kavali|ledi|gadha|gaada)\b",
    re.I,
)


def detect_language(message: str) -> str:
    """Return 'hi', 'te', or 'en'."""
    text = message or ""
    if _TELUGU.search(text):
        return "te"
    if _DEVANAGARI.search(text):
        return "hi"
    # Prefer Telugu romanization if both match weakly — count hits
    te_hits = len(_TE_ROMAN.findall(text))
    hi_hits = len(_HI_ROMAN.findall(text))
    if te_hits > hi_hits and te_hits >= 1:
        return "te"
    if hi_hits >= 1:
        return "hi"
    return "en"


async def localize_reply(text: str, *, language: str, user_message: str = "") -> str:
    """Rewrite assistant reply into hi/te when LLM is available; else return English."""
    lang = (language or "en").lower()
    if lang not in {"hi", "te"} or not (text or "").strip():
        return text
    try:
        from app.services.ai import provider

        if not provider.is_enabled():
            return _fallback_prefix(lang) + text
        lang_name = "Hindi" if lang == "hi" else "Telugu"
        result = await provider.complete_text(
            system_prompt=(
                f"You translate MEDCLUES assistant replies into simple {lang_name} for patients. "
                "Keep medical safety: do not diagnose or prescribe. "
                "Keep booking IDs, doctor names, dates, and times unchanged. "
                "Reply with only the translated text."
            ),
            user_message=f"User said: {user_message}\n\nTranslate this assistant reply:\n{text}",
            history=[],
            grounding="",
        )
        if result.success and (result.content or "").strip():
            return result.content.strip()
    except Exception:
        pass
    return _fallback_prefix(lang) + text


def _fallback_prefix(lang: str) -> str:
    if lang == "hi":
        return "(हिंदी सहायता) "
    if lang == "te":
        return "(తెలుగు సహాయం) "
    return ""


def language_meta(message: str) -> dict[str, Any]:
    lang = detect_language(message)
    return {"language": lang, "isIndic": lang in {"hi", "te"}}
