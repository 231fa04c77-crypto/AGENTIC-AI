"""Redis key naming + TTL policy for MedClues cache layer.

PostgreSQL remains source of truth. Redis is cache / lock / ephemeral only.
"""
from __future__ import annotations

# --- TTL seconds ---
TTL_DOCTOR_PROFILE = 3600          # 1 hour
TTL_DOCTOR_LIST = 600              # 10 minutes
TTL_HOSPITAL_PROFILE = 12 * 3600   # 12 hours
TTL_HOSPITAL_LIST = 600
TTL_SPECIALTY_LIST = 24 * 3600     # 24 hours
TTL_CONFIG = 24 * 3600
TTL_COMMUNITY_CATEGORIES = 3600
TTL_COMMUNITY_TRENDING = 15 * 60   # 15 minutes
TTL_DASHBOARD = 5 * 60             # 5 minutes
TTL_QUEUE_SNAPSHOT = 15            # seconds — live-ish
TTL_SEARCH_SUGGEST = 30 * 60
TTL_MEDICINE_SUGGEST = 30 * 60
TTL_LAB_LIST = 3600
TTL_PARTNER_CATALOG = 3600
TTL_OTP = 5 * 60
TTL_PASSWORD_RESET = 10 * 60
TTL_SLOT_HOLD = 5 * 60             # temporary slot lock during checkout
TTL_DOCTOR_SLOTS = 120              # public schedule JSON (Redis + in-process)
TTL_HOME_BANNERS = 5 * 60          # app home promo carousel
TTL_SESSION_BLACKLIST = 7 * 24 * 3600  # align with refresh max life


def doctor(doc_id: int | str) -> str:
    return f"doctor:{doc_id}"


def doctor_slots(doc_id: int | str, mode: str, day_iso: str) -> str:
    return f"doctor:slots:{doc_id}:{(mode or 'offline').lower()}:{day_iso}"


def home_banners() -> str:
    return "app:home_banners"


def doctor_list(hospital_id: int | None, limit: int, offset: int, q: str) -> str:
    hq = (q or "").strip().lower()[:64]
    hid = hospital_id if hospital_id is not None else "all"
    return f"doctor:list:{hid}:{limit}:{offset}:{hq}"


def hospital(hospital_id: int | str) -> str:
    return f"hospital:{hospital_id}"


def hospital_list(limit: int, offset: int, q: str) -> str:
    hq = (q or "").strip().lower()[:64]
    return f"hospital:list:{limit}:{offset}:{hq}"


def specialty_list() -> str:
    return "specialty:list"


def config_system() -> str:
    return "config:system"


def community_categories() -> str:
    return "community:categories"


def community_trending(sort: str, specialty: str | None, limit: int) -> str:
    sp = (specialty or "all").strip().lower()[:40]
    return f"community:trending:{sort}:{sp}:{limit}"


def dashboard_admin() -> str:
    return "dashboard:admin"


def dashboard_dean(hospital_id: int | str) -> str:
    return f"dashboard:dean:{hospital_id}"


def dashboard_doctor(doc_id: int | str) -> str:
    return f"dashboard:doctor:{doc_id}"


def dashboard_reception(hospital_id: int | str) -> str:
    return f"dashboard:reception:{hospital_id}"


def queue_snapshot(doctor_id: int | str, slot_date: str) -> str:
    return f"queue:{doctor_id}:{slot_date}"


def search_suggest(kind: str, q: str) -> str:
    return f"search:{kind}:{(q or '').strip().lower()[:64]}"


def medicine_suggest(q: str) -> str:
    return f"search:medicine:{(q or '').strip().lower()[:64]}"


def lab_list() -> str:
    return "lab:list"


def partner_catalog() -> str:
    return "partner:catalog"


def otp(email_or_phone: str) -> str:
    return f"otp:{(email_or_phone or '').strip().lower()}"


def password_reset(role: str, email: str) -> str:
    return f"pwdreset:{(role or '').strip().lower()}:{(email or '').strip().lower()}"


def signup_verified(email: str) -> str:
    return f"signup_verified:{(email or '').strip().lower()}"


def slot_hold(slot_id: int | str) -> str:
    return f"slot:hold:{slot_id}"


def session_blacklist(jti_or_hash: str) -> str:
    return f"session:bl:{jti_or_hash}"


# Prefixes for bulk invalidation (SCAN)
PREFIX_DOCTOR = "doctor:"
PREFIX_DOCTOR_SLOTS = "doctor:slots:"
PREFIX_HOSPITAL = "hospital:"
PREFIX_DASHBOARD = "dashboard:"
PREFIX_COMMUNITY = "community:"
PREFIX_SEARCH = "search:"
PREFIX_QUEUE = "queue:"
PREFIX_HOME_BANNERS = "app:home_banners"
