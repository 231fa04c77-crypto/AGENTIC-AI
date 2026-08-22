"""Deterministic hospital check-in codes (no extra DB column)."""
import hashlib
import re
from typing import Optional

from app.config.config import settings

CHECKIN_PATTERN = re.compile(r"^MC-(\d+)-T(\d+)-([A-Z0-9]{4})$", re.IGNORECASE)


def generate_checkin_code(appointment_id: int, token_number: int) -> str:
    """Unique manual + QR fallback ID, e.g. MC-00042-T015-A7X9."""
    appt_id = int(appointment_id)
    token = max(0, int(token_number or 0))
    digest = hashlib.sha256(
        f"{appt_id}:{token}:{settings.JWT_SECRET}".encode("utf-8")
    ).hexdigest()[:4].upper()
    return f"MC-{appt_id:05d}-T{token:03d}-{digest}"


def parse_checkin_code(code: str) -> Optional[dict]:
    m = CHECKIN_PATTERN.match((code or "").strip())
    if not m:
        return None
    return {
        "appointment_id": int(m.group(1)),
        "token_number": int(m.group(2)),
        "suffix": m.group(3).upper(),
    }


def validate_checkin_code(appointment_id: int, token_number: int, code: str) -> bool:
    expected = generate_checkin_code(appointment_id, token_number)
    return expected.upper() == (code or "").strip().upper()
