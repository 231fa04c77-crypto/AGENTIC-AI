"""
MEDCLUES Smart Patient Assistant — @medcluesBot

Commands: /start /help /upcoming /records /profile /logout
Inline menus: appointments, records, health check-in, link help
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.controllers.user_controller import verify_password
from app.models import appointment_model, health_record_model, telegram_model, user_model
from app.services import telegram_messages as msg
from app.services.telegram_api import TelegramApi
from app.services.telegram_notify_service import notify_account_linked

_PARSE = "HTML"


async def handle_update(api: TelegramApi, update: Dict[str, Any]) -> None:
    if "callback_query" in update:
        await _handle_callback(api, update["callback_query"])
        return

    message = update.get("message") or update.get("edited_message")
    if not message:
        return
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if chat_id is None:
        return
    text = (message.get("text") or "").strip()
    if not text:
        return
    username = (message.get("from") or {}).get("username")
    await _dispatch_command(api, int(chat_id), text, username)


async def _dispatch_command(
    api: TelegramApi,
    chat_id: int,
    text: str,
    telegram_username: Optional[str],
) -> None:
    lower = text.lower()
    if lower.startswith("/start"):
        await _cmd_start(api, chat_id, text, telegram_username)
    elif lower.startswith("/dashboard"):
        await _cmd_dashboard(api, chat_id)
    elif lower.startswith("/help"):
        await api.send_message(chat_id, msg.help_text(), parse_mode=_PARSE, reply_markup=msg.main_menu_keyboard(linked=bool(await telegram_model.get_link_by_chat_id(chat_id))))
    elif lower.startswith("/login"):
        reply = await _cmd_login(chat_id, text, telegram_username)
        await api.send_message(chat_id, reply, parse_mode=_PARSE)
    elif lower.startswith("/logout"):
        reply = await _cmd_logout(chat_id)
        await api.send_message(chat_id, reply, parse_mode=_PARSE)
    elif lower.startswith("/my_appointments") or lower.startswith("/appointments"):
        await _send_appointments(api, chat_id, upcoming_only=False)
    elif lower.startswith("/upcoming"):
        await _send_appointments(api, chat_id, upcoming_only=True)
    elif lower.startswith("/profile"):
        reply = await _cmd_profile(chat_id)
        await api.send_message(chat_id, reply, parse_mode=_PARSE)
    elif lower.startswith("/records"):
        await _send_records(api, chat_id)
    elif lower.startswith("/checkin"):
        link = await telegram_model.get_link_by_chat_id(chat_id)
        name = link["name"] if link else "there"
        await api.send_message(
            chat_id,
            msg.health_checkin_message(name),
            parse_mode=_PARSE,
            reply_markup=msg.health_checkin_keyboard(),
        )
    else:
        await api.send_message(
            chat_id,
            "I didn't understand that. Tap /start for the main menu or /help for commands.",
            parse_mode=_PARSE,
        )


async def _handle_callback(api: TelegramApi, cq: Dict[str, Any]) -> None:
    cq_id = cq.get("id")
    data = (cq.get("data") or "").strip()
    message = cq.get("message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if chat_id is None:
        return

    if cq_id:
        try:
            await api.answer_callback_query(cq_id)
        except Exception:
            pass

    if data.startswith("menu:"):
        action = data.split(":", 1)[1]
        if action == "records":
            await _send_records(api, int(chat_id))
        elif action == "upcoming":
            await _send_appointments(api, int(chat_id), upcoming_only=True)
        elif action == "profile":
            reply = await _cmd_profile(int(chat_id))
            await api.send_message(int(chat_id), reply, parse_mode=_PARSE)
        elif action == "link_help":
            await api.send_message(int(chat_id), msg.link_help_text(), parse_mode=_PARSE)
        elif action == "help":
            link = await telegram_model.get_link_by_chat_id(int(chat_id))
            await api.send_message(
                int(chat_id),
                msg.help_text(),
                parse_mode=_PARSE,
                reply_markup=msg.main_menu_keyboard(linked=bool(link)),
            )
        elif action == "dashboard":
            await _cmd_dashboard(api, int(chat_id))
        return

    if data.startswith("checkin:"):
        mood = data.split(":", 1)[1]
        responses = {
            "better": "😊 Glad you're feeling better! Remember to follow your care plan.",
            "assist": "We're here for you. Open MEDCLUES app → Emergency or call our support line.",
        }
        text = responses.get(mood, "👨‍⚕️ Browse doctors in the MEDCLUES app to book a consultation.")
        await api.send_message(int(chat_id), text, parse_mode=_PARSE)
        return

    if data.startswith("apt:view:"):
        try:
            apt_id = int(data.split(":")[-1])
        except ValueError:
            return
        detail = await _appointment_detail(int(chat_id), apt_id)
        await api.send_message(int(chat_id), detail, parse_mode=_PARSE)


async def _cmd_dashboard(api: TelegramApi, chat_id: int) -> None:
    link = await telegram_model.get_link_by_chat_id(chat_id)
    name = link["name"] if link else ""
    await api.send_message(
        chat_id,
        msg.dashboard_message(name),
        parse_mode=_PARSE,
        reply_markup=msg.dashboard_keyboard(),
    )


async def _cmd_start(
    api: TelegramApi,
    chat_id: int,
    text: str,
    telegram_username: Optional[str] = None,
) -> None:
    parts = text.split(maxsplit=1)
    if len(parts) > 1 and parts[1].startswith("link_"):
        from app.controllers.telegram_link_controller import link_chat_with_code

        code = parts[1][5:].strip()
        ok, message = await link_chat_with_code(chat_id, code, telegram_username)
        if ok:
            from app.models import user_model as um

            user_id = (await telegram_model.get_link_by_chat_id(chat_id)) or {}
            user = await um.get_user_by_id(int(user_id.get("user_id", 0))) if user_id.get("user_id") else None
            name = (user or {}).get("name", "Patient")
            await notify_account_linked(chat_id, name)
        else:
            await api.send_message(chat_id, message, parse_mode=_PARSE)
        return

    link = await telegram_model.get_link_by_chat_id(chat_id)
    if link:
        await api.send_message(
            chat_id,
            msg.welcome_linked(link["name"]),
            parse_mode=_PARSE,
            reply_markup=msg.main_menu_keyboard(linked=True),
        )
    else:
        await api.send_message(
            chat_id,
            msg.welcome_unlinked(),
            parse_mode=_PARSE,
            reply_markup=msg.main_menu_keyboard(linked=False),
        )


async def _cmd_login(
    chat_id: int,
    text: str,
    telegram_username: Optional[str],
) -> str:
    parts = text.split(maxsplit=2)
    if len(parts) < 3:
        return (
            "For security, link via the MEDCLUES app instead:\n"
            "Settings → Connect Telegram\n\n"
            "Legacy: /login email password"
        )
    email = parts[1].strip().lower()
    password = parts[2]

    user = await user_model.get_user_by_email(email)
    if not user:
        return "❌ User not found. Register in the MEDCLUES app first."
    if not verify_password(password, user.get("password") or ""):
        return "❌ Invalid password."

    role = (user.get("role") or "patient").lower()
    if role != "patient":
        return f"❌ Only patient accounts can use this bot (role: {role})."

    await telegram_model.link_chat_to_user(chat_id, int(user["id"]), telegram_username)
    return msg.account_linked_success(user["name"])


async def _cmd_logout(chat_id: int) -> str:
    if await telegram_model.unlink_chat(chat_id):
        return "✅ Account unlinked.\n\nOpen MEDCLUES app → Settings → Connect Telegram to link again."
    return "You are not linked yet. Use the MEDCLUES app to connect."


async def _cmd_profile(chat_id: int) -> str:
    link = await telegram_model.get_link_by_chat_id(chat_id)
    if not link:
        return msg.welcome_unlinked()
    return (
        f"👤 <b>Your Profile</b>\n\n"
        f"<b>Name:</b> {link['name']}\n"
        f"<b>Email:</b> {link['email']}\n"
        f"<b>Phone:</b> {link.get('phone') or '—'}\n"
        f"<b>Account:</b> MEDCLUES Patient"
    )


def _parse_doc_name(apt: Dict[str, Any]) -> str:
    doc = apt.get("doctor_data")
    if isinstance(doc, str):
        try:
            doc = json.loads(doc)
        except json.JSONDecodeError:
            return "Doctor"
    if isinstance(doc, dict):
        return doc.get("name") or "Doctor"
    return "Doctor"


def _parse_doc_speciality(apt: Dict[str, Any]) -> str:
    doc = apt.get("doctor_data")
    if isinstance(doc, str):
        try:
            doc = json.loads(doc)
        except json.JSONDecodeError:
            return ""
    if isinstance(doc, dict):
        return doc.get("speciality") or doc.get("specialty") or ""
    return ""


def _apt_status_line(apt: Dict[str, Any]) -> str:
    if apt.get("cancelled"):
        return "Cancelled"
    if apt.get("is_completed"):
        return "Completed"
    return apt.get("status") or "Scheduled"


def _is_upcoming(apt: Dict[str, Any]) -> bool:
    if apt.get("cancelled") or apt.get("is_completed"):
        return False
    slot_date = apt.get("slot_date") or ""
    try:
        d = datetime.strptime(str(slot_date).replace("/", "_"), "%d_%m_%Y").date()
        return d >= datetime.utcnow().date()
    except ValueError:
        return True


async def _send_appointments(api: TelegramApi, chat_id: int, *, upcoming_only: bool) -> None:
    link = await telegram_model.get_link_by_chat_id(chat_id)
    if not link:
        await api.send_message(
            chat_id,
            msg.welcome_unlinked(),
            parse_mode=_PARSE,
            reply_markup=msg.main_menu_keyboard(linked=False),
        )
        return

    rows = await appointment_model.get_appointments_by_user_id(int(link["user_id"]))
    if upcoming_only:
        rows = [a for a in rows if _is_upcoming(a)]

    if not rows:
        label = "upcoming " if upcoming_only else ""
        await api.send_message(
            chat_id,
            f"📅 No {label}appointments found.\n\nBook one in the MEDCLUES app.",
            parse_mode=_PARSE,
            reply_markup=msg.main_menu_keyboard(linked=True),
        )
        return

    title = "Upcoming" if upcoming_only else "My"
    lines: List[str] = [f"📅 <b>{title} Appointments</b> ({min(len(rows), 10)} shown)\n"]
    for apt in rows[:10]:
        doc_name = _parse_doc_name(apt)
        status = _apt_status_line(apt)
        slot_date = (apt.get("slot_date") or "").replace("_", "/")
        slot_time = apt.get("slot_time") or ""
        token = apt.get("token_number")
        token_s = f" | Token #{token}" if token else ""
        lines.append(
            f"\n<b>#{apt['id']}</b> — {doc_name}\n"
            f"📆 {slot_date} {slot_time}{token_s}\n"
            f"Status: {status} | Rs.{apt.get('amount', 0)}"
        )
    if len(rows) > 10:
        lines.append("\n<i>…and more in the MEDCLUES app.</i>")

    await api.send_message(
        chat_id,
        "".join(lines) + msg.footer_note(),
        parse_mode=_PARSE,
        reply_markup=msg.main_menu_keyboard(linked=True),
    )


async def _send_records(api: TelegramApi, chat_id: int) -> None:
    link = await telegram_model.get_link_by_chat_id(chat_id)
    if not link:
        await api.send_message(
            chat_id,
            msg.welcome_unlinked(),
            parse_mode=_PARSE,
            reply_markup=msg.main_menu_keyboard(linked=False),
        )
        return

    records = await health_record_model.get_health_records_by_user_id(int(link["user_id"]))
    if not records:
        await api.send_message(
            chat_id,
            "📂 No health records yet.\n\nUpload reports in the MEDCLUES app.",
            parse_mode=_PARSE,
            reply_markup=msg.main_menu_keyboard(linked=True),
        )
        return

    lines = [f"📂 <b>Health Records</b> ({min(len(records), 10)} shown)\n"]
    for rec in records[:10]:
        title = rec.get("title") or rec.get("record_type") or "Record"
        created = rec.get("created_at")
        if hasattr(created, "strftime"):
            created = created.strftime("%d %B %Y")
        lines.append(f"\n📄 <b>{title}</b>\n   {created}")
    if len(records) > 10:
        lines.append("\n<i>…and more in the app.</i>")

    await api.send_message(
        chat_id,
        "".join(lines) + msg.footer_note(),
        parse_mode=_PARSE,
        reply_markup=msg.report_available_keyboard(),
    )


async def _appointment_detail(chat_id: int, appointment_id: int) -> str:
    link = await telegram_model.get_link_by_chat_id(chat_id)
    if not link:
        return msg.welcome_unlinked()

    apt = await appointment_model.get_appointment_by_id(appointment_id)
    if not apt or int(apt.get("user_id", 0)) != int(link["user_id"]):
        return "Appointment not found."

    doc = _parse_doc_name(apt)
    spec = _parse_doc_speciality(apt)
    slot_date = (apt.get("slot_date") or "").replace("_", "/")
    return (
        f"📄 <b>Appointment #{appointment_id}</b>\n\n"
        f"👨‍⚕️ <b>{doc}</b> ({spec})\n"
        f"📅 {slot_date}\n"
        f"🕙 {apt.get('slot_time', '')}\n"
        f"🎫 Token #{apt.get('token_number', '—')}\n"
        f"Status: {_apt_status_line(apt)}\n"
        f"Fee: Rs.{apt.get('amount', 0)}"
    )
