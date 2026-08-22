"""Unique short booking IDs for appointment receipts (BK + 6 alphanumeric)."""
from __future__ import annotations

import json
import random
import re
import string

BOOKING_ID_PATTERN = re.compile(r"^BK[A-Z0-9]{6}$", re.IGNORECASE)
BOOKING_ID_FIND = re.compile(r"BK[A-Z0-9]{6}", re.IGNORECASE)
_CHARS = string.ascii_uppercase + string.digits


def is_valid_booking_id(value: str) -> bool:
    return bool(BOOKING_ID_PATTERN.match((value or "").strip()))


def normalize_booking_id(value: str) -> str:
    return (value or "").strip().upper()


def looks_like_visit_summary_payload(raw: str | None) -> bool:
    """True when scan payload looks like a post-visit summary URL (not check-in QR)."""
    t = (raw or "").strip().lower()
    if not t:
        return False
    return (
        "appointment-summary" in t
        or "/#/a/" in t
        or "/a/bk" in t
        or "sig=" in t and "/a/" in t
    )


def extract_booking_id(raw: str | None) -> str | None:
    """
    Pull a BK…… id from bare codes, signed summary URLs, or JSON payloads.
    Returns normalized uppercase booking id or None.
    """
    text = (raw or "").strip()
    if not text:
        return None

    direct = normalize_booking_id(text)
    if is_valid_booking_id(direct):
        return direct

    # JSON: {"bookingId":"BK…"} / {"type":"appointment","bookingId":…}
    if text.startswith("{") or text.startswith("["):
        try:
            data = json.loads(text)
        except Exception:
            data = None
        if isinstance(data, dict):
            for key in ("bookingId", "booking_id", "code", "id"):
                candidate = data.get(key)
                if candidate is not None:
                    found = extract_booking_id(str(candidate))
                    if found:
                        return found
        elif isinstance(data, list):
            for item in data:
                found = extract_booking_id(json.dumps(item) if not isinstance(item, str) else item)
                if found:
                    return found

    match = BOOKING_ID_FIND.search(text)
    if match:
        return match.group(0).upper()
    return None


def generate_booking_id_candidate() -> str:
    """Random BK + 6 chars (caller must ensure uniqueness in DB)."""
    return "BK" + "".join(random.choice(_CHARS) for _ in range(6))
