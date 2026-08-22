"""MEDCLUES Telegram bot copy + inline keyboards (Smart Patient Assistant)."""
from datetime import datetime
from html import escape
from typing import Any, Dict, List, Optional

from app.config.config import settings

BOT_NAME = "MEDCLUES"
TAGLINE = "Your Health, Our Priority"


def support_email() -> str:
    return (settings.SUPPORT_EMAIL or "support@medclues.com").strip() or "support@medclues.com"


def support_phone() -> str:
    return (getattr(settings, "SUPPORT_PHONE", None) or "1800-123-4567").strip() or "1800-123-4567"


SUPPORT_EMAIL = support_email()
SUPPORT_PHONE = support_phone()


def _e(text) -> str:
    return escape(str(text or ""))


def _app_url(path: str = "/") -> str:
    base = (settings.FRONTEND_URL or settings.BACKEND_URL or "https://medclues.onrender.com").rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def dashboard_app_url() -> str:
    """Opens MEDCLUES mobile app home (dashboard) via custom scheme."""
    scheme = (settings.MEDCLUES_APP_DEEP_LINK_SCHEME or "medclues").strip().rstrip(":/")
    return f"{scheme}://dashboard"


def app_deep_link(path: str) -> str:
    """e.g. medclues://open/appointments"""
    scheme = (settings.MEDCLUES_APP_DEEP_LINK_SCHEME or "medclues").strip().rstrip(":/")
    clean = path.strip().lstrip("/")
    return f"{scheme}://open/{clean}" if clean else dashboard_app_url()


def _btn(text: str, *, callback: Optional[str] = None, url: Optional[str] = None) -> Dict[str, str]:
    row: Dict[str, str] = {"text": text}
    if url:
        row["url"] = url
    else:
        row["callback_data"] = callback or "menu:help"
    return row


def _keyboard(rows: List[List[Dict[str, str]]]) -> Dict[str, Any]:
    return {"inline_keyboard": rows}


def main_menu_keyboard(*, linked: bool) -> Dict[str, Any]:
    if linked:
        return _keyboard([
            [_btn("🏠 Open App Home", url=dashboard_app_url())],
            [_btn("📅 Book Appointment", url=app_deep_link("doctors"))],
            [_btn("📂 My Records", callback="menu:records"), _btn("👨‍⚕️ Find Doctor", url=app_deep_link("doctors"))],
            [_btn("📅 Upcoming Visits", callback="menu:upcoming"), _btn("👤 My Profile", callback="menu:profile")],
        ])
    return _keyboard([
        [_btn("🏠 Open MEDCLUES App", url=dashboard_app_url())],
        [_btn("ℹ️ How to Link", callback="menu:link_help")],
    ])


def linked_success_keyboard() -> Dict[str, Any]:
    return _keyboard([
        [_btn("🏠 Go to Dashboard", url=dashboard_app_url())],
        [_btn("📅 My Appointments", callback="menu:upcoming"), _btn("📂 My Records", callback="menu:records")],
    ])


def appointment_booked_keyboard(appointment_id: int, maps_url: Optional[str] = None) -> Dict[str, Any]:
    rows = [[_btn("📄 View Appointment", callback=f"apt:view:{appointment_id}")]]
    if maps_url:
        rows.append([_btn("🗺 Open Directions", url=maps_url)])
    return _keyboard(rows)


def appointment_reminder_keyboard(maps_url: Optional[str] = None) -> Dict[str, Any]:
    rows = []
    if maps_url:
        rows.append([_btn("🗺 Open Directions", url=maps_url)])
    rows.append([_btn("📄 View Appointment", callback="menu:upcoming")])
    return _keyboard(rows)


def report_available_keyboard() -> Dict[str, Any]:
    return _keyboard([
        [_btn("👁 View Report", url=app_deep_link("records"))],
    ])


def health_checkin_keyboard() -> Dict[str, Any]:
    return _keyboard([
        [
            _btn("😊 Feeling Better", callback="checkin:better"),
            _btn("😟 Need Assistance", callback="checkin:assist"),
        ],
        [_btn("👨‍⚕️ Talk to Doctor", url=app_deep_link("doctors"))],
    ])


def dashboard_keyboard() -> Dict[str, Any]:
    return _keyboard([
        [_btn("🏠 Open App Home", url=dashboard_app_url())],
    ])


def dashboard_message(name: str = "") -> str:
    first = (name or "there").split()[0]
    return (
        f"🏠 <b>MEDCLUES Home</b>\n\n"
        f"Hi <b>{_e(first)}</b>, tap below to open the app home page directly.\n\n"
        "<i>Book doctors, view appointments, and manage your health in one place.</i>"
    )


def welcome_unlinked() -> str:
    return (
        f"👋 <b>Hello!</b> Welcome to <b>{BOT_NAME}</b>.\n"
        f"<i>{TAGLINE}</i>\n\n"
        "I'm your Smart Patient Assistant — friendly, secure, and real-time.\n\n"
        "I can help you with:\n"
        "📅 Appointments\n"
        "👨‍⚕️ Doctors\n"
        "📂 Health Records\n"
        "🔔 Reminders\n\n"
        "<b>Link your account first:</b>\n"
        "1. Open MEDCLUES app → Settings\n"
        "2. Tap <b>Connect Telegram</b>\n"
        "3. Press START in this chat\n\n"
        "No password needed here. 🔒"
    )


