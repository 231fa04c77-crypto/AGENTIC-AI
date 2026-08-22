import re
import time
from collections import defaultdict
from datetime import datetime, timezone

from jose import JWTError

from app.config.config import settings
from app.config.db import db
from app.services import email_service
from app.services import token_service
from app.utils import password_reset_storage
from app.utils.app_logger import get_logger
from app.utils.refresh_cookie import get_refresh_from_cookie

log = get_logger(__name__)
from app.models import user_model, admin_model, doctor_model, dean_model, refresh_token_model
from app.controllers.user_controller import get_password_hash

# Simple in-memory rate limit for /refresh (per IP)
_REFRESH_RATE: dict[str, list[float]] = defaultdict(list)
_REFRESH_RATE_LIMIT = 10
_REFRESH_RATE_WINDOW_SEC = 60

EMAIL_RE = re.compile(r"^[^@]+@[^@]+\.[^@]+$")


def _valid_email(email: str) -> bool:
    return bool(email and EMAIL_RE.match(email.strip()))


async def _account_exists(role: str, email: str):
    email = email.strip().lower()
    role = role.strip().lower()
    if role == "patient":
        return await user_model.get_user_by_email(email)
    if role == "admin":
        admin = await admin_model.get_admin_by_email(email)
        if admin:
            return admin
        expected = (settings.ADMIN_EMAIL or "").strip().lower()
        if expected and email == expected:
            return {"email": expected, "from_env": True}
        return None
    if role == "doctor":
        return await doctor_model.get_doctor_by_email(email)
    if role == "dean":
        return await dean_model.get_dean_by_email(email)
    return None


async def forgot_password(email: str, role: str):
    if not _valid_email(email):
        return {"success": False, "message": "Please provide a valid email address"}

    role = (role or "patient").strip().lower()
    account = await _account_exists(role, email.strip().lower())
    if not account:
        return {"success": False, "message": "No account found for this email and role"}

    otp = password_reset_storage.generate_otp()
    password_reset_storage.store_otp(role, email, otp)

    name = (
        account.get("name")
        or account.get("email", email).split("@")[0]
        or "User"
    )
    email_result = await email_service.send_password_reset_otp(email.strip().lower(), otp, name)

    if email_result.get("success"):
        return {"success": True, "message": "OTP sent successfully"}

    if settings.DEBUG:
        log.warning("Password reset OTP generated for %s (dev only — not logged)", email)
        return {
            "success": True,
            "message": "OTP generated (email delivery failed — use dev_otp in development)",
            "dev_otp": otp,
            "email_error": email_result.get("message"),
        }

    return {
        "success": False,
        "message": email_result.get("message")
        or "Failed to send OTP. Add your IP in Brevo authorised IPs or configure Gmail SMTP.",
    }


async def verify_otp(email: str, otp: str, role: str):
    if not _valid_email(email):
        return {"success": False, "message": "Invalid email"}

    if not otp or not re.match(r"^\d{6}$", str(otp)):
        return {"success": False, "message": "Please enter a valid 6-digit OTP"}

    role = (role or "patient").strip().lower()
    result = password_reset_storage.verify_otp(role, email, str(otp))
    if not result.get("success"):
        return {"success": False, "message": result.get("message", "Invalid OTP")}

    return {"valid": True}


async def reset_password(email: str, otp: str, new_password: str, role: str):
    if not _valid_email(email):
        return {"success": False, "message": "Invalid email"}

    if not new_password or len(new_password) < 8:
        return {"success": False, "message": "Password must be at least 8 characters"}

    role = (role or "patient").strip().lower()
    email_key = email.strip().lower()

    verify = password_reset_storage.verify_otp(role, email_key, str(otp), consume=False)
    if not verify.get("success"):
        if "expired" in (verify.get("message") or "").lower():
            return {"success": False, "message": "OTP expired. Please resend."}
        return {"success": False, "message": verify.get("message", "Invalid OTP")}

    hashed = await get_password_hash(new_password)

    if role == "patient":
        user = await user_model.get_user_by_email(email_key)
        if not user:
            return {"success": False, "message": "User not found"}
        await user_model.update_user_password(user["id"], hashed)
        await db.execute(
            "UPDATE users SET reset_password_otp = NULL, reset_password_otp_expiry = NULL WHERE id = $1",
            user["id"],
        )
    elif role == "admin":
        admin = await admin_model.get_admin_by_email(email_key)
        expected = (settings.ADMIN_EMAIL or "").strip().lower()
        if admin:
            await db.execute(
                "UPDATE admins SET password = $1 WHERE id = $2",
                hashed,
                admin["id"],
            )
        elif email_key == expected:
            existing = await admin_model.get_admin_by_email(email_key)
            if not existing:
                await admin_model.create_admin(email_key, hashed)
            else:
                await db.execute(
                    "UPDATE admins SET password = $1 WHERE email = $2",
                    hashed,
                    email_key,
                )
        else:
            return {"success": False, "message": "Admin not found"}
    elif role == "doctor":
        doc = await doctor_model.get_doctor_by_email(email_key)
        if not doc:
            return {"success": False, "message": "Doctor not found"}
        await doctor_model.update_doctor_password(doc["id"], hashed)
    elif role == "dean":
        dean = await dean_model.get_dean_by_email(email_key)
        if not dean:
            return {"success": False, "message": "Dean not found"}
        await dean_model.update_dean(dean["id"], {"password": hashed})
    else:
        return {"success": False, "message": "Unsupported role"}

    password_reset_storage.verify_otp(role, email_key, str(otp), consume=True)
    return {"message": "Password reset successful"}


