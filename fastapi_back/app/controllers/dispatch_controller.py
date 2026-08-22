"""Dispatch controller — orchestrates the full emergency case lifecycle.

Covers:
  - Case creation (with hospital finder + webhook emit)
  - Status transitions by operators / hospitals
  - Sandbox simulation (auto-advance states every 5s for demo testing)
  - SHAMS (partner) status-poll endpoint
"""
from __future__ import annotations

import asyncio
import secrets
from typing import Any

from app.models import emergency_case_model as ecm
from app.models import partner_model
from app.services import hospital_finder_service as hfs
from app.services import partner_webhook_service as pws
from app.services.public_id_service import new_emergency_case_public_id
from app.utils.app_logger import get_logger

log = get_logger(__name__)

# ── Case creation ─────────────────────────────────────────────────────────────

async def create_emergency_case(partner: dict[str, Any], request_data: dict[str, Any]) -> dict:
    """Full case creation flow: idempotency → progressive hospital lookup → DB insert → triage → webhook."""

    partner_id = partner["partner_id"]
    partner_request_id = request_data.get("request_id") or secrets.token_hex(8)
    is_sandbox = partner["is_sandbox"]

    # 1. Idempotency check
    existing = await ecm.get_case_by_partner_request(partner_id, partner_request_id)
    if existing:
        log.info("Idempotency: returning existing case %s", existing["public_id"])
        return _format_case_response(existing)

    # 2. Find nearest hospital (progressive radius: 15 → 35 → 75 → 100 km)
    lat = float(request_data["latitude"])
    lon = float(request_data["longitude"])
    hospital = await hfs.find_nearest_hospital(lat, lon)

    triage_mode   = hospital.get("triage_mode", "no_partner_found")
    search_radius = hospital.get("search_radius_used", 15)
    log.info(
        "Triage mode '%s' | hospital '%s' %.2fkm | search radius %dkm",
        triage_mode, hospital["hospital_name"], hospital.get("distance_km", 0), search_radius
    )

    # 3. Build tracking info
    tracking_token = secrets.token_urlsafe(16)
    # public_id is generated next — use a deferred URL format so it works after public_id is set
    # tracking_url is updated below after public_id is created

    # 4. Generate public_id
    public_id = await new_emergency_case_public_id()

    # Build tracking URL pointing to the live GreenCorridorPage UI map
    from app.config.config import settings as _settings
    _admin_base = (_settings.ADMIN_PANEL_URL or "https://medclues-admin.vercel.app").rstrip("/")
    tracking_url = f"{_admin_base}/live-track/{public_id}"


    # 5. Persist case
    case = await ecm.create_case({
        "public_id": public_id,
        "partner_id": partner_id,
        "partner_request_id": partner_request_id,
        "patient_name": request_data["patient_name"],
        "patient_phone": request_data["patient_phone"],
        "user_id": request_data.get("user_id"),
        "latitude": lat,
        "longitude": lon,
        "location_text": request_data.get("location_text"),
        "emergency_type": request_data.get("emergency_type", "MEDICAL_EMERGENCY"),
        "additional_info": request_data.get("additional_info", {}),
        "partner_metadata": request_data.get("partner_metadata", {}),
        "hospital_id": hospital.get("hospital_id"),
        "hospital_name": hospital["hospital_name"],
        "hospital_address": hospital["hospital_address"],
        "hospital_distance_km": hospital["distance_km"],
        "ambulance_eta_minutes": hospital["eta_minutes"],
        "tracking_token": tracking_token,
        "tracking_url": tracking_url,
        "is_sandbox": is_sandbox,
    })

    # 6. Log hospital notification
    await ecm.log_hospital_notification(
        case["id"],
        hospital.get("hospital_id"),
        hospital["hospital_name"],
        hospital.get("hospital_phone"),
        contact_method="dashboard" if hospital.get("hospital_id") else "manual",
    )

    # 7. Advance status to HOSPITAL_ASSIGNED (for standard + hybrid; skip for no_partner_found)
    if triage_mode in ("close_dispatch", "hybrid_triage") and hospital.get("hospital_id"):
        await ecm.transition_status(case["id"], "HOSPITAL_ASSIGNED",
                                    notes=f"Auto-assigned on case creation [{triage_mode}]")
        case["status"] = "HOSPITAL_ASSIGNED"

        # ── Hybrid Triage: ER Pre-Admission Notification ───────────────────────
        # The patient is being fetched by a public ambulance (108).
        # We notify the MEDCLUES hospital's ER team to PREPARE the room.
        if triage_mode == "hybrid_triage":
            asyncio.create_task(
                _send_er_preadmission_notification(case, hospital)
            )

    # 8. Fire webhook
    webhook_url = partner.get("webhook_url") or request_data.get("webhook_url")
    if webhook_url:
        asyncio.create_task(
            pws.emit_case_created(partner_id, case["id"], case, webhook_url)
        )

    response = _format_case_response(case)
    response["hospital"] = {
        "name": hospital["hospital_name"],
        "address": hospital["hospital_address"],
        "distance_km": hospital["distance_km"],
        "eta_minutes": hospital["eta_minutes"],
        "is_tieup": hospital.get("is_tieup", False),
        "phone": hospital.get("hospital_phone"),
        "latitude": hospital.get("latitude"),
        "longitude": hospital.get("longitude"),
    }
    # Triage guidance for partner apps / SHAMS / MedID
    response["triage_info"] = {
        "mode":                triage_mode,
        "message":             hospital.get("triage_message", ""),
        "show_108_button":     hospital.get("show_108_button", False),
        "show_er_booking":     hospital.get("show_er_booking", False),
        "er_booking_immediate":hospital.get("er_booking_immediate", False),
        "emergency_contacts":  hospital.get("emergency_contacts", {"ambulance_108": "108", "police_112": "112"}),
        "search_radius_km":    search_radius,
    }
    return response


