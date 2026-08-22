import os
import sys
from dotenv import load_dotenv
from pathlib import Path

# Load .env from the current backend directory (fastapi_back)
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)


def _env_bool(key: str, default: bool = False) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


class Config:
    # Core
    DEBUG = _env_bool("DEBUG", True)
    PORT = _env_int("PORT", 5000)
    CURRENCY = os.getenv("CURRENCY", "INR").replace('"', '').replace("'", "").strip()

    # JWT — no insecure defaults in production (validated on startup)
    JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("ACCESS_TOKEN_SECRET")
    REFRESH_TOKEN_SECRET = os.getenv("REFRESH_TOKEN_SECRET") or JWT_SECRET
    ACCESS_TOKEN_EXPIRE_MINUTES = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 15)
    REFRESH_TOKEN_EXPIRE_DAYS = _env_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)

    # Admin Credentials
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

    # PostgreSQL — prefer DATABASE_URL; legacy PG_* only if URL unset
    DATABASE_URL = os.getenv("DATABASE_URL")
    PG_USER = os.getenv("PG_USER", "postgres")
    PG_HOST = os.getenv("PG_HOST", "localhost")
    PG_DATABASE = os.getenv("PG_DATABASE", "healthsystem_pg")
    PG_PASSWORD = os.getenv("PG_PASSWORD")
    PG_PORT = _env_int("PG_PORT", 5432)
    PG_SSL = _env_bool("PG_SSL", False)
    DB_POOL_MIN = _env_int("DB_POOL_MIN", 1)
    DB_POOL_MAX = _env_int("DB_POOL_MAX", 8)

    # Redis (optional) — OTP, rate limits, Socket.IO adapter when set
    REDIS_URL = (os.getenv("REDIS_URL") or "").strip()

    # Optional read replica for heavy search / reports (falls back to primary)
    DATABASE_READ_URL = (os.getenv("DATABASE_READ_URL") or "").strip()

    # OpenSearch (optional) — unified /api/search; Postgres FTS/ILIKE fallback when unset
    OPENSEARCH_URL = (os.getenv("OPENSEARCH_URL") or "").strip()
    OPENSEARCH_INDEX = (os.getenv("OPENSEARCH_INDEX") or "medclues").strip()
    OPENSEARCH_USER = (os.getenv("OPENSEARCH_USER") or "").strip()
    OPENSEARCH_PASSWORD = (os.getenv("OPENSEARCH_PASSWORD") or "").strip()

    # Chaos probes (/api/ops/chaos/*) — never enable in production unless intentional
    CHAOS_ENABLED = _env_bool("CHAOS_ENABLED", False)

    # AI Medical Assistant tool gateway (default off — additive)
    AI_ASSISTANT_ENABLED = _env_bool("AI_ASSISTANT_ENABLED", False)
    # Optional LLM polish for replies (tools/RAG still required for facts)
    AI_LLM_ENABLED = _env_bool("AI_LLM_ENABLED", False)
    AI_LLM_PROVIDER = (os.getenv("AI_LLM_PROVIDER") or "mistral").strip().lower()
    AI_LLM_MODEL = (os.getenv("AI_LLM_MODEL") or "mistral-medium-latest").strip()
    # OpenAI-compatible base URL (openai + qwen/DashScope; optional Cohere compatibility URL)
    AI_LLM_BASE_URL = (
        os.getenv("AI_LLM_BASE_URL")
        or os.getenv("DASHSCOPE_BASE_URL")
        or ""
    ).strip().rstrip("/")
    OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
    # Cohere (primary NLU / phrasing when AI_LLM_PROVIDER=cohere) — backend only
    COHERE_API_KEY = (os.getenv("COHERE_API_KEY") or "").strip()
    # Qwen (Alibaba DashScope) — OpenAI-compatible; also accept DASHSCOPE_API_KEY / QWEN_API_KEY
    DASHSCOPE_API_KEY = (
        os.getenv("DASHSCOPE_API_KEY")
        or os.getenv("QWEN_API_KEY")
        or ""
    ).strip()
    AI_ASSISTANT_RATE_LIMIT_RPM = _env_int("AI_ASSISTANT_RATE_LIMIT_RPM", 30)
    # Module 1 Intent Engine — log-only compare vs legacy intents (default off)
    AI_INTENT_ENGINE_SHADOW = _env_bool("AI_INTENT_ENGINE_SHADOW", False)
    # Module 8 — use new NLU pipeline for live intent/entity detection (default off)
    AI_NLU_PIPELINE_CUTOVER = _env_bool("AI_NLU_PIPELINE_CUTOVER", False)
    # Module 2 Intent Dictionary — soft-validate YAML on API startup (never blocks boot)
    AI_INTENT_DICTIONARY_VALIDATE_ON_START = _env_bool(
        "AI_INTENT_DICTIONARY_VALIDATE_ON_START", True
    )
    # Module 4 Entity Dictionary — soft-validate YAML catalogs on startup
    AI_ENTITY_DICTIONARY_VALIDATE_ON_START = _env_bool(
        "AI_ENTITY_DICTIONARY_VALIDATE_ON_START", True
    )
    # Optional Redis warm marker for entity dictionary (default off)
    AI_ENTITY_DICTIONARY_REDIS_CACHE = _env_bool("AI_ENTITY_DICTIONARY_REDIS_CACHE", False)
    # Module 5 Synonym Engine
    AI_SYNONYM_REGION = (os.getenv("AI_SYNONYM_REGION") or "IN").strip().upper() or "IN"
    AI_SYNONYM_VALIDATE_ON_START = _env_bool("AI_SYNONYM_VALIDATE_ON_START", True)
    AI_SYNONYM_REDIS_CACHE = _env_bool("AI_SYNONYM_REDIS_CACHE", False)
    # Module 6 Abbreviation Engine
    AI_ABBREVIATION_VALIDATE_ON_START = _env_bool("AI_ABBREVIATION_VALIDATE_ON_START", True)
    AI_ABBREVIATION_REDIS_CACHE = _env_bool("AI_ABBREVIATION_REDIS_CACHE", False)
    # Module 7 Spelling Correction Engine
    AI_SPELLING_VALIDATE_ON_START = _env_bool("AI_SPELLING_VALIDATE_ON_START", True)
    AI_SPELLING_REDIS_CACHE = _env_bool("AI_SPELLING_REDIS_CACHE", False)

    # Background workers: run inside API process (default true for single-instance deploys).
    # Set false when running `python -m app.workers.runner` separately.
    RUN_BACKGROUND_WORKERS_IN_API = _env_bool("RUN_BACKGROUND_WORKERS_IN_API", True)

    # SMS — twilio | msg91 | auto | stub
    SMS_PROVIDER = (os.getenv("SMS_PROVIDER") or "auto").strip().lower()
    TWILIO_ACCOUNT_SID = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
    TWILIO_AUTH_TOKEN = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
    TWILIO_FROM_NUMBER = (os.getenv("TWILIO_FROM_NUMBER") or "").strip()
    MSG91_AUTH_KEY = (os.getenv("MSG91_AUTH_KEY") or "").strip()
    MSG91_SENDER_ID = (os.getenv("MSG91_SENDER_ID") or "MEDCLU").strip()
    MSG91_TEMPLATE_ID = (os.getenv("MSG91_TEMPLATE_ID") or "").strip()
    SMS_ENQUEUE_WHEN_UNCONFIGURED = _env_bool("SMS_ENQUEUE_WHEN_UNCONFIGURED", False)

    # WhatsApp Cloud API (Meta)
    WHATSAPP_ACCESS_TOKEN = (os.getenv("WHATSAPP_ACCESS_TOKEN") or "").strip()
    WHATSAPP_PHONE_NUMBER_ID = (os.getenv("WHATSAPP_PHONE_NUMBER_ID") or "").strip()

    # Appointment cold archive
    APPOINTMENT_ARCHIVE_DAYS = _env_int("APPOINTMENT_ARCHIVE_DAYS", 365)
    APPOINTMENT_ARCHIVE_BATCH = _env_int("APPOINTMENT_ARCHIVE_BATCH", 500)

    # Upload limits
    MAX_UPLOAD_BYTES = _env_int("MAX_UPLOAD_BYTES", 10 * 1024 * 1024)  # 10 MiB
    ALLOWED_UPLOAD_MIME_PREFIXES = tuple(
        p.strip()
        for p in (os.getenv("ALLOWED_UPLOAD_MIME_PREFIXES") or "image/,application/pdf").split(",")
        if p.strip()
    )

    # MongoDB
    MONGODB_URI = os.getenv("MONGODB_URI")

    # Cloudinary
    CLOUDINARY_NAME = os.getenv("CLOUDINARY_NAME")
    CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET") or os.getenv("CLOUDINARY_SECRET_KEY")

    # Payments — strip quotes/spaces so .env KEY = "rzp_…" still authenticates
    RAZORPAY_KEY_ID = (os.getenv("RAZORPAY_KEY_ID") or "").replace('"', "").replace("'", "").strip() or None
    RAZORPAY_KEY_SECRET = (os.getenv("RAZORPAY_KEY_SECRET") or "").replace('"', "").replace("'", "").strip() or None
    RAZORPAY_WEBHOOK_SECRET = (os.getenv("RAZORPAY_WEBHOOK_SECRET") or "").replace('"', "").replace("'", "").strip() or None
    # Local-only: skip live Razorpay and complete bookings with mock payments (DEBUG required).
    RAZORPAY_MOCK = _env_bool("RAZORPAY_MOCK", False)
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
    PAYU_MERCHANT_KEY = os.getenv("PAYU_MERCHANT_KEY")
    PAYU_MERCHANT_SALT = os.getenv("PAYU_MERCHANT_SALT")
    PAYU_BASE_URL = os.getenv("PAYU_BASE_URL")
    MERCHANT_UPI_ID = (os.getenv("MERCHANT_UPI_ID") or "").strip()

    # AI
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
    # OPENAI_API_KEY / DASHSCOPE_API_KEY set above under AI Medical Assistant

    # openFDA Drug Label API (api.data.gov) — never hardcode; backend-only
    OPENFDA_API_KEY = (os.getenv("OPENFDA_API_KEY") or "").strip()
    OPENFDA_CACHE_TTL_SECONDS = _env_int("OPENFDA_CACHE_TTL_SECONDS", 1800)
    OPENFDA_TIMEOUT_SECONDS = _env_float("OPENFDA_TIMEOUT_SECONDS", 10.0)

    # MedClues Bot Integration — prefer MEDCLUES_BOT_*; MEDICHAIN_BOT_* still accepted
    MEDICHAIN_BOT_BASE_URL = (
        os.getenv("MEDCLUES_BOT_BASE_URL") or os.getenv("MEDICHAIN_BOT_BASE_URL")
    )
    MEDICHAIN_BOT_API_KEY = (
        os.getenv("MEDCLUES_BOT_API_KEY") or os.getenv("MEDICHAIN_BOT_API_KEY")
    )
    MEDICHAIN_BOT_PASSWORD = (
        os.getenv("MEDCLUES_BOT_PASSWORD") or os.getenv("MEDICHAIN_BOT_PASSWORD")
    )
    # Canonical aliases (same values)
    MEDCLUES_BOT_BASE_URL = MEDICHAIN_BOT_BASE_URL
    MEDCLUES_BOT_API_KEY = MEDICHAIN_BOT_API_KEY
    MEDCLUES_BOT_PASSWORD = MEDICHAIN_BOT_PASSWORD
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
    TELEGRAM_BOT_ENABLED = _env_bool("TELEGRAM_BOT_ENABLED", True)

    # Agora
    AGORA_APP_ID = os.getenv("AGORA_APP_ID")
    AGORA_APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE")

    # Email (Brevo/SMTP)
    BREVO_API_KEY = os.getenv("BREVO_API_KEY") or os.getenv("BERVO_API_KEY")
    BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL") or os.getenv("BERVO_SENDER_EMAIL")
    BREVO_APP_NAME = os.getenv("BREVO_APP_NAME") or os.getenv("BERVO_APP_NAME")
    EMAIL_LOGO_URL = os.getenv("EMAIL_LOGO_URL") or (
        "https://res.cloudinary.com/dinbiaq7q/image/upload/v1781150365/medclues/branding/medclues_logo_email.png"
    )
    MEDCLUES_APP_DEEP_LINK_SCHEME = os.getenv("MEDCLUES_APP_DEEP_LINK_SCHEME", "medclues")
    # Comma-separated legacy schemes still accepted by apps (emit primary only)
    MEDCLUES_APP_DEEP_LINK_ALIASES = (
        os.getenv("MEDCLUES_APP_DEEP_LINK_ALIASES") or "mediclues,medichain"
    ).strip()
    # Must match flutter_mobile android applicationId until package-rename sprint
    MEDCLUES_ANDROID_PACKAGE = (
        os.getenv("MEDCLUES_ANDROID_PACKAGE") or "com.medichain.medichain_mobile"
    ).strip() or "com.medichain.medichain_mobile"
    EMAIL_USER = os.getenv("EMAIL_USER")
    EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")
    # Public support inbox (testing: Gmail until support@medclues.com is provisioned)
    SUPPORT_EMAIL = (
        os.getenv("SUPPORT_EMAIL") or "support@medclues.com"
    ).strip() or "support@medclues.com"
    SUPPORT_PHONE = (os.getenv("SUPPORT_PHONE") or "1800-123-4567").strip() or "1800-123-4567"

    # URLs
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    # Flutter web (or hosted app) origin for Visit Summary QR hash routes: /#/a/{BK}?sig=
    # When empty, QR falls back to BACKEND_URL /link/appointment-summary/...
    PUBLIC_WEB_BASE_URL = (os.getenv("PUBLIC_WEB_BASE_URL") or "").strip()
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
    ADMIN_PANEL_URL = (os.getenv("ADMIN_PANEL_URL") or os.getenv("ADMIN_URL") or "https://medclues-admin.vercel.app").strip()

    # PharmaSync integration (Dean connect + Rx/order webhooks)
    PHARMASYNC_BASE_URL = (os.getenv("PHARMASYNC_BASE_URL") or "").strip().rstrip("/")
    PHARMASYNC_PUBLIC_API_KEY = (
        (os.getenv("PHARMASYNC_PUBLIC_API_KEY") or os.getenv("PHARMASYNC_INTEGRATION_API_KEY") or "")
        .strip()
    )
    PHARMASYNC_PRIVATE_SECRET_KEY = (os.getenv("PHARMASYNC_PRIVATE_SECRET_KEY") or "").strip()
    PHARMASYNC_HOSPITAL_CODE = (os.getenv("PHARMASYNC_HOSPITAL_CODE") or "").strip()
    PHARMASYNC_WEBHOOK_SIGNING_SECRET = (os.getenv("PHARMASYNC_WEBHOOK_SIGNING_SECRET") or "").strip()
    PHARMASYNC_WEBHOOK_URL = (os.getenv("PHARMASYNC_WEBHOOK_URL") or "").strip()
    PHARMASYNC_PROVISION_PATH = (
        os.getenv("PHARMASYNC_PROVISION_PATH") or "/api/integration/pharmacies"
    ).strip()
    # Legacy alias
    PHARMASYNC_INTEGRATION_API_KEY = PHARMASYNC_PUBLIC_API_KEY


    # CORS — comma-separated allowlist for production
    CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "")
    # Optional extra regex (e.g. Vercel preview URLs). Merged with built-in admin Vercel pattern.
    CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", "").strip()

    # OAuth / social login
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_IDS = os.getenv("GOOGLE_CLIENT_IDS")
    # Legacy email-only social login — default True until all clients send idToken
    SOCIAL_LOGIN_ALLOW_LEGACY = _env_bool("SOCIAL_LOGIN_ALLOW_LEGACY", default=True)

    # Appointment Lifecycle
    APPOINTMENT_LIFECYCLE_ENFORCED = _env_bool("APPOINTMENT_LIFECYCLE_ENFORCED", True)
    TRUST_SCORE_ENFORCED = _env_bool("TRUST_SCORE_ENFORCED", True)
    # When false, pay-at-clinic is allowed even for mid trust scores (local/testing).
    ADVANCE_PAYMENT_ENFORCED = _env_bool("ADVANCE_PAYMENT_ENFORCED", not DEBUG)
    # Missed-slot job: MISSED → tomorrow offer → EOD auto-cancel.
    # Explicit env wins; if unset, on in production (DEBUG=false), off locally.
    AUTO_NO_SHOW_JOB = _env_bool("AUTO_NO_SHOW_JOB", not DEBUG)

    # Fees
    PLATFORM_FEE_PERCENTAGE = _env_float("PLATFORM_FEE_PERCENTAGE", 5)
    GST_PERCENTAGE = _env_float("GST_PERCENTAGE", 18)

    # Firebase Cloud Messaging (push notifications)
    FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    FIREBASE_SENDER_ID = os.getenv("FIREBASE_SENDER_ID", "")

    # Firebase phone verification — project id is the audience of the phone ID token.
    FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "mediclues-e39db")
    # When True, signup is rejected unless a valid Firebase phone ID token is sent.
    PHONE_VERIFICATION_REQUIRED = _env_bool("PHONE_VERIFICATION_REQUIRED", default=False)


