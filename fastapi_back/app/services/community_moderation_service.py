"""Multi-layer community content moderation (rules + optional LLM)."""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.config.config import settings
from app.config.db import db
from app.utils.app_logger import get_logger

log = get_logger(__name__)

SPAM_PATTERNS = [
    r"(?i)\b(buy now|click here|crypto|forex|whatsapp\s*\+?\d{8,}|telegram\s*@)\b",
    r"(?i)\b(viagra|casino|loan approval|make money fast)\b",
    r"(?i)https?://\S+",
]
PROFANITY = re.compile(
    r"(?i)\b(fuck|shit|bitch|asshole|bastard|slut|whore|nigger|rape)\b"
)
PII_PATTERNS = [
    r"\b\d{10}\b",  # phone-ish
    r"\b\d{12}\b",  # aadhaar-ish
    r"(?i)\b[A-Z]{5}\d{4}[A-Z]\b",  # PAN
    r"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}",
]
REPEATED_CHAR = re.compile(r"(.)\1{7,}")
KEYBOARD_MASH = re.compile(r"(?i)^(asdf|qwer|zxcv|lorem|testtest|aaaa)+")


def _rules_scan(title: str, body: str) -> dict[str, Any]:
    text = f"{title}\n{body}".strip()
    reasons: list[str] = []
    score = 0.0

    if len(title.strip()) < 8 or len(body.strip()) < 20:
        reasons.append("too_short")
        score += 0.4
    if REPEATED_CHAR.search(text):
        reasons.append("repeated_characters")
        score += 0.5
    if KEYBOARD_MASH.search(title.replace(" ", "")):
        reasons.append("nonsense_text")
        score += 0.7
    if PROFANITY.search(text):
        reasons.append("profanity")
        score += 0.8
    for pat in SPAM_PATTERNS:
        if re.search(pat, text):
            reasons.append("spam_or_advertisement")
            score += 0.9
            break
    for pat in PII_PATTERNS:
        if re.search(pat, text):
            reasons.append("sensitive_personal_information")
            score += 0.6
            break
    # Random keyboard density
    letters = re.findall(r"[a-zA-Z]", text)
    if len(letters) > 40:
        uniq = len(set(c.lower() for c in letters))
        if uniq < 8:
            reasons.append("nonsense_text")
            score += 0.7

    if score >= 1.2 or "spam_or_advertisement" in reasons and score >= 0.9:
        decision = "dangerous"
    elif score >= 0.5 or reasons:
        decision = "suspicious"
    else:
        decision = "safe"

    return {"decision": decision, "reasons": reasons, "score": round(score, 3), "engine": "rules"}


async def _llm_refine(title: str, body: str, base: dict) -> dict[str, Any]:
    """Optional Gemini/OpenAI second pass when configured."""
    api_key = (settings.GEMINI_API_KEY or settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        return base

    prompt = (
        "You are a healthcare community moderator. Classify the post.\n"
        "Return ONLY JSON: {\"decision\":\"safe|suspicious|dangerous\",\"reasons\":[\"...\"]}\n"
        "Flag: spam, ads, harassment, hate, sexual content, scams, illegal, medical misinformation "
        "that could cause harm, or sensitive PII.\n"
        f"Title: {title[:300]}\nBody: {body[:1200]}\n"
        f"Rules pre-score: {base}"
    )
    try:
        if settings.GEMINI_API_KEY:
            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            )
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
            if resp.status_code >= 400:
                return base
            data = resp.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
        else:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0,
                    },
                )
            if resp.status_code >= 400:
                return base
            text = resp.json()["choices"][0]["message"]["content"]

        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return base
        parsed = json.loads(m.group(0))
        decision = (parsed.get("decision") or base["decision"]).lower()
        if decision not in ("safe", "suspicious", "dangerous"):
            decision = base["decision"]
        reasons = list({*base.get("reasons", []), *(parsed.get("reasons") or [])})
        # escalate only — never downgrade dangerous from rules
        order = {"safe": 0, "suspicious": 1, "dangerous": 2}
        if order[decision] < order[base["decision"]]:
            decision = base["decision"]
        return {
            "decision": decision,
            "reasons": reasons,
            "score": base.get("score", 0),
            "engine": "rules+llm",
        }
    except Exception as exc:
        log.warning("LLM moderation skipped: %s", type(exc).__name__)
        return base


async def log_decision(
    *,
    target_type: str,
    target_id: int | None,
    author_user_id: int | None,
    result: dict,
    excerpt: str,
) -> None:
    try:
        await db.execute(
            """
            INSERT INTO community_moderation_logs (
                target_type, target_id, author_user_id, decision, reasons, score, engine, raw_excerpt
            ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
            """,
            target_type,
            target_id,
            author_user_id,
            result.get("decision"),
            json.dumps(result.get("reasons") or []),
            float(result.get("score") or 0),
            result.get("engine") or "rules",
            (excerpt or "")[:500],
        )
    except Exception as exc:
        log.warning("moderation log failed: %s", exc)


async def moderate_content(
    title: str,
    body: str,
    *,
    target_type: str = "question",
    target_id: int | None = None,
    author_user_id: int | None = None,
    use_llm: bool = True,
) -> dict[str, Any]:
    """
    Returns decision: safe | suspicious | dangerous + reasons.
    Safe → publish; Suspicious → pending_moderation; Dangerous → reject.
    """
    base = _rules_scan(title or "", body or "")
    result = await _llm_refine(title or "", body or "", base) if use_llm else base
    await log_decision(
        target_type=target_type,
        target_id=target_id,
        author_user_id=author_user_id,
        result=result,
        excerpt=f"{title}\n{body}",
    )
    return result
