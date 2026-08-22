import json
import time
import random
from typing import Dict, Optional

from app.config.config import settings

# In-memory fallback when REDIS_URL is unset
otp_store: Dict[str, dict] = {}

OTP_EXPIRY_SECONDS = 5 * 60
MAX_ATTEMPTS = 5
COOLDOWN_SECONDS = 15 * 60

_redis_sync = None
_redis_tried = False


def _get_redis_sync():
    global _redis_sync, _redis_tried
    if _redis_sync is not None:
        return _redis_sync
    if _redis_tried:
        return None
    _redis_tried = True
    url = (getattr(settings, "REDIS_URL", None) or "").strip()
    if not url:
        return None
    try:
        import redis

        client = redis.from_url(url, encoding="utf-8", decode_responses=True, protocol=2)
        client.ping()
        _redis_sync = client
        return _redis_sync
    except Exception:
        _redis_sync = None
        return None


def generate_otp() -> str:
    """Generate secure 6-digit OTP"""
    return str(random.randint(100000, 999999))


def _key(email: str) -> str:
    return f"otp:{email.lower()}"


def store_otp(email: str, otp: str):
    """Store OTP for email (Redis when configured, else in-memory)."""
    email_key = email.lower()
    now = time.time()
    r = _get_redis_sync()

    if r is not None:
        raw = r.get(_key(email_key))
        if raw:
            existing = json.loads(raw)
            if existing.get("cooldown_until") and existing["cooldown_until"] > now:
                remaining_minutes = int((existing["cooldown_until"] - now) / 60) + 1
                raise Exception(
                    f"Please wait {remaining_minutes} minute(s) before requesting a new OTP"
                )
        payload = {
            "otp": otp,
            "expires_at": now + OTP_EXPIRY_SECONDS,
            "attempts": 0,
            "created_at": now,
            "cooldown_until": None,
        }
        r.setex(_key(email_key), OTP_EXPIRY_SECONDS + COOLDOWN_SECONDS, json.dumps(payload))
        return True

    existing = otp_store.get(email_key)
    if existing and existing.get("cooldown_until") and existing["cooldown_until"] > now:
        remaining_minutes = int((existing["cooldown_until"] - now) / 60) + 1
        raise Exception(
            f"Please wait {remaining_minutes} minute(s) before requesting a new OTP"
        )

    otp_store[email_key] = {
        "otp": otp,
        "expires_at": now + OTP_EXPIRY_SECONDS,
        "attempts": 0,
        "created_at": now,
        "cooldown_until": None,
    }
    cleanup_expired_otps()
    return True


def verify_otp(email: str, input_otp: str) -> dict:
    """Verify OTP for email"""
    email_key = email.lower()
    now = time.time()
    r = _get_redis_sync()

    if r is not None:
        raw = r.get(_key(email_key))
        if not raw:
            return {"success": False, "message": "OTP not found. Please request a new OTP"}
        stored = json.loads(raw)
        if stored["expires_at"] < now:
            r.delete(_key(email_key))
            return {"success": False, "message": "OTP has expired. Please request a new OTP"}
        if stored.get("attempts", 0) >= MAX_ATTEMPTS:
            stored["cooldown_until"] = now + COOLDOWN_SECONDS
            r.setex(_key(email_key), COOLDOWN_SECONDS, json.dumps(stored))
            remaining_minutes = int(COOLDOWN_SECONDS / 60)
            return {
                "success": False,
                "message": (
                    f"Too many failed attempts. Please wait {remaining_minutes} "
                    "minutes before requesting a new OTP"
                ),
            }
        if stored["otp"] != input_otp:
            stored["attempts"] = int(stored.get("attempts", 0)) + 1
            r.setex(_key(email_key), OTP_EXPIRY_SECONDS + COOLDOWN_SECONDS, json.dumps(stored))
            return {"success": False, "message": "Invalid OTP"}
        r.delete(_key(email_key))
        return {"success": True, "message": "OTP verified successfully"}

    stored = otp_store.get(email_key)
    if not stored:
        return {"success": False, "message": "OTP not found. Please request a new OTP"}

    if stored["expires_at"] < now:
        del otp_store[email_key]
        return {"success": False, "message": "OTP has expired. Please request a new OTP"}

    if stored["attempts"] >= MAX_ATTEMPTS:
        stored["cooldown_until"] = now + COOLDOWN_SECONDS
        otp_store[email_key] = stored
        remaining_minutes = int(COOLDOWN_SECONDS / 60)
        return {
            "success": False,
            "message": (
                f"Too many failed attempts. Please wait {remaining_minutes} "
                "minutes before requesting a new OTP"
            ),
        }

    if stored["otp"] != input_otp:
        stored["attempts"] += 1
        otp_store[email_key] = stored
        return {"success": False, "message": "Invalid OTP"}

    del otp_store[email_key]
    return {"success": True, "message": "OTP verified successfully"}


def cleanup_expired_otps():
    now = time.time()
    expired = [
        k
        for k, v in otp_store.items()
        if v.get("expires_at", 0) < now and not (v.get("cooldown_until") or 0) > now
    ]
    for k in expired:
        del otp_store[k]