settings = Config()

# Clean up FRONTEND_URL and ADMIN_PANEL_URL if they are comma-separated lists
def _clean_url(url_val: str, default: str) -> str:
    if not url_val:
        return default
    # Split by comma
    parts = [p.strip() for p in url_val.split(",") if p.strip()]
    if not parts:
        return default
    # Find first non-localhost URL if possible
    non_local = [p for p in parts if "localhost" not in p and "127.0.0.1" not in p]
    return non_local[0] if non_local else parts[0]

settings.FRONTEND_URL = _clean_url(settings.FRONTEND_URL, "http://localhost:5173")
settings.ADMIN_PANEL_URL = _clean_url(settings.ADMIN_PANEL_URL, "https://medclues-admin.vercel.app")


_INSECURE_JWT_VALUES = frozenset({"greatstack", "secret", "changeme", "jwt_secret"})


def validate_settings() -> None:
    """Fail fast when required production secrets are missing or weak."""
    errors: list[str] = []
    warnings: list[str] = []

    if not settings.DEBUG:
        if not settings.DATABASE_URL:
            errors.append("DATABASE_URL is required when DEBUG=false")

        secret = (settings.JWT_SECRET or "").strip()
        if not secret:
            errors.append("JWT_SECRET (or ACCESS_TOKEN_SECRET) is required when DEBUG=false")
        elif len(secret) < 32:
            errors.append("JWT_SECRET must be at least 32 characters in production")
        elif secret.lower() in _INSECURE_JWT_VALUES:
            errors.append("JWT_SECRET is a known insecure default — set a strong random value")

        if not settings.CORS_ALLOWED_ORIGINS.strip():
            warnings.append(
                "CORS_ALLOWED_ORIGINS is empty — only built-in localhost origins will be allowed"
            )

        if settings.SOCIAL_LOGIN_ALLOW_LEGACY:
            warnings.append(
                "SOCIAL_LOGIN_ALLOW_LEGACY=true — social login accepts unverified email. "
                "Send idToken from clients and set SOCIAL_LOGIN_ALLOW_LEGACY=false when ready."
            )
    else:
        if not settings.JWT_SECRET:
            warnings.append("JWT_SECRET not set — using insecure dev-only fallback")
            Config.JWT_SECRET = "dev-only-insecure-jwt-secret-change-me"
            if not os.getenv("REFRESH_TOKEN_SECRET"):
                Config.REFRESH_TOKEN_SECRET = Config.JWT_SECRET

    for w in warnings:
        print(f"[CONFIG WARNING] {w}", file=sys.stderr)

    if errors:
        for e in errors:
            print(f"[CONFIG ERROR] {e}", file=sys.stderr)
        raise SystemExit(1)


