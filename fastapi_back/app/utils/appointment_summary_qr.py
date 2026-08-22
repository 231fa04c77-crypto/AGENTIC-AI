"""Signed Visit Summary QR helpers — unique BK booking ID + HMAC, no ML."""
from __future__ import annotations

import base64
import hashlib
import hmac

from app.config.config import settings
from app.utils.booking_id import is_valid_booking_id, normalize_booking_id

_PURPOSE = "appt-summary-v1"


def _secret_bytes() -> bytes:
    secret = (settings.JWT_SECRET or "").strip() or "dev-only-insecure-jwt-secret-change-me"
    return secret.encode("utf-8")


def sign_appointment_summary(booking_id: str) -> str:
    """Return URL-safe HMAC signature for a booking ID."""
    code = normalize_booking_id(booking_id)
    digest = hmac.new(
        _secret_bytes(),
        f"{_PURPOSE}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def verify_appointment_summary_sig(booking_id: str, sig: str | None) -> bool:
    if not sig or not is_valid_booking_id(booking_id):
        return False
    expected = sign_appointment_summary(booking_id)
    provided = (sig or "").strip()
    if len(provided) != len(expected):
        # Allow padded base64url variants
        try:
            pad = "=" * (-len(provided) % 4)
            raw = base64.urlsafe_b64decode(provided + pad)
            provided = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
        except Exception:
            return False
    return hmac.compare_digest(expected, provided)


def sign_booking_lookup(booking_id: str) -> str:
    """HMAC for unauthenticated BK lookup (staff tools / deep links)."""
    code = normalize_booking_id(booking_id)
    digest = hmac.new(
        _secret_bytes(),
        f"appt-bk-lookup-v1:{code}".encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def verify_booking_lookup_sig(booking_id: str, sig: str | None) -> bool:
    if not sig or not is_valid_booking_id(booking_id):
        return False
    expected = sign_booking_lookup(booking_id)
    provided = (sig or "").strip()
    if len(provided) != len(expected):
        try:
            pad = "=" * (-len(provided) % 4)
            raw = base64.urlsafe_b64decode(provided + pad)
            provided = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
        except Exception:
            return False
    return hmac.compare_digest(expected, provided)


def build_appointment_summary_url(booking_id: str) -> str:
    """
    HTTPS/HTTP URL embedded in the Visit Summary QR.

    Prefer PUBLIC_WEB_BASE_URL → Flutter hash route `/#/a/{BK}?sig=…`.
    Otherwise fall back to API HTML bridge (phone camera friendly).
    """
    code = normalize_booking_id(booking_id)
    sig = sign_appointment_summary(code)
    web = (getattr(settings, "PUBLIC_WEB_BASE_URL", None) or "").strip().rstrip("/")
    if web:
        return f"{web}/#/a/{code}?sig={sig}"
    api = (getattr(settings, "BACKEND_URL", None) or "").strip().rstrip("/")
    if not api:
        api = f"http://localhost:{getattr(settings, 'PORT', 5000)}"
    return f"{api}/link/appointment-summary/{code}?sig={sig}"
