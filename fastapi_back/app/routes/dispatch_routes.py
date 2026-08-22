"""Dispatch routes — Hospital Dean portal + Ambulance operator portal.

Hospital Dean Portal endpoints (JWT-authenticated as dean):
    GET  /api/dispatch/hospital/incoming      → list unresolved cases for this hospital
    POST /api/dispatch/hospital/accept        → accept a case (marks hospital as ready)
    POST /api/dispatch/hospital/reject        → reject a case (triggers re-routing)

Ambulance Operator endpoints (operator JWT token):
    POST /api/dispatch/operator/login         → authenticate ambulance operator
    GET  /api/dispatch/operator/case          → get currently assigned case
    POST /api/dispatch/operator/ping          → submit GPS coordinates
    POST /api/dispatch/operator/status        → advance case status

Admin fleet management:
    GET  /api/dispatch/ambulances             → list all ambulances
    POST /api/dispatch/ambulances             → register a new ambulance
    POST /api/dispatch/ambulances/{id}/assign → manually assign to a case
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.models import ambulance_model as am
from app.models import emergency_case_model as ecm
from app.services import partner_webhook_service as pws
from app.utils.app_logger import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/api/dispatch", tags=["Dispatch — Phase 2"])

# ── Import dispatch auth (accepts Dean OR Receptionist) ───────────────────────
try:
    from app.middleware.auth import dispatch_auth
except ImportError:
    async def dispatch_auth():  # type: ignore
        return {"id": 1, "hospital_id": 1, "role": "dean"}

# Keep dean_auth alias for legacy internal use
try:
    from app.middleware.auth import auth_dean as dean_auth
except ImportError:
    async def dean_auth():  # type: ignore
        return {"id": 1, "hospital_id": 1}

# ── Simple ambulance operator JWT (reuse Jose from existing auth) ─────────────

import os
from jose import jwt as _jwt, JWTError

from app.config.config import settings

_INSECURE_OPERATOR_DEFAULTS = frozenset(
    {
        "medclues-secret-change-me",
        "secret",
        "changeme",
        "greatstack",
    }
)


def _operator_secret() -> str:
    raw = (
        os.getenv("OPERATOR_JWT_SECRET")
        or os.getenv("SECRET_KEY")
        or (settings.JWT_SECRET or "")
    ).strip()
    if not raw or raw.lower() in _INSECURE_OPERATOR_DEFAULTS:
        if settings.DEBUG:
            return settings.JWT_SECRET or "dev-only-insecure-jwt-secret-change-me"
        raise RuntimeError(
            "OPERATOR_JWT_SECRET / SECRET_KEY / JWT_SECRET must be set to a strong value "
            "(not the default medclues-secret-change-me)"
        )
    return raw


_OPERATOR_ALG = "HS256"


def _create_operator_token(data: dict) -> str:
    payload = {**data, "exp": int(time.time()) + 86400 * 30, "role": "ambulance_operator"}
    return _jwt.encode(payload, _operator_secret(), algorithm=_OPERATOR_ALG)


async def _operator_auth(authorization: str = Header(...)) -> dict:
    if authorization.startswith("triptoken "):
        trip_token = authorization.removeprefix("triptoken ").strip()
        from app.config.db import db as _db
        row = await _db.fetch_row(
            """
            SELECT aa.ambulance_id, a.operator_name, a.vehicle_number
            FROM ambulance_assignments aa
            JOIN ambulances a ON a.id = aa.ambulance_id
            WHERE aa.driver_trip_token = $1 AND aa.completed_at IS NULL
            """,
            trip_token
        )
        if not row:
            raise HTTPException(status_code=401, detail="Invalid or expired driver trip token")
        return {
            "operator_id": None,
            "ambulance_id": row["ambulance_id"],
            "vehicle_number": row["vehicle_number"],
            "role": "ambulance_operator",
        }

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = _jwt.decode(token, _operator_secret(), algorithms=[_OPERATOR_ALG])
        if payload.get("role") != "ambulance_operator":
            raise HTTPException(status_code=403, detail="Not an operator token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid operator token")


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class OperatorLoginRequest(BaseModel):
    username: str
    password: str

class AcceptCaseRequest(BaseModel):
    case_id: str                        # public_id of the emergency case
    ambulance_id: Optional[int] = None  # if set: manual assignment; else: auto-assign

class RejectCaseRequest(BaseModel):
    case_id: str
    reason: Optional[str] = None

class GpsPingRequest(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: Optional[float] = None
    heading: Optional[float] = None
    case_id: Optional[str] = None    # public_id of current case (optional)

class OperatorStatusRequest(BaseModel):
    case_id: str    # public_id
    status: str     # target status

class CreateAmbulanceRequest(BaseModel):
    vehicle_number: str
    vehicle_type: str = "BLS"
    operator_name: Optional[str] = None
    operator_phone: Optional[str] = None
    operator_email: Optional[str] = None
    hospital_id: Optional[int] = None
    operator_username: Optional[str] = None
    operator_password: Optional[str] = None

class AssignAmbulanceRequest(BaseModel):
    case_id: str
    ambulance_id: int


class CreateHospitalAmbulanceRequest(BaseModel):
    vehicle_number: str
    vehicle_type: str = "BLS"
    operator_name: Optional[str] = None
    operator_phone: Optional[str] = None
    operator_email: Optional[str] = None
    operator_username: Optional[str] = None
    operator_password: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Hospital Dean Portal
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/hospital/incoming", summary="Dean/Receptionist: list incoming emergency cases")
async def hospital_incoming(
    tab: str = "live",
    date: Optional[str] = None,
    dispatcher=Depends(dispatch_auth)
):
    """Returns emergency cases assigned to this hospital based on tab and date filter."""
    hospital_id = dispatcher.get("hospital_id")
    if not hospital_id:
        raise HTTPException(status_code=400, detail="Dispatcher not linked to a hospital")

    rows = await db_query_hospital_cases(hospital_id, tab, date)
    return {"success": True, "data": rows}


async def db_query_hospital_cases(hospital_id: int, tab: str = "live", selected_date: str | None = None) -> list:
    from app.config.db import db
    params: list = [hospital_id]
    idx = 2

    where_clauses = ["ec.hospital_id = $1"]

    if tab == "live":
        where_clauses.append("ec.status NOT IN ('COMPLETED', 'CANCELLED')")
    else:
        where_clauses.append("ec.status IN ('COMPLETED', 'CANCELLED')")

    if selected_date:
        # Check date (handling local server time conversions if needed)
        where_clauses.append(f"DATE(ec.created_at) = ${idx}")
        params.append(selected_date)
        idx += 1

    sql = f"""
        SELECT ec.*, p.name AS partner_name
        FROM emergency_cases ec
        JOIN partners p ON p.id = ec.partner_id
        WHERE {" AND ".join(where_clauses)}
        ORDER BY ec.created_at DESC
        LIMIT 100
    """
    rows = await db.query(sql, *params)
    return [dict(r) for r in rows]


@router.post("/hospital/accept", summary="Dean/Receptionist: accept and dispatch emergency case")
async def hospital_accept(body: AcceptCaseRequest, dispatcher=Depends(dispatch_auth)):
    """Accept an emergency case and optionally assign a specific ambulance.
    
    - If ambulance_id is supplied: manual assignment (receptionist selected from dropdown).
    - If ambulance_id is None: auto-assigns the nearest available ambulance (fallback).
    After assignment, triggers multi-channel alerts to the driver.
    """
    import math
    from app.config.db import db

    case = await ecm.get_case_by_public_id(body.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    actor_role = dispatcher.get("role", "dean")
    await ecm.transition_status(
        case["id"], "HOSPITAL_ACCEPTED",
        actor_role=actor_role,
        notes=f"Hospital accepted via {'Receptionist' if actor_role == 'receptionist' else 'Dean'} portal"
    )

    # ── Haversine helper ──────────────────────────────────────────────────────
    def _haversine(lat2, lon2):
        dlat = math.radians(lat2 - (case["latitude"] or 0))
        dlon = math.radians(lon2 - (case["longitude"] or 0))
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(case["latitude"] or 0)) *
             math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    amb = None

    # ── Manual assignment (receptionist chose from dropdown) ──────────────────
    if body.ambulance_id:
        amb = await am.get_ambulance_by_id(body.ambulance_id)
        if not amb:
            raise HTTPException(status_code=404, detail="Selected ambulance not found")
        if amb.get("hospital_id") and amb["hospital_id"] != dispatcher.get("hospital_id"):
            raise HTTPException(status_code=403, detail="Ambulance does not belong to your hospital")
        log.info("Manual ambulance selection: %s by %s", amb["vehicle_number"], actor_role)

    # ── Auto-assign fallback (no ambulance_id given) ──────────────────────────
    if not amb:
        amb = await am.find_nearest_available_ambulance(
            case["latitude"], case["longitude"]
        )
        if amb:
            log.info("Auto-assigned ambulance %s to case %s", amb["vehicle_number"], body.case_id)

    # ── Create assignment record & advance status ──────────────────────────────
    if amb:
        amb_lat = amb.get("latitude") or 0.0
        amb_lon = amb.get("longitude") or 0.0
        dist_km = _haversine(amb_lat, amb_lon)
        eta = max(1, round((dist_km / 40.0) * 60))
        assignment = await am.create_assignment(case["id"], amb["id"], round(dist_km, 2), eta)
        await ecm.transition_status(
            case["id"], "AMBULANCE_ASSIGNED",
            actor_role="system",
            notes=f"{'Manually' if body.ambulance_id else 'Auto'}-assigned ambulance {amb['vehicle_number']}"
        )

        # Build secure one-tap driver trip link (no password needed)
        driver_trip_token = assignment.get("driver_trip_token", "")
        from app.config.config import settings
        frontend_base = (settings.ADMIN_PANEL_URL or settings.FRONTEND_URL or "http://localhost:5174").rstrip("/")
        trip_link = f"{frontend_base}/driver-trip?token={driver_trip_token}" if driver_trip_token else f"{frontend_base}/driver-trip?id={case['public_id']}"
        green_link = f"{frontend_base}/live-track/{case['public_id']}"

        # ── Multi-channel driver alerts ────────────────────────────────────────
        driver_name = amb.get("operator_name") or "Driver"
        driver_phone = amb.get("operator_phone") or ""
        driver_email = amb.get("operator_email") or ""
        case_lat = case.get("latitude") or 0
        case_lon = case.get("longitude") or 0
        maps_link = f"https://www.google.com/maps?q={case_lat},{case_lon}"

        sms_body = (
            f"🚨 MEDCLUES EMERGENCY DISPATCH\n"
            f"Case: {case['public_id']}\n"
            f"Patient: {case.get('patient_name') or 'Emergency Patient'}\n"
            f"📍 Location: {maps_link}\n"
            f"🚑 Start trip (one tap, no login): {trip_link}"
        )

        # SMS/WhatsApp alert to driver
        if driver_phone:
            try:
                from app.services.sms_service import send_sms
                await send_sms(driver_phone, sms_body)
                log.info("SMS dispatch alert sent to %s", driver_phone)
            except Exception as exc:
                log.warning("SMS alert failed: %s", exc)

        # Email dispatch alert directly to driver (highly useful for testing)
        if driver_email:
            try:
                from app.services.email_service import send_email
                driver_email_html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;border:1px solid #ef4444;border-radius:12px;padding:24px;color:#1e293b">
  <h2 style="color:#ef4444;margin-top:0">🚨 MEDCLUES — Emergency Driver Dispatch</h2>
  <p>You have been dispatched to an emergency case. Tap the link below on your phone to open navigation and track the trip.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Case ID</td><td style="padding:8px 0;font-family:monospace;border-bottom:1px solid #f1f5f9">{case['public_id']}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Patient</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{case.get('patient_name') or 'Emergency Patient'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Phone</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{case.get('patient_phone') or 'N/A'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold">Pickup Address</td><td style="padding:8px 0">{case.get('location_text') or 'See GPS map'}</td></tr>
  </table>
  <div style="margin-top:20px">
    <a href="{trip_link}" style="background:#ef4444;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">🚑 Start Journey (One-Tap Navigation)</a>
  </div>
</div>"""
                await send_email(
                    to=driver_email,
                    subject=f"🚨 EMERGENCY ASSIGNMENT: Case {case['public_id']}",
                    html_content=driver_email_html,
                    recipient_name=driver_name
                )
                log.info("Driver trip email sent to %s", driver_email)
            except Exception as exc:
                log.warning("Driver trip email failed: %s", exc)

        # Email dispatch sheet to hospital
        try:
            hospital_row = await db.fetch_row(
                "SELECT email FROM hospitals WHERE id=$1", dispatcher.get("hospital_id")
            )
            hospital_email = (hospital_row or {}).get("email") or "emergency@medclues.com"
            email_html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;border:1px solid #e2e8f0;border-radius:12px;padding:24px;color:#1e293b">
  <h2 style="color:#ef4444;margin-top:0">🚨 MEDCLUES — Emergency Dispatch Sheet</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Case ID</td><td style="padding:8px 0;font-family:monospace;border-bottom:1px solid #f1f5f9">{case['public_id']}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Patient</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{case.get('patient_name') or 'N/A'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Phone</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{case.get('patient_phone') or 'N/A'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Ambulance</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{amb['vehicle_number']} ({amb.get('vehicle_type','BLS')})</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9">Driver</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">{driver_name} · {driver_phone or 'N/A'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:bold">ETA</td><td style="padding:8px 0">{eta} min · {round(dist_km,1)} km</td></tr>
  </table>
  <div style="margin-top:20px">
    <a href="{maps_link}" style="background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:10px">📍 Pickup Location</a>
    <a href="{trip_link}" style="background:#3b82f6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">🚑 Track Trip</a>
  </div>
</div>"""
            from app.services.email_service import send_email
            await send_email(
                to=hospital_email,
                subject=f"🚨 MEDCLUES Dispatch: Case {case['public_id']}",
                html_content=email_html,
                recipient_name="Emergency Crew"
            )
            log.info("Dispatch email sent to %s", hospital_email)
        except Exception as exc:
            log.warning("Dispatch email failed: %s", exc)

    # ── Emit partner webhook ───────────────────────────────────────────────────
    partner_id = case["partner_id"]
    partner = await db.fetch_row("SELECT webhook_url FROM partners WHERE id=$1", partner_id)
    if partner and partner["webhook_url"]:
        refreshed = await ecm.get_case_by_id(case["id"])
        await pws.emit_status_changed(partner_id, case["id"], dict(refreshed), partner["webhook_url"])

    return {
        "success": True,
        "message": "Case accepted and dispatched",
        "ambulance_assigned": amb is not None,
        "ambulance_vehicle": amb["vehicle_number"] if amb else None,
        "eta_minutes": eta if amb else None,
        "driver_trip_link": trip_link if amb else None,
        "green_corridor_link": green_link if amb else None,
    }


@router.get("/hospital/ambulances", summary="Dean/Receptionist: list available ambulances for this hospital")
async def hospital_ambulances(dispatcher=Depends(dispatch_auth)):
    """Returns ambulances belonging to this hospital for the receptionist dispatch dropdown."""
    hospital_id = dispatcher.get("hospital_id")
    from app.config.db import db
    rows = await db.query(
        """SELECT id, vehicle_number, vehicle_type, operator_name, operator_phone, operator_email,
                  status, latitude, longitude
           FROM ambulances
           WHERE hospital_id = $1
           ORDER BY status, vehicle_number""",
        hospital_id
    )
    return {"success": True, "data": [dict(r) for r in rows]}


@router.post("/hospital/ambulances", summary="Dean/Receptionist: register a new ambulance and driver operator for this hospital")
async def create_hospital_ambulance(body: CreateHospitalAmbulanceRequest, dispatcher=Depends(dispatch_auth)):
    hospital_id = dispatcher.get("hospital_id")
    if not hospital_id:
        raise HTTPException(status_code=400, detail="Dispatcher not linked to a hospital")

    # Check if vehicle number already exists
    from app.config.db import db
    existing = await db.fetch_row("SELECT id FROM ambulances WHERE vehicle_number=$1", body.vehicle_number)
    if existing:
        raise HTTPException(status_code=400, detail=f"Ambulance with vehicle number {body.vehicle_number} already registered")

    # Check if username already exists (only if supplied)
    if body.operator_username:
        existing_op = await db.fetch_row("SELECT id FROM ambulance_operators WHERE username=$1", body.operator_username)
        if existing_op:
            raise HTTPException(status_code=400, detail=f"Operator username {body.operator_username} already taken")

    # Create ambulance
    amb = await am.create_ambulance({
        "vehicle_number": body.vehicle_number,
        "vehicle_type": body.vehicle_type,
        "operator_name": body.operator_name,
        "operator_phone": body.operator_phone,
        "operator_email": body.operator_email,
        "hospital_id": hospital_id,
    })

    # Create operator (if username & password provided)
    op_data = None
    if body.operator_username and body.operator_password:
        op_data = await am.create_operator(amb["id"], body.operator_username, body.operator_password)

    return {
        "success": True,
        "message": "Ambulance registered successfully",
        "data": {
            "ambulance": dict(amb),
            "operator": {
                "id": op_data["id"] if op_data else None,
                "username": op_data["username"] if op_data else None,
                "is_active": op_data["is_active"] if op_data else None
            } if op_data else None
        }
    }



@router.post("/hospital/reject", summary="Dean/Receptionist: reject emergency case")
async def hospital_reject(body: RejectCaseRequest, dispatcher=Depends(dispatch_auth)):
    case = await ecm.get_case_by_public_id(body.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    actor_role = dispatcher.get("role", "dean")
    await ecm.transition_status(case["id"], "HOSPITAL_REJECTED",
                                actor_role=actor_role, notes=body.reason or "Rejected by hospital")
    return {"success": True, "message": "Case rejected"}


# ── Public: Driver One-Tap Trip Page ──────────────────────────────────────────
# No authentication required — the secure token acts as the credential.

@router.get("/driver-trip/{token}",
            summary="Public: get trip data for driver via one-tap secure token")
async def driver_trip(token: str):
    """Called by the DriverTripPage frontend. The secure driver_trip_token was sent
    to the driver via SMS/WhatsApp — no username or password needed.
    Returns everything the driver needs: patient location, hospital, case status.
    """
    assignment = await am.get_assignment_by_trip_token(token)
    if not assignment:
        raise HTTPException(status_code=404, detail="Trip not found or link expired")

    case_lat = assignment.get("case_lat") or 0
    case_lon = assignment.get("case_lon") or 0

    return {
        "success": True,
        "data": {
            "case_id":        assignment.get("public_id"),
            "case_status":    assignment.get("case_status"),
            "patient_name":   assignment.get("patient_name"),
            "patient_phone":  assignment.get("patient_phone"),
            "emergency_type": assignment.get("emergency_type"),
            "location_text":  assignment.get("location_text"),
            "pickup_lat":     case_lat,
            "pickup_lon":     case_lon,
            "hospital_name":  assignment.get("hospital_name"),
            "hospital_address": assignment.get("hospital_address"),
            "vehicle_number": assignment.get("vehicle_number"),
            "vehicle_type":   assignment.get("vehicle_type"),
            "eta_minutes":    assignment.get("eta_minutes"),
            "distance_km":    assignment.get("distance_km"),
            "maps_nav_url":   f"https://www.google.com/maps/dir/?api=1&destination={case_lat},{case_lon}&travelmode=driving",
            "assigned_at":    str(assignment.get("assigned_at") or ""),
        }
    }


# ── Public: Green Corridor Live GPS Feed ──────────────────────────────────────
# Shareable with traffic police for real-time ambulance tracking.

@router.get("/live-track/{case_id}",
            summary="Public: live GPS feed for active ambulance (Green Corridor)")
async def live_track(case_id: str):
    """Returns the current GPS position of the ambulance assigned to this case.
    This URL can be shared with traffic police / corridor management to enable
    smart signal clearing as the ambulance approaches intersections.
    Requires no authentication — the case_id is the access key.
    """
    from app.config.db import db as _db
    case = await ecm.get_case_by_public_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Get the latest GPS ping for the assigned ambulance
    assignment = await _db.fetch_row(
        "SELECT aa.ambulance_id, a.vehicle_number, a.vehicle_type, a.operator_name "
        "FROM ambulance_assignments aa "
        "JOIN ambulances a ON a.id = aa.ambulance_id "
        "WHERE aa.case_id=$1 AND aa.completed_at IS NULL",
        case["id"]
    )
    if not assignment:
        return {"success": True, "data": None, "message": "No ambulance currently assigned"}

    ping = await am.get_latest_ping(assignment["ambulance_id"])

    return {
        "success": True,
        "data": {
            "case_id":         case_id,
            "case_status":     case.get("status"),
            "patient_name":    case.get("patient_name"),
            "emergency_type":  case.get("emergency_type"),
            "pickup_lat":      case.get("latitude"),
            "pickup_lon":      case.get("longitude"),
            "hospital_name":   case.get("hospital_name"),
            "hospital_address": case.get("hospital_address"),
            "eta_minutes":     case.get("ambulance_eta_minutes"),
            "ambulance_id":    assignment["ambulance_id"],
            "vehicle_number":  assignment["vehicle_number"],
            "vehicle_type":    assignment["vehicle_type"],
            "driver_name":     assignment["operator_name"],
            "current_lat":     ping["latitude"] if ping else None,
            "current_lon":     ping["longitude"] if ping else None,
            "speed_kmh":       ping["speed_kmh"] if ping else None,
            "heading":         ping["heading"] if ping else None,
            "last_ping_at":    str(ping["created_at"]) if ping else None,
            "socket_room":     f"case:{case_id}",
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# Ambulance Operator
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/operator/login", summary="Ambulance operator login")
async def operator_login(body: OperatorLoginRequest):
    op = await am.get_operator_by_username(body.username)
    if not op or not am.verify_operator_password(body.password, op["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_operator_token({
        "operator_id": op["id"],
        "ambulance_id": op["ambulance_id"],
        "vehicle_number": op.get("vehicle_number"),
        "hospital_id": op.get("hospital_id"),
    })
    return {"success": True, "token": token, "ambulance_id": op["ambulance_id"],
            "vehicle_number": op.get("vehicle_number")}


@router.get("/operator/case", summary="Operator: get currently assigned case")
async def operator_get_case(op=Depends(_operator_auth)):
    from app.config.db import db
    assignment = await db.fetch_row(
        "SELECT * FROM ambulance_assignments WHERE ambulance_id=$1 AND completed_at IS NULL",
        op["ambulance_id"]
    )
    if not assignment:
        return {"success": True, "data": None, "message": "No active case assigned"}
    case = await ecm.get_case_by_id(assignment["case_id"])
    return {"success": True, "data": dict(case) if case else None}


@router.post("/operator/ping", summary="Operator: submit GPS ping")
async def operator_gps_ping(body: GpsPingRequest, op=Depends(_operator_auth)):
    case_id_int = None
    if body.case_id:
        case = await ecm.get_case_by_public_id(body.case_id)
        if case:
            case_id_int = case["id"]

    await am.record_gps_ping(
        op["ambulance_id"], case_id_int,
        body.latitude, body.longitude, body.speed_kmh, body.heading
    )

    # Emit Socket.IO room update
    try:
        from app.services.socket_service import sio
        if case_id_int:
            case = await ecm.get_case_by_id(case_id_int)
            if case:
                await sio.emit(
                    "ambulance_location",
                    {"latitude": body.latitude, "longitude": body.longitude,
                     "speed_kmh": body.speed_kmh, "heading": body.heading,
                     "ambulance_id": op["ambulance_id"], "ts": int(time.time())},
                    room=f"case:{case['public_id']}",
                )
    except Exception as exc:
        log.debug("Socket.IO emit skipped: %s", exc)

    return {"success": True}


@router.post("/operator/status", summary="Operator: advance case status")
async def operator_advance_status(body: OperatorStatusRequest, op=Depends(_operator_auth)):
    case = await ecm.get_case_by_public_id(body.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    valid_operator_transitions = [
        "AMBULANCE_STARTED", "PATIENT_PICKED", "HOSPITAL_REACHED",
        "TREATMENT_STARTED", "COMPLETED"
    ]
    if body.status not in valid_operator_transitions:
        raise HTTPException(status_code=400, detail=f"Operators can only set: {valid_operator_transitions}")

    try:
        updated = await ecm.transition_status(
            case["id"], body.status,
            actor_role="ambulance_operator",
            notes=f"Operator transition via mobile app"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if body.status == "COMPLETED":
        await am.complete_assignment(case["id"])

    # Emit Socket.IO status update
    try:
        from app.services.socket_service import sio
        await sio.emit("case_status", {"case_id": body.case_id, "status": body.status},
                       room=f"case:{body.case_id}")
    except Exception:
        pass

    # Emit partner webhook
    partner_id = case["partner_id"]
    from app.config.db import db
    partner = await db.fetch_row("SELECT webhook_url FROM partners WHERE id=$1", partner_id)
    if partner and partner["webhook_url"] and updated:
        await pws.emit_status_changed(partner_id, case["id"], dict(updated), partner["webhook_url"])

    return {"success": True, "status": body.status}


# ─────────────────────────────────────────────────────────────────────────────
# Admin Fleet Management
# ─────────────────────────────────────────────────────────────────────────────

try:
    from app.middleware.auth import admin_auth
except ImportError:
    async def admin_auth():  # type: ignore
        return {"admin_id": 1}


@router.get("/ambulances", summary="Admin: list all ambulances")
async def list_ambulances(_admin=Depends(admin_auth)):
    rows = await am.list_ambulances()
    return {"success": True, "data": [dict(r) for r in rows]}


@router.post("/ambulances", summary="Admin: register a new ambulance")
async def create_ambulance(body: CreateAmbulanceRequest, _admin=Depends(admin_auth)):
    amb = await am.create_ambulance(body.model_dump(exclude={"operator_username", "operator_password"}))
    op_data = None
    if body.operator_username and body.operator_password:
        op_data = await am.create_operator(amb["id"], body.operator_username, body.operator_password)
    return {"success": True, "data": {"ambulance": dict(amb), "operator": op_data}}


@router.post("/ambulances/{amb_id}/assign", summary="Admin: manually assign ambulance to case")
async def assign_ambulance(amb_id: int, body: AssignAmbulanceRequest, _admin=Depends(admin_auth)):
    case = await ecm.get_case_by_public_id(body.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    amb = await am.get_ambulance_by_id(amb_id)
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
    assignment = await am.create_assignment(case["id"], amb_id, 0.0, 10)
    await ecm.transition_status(case["id"], "AMBULANCE_ASSIGNED",
                                actor_role="admin", notes=f"Manually assigned by admin")
    return {"success": True, "data": dict(assignment)}
