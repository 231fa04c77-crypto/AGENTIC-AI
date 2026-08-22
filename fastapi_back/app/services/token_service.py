"""JWT access + refresh token helpers."""
import hashlib
import hmac
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple

from jose import jwt, JWTError

from app.config.config import settings

VALID_ROLES = frozenset({"patient", "doctor", "dean", "admin", "receptionist"})


def _access_secret() -> str:
    return (settings.JWT_SECRET or "").strip('"').strip("'")


def _refresh_secret() -> str:
    return (settings.REFRESH_TOKEN_SECRET or settings.JWT_SECRET or "").strip('"').strip("'")


def hash_refresh_token(raw_token: str) -> str:
    """HMAC-SHA256 with server secret — prevents rainbow-table attacks on DB leaks."""
    secret = _refresh_secret().encode("utf-8")
    return hmac.new(secret, raw_token.encode("utf-8"), hashlib.sha256).hexdigest()


def access_token_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)


def refresh_token_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


def create_access_token(
    role: str,
    *,
    user_id: Optional[int] = None,
    email: Optional[str] = None,
    hospital_id: Optional[int] = None,
) -> str:
    role = role.strip().lower()
    payload = {
        "token_type": "access",
        "role": role,
        "exp": access_token_expires_at(),
    }
    if role == "admin":
        payload["email"] = email
    elif role in ("dean", "receptionist"):
        payload["id"] = user_id
        payload["hospital_id"] = hospital_id
    else:
        uid = int(user_id) if user_id is not None else None
        payload["id"] = uid
        payload["userId"] = uid  # backward-compatible alias for clients
    return jwt.encode(payload, _access_secret(), algorithm="HS256")


def create_refresh_token(
    role: str,
    *,
    user_id: Optional[int] = None,
    email: Optional[str] = None,
    hospital_id: Optional[int] = None,
) -> Tuple[str, str, str]:
    """Return (raw_jwt, jti, user_key)."""
    role = role.strip().lower()
    jti = str(uuid.uuid4())
    payload = {
        "jti": jti,
        "token_type": "refresh",
        "role": role,
        "exp": refresh_token_expires_at(),
    }
    if role == "admin":
        payload["email"] = email
        user_key = str(email).strip().lower()
    elif role in ("dean", "receptionist"):
        payload["id"] = user_id
        payload["hospital_id"] = hospital_id
        user_key = str(user_id)
    else:
        uid = int(user_id) if user_id is not None else None
        payload["id"] = uid
        payload["userId"] = uid
        user_key = str(uid)
    raw = jwt.encode(payload, _refresh_secret(), algorithm="HS256")
    return raw, jti, user_key


def decode_access_token(raw_token: str) -> dict:
    return jwt.decode(raw_token, _access_secret(), algorithms=["HS256"])


def decode_refresh_token(raw_token: str) -> dict:
    return jwt.decode(raw_token, _refresh_secret(), algorithms=["HS256"])


def decode_token(raw_token: str) -> dict:
    """Decode access or refresh token (tries refresh secret first for refresh tokens)."""
    try:
        payload = jwt.decode(raw_token, _refresh_secret(), algorithms=["HS256"])
        if payload.get("token_type") == "refresh":
            return payload
    except JWTError:
        pass
    return jwt.decode(raw_token, _access_secret(), algorithms=["HS256"])


def verify_access_payload(payload: dict) -> None:
    token_type = payload.get("token_type")
    if token_type == "refresh":
        raise JWTError("Refresh token cannot be used for API access")


def verify_refresh_payload(payload: dict, expected_role: str) -> None:
    if payload.get("token_type") != "refresh":
        raise JWTError("Invalid refresh token")
    role = (payload.get("role") or "").strip().lower()
    if role != expected_role.strip().lower():
        raise JWTError("Role mismatch")


def build_login_response(
    access: str,
    refresh: Optional[str] = None,
    *,
    role: Optional[str] = None,
    user_id: Optional[int] = None,
    email: Optional[str] = None,
    hospital_id: Optional[int] = None,
    permissions: Optional[list] = None,
    profile: Optional[dict] = None,
) -> dict:
    """Login/refresh JSON body. Keeps legacy `token` / `refresh_token` / `expires_in`."""
    expires_at = access_token_expires_at()
    payload: dict = {
        "success": True,
        "token": access,
        "accessToken": access,
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "expiresAt": expires_at.isoformat() + "Z",
        "permissions": list(permissions) if permissions is not None else [],
    }
    if refresh:
        payload["refresh_token"] = refresh
        payload["refreshToken"] = refresh
    if role:
        payload["role"] = role.strip().lower()
    if user_id is not None:
        payload["userId"] = int(user_id)
    if email is not None:
        payload["email"] = email
    if hospital_id is not None:
        payload["hospitalId"] = int(hospital_id)
    if profile is not None:
        payload["profile"] = profile
    return payload


async def issue_token_pair(
    role: str,
    *,
    user_id: Optional[int] = None,
    email: Optional[str] = None,
    hospital_id: Optional[int] = None,
    device_info: Optional[str] = None,
    ip_address: Optional[str] = None,
    permissions: Optional[list] = None,
    profile: Optional[dict] = None,
) -> dict:
    from app.models import refresh_token_model

    access = create_access_token(
        role,
        user_id=user_id,
        email=email,
        hospital_id=hospital_id,
    )
    refresh, _jti, user_key = create_refresh_token(
        role, user_id=user_id, email=email, hospital_id=hospital_id
    )
    await refresh_token_model.store_token(
        user_id=user_key,
        role=role,
        token_hash=hash_refresh_token(refresh),
        expires_at=refresh_token_expires_at(),
        device_info=device_info,
        ip_address=ip_address,
    )
    return build_login_response(
        access,
        refresh,
        role=role,
        user_id=user_id,
        email=email,
        hospital_id=hospital_id,
        permissions=permissions,
        profile=profile,
    )
