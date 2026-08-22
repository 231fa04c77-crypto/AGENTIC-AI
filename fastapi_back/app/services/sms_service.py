"""SMS delivery — Twilio or MSG91 when configured; else log + optional outbox."""
from __future__ import annotations

import httpx

from app.config.config import settings
from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def send_sms(to: str, message: str, *, use_outbox: bool = True):
    phone = (to or "").strip()
    body = (message or "").strip()
    if not phone or not body:
        return {"success": False, "message": "Missing phone or message"}

    provider = (getattr(settings, "SMS_PROVIDER", None) or "auto").strip().lower()

    if provider in ("auto", "twilio") and getattr(settings, "TWILIO_ACCOUNT_SID", None):
        result = await _send_twilio(phone, body)
        if result.get("success") or provider == "twilio":
            return result

    if provider in ("auto", "msg91") and getattr(settings, "MSG91_AUTH_KEY", None):
        result = await _send_msg91(phone, body)
        if result.get("success") or provider == "msg91":
            return result

    if use_outbox and getattr(settings, "SMS_ENQUEUE_WHEN_UNCONFIGURED", False):
        try:
            from app.services.notification_outbox_worker import enqueue

            await enqueue("sms", phone, {"message": body})
            return {
                "success": True,
                "message": "SMS queued (provider not configured)",
                "provider": "outbox",
            }
        except Exception as exc:
            log.warning("SMS outbox enqueue failed: %s", exc)

    log.info("SMS (dev/stub) to=%s msg=%s", phone, body[:120])
    return {
        "success": True,
        "message": "SMS logged (no provider configured)",
        "provider": "dev-mode",
    }


async def _send_twilio(to: str, message: str) -> dict:
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_num = settings.TWILIO_FROM_NUMBER
    if not sid or not token or not from_num:
        return {"success": False, "message": "Twilio not fully configured"}
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                data={"To": to, "From": from_num, "Body": message},
                auth=(sid, token),
            )
        if resp.status_code in (200, 201):
            return {"success": True, "message": "SMS sent", "provider": "twilio"}
        return {
            "success": False,
            "message": f"Twilio error {resp.status_code}: {resp.text[:200]}",
            "provider": "twilio",
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "provider": "twilio"}


async def _send_msg91(to: str, message: str) -> dict:
    key = settings.MSG91_AUTH_KEY
    sender = getattr(settings, "MSG91_SENDER_ID", None) or "MEDCLU"
    template_id = getattr(settings, "MSG91_TEMPLATE_ID", None) or ""
    digits = "".join(c for c in to if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # Flow API (simple text) — template_id optional for DLT
            payload = {
                "template_id": template_id or None,
                "short_url": "0",
                "recipients": [{"mobiles": digits, "VAR1": message[:100]}],
            }
            headers = {"authkey": key, "Content-Type": "application/json"}
            if template_id:
                resp = await client.post(
                    "https://control.msg91.com/api/v5/flow/",
                    json={k: v for k, v in payload.items() if v is not None},
                    headers=headers,
                )
            else:
                resp = await client.post(
                    "https://api.msg91.com/api/v2/sendsms",
                    json={
                        "sender": sender,
                        "route": "4",
                        "country": "91",
                        "sms": [{"message": message, "to": [digits]}],
                    },
                    headers=headers,
                )
        if resp.status_code in (200, 201):
            return {"success": True, "message": "SMS sent", "provider": "msg91"}
        return {
            "success": False,
            "message": f"MSG91 error {resp.status_code}: {resp.text[:200]}",
            "provider": "msg91",
        }
    except Exception as exc:
        return {"success": False, "message": str(exc), "provider": "msg91"}


async def send_appointment_sms(phone: str, appointment_data: dict):
    patient_name = appointment_data.get("patientName", "Patient")
    doctor_name = appointment_data.get("doctorName", "Doctor")
    speciality = appointment_data.get("speciality", "General")
    date = appointment_data.get("date", "N/A")
    time = appointment_data.get("time", "N/A")
    fee = appointment_data.get("fee", "0")
    hospital_address = appointment_data.get("hospitalAddress", "Address not provided")
    google_maps_link = appointment_data.get("googleMapsLink")
    token_number = appointment_data.get("tokenNumber")

    message = f"""Appointment Confirmation

Hello {patient_name},

Your appointment with Dr. {doctor_name} ({speciality}) is confirmed.

Date: {date}
Time: {time}
Fee: Rs. {fee}
Location: {hospital_address}
{f'Maps: {google_maps_link}' if google_maps_link else ''}
{f'Token Number: {token_number}' if token_number else ''}

Thank you for choosing MedClues!"""

    return await send_sms(phone, message)


async def send_emergency_sms(phone: str, patient_name: str, location):
    location_text = "Location not available"

    if location:
        if isinstance(location, str):
            location_text = location
        elif isinstance(location, dict) and location.get("latitude") and location.get("longitude"):
            lat = location["latitude"]
            lng = location["longitude"]
            location_text = (
                f"Location: https://www.google.com/maps?q={lat},{lng}\n"
                f"Lat: {lat:.6f}, Lng: {lng:.6f}"
            )

    message = f"""EMERGENCY ALERT

{patient_name} needs immediate help!

{location_text}

Please help or contact emergency services immediately."""

    return await send_sms(phone, message)
