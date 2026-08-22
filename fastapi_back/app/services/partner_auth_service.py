"""Partner authentication helpers — API key generation and HMAC signature validation."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.utils.app_logger import get_logger

log = get_logger(__name__)

# Replay-attack window in seconds (±5 minutes)
_TIMESTAMP_WINDOW = 300


def generate_api_key() -> str:
    """Generate a cryptographically secure public API key (48 hex chars, prefixed)."""
    return "pk_" + secrets.token_hex(24)


def generate_secret_key() -> str:
    """Generate a cryptographically secure raw secret key (shown once to admin)."""
    return "sk_" + secrets.token_hex(32)


def generate_webhook_secret() -> str:
    """Generate a random webhook signing secret."""
    return "whs_" + secrets.token_hex(24)


def _fernet() -> Fernet:
    """Derive a Fernet key from JWT_SECRET so we can encrypt secrets at rest."""
    from app.config.config import settings
    raw = (settings.JWT_SECRET or "medclues-dev-partner-secret").encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt_secret(raw_secret: str) -> str:
    """Encrypt a raw secret for reversible storage (HMAC verification)."""
    return _fernet().encrypt(raw_secret.encode()).decode()


def decrypt_secret(encrypted: str) -> Optional[str]:
    """Decrypt a stored secret. Returns None if missing/invalid."""
    if not encrypted:
        return None
    try:
        return _fernet().decrypt(encrypted.encode()).decode()
    except (InvalidToken, Exception) as exc:
        log.error("Failed to decrypt partner secret: %s", exc)
        return None


def hash_secret(raw_secret: str) -> str:
    """One-way PBKDF2-HMAC-SHA256 hash of a secret for safe DB storage.
    Unlike bcrypt, PBKDF2 is much faster for high-frequency auth checks.
    """
    salt = raw_secret[:8].encode()  # deterministic salt from key prefix
    dk = hashlib.pbkdf2_hmac("sha256", raw_secret.encode(), salt, 100_000)
    return dk.hex()


def verify_secret(raw_secret: str, stored_hash: str) -> bool:
    """Constant-time comparison of a raw secret against its stored hash."""
    return hmac.compare_digest(hash_secret(raw_secret), stored_hash)


def build_signature_payload(timestamp: str, method: str, path: str, body: bytes) -> bytes:
    """Construct the canonical signing string for request validation.
    Format: {timestamp}.{METHOD}.{path}.{sha256(body_hex)}
    """
    body_hash = hashlib.sha256(body).hexdigest()
    return f"{timestamp}.{method.upper()}.{path}.{body_hash}".encode()


def compute_request_signature(raw_secret: str, timestamp: str,
                              method: str, path: str, body: bytes) -> str:
    """Compute the HMAC-SHA256 signature a partner should include in X-Signature."""
    payload = build_signature_payload(timestamp, method, path, body)
    return hmac.new(raw_secret.encode(), payload, hashlib.sha256).hexdigest()


def verify_request_signature(raw_secret: str, timestamp: str,
                              method: str, path: str, body: bytes,
                              provided_signature: str) -> bool:
    """Validate an incoming partner request's HMAC-SHA256 signature and timestamp."""
    try:
        # Replay protection — reject requests older than ±5 minutes
        ts = int(timestamp)
        if abs(time.time() - ts) > _TIMESTAMP_WINDOW:
            log.warning("Partner auth: timestamp out of window (ts=%s)", ts)
            return False
    except (TypeError, ValueError):
        log.warning("Partner auth: invalid timestamp format: %s", timestamp)
        return False

    expected = compute_request_signature(raw_secret, timestamp, method, path, body)
    return hmac.compare_digest(expected, provided_signature)


def build_webhook_signature(raw_secret: str, payload_body: bytes) -> str:
    """Compute the HMAC-SHA256 signature for an outbound webhook payload."""
    return "sha256=" + hmac.new(raw_secret.encode(), payload_body, hashlib.sha256).hexdigest()