# ── Status transitions ────────────────────────────────────────────────────────

async def advance_case_status(case_public_id: str, to_status: str,
                              actor_id: int | None = None,
                              actor_role: str | None = None,
                              notes: str | None = None) -> dict:
    case = await ecm.get_case_by_public_id(case_public_id)
    if not case:
        raise ValueError("Case not found")
    updated = await ecm.transition_status(case["id"], to_status, actor_id, actor_role, notes)
    if not updated:
        raise ValueError(f"Cannot transition case {case_public_id} to {to_status}")
    return _format_case_response(updated)


async def cancel_case(case_public_id: str, reason: str | None = None) -> dict:
    case = await ecm.get_case_by_public_id(case_public_id)
    if not case:
        raise ValueError("Case not found")
    if case["status"] in ecm.TERMINAL_STATUSES:
        raise ValueError(f"Case is already in terminal state: {case['status']}")
    updated = await ecm.cancel_case(case["id"], reason)
    return _format_case_response(updated)


# ── Status polling ────────────────────────────────────────────────────────────

async def get_case_status(case_public_id: str) -> dict:
    case = await ecm.get_case_by_public_id(case_public_id)
    if not case:
        raise ValueError("Case not found")
    history = await ecm.get_status_history(case["id"])
    result = _format_case_response(case)
    result["history"] = [
        {
            "from": h["from_status"],
            "to": h["to_status"],
            "notes": h.get("notes"),
            "at": h["created_at"].isoformat() if hasattr(h["created_at"], "isoformat") else str(h["created_at"]),
        }
        for h in history
    ]
    return result


# ── ER Pre-Admission Notification (Hybrid Triage) ─────────────────────────────

