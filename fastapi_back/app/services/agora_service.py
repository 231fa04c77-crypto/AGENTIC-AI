import re
import time

from app.config.config import settings

try:
    from app.services.agora_token.RtcTokenBuilder2 import Role_Publisher, RtcTokenBuilder
except ImportError:  # pragma: no cover
    RtcTokenBuilder = None
    Role_Publisher = 1


def _normalize_agora_secret(value: str | None) -> str:
    """Agora App ID / Certificate must be exactly 32 lowercase hex characters."""
    raw = (value or "").strip().strip('"').strip("'")
    raw = raw.lower()
    if len(raw) == 33 and not re.fullmatch(r"[0-9a-f]{33}", raw):
        # Common copy/paste typo: extra trailing non-hex character.
        raw = raw[:32]
    return raw


def normalized_app_id() -> str:
    return _normalize_agora_secret(settings.AGORA_APP_ID)


def agora_configured() -> bool:
    app_id = _normalize_agora_secret(settings.AGORA_APP_ID)
    cert = _normalize_agora_secret(settings.AGORA_APP_CERTIFICATE)
    return bool(
        re.fullmatch(r"[0-9a-f]{32}", app_id or "")
        and re.fullmatch(r"[0-9a-f]{32}", cert or "")
        and RtcTokenBuilder is not None
    )


def channel_for_appointment(appointment_id: int) -> str:
    return f"medi_appt_{appointment_id}"


# Agora UIDs must be unique per channel. Derive from appointment id so patient/doctor
# never collide (e.g. user_id 31 vs doctor_id 31) and retries stay predictable.
def uid_for_patient(appointment_id: int) -> int:
    uid = int(appointment_id) * 2
    return uid if uid > 0 else 2


def uid_for_doctor(appointment_id: int) -> int:
    uid = int(appointment_id) * 2 + 1
    return uid if uid > 0 else 3


def build_rtc_token(channel_name: str, uid: int, expire_seconds: int = 3600) -> str | None:
    if RtcTokenBuilder is None:
        return None

    app_id = _normalize_agora_secret(settings.AGORA_APP_ID)
    cert = _normalize_agora_secret(settings.AGORA_APP_CERTIFICATE)
    if not re.fullmatch(r"[0-9a-f]{32}", app_id or "") or not re.fullmatch(
        r"[0-9a-f]{32}", cert or ""
    ):
        print(
            "[Agora] Invalid AGORA_APP_ID or AGORA_APP_CERTIFICATE — "
            "each must be 32 hex characters from Agora Console."
        )
        return None

    token = RtcTokenBuilder.build_token_with_uid(
        app_id,
        cert,
        channel_name,
        int(uid),
        Role_Publisher,
        expire_seconds,
        expire_seconds,
    )
    if not token:
        print("[Agora] Token generation returned empty string — check App Certificate.")
    return token or None