def cors_allowed_origins() -> list[str]:
    """Production CORS allowlist: env + sensible localhost defaults."""
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
        "http://localhost:5178",
        "http://127.0.0.1:5178",
        "http://localhost:5179",
        "http://127.0.0.1:5179",
        "http://localhost:5180",
        "http://127.0.0.1:5180",
    ]
    extra = [
        o.strip()
        for o in (settings.CORS_ALLOWED_ORIGINS or "").split(",")
        if o.strip()
    ]
    if settings.FRONTEND_URL and settings.FRONTEND_URL not in extra:
        extra.append(settings.FRONTEND_URL.rstrip("/"))
    if settings.ADMIN_PANEL_URL and settings.ADMIN_PANEL_URL not in extra:
        extra.append(settings.ADMIN_PANEL_URL.rstrip("/"))
    if settings.BACKEND_URL and settings.BACKEND_URL not in extra:
        extra.append(settings.BACKEND_URL.rstrip("/"))
    merged = list(dict.fromkeys(extra + defaults))
    return merged


def cors_origin_regex() -> str:
    """Regex patterns for CORS (localhost dev + Vercel admin, pharmacy & SHAMS deployments)."""
    parts = [
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        # Production + preview: medclues-admin.vercel.app, medclues-admin-*-projects.vercel.app
        r"https://medclues-admin[a-z0-9-]*\.vercel\.app",
        # SHAMS Vercel deployments: shams-green.vercel.app, shams-*.vercel.app
        r"https://shams-[a-z0-9-]*\.vercel\.app",
        # Pharmacy Vercel deployments: medclues-pharmacy.vercel.app, medclues-pharmacy-*.vercel.app
        r"https://medclues-pharmacy[a-z0-9-]*\.vercel\.app",
    ]
    if settings.CORS_ORIGIN_REGEX:
        parts.append(settings.CORS_ORIGIN_REGEX)
    return "|".join(f"(?:{p})" for p in parts)


