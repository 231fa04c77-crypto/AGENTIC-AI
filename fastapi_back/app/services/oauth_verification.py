"""Verify Google / Firebase ID tokens server-side."""
from typing import Any, Optional

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config.config import settings
from app.utils.app_logger import get_logger

log = get_logger(__name__)


class OAuthVerificationError(Exception):
    pass


def _audiences() -> list[str]:
    raw = settings.GOOGLE_CLIENT_IDS or settings.GOOGLE_CLIENT_ID or ""
    return [a.strip() for a in raw.split(",") if a.strip()]


def verify_google_id_token(raw_token: str) -> dict[str, Any]:
    """
    Verify signature, issuer, audience, and expiration.
    Tries each configured GOOGLE_CLIENT_ID / GOOGLE_CLIENT_IDS audience.
    """
    token = (raw_token or "").strip()
    if not token:
        raise OAuthVerificationError("Missing ID token")

    audiences = _audiences()
    if not audiences:
        raise OAuthVerificationError("Google OAuth client ID not configured on server")

    last_error: Optional[Exception] = None
    for audience in audiences:
        try:
            info = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=audience,
            )
            issuer = info.get("iss", "")
            if issuer not in (
                "accounts.google.com",
                "https://accounts.google.com",
                "securetoken.google.com",
            ) and not issuer.startswith("https://securetoken.google.com/"):
                raise OAuthVerificationError("Invalid token issuer")
            if not info.get("email"):
                raise OAuthVerificationError("Token missing email claim")
            if info.get("email_verified") is False:
                raise OAuthVerificationError("Email not verified by provider")
            return info
        except OAuthVerificationError:
            raise
        except Exception as e:
            last_error = e
            continue

    raise OAuthVerificationError("Invalid or expired ID token") from last_error


def extract_id_token_from_body(body: dict) -> Optional[str]:
    for key in ("idToken", "id_token", "token", "credential"):
        val = body.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def extract_phone_id_token_from_body(body: dict) -> Optional[str]:
    for key in ("phoneIdToken", "phone_id_token", "phoneToken"):
        val = body.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _normalize_phone(value: str) -> str:
    """Keep only digits; compare on the last 10 (national) digits."""
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def verify_firebase_token(raw_token: str) -> dict[str, Any]:
    """
    Verify a Firebase ID token (issued by Firebase Auth — phone, Google, etc.).

    Uses the Firebase project id as the audience and the public Firebase signing
    certs, so it does NOT require the Firebase Admin service account.
    """
    token = (raw_token or "").strip()
    if not token:
        raise OAuthVerificationError("Missing ID token")

    project_id = (settings.FIREBASE_PROJECT_ID or "").strip()
    if not project_id:
        raise OAuthVerificationError("Firebase project id not configured on server")

    try:
        info = id_token.verify_firebase_token(
            token,
            google_requests.Request(),
            audience=project_id,
        )
    except OAuthVerificationError:
        raise
    except Exception as e:  # signature / audience / expiry failures
        raise OAuthVerificationError("Invalid or expired token") from e

    if info.get("iss", "") != f"https://securetoken.google.com/{project_id}":
        raise OAuthVerificationError("Invalid token issuer")
    if info.get("aud") != project_id:
        raise OAuthVerificationError("Invalid token audience")
    return info


def verify_firebase_phone_token(raw_token: str) -> dict[str, Any]:
    """Verify a Firebase **phone** ID token (SMS OTP) — requires a phone claim."""
    info = verify_firebase_token(raw_token)
    if not info.get("phone_number"):
        raise OAuthVerificationError("Token missing verified phone number")
    return info


def phone_numbers_match(claim_phone: str, submitted_phone: str) -> bool:
    """True when the verified token phone matches the phone the user typed."""
    return _normalize_phone(claim_phone) == _normalize_phone(submitted_phone)