def welcome_linked(name: str) -> str:
    first = (name or "there").split()[0]
    return (
        f"👋 <b>Hello { _e(first) }!</b> Welcome to <b>{BOT_NAME}</b>.\n"
        f"<i>{TAGLINE}</i>\n\n"
        "How are you feeling today? I'm here to help you with:\n"
        "📅 Appointments\n"
        "👨‍⚕️ Doctors\n"
        "📂 Health Records\n"
        "🔔 Reminders\n\n"
        "Choose an option below."
    )


def account_linked_success(name: str) -> str:
    first = (name or "there").split()[0]
    return (
        f"✅ <b>Account Linked Successfully</b>\n\n"
        f"Hi <b>{_e(first)}</b>, nice to meet you! 👋\n\n"
        "Your MEDCLUES account is now connected securely.\n\n"
        "You can now:\n"
        "✔ View appointments\n"
        "✔ Access records\n"
        "✔ Receive reminders\n\n"
        "<i>Secure • Private • Real-Time Updates</i>"
    )


def appointment_booked_message(
    name: str,
    doctor_name: str,
    speciality: str,
    slot_date: str,
    slot_time: str,
    token_number,
    hospital_name: str,
    location: str = "",
    appointment_public_id: Optional[str] = None,
) -> str:
    first = (name or "there").split()[0]
    date_fmt = _format_date(slot_date)
    loc_line = f"\n📍 <b>Location:</b> {_e(location or hospital_name)}" if (location or hospital_name) else ""
    token_line = f"\n🎫 <b>Token:</b> #{token_number}" if token_number else ""
    id_line = f"\n🆔 <b>Appointment ID:</b> <code>{_e(appointment_public_id)}</code>" if appointment_public_id else ""
    return (
        f"😊 Great choice, <b>{_e(first)}</b>!\n\n"
        f"Your appointment has been <b>confirmed</b>.\n\n"
        f"👨‍⚕️ <b>Dr. {_e(doctor_name)}</b> ({_e(speciality)})\n"
        f"📅 <b>{date_fmt}</b>\n"
        f"🕙 <b>{_e(slot_time)}</b>"
        f"{token_line}"
        f"{id_line}"
        f"{loc_line}\n\n"
        "We'll remind you before your visit. 🔔"
    )


def appointment_reminder_message(
    name: str,
    doctor_name: str,
    slot_time: str,
    hospital_name: str,
    minutes: int = 30,
) -> str:
    first = (name or "there").split()[0]
    return (
        f"⏰ Good morning, <b>{_e(first)}</b>!\n\n"
        "Just a friendly reminder —\n"
        f"<b>Your appointment starts in {minutes} minutes.</b>\n\n"
        f"👨‍⚕️ Dr. {_e(doctor_name)}\n"
        f"🕙 {_e(slot_time)}\n"
        f"📍 {_e(hospital_name)}\n\n"
        "Please arrive 15 minutes early."
    )


def report_available_message(name: str, report_name: str, upload_date: str) -> str:
    first = (name or "there").split()[0]
    return (
        f"📂 Hi <b>{_e(first)}</b>,\n\n"
        "Your new health report is ready.\n\n"
        f"📄 <b>{_e(report_name)}</b>\n"
        f"Uploaded: {_e(upload_date)}\n\n"
        "You can securely view it in the MEDCLUES app. 🔒"
    )


def health_checkin_message(name: str) -> str:
    first = (name or "there").split()[0]
    return (
        f"💙 Hello <b>{_e(first)}</b>,\n\n"
        "How are you feeling today?\n\n"
        "<i>Your health matters to us.</i>"
    )


def appointment_cancelled_message(name: str, doctor_name: str, slot_date: str, reason: str = "Cancelled") -> str:
    first = (name or "there").split()[0]
    return (
        f"❌ Hi <b>{_e(first)}</b>,\n\n"
        f"Your appointment with <b>Dr. {_e(doctor_name)}</b> on "
        f"<b>{_e(_format_date(slot_date))}</b> has been cancelled.\n\n"
        f"<b>Reason:</b> {_e(reason)}\n\n"
        "Book a new slot anytime in the MEDCLUES app."
    )


def help_text() -> str:
    return (
        f"🏥 <b>{BOT_NAME} Smart Patient Assistant</b>\n"
        f"<i>{TAGLINE}</i>\n\n"
        "<b>Quick actions</b> — use the Menu button or:\n"
        "/start — Home & main menu\n"
        "/dashboard — Open app home page\n"
        "/upcoming — Next appointments\n"
        "/records — Health reports\n"
        "/profile — Your profile\n"
        "/logout — Unlink account\n\n"
        f"📧 {_e(support_email())} | {_e(support_phone())}\n"
        "<i>This is an automated message. For emergencies call 108.</i>"
    )


def link_help_text() -> str:
    return (
        "<b>How to link your account</b>\n\n"
        "1. Open the <b>MEDCLUES</b> app on your phone\n"
        "2. Go to <b>Settings → Connect Telegram</b>\n"
        "3. Tap Connect — this chat opens automatically\n"
        "4. Press <b>START</b>\n\n"
        "Works with Google sign-in. No password in Telegram. 🔒"
    )


def footer_note() -> str:
    return (
        f"\n\n—\n"
        f"<i>Secure & Private • Linked Account Only • Real-Time Updates</i>\n"
        f"{_e(support_email())} | {_e(support_phone())}"
    )


def _format_date(slot_date: str) -> str:
    raw = str(slot_date or "").replace("_", "/").replace("-", "/")
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
        try:
            d = datetime.strptime(raw[:10] if len(raw) > 10 else raw, fmt)
            return d.strftime("%d %B %Y (%a)")
        except ValueError:
            continue
    return raw