def _client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _check_refresh_rate_limit(ip: str | None) -> bool:
    key = ip or "unknown"
    now = time.time()
    window = _REFRESH_RATE[key]
    _REFRESH_RATE[key] = [t for t in window if now - t < _REFRESH_RATE_WINDOW_SEC]
    if len(_REFRESH_RATE[key]) >= _REFRESH_RATE_LIMIT:
        return False
    _REFRESH_RATE[key].append(now)
    return True


def _request_meta(request) -> tuple[str | None, str | None]:
    if request is None:
        return None, None
    device = (request.headers.get("user-agent") or "")[:500] or None
    return device, _client_ip(request)


def _resolve_refresh_token(refresh_token: str | None, role: str, request=None) -> str | None:
    if refresh_token and isinstance(refresh_token, str) and refresh_token.strip():
        return refresh_token.strip()
    return get_refresh_from_cookie(request, role)


async def refresh_tokens(refresh_token: str | None, role: str, request=None):
    role = (role or "").strip().lower()
    if role not in token_service.VALID_ROLES:
        return {"success": False, "message": "Invalid role"}

    refresh_token = _resolve_refresh_token(refresh_token, role, request)
    if not refresh_token:
        return {"success": False, "message": "Refresh token required"}

    ip = _client_ip(request)
    if not _check_refresh_rate_limit(ip):
        return {"success": False, "message": "Too many refresh attempts. Try again later."}

    try:
        payload = token_service.decode_token(refresh_token.strip())
        token_service.verify_refresh_payload(payload, role)
    except JWTError:
        return {"success": False, "message": "Invalid or expired refresh token"}

    token_hash = token_service.hash_refresh_token(refresh_token.strip())
    row = await refresh_token_model.find_by_hash(token_hash)
    if not row:
        return {"success": False, "message": "Refresh token revoked or not found"}

    if row.get("revoked_at"):
        # Reuse of a rotated/revoked refresh token — possible theft; invalidate all sessions.
        log.warning(
            "Refresh token reuse detected for user_id=%s role=%s — revoking all sessions",
            row.get("user_id"),
            row.get("role"),
        )
        await refresh_token_model.revoke_all_for_user(row["user_id"], row["role"])
        return {"success": False, "message": "Refresh token revoked"}

    expires_at = row.get("expires_at")
    if expires_at:
        exp = expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            return {"success": False, "message": "Refresh token expired"}

    if role == "admin":
        email = payload.get("email")
        if not email:
            return {"success": False, "message": "Invalid refresh token"}
        access = token_service.create_access_token("admin", email=email)
        user_key = str(email).strip().lower()
        user_id = None
        hospital_id = None
    elif role in ("dean", "receptionist"):
        user_id = payload.get("id")
        hospital_id = payload.get("hospital_id")
        if user_id is None:
            return {"success": False, "message": "Invalid refresh token"}
        access = token_service.create_access_token(
            role,
            user_id=int(user_id),
            hospital_id=int(hospital_id) if hospital_id is not None else None,
        )
        user_key = str(user_id)
        email = None
    else:
        from app.utils.ownership import coerce_user_id

        user_id = coerce_user_id(payload.get("id")) or coerce_user_id(payload.get("userId"))
        if user_id is None:
            return {"success": False, "message": "Invalid refresh token"}
        access = token_service.create_access_token(role, user_id=int(user_id))
        user_key = str(user_id)
        hospital_id = None
        email = None

    # Rotate refresh token
    await refresh_token_model.revoke_by_hash(token_hash)
    device_info, ip_address = _request_meta(request)
    new_refresh, _jti, _ = token_service.create_refresh_token(
        role,
        user_id=int(user_id) if user_id is not None else None,
        email=email,
        hospital_id=int(hospital_id) if hospital_id is not None else None,
    )
    await refresh_token_model.store_token(
        user_id=user_key,
        role=role,
        token_hash=token_service.hash_refresh_token(new_refresh),
        expires_at=token_service.refresh_token_expires_at(),
        device_info=device_info,
        ip_address=ip_address,
    )

    return token_service.build_login_response(
        access,
        new_refresh,
        role=role,
        user_id=int(user_id) if user_id is not None else None,
        email=email,
        hospital_id=int(hospital_id) if hospital_id is not None else None,
    )


async def logout_all(role: str, request=None, user_id: int | None = None, email: str | None = None):
    """Revoke all refresh tokens for the authenticated user."""
    role = (role or "").strip().lower()
    if role not in token_service.VALID_ROLES:
        return {"success": False, "message": "Invalid role"}

    if role == "admin":
        key = str((email or "")).strip().lower()
        if not key:
            return {"success": False, "message": "Admin email required"}
    else:
        if user_id is None:
            return {"success": False, "message": "User id required"}
        key = str(user_id)

    await refresh_token_model.revoke_all_for_user(key, role)
    return {"success": True, "message": "Logged out from all devices"}


async def logout(refresh_token: str | None, role: str, request=None):
    role = (role or "").strip().lower()
    if role not in token_service.VALID_ROLES:
        return {"success": False, "message": "Invalid role"}

    resolved = _resolve_refresh_token(refresh_token, role, request)
    if resolved:
        token_hash = token_service.hash_refresh_token(resolved)
        await refresh_token_model.revoke_by_hash(token_hash)

    # Optional access-token blacklist when client sends Authorization Bearer
    try:
        if request is not None:
            auth = request.headers.get("Authorization") or ""
            if auth.lower().startswith("bearer "):
                from app.services import session_blacklist
                await session_blacklist.blacklist_access_token(auth.split(" ", 1)[1].strip())
    except Exception:
        pass

    return {"success": True, "message": "Logged out"}
