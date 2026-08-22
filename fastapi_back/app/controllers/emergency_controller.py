import re

from app.models import emergency_event_model
from app.services import sms_service
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_PHONE_RE = re.compile(r"^\d{10,15}$")


def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if not _PHONE_RE.match(digits):
        return None
    return digits


def _location_text(location) -> str | None:
    if not location:
        return None
    if isinstance(location, str):
        return location[:2000]
    if isinstance(location, dict):
        lat = location.get("latitude")
        lng = location.get("longitude")
        if lat is not None and lng is not None:
            return f"https://www.google.com/maps?q={lat},{lng}"
        return str(location)[:2000]
    return str(location)[:2000]


async def send_emergency_alert(
    data: dict,
    *,
    user_id: int | None = None,
    ip_address: str | None = None,
    source: str = "api",
):
    try:
        phone = _normalize_phone(data.get("phone") or "")
        patient_name = (data.get("patientName") or data.get("patient_name") or "").strip()
        location = data.get("location")

        if not phone or not patient_name:
            return {
                "success": False,
                "message": "Phone number and patient name are required",
            }

        await emergency_event_model.log_event(
            event_type="sms_alert_requested",
            user_id=user_id,
            recipient_phone=phone,
            location_text=_location_text(location),
            metadata={"patient_name": patient_name[:120]},
            source=source,
            ip_address=ip_address,
        )

        result = await sms_service.send_emergency_sms(phone, patient_name, location)

        if result.get("success"):
            await emergency_event_model.log_event(
                event_type="sms_sent",
                user_id=user_id,
                recipient_phone=phone,
                location_text=_location_text(location),
                metadata={"provider": result.get("provider"), "sid": result.get("sid")},
                source=source,
                ip_address=ip_address,
            )
            return {
                "success": True,
                "message": "Emergency SMS sent successfully",
                "sid": result.get("sid"),
            }

        await emergency_event_model.log_event(
            event_type="sms_failed",
            user_id=user_id,
            recipient_phone=phone,
            metadata={"error": result.get("message")},
            source=source,
            ip_address=ip_address,
        )
        return {
            "success": False,
            "message": result.get("message") or "Failed to send emergency SMS",
        }
    except Exception as e:
        log.warning("Emergency alert error: %s", e)
        return {
            "success": False,
            "message": str(e) or "Failed to send emergency SMS",
        }


async def log_sos_event(
    data: dict,
    *,
    user_id: int | None = None,
    ip_address: str | None = None,
    source: str = "api",
):
    """Record SOS activation (no SMS). Additive audit trail for mobile/web."""
    try:
        symptoms = data.get("symptoms") or []
        if not isinstance(symptoms, list):
            symptoms = [str(symptoms)]

        lat = data.get("latitude")
        lng = data.get("longitude")
        try:
            lat = float(lat) if lat is not None else None
        except (TypeError, ValueError):
            lat = None
        try:
            lng = float(lng) if lng is not None else None
        except (TypeError, ValueError):
            lng = None

        await emergency_event_model.log_event(
            event_type=data.get("eventType") or data.get("event_type") or "sos_activated",
            user_id=user_id,
            severity=(data.get("severity") or "")[:32] or None,
            latitude=lat,
            longitude=lng,
            location_text=_location_text(data.get("location") or data.get("mapsLink")),
            symptoms=[str(s)[:120] for s in symptoms[:20]],
            metadata={
                k: v
                for k, v in {
                    "triggerType": data.get("triggerType") or data.get("trigger_type"),
                    "isHelperFlow": data.get("isHelperFlow"),
                    "notes": (data.get("notes") or "")[:500] or None,
                }.items()
                if v is not None
            },
            source=source,
            ip_address=ip_address,
        )
        return {"success": True, "message": "Emergency event logged"}
    except Exception as e:
        log.warning("Emergency log error: %s", e)
        return {"success": False, "message": str(e) or "Failed to log emergency event"}
