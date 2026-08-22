"""Lightweight ranking helpers for spelling candidates."""
from __future__ import annotations


def soundex(word: str) -> str:
    """Simple Soundex for ranking among known lexicon candidates."""
    w = "".join(c for c in (word or "").upper() if c.isalpha())
    if not w:
        return ""
    codes = {
        **dict.fromkeys(list("BFPV"), "1"),
        **dict.fromkeys(list("CGJKQSXZ"), "2"),
        **dict.fromkeys(list("DT"), "3"),
        **dict.fromkeys(list("L"), "4"),
        **dict.fromkeys(list("MN"), "5"),
        **dict.fromkeys(list("R"), "6"),
    }
    first = w[0]
    digits = []
    prev = codes.get(first, "0")
    for ch in w[1:]:
        code = codes.get(ch)
        if code and code != prev:
            digits.append(code)
            prev = code
        elif ch in "AEIOUHWY":
            prev = "0"
        # else keep prev for H/W handled above
    return (first + "".join(digits) + "000")[:4]


def rank_candidates(
    token: str,
    candidates: list[tuple[str, float]],
) -> list[tuple[str, float]]:
    """Boost candidates sharing Soundex with token."""
    sx = soundex(token)
    ranked: list[tuple[str, float]] = []
    for cand, score in candidates:
        boost = 0.05 if sx and soundex(cand) == sx else 0.0
        ranked.append((cand, min(0.99, score + boost)))
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked
