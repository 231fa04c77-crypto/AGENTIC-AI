"""Proactive Telegram messages to linked patients (booking, reports, reminders)."""
import asyncio
import urllib.parse
from typing import Any, Dict, Optional

from app.models import telegram_model
from app.services.telegram_api import get_telegram_api
from app.services import telegram_messages as msg


async def _chat_id_for_user(user_id: int) -> Optional[int]:
    link = await telegram_model.get_link_by_user_id(int(user_id))
    if not link:
        return None
    return int(link["chat_id"])


async def send_to_user(
    user_id: int,
    text: str,
    *,
    reply_markup: Optional[Dict[str, Any]] = None,
    parse_mode: str = "HTML",
) -> bool:
    api = get_telegram_api()
    if not api:
        return False
    chat_id = await _chat_id_for_user(user_id)
    if not chat_id:
        return False
    try:
        await api.send_message(
            chat_id, text, parse_mode=parse_mode, reply_markup=reply_markup
        )
        return True
    except Exception as e:
        print(f"[WARNING] Telegram notify user {user_id}: {e}")
        return False


async def notify_account_linked(chat_id: int, name: str) -> None:
    api = get_telegram_api()
    if not api:
        return
    try:
        await api.send_message(
            chat_id,
            msg.account_linked_success(name),
            parse_mode="HTML",
            reply_markup=msg.linked_success_keyboard(),
        )
        await asyncio.sleep(0.5)
        await api.send_message(
            chat_id,
            msg.health_checkin_message(name),
            parse_mode="HTML",
            reply_markup=msg.health_checkin_keyboard(),
        )
    except Exception as e:
        print(f"[WARNING] Telegram link welcome: {e}")


async def notify_appointment_booked(
    user_id: int,
    *,
    patient_name: str,
    doctor_name: str,
    speciality: str,
    slot_date: str,
    slot_time: str,
    token_number,
    hospital_name: str,
    hospital_location: str = "",
    appointment_id: int,
    appointment_public_id: Optional[str] = None,
    maps_url: Optional[str] = None,
) -> bool:
    if not maps_url:
        loc = hospital_location or hospital_name
        if loc:
            q = urllib.parse.quote(loc)
            maps_url = f"https://www.google.com/maps/search/?api=1&query={q}"

    text = msg.appointment_booked_message(
        patient_name,
        doctor_name,
        speciality,
        slot_date,
        slot_time,
        token_number,
        hospital_name,
        hospital_location,
        appointment_public_id=appointment_public_id,
    )
    return await send_to_user(
        user_id,
        text,
        reply_markup=msg.appointment_booked_keyboard(appointment_id, maps_url),
    )


async def notify_appointment_cancelled(
    user_id: int,
    doctor_name: str,
    slot_date: str,
    patient_name: str = "Patient",
    reason: str = "Cancelled by user",
) -> bool:
    text = msg.appointment_cancelled_message(patient_name, doctor_name, slot_date, reason)
    return await send_to_user(user_id, text)


async def notify_report_available(
    user_id: int,
    patient_name: str,
    report_name: str,
    upload_date: str,
) -> bool:
    text = msg.report_available_message(patient_name, report_name, upload_date)
    return await send_to_user(
        user_id,
        text,
        reply_markup=msg.report_available_keyboard(),
    )


async def notify_appointment_reminder(
    user_id: int,
    *,
    patient_name: str,
    doctor_name: str,
    slot_time: str,
    hospital_name: str,
    hospital_location: str = "",
    minutes: int = 30,
) -> bool:
    maps_url = None
    loc = hospital_location or hospital_name
    if loc:
        q = urllib.parse.quote(loc)
        maps_url = f"https://www.google.com/maps/search/?api=1&query={q}"

    text = msg.appointment_reminder_message(
        patient_name, doctor_name, slot_time, hospital_name, minutes
    )
    return await send_to_user(
        user_id,
        text,
        reply_markup=msg.appointment_reminder_keyboard(maps_url),
    )