async def _send_er_preadmission_notification(case: dict, hospital: dict) -> None:
    """Fire an ER pre-admission alert to the hospital when a hybrid triage occurs.
    
    This is called when the nearest MEDCLUES hospital is 25–100 km away.
    The patient is being transported by a public ambulance (108), but we pre-notify
    the hospital's ER desk so they can prepare ventilators, blood packets, and beds.
    """
    try:
        hospital_name  = hospital.get("hospital_name", "Your Hospital")
        hospital_dist  = hospital.get("distance_km", "?")
        patient_name   = case.get("patient_name") or "Emergency Patient"
        patient_phone  = case.get("patient_phone") or "N/A"
        emergency_type = (case.get("emergency_type") or "MEDICAL_EMERGENCY").replace("_", " ")
        public_id      = case.get("public_id", "")
        lat            = case.get("latitude", 0)
        lon            = case.get("longitude", 0)
        maps_link      = f"https://www.google.com/maps?q={lat},{lon}"
        tracking_url   = case.get("tracking_url", "#")

        email_html = f"""
<div style="font-family:Arial,sans-serif;max-width:640px;border:2px solid #f97316;border-radius:14px;padding:0;overflow:hidden;color:#1e293b">
  <div style="background:#f97316;padding:20px 24px;">
    <h2 style="margin:0;color:#fff;font-size:18px">⚠️ MEDCLUES — ER Pre-Admission Alert</h2>
    <p style="margin:6px 0 0;color:#fff3e6;font-size:13px">Patient en route via public ambulance (108) — Please prepare ER</p>
  </div>
  <div style="padding:24px">
    <p style="font-size:14px;color:#475569;margin-top:0">A patient has triggered an emergency via a MEDCLUES partner app. The nearest ambulance available is a public 108 service. Your hospital ({hospital_name}) at {hospital_dist} km has been pre-notified to prepare the Emergency Room.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9;width:40%">Case ID</td><td style="padding:8px 0;font-family:monospace;border-bottom:1px solid #f1f5f9">{public_id}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Patient</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{patient_name}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Phone</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{patient_phone}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Emergency</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{emergency_type}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold">Distance</td><td style="padding:8px 0">{hospital_dist} km away</td></tr>
    </table>
    <div style="background:#fff3e6;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-bottom:20px">
      <p style="margin:0;font-weight:bold;color:#ea580c">📋 Action Required for ER Team:</p>
      <ul style="margin:8px 0 0 16px;color:#7c3aed;font-size:13px;padding-left:0;list-style:disc inside">
        <li>Prepare Emergency Room bed and basic life support equipment</li>
        <li>Alert on-call ER doctor for: <strong>{emergency_type}</strong></li>
        <li>Check blood bank for O+/O- units</li>
        <li>Inform patient family: ER slot confirmed at {hospital_name}</li>
      </ul>
    </div>
    <div style="display:flex;gap:12px">
      <a href="{maps_link}" style="background:#f97316;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">📍 Patient Location</a>
      <a href="{tracking_url}" style="background:#3b82f6;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;margin-left:8px">🔴 Live Track</a>
    </div>
  </div>
</div>"""

        from app.config.db import db as _db
        hospital_row = await _db.fetch_row(
            "SELECT email FROM hospital_tieups WHERE id=$1",
            hospital.get("hospital_id")
        )
        hospital_email = (hospital_row or {}).get("email") or None

        if hospital_email:
            from app.services.email_service import send_email
            await send_email(
                to=hospital_email,
                subject=f"⚠️ MEDCLUES ER Pre-Admission: {patient_name} ({emergency_type})",
                html_content=email_html,
                recipient_name="ER Triage Team"
            )
            log.info("ER pre-admission email sent to %s for case %s", hospital_email, public_id)
        else:
            log.warning("No hospital email found for hospital_id=%s — skipping pre-admission email",
                        hospital.get("hospital_id"))

    except Exception as exc:
        log.warning("_send_er_preadmission_notification failed: %s", exc)


# ── Sandbox simulation ────────────────────────────────────────────────────────

_SIMULATION_SEQUENCE = [
    "HOSPITAL_ACCEPTED",
    "AMBULANCE_ASSIGNED",
    "AMBULANCE_STARTED",
    "PATIENT_PICKED",
    "HOSPITAL_REACHED",
    "TREATMENT_STARTED",
    "COMPLETED",
]


async def _simulate_sandbox_progression(case_id: int, partner_id: int,
                                        webhook_url: str | None) -> None:
    """Auto-advance sandbox case through the full state machine for demo purposes."""
    await asyncio.sleep(5)
    for status in _SIMULATION_SEQUENCE:
        try:
            case = await ecm.get_case_by_id(case_id)
            if not case or case["status"] in ecm.TERMINAL_STATUSES:
                break
            updated = await ecm.transition_status(case_id, status,
                                                  notes="[SANDBOX] Auto-simulated")
            if updated and webhook_url:
                asyncio.create_task(
                    pws.emit_status_changed(partner_id, case_id, updated, webhook_url)
                )
            log.info("Sandbox simulation: case=%s → %s", case_id, status)
        except Exception as exc:
            log.warning("Sandbox simulation error at %s: %s", status, exc)
            break
        await asyncio.sleep(8)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _format_case_response(case: dict) -> dict:
    """Return a clean dict suitable for the API response."""
    return {
        "case_id": case.get("public_id"),
        "status": case.get("status"),
        "patient_name": case.get("patient_name"),
        "patient_phone": case.get("patient_phone"),
        "latitude": case.get("latitude"),
        "longitude": case.get("longitude"),
        "emergency_type": case.get("emergency_type"),
        "hospital_name": case.get("hospital_name"),
        "hospital_address": case.get("hospital_address"),
        "hospital_distance_km": case.get("hospital_distance_km"),
        "ambulance_eta_minutes": case.get("ambulance_eta_minutes"),
        "tracking_url": case.get("tracking_url"),
        "is_sandbox": case.get("is_sandbox"),
        "created_at": (
            case["created_at"].isoformat()
            if hasattr(case.get("created_at"), "isoformat")
            else str(case.get("created_at"))
        ),
        "updated_at": (
            case["updated_at"].isoformat()
            if hasattr(case.get("updated_at"), "isoformat")
            else str(case.get("updated_at"))
        ),
    }
