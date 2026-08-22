"""Password-reset OTP + signup verified markers — Redis when available, else memory."""
from __future__ import annotations

import json
import random
import time
from typing import Dict, Optional

from app.config.config import settings

# { "role:email": { otp, expires_at, verified, attempts } }
_store: Dict[str, dict] = {}

RESET_EXPIRY_SECONDS = 10 * 60
MAX_VERIFY_ATTEMPTS = 5

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


def _key(role: str, email: str) -> str:
    return f"{role.strip().lower()}:{email.strip().lower()}"


def _redis_key(role: str, email: str) -> str:
    return f"pwdreset:{_key(role, email)}"


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


def store_otp(role: str, email: str, otp: str) -> None:
    key = _key(role, email)
    now = time.time()
    payload = {
        "otp": otp,
        "expires_at": now + RESET_EXPIRY_SECONDS,
        "verified": False,
        "attempts": 0,
        "created_at": now,
    }
    r = _get_redis_sync()
    if r:
        try:
            r.set(_redis_key(role, email), json.dumps(payload), ex=RESET_EXPIRY_SECONDS)
            return
        except Exception:
            pass
    _store[key] = payload


def _load(role: str, email: str) -> Optional[dict]:
    r = _get_redis_sync()
    if r:
        try:
            raw = r.get(_redis_key(role, email))
            if raw:
                return json.loads(raw)
            return None
        except Exception:
            pass
    return _store.get(_key(role, email))


def _save(role: str, email: str, payload: dict) -> None:
    key = _key(role, email)
    ttl = max(1, int(payload.get("expires_at", time.time()) - time.time()))
    r = _get_redis_sync()
    if r:
        try:
            r.set(_redis_key(role, email), json.dumps(payload), ex=ttl)
            return
        except Exception:
            pass
    _store[key] = payload


def _delete(role: str, email: str) -> None:
    r = _get_redis_sync()
    if r:
        try:
            r.delete(_redis_key(role, email))
        except Exception:
            pass
    _store.pop(_key(role, email), None)


def verify_otp(role: str, email: str, input_otp: str, *, consume: bool = False) -> dict:
    stored = _load(role, email)
    if not stored:
        return {"success": False, "message": "OTP not found. Please request a new OTP"}

    now = time.time()
    if stored["expires_at"] < now:
        _delete(role, email)
        return {"success": False, "message": "OTP expired. Please resend."}

    if stored["attempts"] >= MAX_VERIFY_ATTEMPTS:
        return {"success": False, "message": "Too many attempts. Try again later."}

    if stored["otp"] != str(input_otp).strip():
        stored["attempts"] += 1
        _save(role, email, stored)
        return {"success": False, "message": "Invalid OTP. Try again."}

    if consume:
        _delete(role, email)
        return {"success": True, "message": "OK"}

    stored["verified"] = True
    _save(role, email, stored)
    return {"success": True, "message": "OTP verified"}


def is_verified(role: str, email: str, otp: str) -> bool:
    stored = _load(role, email)
    if not stored:
        return False
    if stored["expires_at"] < time.time():
        return False
    return stored.get("verified") and stored["otp"] == str(otp).strip()


def consume_verified_otp(role: str, email: str, otp: str) -> bool:
    if not is_verified(role, email, otp):
        stored = _load(role, email)
        if not stored or stored["otp"] != str(otp).strip():
            return False
    verify_otp(role, email, otp, consume=True)
    return True


# --- Pre-signup email verification ------------------------------------------
_verified_signup_emails: Dict[str, float] = {}
SIGNUP_VERIFIED_WINDOW = 30 * 60


def mark_signup_email_verified(email: str) -> None:
    key = email.strip().lower()
    exp = time.time() + SIGNUP_VERIFIED_WINDOW
    r = _get_redis_sync()
    if r:
        try:
            r.set(f"signup_verified:{key}", str(exp), ex=SIGNUP_VERIFIED_WINDOW)
            return
        except Exception:
            pass
    _verified_signup_emails[key] = exp


def is_signup_email_verified(email: str) -> bool:
    key = email.strip().lower()
    r = _get_redis_sync()
    if r:
        try:
            raw = r.get(f"signup_verified:{key}")
            if raw:
                return float(raw) > time.time()
            return False
        except Exception:
            pass
    exp = _verified_signup_emails.get(key)
    return bool(exp and exp > time.time())


def consume_signup_email_verified(email: str) -> bool:
    key = email.strip().lower()
    r = _get_redis_sync()
    if r:
        try:
            raw = r.get(f"signup_verified:{key}")
            r.delete(f"signup_verified:{key}")
            return bool(raw and float(raw) > time.time())
        except Exception:
            pass
    exp = _verified_signup_emails.pop(key, None)
    return bool(exp and exp > time.time())
