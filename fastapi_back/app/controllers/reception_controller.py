"""Reception desk operations: auth, verification, walk-in, queue, follow-up, payment."""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional

import bcrypt

from app.config.db import db
from app.controllers import lifecycle_controller
from app.models import (
    appointment_model,
    doctor_model,
    hospital_policy_model,
    receptionist_model,
    user_model,
)
from app.services import (
    appointment_lifecycle_service,
    followup_service,
    qr_scan_service,
    queue_service,
    refund_service,
    token_service,
)
from app.utils.formatters import format_appointment_for_frontend, format_doctor, format_user, parse_json_field
from app.utils import password_hash as _ph


# ── Password helpers ────────────────────────────────────────────────────────
async def _hash(password: str) -> str:
    return await _ph.hash_password(password)


async def _verify(password: str, hashed: str) -> bool:
    return await _ph.verify_password(password, hashed)

# ── Date helpers ────────────────────────────────────────────────────────────
def _today_slot_dates() -> set[str]:
    try:
        from zoneinfo import ZoneInfo
        from app.services.doctor_slot_service import legacy_slot_date, legacy_slot_date_padded

        today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
        return {legacy_slot_date(today), legacy_slot_date_padded(today)}
    except Exception:
        today = datetime.now().date()
        return {today.strftime("%-d_%-m_%Y") if False else today.strftime("%d_%m_%Y")}


def _is_today(apt: dict) -> bool:
    return str(apt.get("slot_date") or "") in _today_slot_dates()


def _today_primary() -> str:
    from zoneinfo import ZoneInfo
    from app.services.doctor_slot_service import legacy_slot_date

    return legacy_slot_date(datetime.now(ZoneInfo("Asia/Kolkata")).date())


def _is_online(apt: dict) -> bool:
    """Payment semantics: does this appointment require/use online payment?"""
    mode = str(apt.get("mode") or "").lower()
    pm = str(apt.get("payment_method") or "").lower()
    return "online" in mode or "video" in mode or pm in ("razorpay", "onlinepayment", "online")


def _appt_source(apt: dict) -> str:
    """Booking channel: 'ONLINE' (app) vs 'WALK_IN' (reception desk).

    Independent of payment method — an app booking paid at the desk is still ONLINE.
    """
    src = str(apt.get("appointment_source") or "").upper()
    if src in ("ONLINE", "WALK_IN"):
        return src
    # Legacy rows without an explicit source: reception walk-ins used slot_time 'Walk-in'.
    if str(apt.get("slot_time") or "").strip().lower() in ("walk-in", "walkin"):
        return "WALK_IN"
    return "ONLINE"


def _is_paid(apt: dict) -> bool:
    return bool(apt.get("payment")) or str(apt.get("payment_status") or "").lower() in ("paid", "completed") or bool(apt.get("paid_at_booking"))


# ── Auth ────────────────────────────────────────────────────────────────────
async def login(body: dict):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    rec = await receptionist_model.get_by_email(email)
    if not rec or not await _verify(password, rec["password"]):
        return {"success": False, "message": "Invalid credentials"}
    if not rec.get("is_active", True):
        return {"success": False, "message": "Account disabled. Contact admin."}

    if not rec["password"].startswith(("$2b$", "$2a$", "$2y$")):
        try:
            await receptionist_model.update_password(rec["id"], await _hash(password))
        except Exception:
            pass

    hospital_name = None
    if rec.get("hospital_id"):
        h = await db.fetch_row("SELECT name FROM hospital_tieups WHERE id = $1", rec["hospital_id"])
        hospital_name = h.get("name") if h else None

    reception_profile = {
        "id": rec["id"],
        "name": rec["name"],
        "email": rec["email"],
        "hospitalId": rec.get("hospital_id"),
        "hospitalName": hospital_name,
    }
    auth_response = await token_service.issue_token_pair(
        "receptionist",
        user_id=rec["id"],
        hospital_id=rec.get("hospital_id"),
        email=rec.get("email"),
        profile=reception_profile,
    )
    return {
        **auth_response,
        "reception": reception_profile,
    }


# ── Data helpers ────────────────────────────────────────────────────────────
async def _hospital_appointments(hospital_id: Optional[int]):
    if hospital_id:
        return await appointment_model.get_appointments_by_hospital_id(int(hospital_id))
    return await appointment_model.get_all_appointments()


def _verification(apt: dict) -> dict:
    lifecycle = (apt.get("lifecycle_status") or "").upper()
    valid_until = apt.get("valid_until")
    validity_ok = True
    if valid_until is not None:
        try:
            now = datetime.now(valid_until.tzinfo) if valid_until.tzinfo else datetime.now()
            validity_ok = now <= valid_until
        except Exception:
            validity_ok = True
    max_visits = apt.get("max_visits")
    visit_count = apt.get("visit_count") or 0
    visits_ok = True if max_visits in (None, 0) else (visit_count < max_visits)
    ud = parse_json_field(apt.get("user_data")) or {}
    report_url = ud.get("bookingReportUrl") or (apt.get("actual_patient") or {}) and None
    fu_max = apt.get("followup_visits_max")
    fu_used = apt.get("followup_visits_used") or 0
    return {
        "paymentOk": _is_paid(apt),
        "validityOk": validity_ok,
        "visitsOk": visits_ok,
        "reportsOk": bool(report_url),
        "reportUrl": report_url,
        "followupAvailable": lifecycle == "FOLLOWUP_AVAILABLE",
        "followupRemaining": (fu_max - fu_used) if fu_max else 0,
        "visitsRemaining": (max_visits - visit_count) if max_visits else None,
    }


def _desk_status(apt: dict) -> str:
    rs = apt.get("reception_status")
    if rs:
        # Normalize desk alias to lifecycle-aligned labels for UI.
        if str(rs).upper() in ("IN_QUEUE", "CHECKED_IN"):
            return "CHECKED_IN"
        return rs
    lifecycle = (apt.get("lifecycle_status") or "").upper()
    return {
        "BOOKED": "PENDING",
        "CONFIRMED": "VERIFIED",
        "CHECKED_IN": "CHECKED_IN",
        "READY_FOR_DOCTOR": "CHECKED_IN",
        "IN_PROGRESS": "IN_PROGRESS",
        "COMPLETED": "COMPLETED",
        "NO_SHOW": "NO_SHOW",
        "CANCELLED": "CANCELLED",
        "EXPIRED": "INVALID",
    }.get(lifecycle, "PENDING")


def _format(apt: dict) -> dict:
    payload = format_appointment_for_frontend(apt)
    payload["verification"] = _verification(apt)
    payload["deskStatus"] = _desk_status(apt)
    payload["receptionStatus"] = apt.get("reception_status")
    # Unified queue token (shared online + walk-in sequence per doctor/day).
    payload["todayToken"] = apt.get("today_token") or apt.get("token_number")
    payload["tokenNumber"] = apt.get("token_number")
    src = _appt_source(apt)
    payload["appointmentSource"] = src
    payload["isOnline"] = src == "ONLINE"
    payload["paymentMethod"] = apt.get("payment_method")
    payload["paid"] = _is_paid(apt)
    return payload


# ── Dashboard ───────────────────────────────────────────────────────────────
async def dashboard(hospital_id: Optional[int]):
    from app.services import cache_keys as ck
    from app.services import cache_service as cache

    hid = hospital_id if hospital_id is not None else "all"

    async def _load():
        return await _reception_dashboard_uncached(hospital_id)

    return await cache.cache_aside(ck.dashboard_reception(hid), ck.TTL_DASHBOARD, _load)


async def _reception_dashboard_uncached(hospital_id: Optional[int]):
    appts = await _hospital_appointments(hospital_id)
    today = [a for a in appts if _is_today(a)]
    online = [a for a in today if _appt_source(a) == "ONLINE"]
    walkin = [a for a in today if _appt_source(a) == "WALK_IN"]
    waiting = [a for a in today if (a.get("lifecycle_status") or "").upper() == "CHECKED_IN" or a.get("reception_status") == "READY_FOR_DOCTOR"]
    no_shows = [a for a in today if (a.get("lifecycle_status") or "").upper() == "NO_SHOW"]
    followups = [a for a in appts if (a.get("lifecycle_status") or "").upper() == "FOLLOWUP_AVAILABLE"]
    revenue = sum(float(a.get("amount") or 0) for a in today if _is_paid(a))

    pending_refunds = 0
    try:
        rows = await refund_service.list_pending_refunds(limit=500)
        if hospital_id:
            hosp_ids = {a["id"] for a in appts}
            pending_refunds = sum(1 for r in rows if r.get("appointment_id") in hosp_ids)
        else:
            pending_refunds = len(rows)
    except Exception:
        pending_refunds = 0

    live_queue = sorted(
        [a for a in waiting],
        key=lambda x: (x.get("today_token") or x.get("token_number") or 0),
    )[:8]

    return {
        "success": True,
        "stats": {
            "onlineToday": len(online),
            "walkInToday": len(walkin),
            "waitingQueue": len(waiting),
            "noShows": len(no_shows),
            "followUps": len(followups),
            "pendingRefunds": pending_refunds,
            "revenueToday": revenue,
        },
        "liveQueue": [_format(a) for a in live_queue],
    }


# ── Online bookings ─────────────────────────────────────────────────────────
async def online_bookings(hospital_id: Optional[int], date: Optional[str] = None):
    appts = await _hospital_appointments(hospital_id)
    if date:
        appts = [a for a in appts if str(a.get("slot_date")) == date]
    else:
        appts = [a for a in appts if _is_today(a)]
    online = [a for a in appts if _appt_source(a) == "ONLINE"]
    online.sort(key=lambda x: (x.get("today_token") or x.get("token_number") or 0))
    return {"success": True, "appointments": [_format(a) for a in online]}


async def _appt_in_hospital(doctor_id: int, hospital_id: int) -> bool:
    row = await db.fetch_row(
        """
        SELECT 1 AS ok FROM doctors WHERE id = $1 AND hospital_id = $2
        UNION
        SELECT 1 AS ok FROM hospital_tieup_doctors WHERE id = $1 AND hospital_tieup_id = $2
        LIMIT 1
        """,
        int(doctor_id), int(hospital_id),
    )
    return bool(row)


async def _get_scoped_appointment(appointment_id: int, hospital_id: Optional[int]):
    apt = await appointment_model.get_appointment_by_id(int(appointment_id))
    if not apt:
        return None, {"success": False, "message": "Appointment not found"}
    apt = dict(apt)
    if hospital_id and apt.get("doctor_id") and not await _appt_in_hospital(apt["doctor_id"], hospital_id):
        return None, {"success": False, "message": "Appointment belongs to another hospital"}
    return apt, None


async def verify_appointment(appointment_id: int, receptionist_id: int, hospital_id: Optional[int], notes: Optional[str] = None):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    checks = _verification(apt)
    blocking = []
    if not checks["validityOk"]:
        blocking.append("Appointment validity expired")
    if not checks["visitsOk"]:
        blocking.append("Visit limit reached")
    if not checks["paymentOk"] and _is_online(apt):
        blocking.append("Payment not verified")
    if blocking:
        return {"success": False, "message": "; ".join(blocking), "verification": checks}

    await db.execute(
        "UPDATE appointments SET reception_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), verification_notes = $2 WHERE id = $3",
        int(receptionist_id), notes, int(appointment_id),
    )
    try:
        if (apt.get("lifecycle_status") or "").upper() == "BOOKED":
            await appointment_lifecycle_service.transition(
                int(appointment_id), "CONFIRMED",
                actor_id=receptionist_id, actor_role="receptionist", reason="Verified at reception",
            )
    except Exception:
        pass
    return {"success": True, "message": "Appointment verified", "verification": checks}


async def mark_arrived(appointment_id: int, receptionist_id: int, hospital_id: Optional[int]):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    await db.execute(
        "UPDATE appointments SET reception_status = 'ARRIVED', arrived_at = NOW() WHERE id = $1",
        int(appointment_id),
    )
    # Assign a queue token when marking arrived so CHECKED_IN patients
    # appear in the doctor queue (CHECKED_IN alone is not enough without a token).
    token = apt.get("token_number") or apt.get("today_token")
    if not token:
        token = await _unified_token(apt["doctor_id"], apt.get("slot_date"))
        await db.execute(
            "UPDATE appointments SET token_number = $1, today_token = $1 WHERE id = $2",
            int(token),
            int(appointment_id),
        )
    try:
        if (apt.get("lifecycle_status") or "").upper() in ("BOOKED", "CONFIRMED", "RESCHEDULED_ONCE"):
            await appointment_lifecycle_service.transition(
                int(appointment_id), "CHECKED_IN",
                actor_id=receptionist_id, actor_role="receptionist", reason="Marked arrived at reception",
            )
    except Exception:
        pass
    try:
        from app.services.socket_service import emit_queue_update

        await emit_queue_update(
            appointment_id,
            apt.get("doctor_id"),
            {
                "appointmentId": int(appointment_id),
                "doctorId": apt.get("doctor_id"),
                "token": token,
                "receptionStatus": "ARRIVED",
                "lifecycleStatus": "CHECKED_IN",
            },
        )
    except Exception:
        pass
    return {"success": True, "message": "Patient marked as arrived", "token": token}


async def _unified_token(doctor_id: int, slot_date: str) -> int:
    """Single continuous queue token per doctor per day, shared by ONLINE + WALK_IN.

    token = MAX(token_number) for that doctor on that consultation day + 1.
    The appointment source never affects numbering.
    """
    return await queue_service.assign_token_number(doctor_id, slot_date)


async def generate_token(appointment_id: int, receptionist_id: int, hospital_id: Optional[int]):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    # Reuse the booking token (already drawn from the shared per-doctor/day
    # sequence). Only assign a fresh one if this appointment never got a token.
    token = apt.get("token_number") or apt.get("today_token")
    if not token:
        token = await _unified_token(apt["doctor_id"], apt.get("slot_date"))
    await db.execute(
        "UPDATE appointments SET token_number = $1, today_token = $1, reception_status = 'READY_FOR_DOCTOR' WHERE id = $2",
        int(token), int(appointment_id),
    )
    try:
        lc = (apt.get("lifecycle_status") or "").upper()
        if lc in ("BOOKED", "CONFIRMED", "RESCHEDULED_ONCE"):
            await appointment_lifecycle_service.transition(
                int(appointment_id), "CHECKED_IN",
                actor_id=receptionist_id, actor_role="receptionist", reason="Token generated",
            )
        await appointment_lifecycle_service.transition(
            int(appointment_id), "READY_FOR_DOCTOR",
            actor_id=receptionist_id, actor_role="receptionist", reason="Ready for doctor",
        )
    except Exception:
        pass
    try:
        from app.services.socket_service import emit_queue_update

        await emit_queue_update(
            appointment_id,
            apt.get("doctor_id"),
            {
                "appointmentId": int(appointment_id),
                "doctorId": apt.get("doctor_id"),
                "token": token,
                "receptionStatus": "READY_FOR_DOCTOR",
                "lifecycleStatus": "READY_FOR_DOCTOR",
            },
        )
    except Exception:
        pass
    return {"success": True, "message": f"Token #{token} generated", "token": token}


async def mark_no_show(appointment_id: int, receptionist_id: int, hospital_id: Optional[int]):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    try:
        await appointment_lifecycle_service.transition(
            int(appointment_id), "NO_SHOW",
            actor_id=receptionist_id, actor_role="receptionist", reason="Marked no-show at reception",
        )
    except Exception:
        await db.execute(
            """
            UPDATE appointments SET
                reception_status = 'NO_SHOW',
                status = 'no-show',
                lifecycle_status = 'NO_SHOW',
                closed_at = COALESCE(closed_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
            """,
            int(appointment_id),
        )
    return {"success": True, "message": "Marked as no-show"}


# ── Patient search & registration ───────────────────────────────────────────
async def search_patients(q: str):
    rows = await user_model.search_users(q, limit=20)
    return {"success": True, "patients": [format_user(r) for r in rows]}


def _slot_date_variants(iso: str) -> set[str]:
    """Convert an ISO calendar date (YYYY-MM-DD) into the stored slot_date formats."""
    try:
        from app.services.doctor_slot_service import legacy_slot_date, legacy_slot_date_padded

        d = datetime.strptime(str(iso)[:10], "%Y-%m-%d").date()
        return {legacy_slot_date(d), legacy_slot_date_padded(d)}
    except Exception:
        return set()


def _is_cancelled(apt: dict) -> bool:
    return bool(apt.get("cancelled")) or str(apt.get("status") or "").lower() in ("cancelled", "canceled")


async def list_patients(hospital_id: Optional[int], date: Optional[str] = None):
    """Patients of THIS hospital with their latest appointment's booking channel,
    payment and status. Type is strictly Online (app) or Walk-in (reception desk).
    Optional `date` (ISO YYYY-MM-DD) restricts to patients with an appointment on
    that calendar date. Cancelled patients are pushed to the bottom of the list."""
    appts = await _hospital_appointments(hospital_id)

    if date:
        variants = _slot_date_variants(date)
        if variants:
            appts = [a for a in appts if str(a.get("slot_date") or "") in variants]

    stats: dict[int, dict] = {}
    for a in appts:
        uid = a.get("user_id")
        if not uid:
            continue
        s = stats.setdefault(uid, {
            "visits": 0, "online": 0, "walkIn": 0, "lastTs": None, "lastDate": None,
            "lastPayMethod": None, "lastPaid": False, "lastCancelled": False,
            "lastSource": "ONLINE", "lastMode": None,
        })
        s["visits"] += 1
        if _appt_source(a) == "ONLINE":
            s["online"] += 1
        else:
            s["walkIn"] += 1
        ts = a.get("created_at")
        if ts is not None and (s["lastTs"] is None or ts > s["lastTs"]):
            s["lastTs"] = ts
            s["lastDate"] = a.get("slot_date")
            s["lastPayMethod"] = a.get("payment_method")
            s["lastPaid"] = _is_paid(a)
            s["lastCancelled"] = _is_cancelled(a)
            s["lastSource"] = _appt_source(a)
            s["lastMode"] = a.get("mode")

    if not stats:
        return {"success": True, "patients": [], "total": 0}

    ids = list(stats.keys())
    rows = await db.query("SELECT * FROM users WHERE id = ANY($1::int[])", ids)
    users = {r["id"]: r for r in rows}

    out = []
    for uid, s in stats.items():
        u = users.get(uid)
        base = format_user(u) if u else {"_id": uid, "id": uid, "name": "Unknown Patient"}
        base["type"] = "Online" if s["lastSource"] == "ONLINE" else "Walk-in"
        base["appointments"] = s["visits"]
        base["visits"] = s["visits"]
        base["onlineVisits"] = s["online"]
        base["walkInVisits"] = s["walkIn"]
        base["lastVisit"] = s["lastTs"].isoformat() if hasattr(s["lastTs"], "isoformat") else s["lastTs"]
        base["lastVisitDate"] = s["lastDate"]
        base["paymentMethod"] = s["lastPayMethod"]
        base["paid"] = bool(s["lastPaid"])
        base["cancelled"] = bool(s["lastCancelled"])
        base["bookingStatus"] = "Cancelled" if s["lastCancelled"] else "Active"
        base["mode"] = s["lastMode"]
        out.append(base)

    # Latest first, then push cancelled patients to the bottom (stable sort keeps date order).
    out.sort(key=lambda x: x.get("lastVisit") or "", reverse=True)
    out.sort(key=lambda x: 1 if x.get("cancelled") else 0)
    return {"success": True, "patients": out, "total": len(out)}


async def register_patient(data: dict):
    from app.controllers.user_controller import get_password_hash

    email = (data.get("email") or "").strip().lower()
    if email:
        existing = await user_model.get_user_by_email(email)
        if existing:
            return {"success": True, "patient": format_user(existing), "existing": True}
    else:
        email = f"walkin_{int(time.time())}@medclues.local"
    raw_pw = data.get("password") or f"Pat@{int(time.time())%100000}"
    age_raw = data.get("age")
    try:
        age_val = int(str(age_raw).strip()) if age_raw not in (None, "") else None
    except (TypeError, ValueError):
        age_val = None
    user = await user_model.create_user({
        "name": data.get("name") or "Walk-in Patient",
        "email": email,
        "password": await _hash(raw_pw),
        "phone": data.get("phone") or "0000000000",
        "gender": data.get("gender") or "Not Selected",
        "age": age_val,
        "dob": data.get("dob") or "Not Selected",
        "bloodGroup": data.get("bloodGroup") or "",
        "address": {"line1": data.get("address") or "", "line2": ""},
        "role": "patient",
    })
    return {"success": True, "patient": format_user(user), "existing": False}


# ── Walk-in booking ─────────────────────────────────────────────────────────
async def walk_in(data: dict, receptionist_id: int, hospital_id: Optional[int]):
    user_id = data.get("userId")
    if not user_id:
        reg = await register_patient(data.get("patient") or data)
        if not reg.get("success"):
            return reg
        user_id = reg["patient"]["_id"] if reg["patient"].get("_id") else reg["patient"].get("id")
    user = await user_model.get_user_by_id(int(user_id))
    if not user:
        return {"success": False, "message": "Patient not found"}

    doctor_id = data.get("docId") or data.get("doctorId")
    if not doctor_id:
        return {"success": False, "message": "Select a doctor"}
    doc = await doctor_model.get_doctor_by_id(doctor_id)
    if not doc:
        return {"success": False, "message": "Doctor not found"}

    slot_date = data.get("slotDate") or _today_primary()
    slot_time = data.get("slotTime") or "Walk-in"
    policy = await hospital_policy_model.get_policy_for_doctor(int(doc["id"]))
    fee = float(data.get("amount") or doc.get("fees") or doc.get("consultation_fee") or 0)
    payment_method = data.get("paymentMethod") or "cash"
    collected = bool(data.get("paymentCollected", True))

    token = await queue_service.assign_token_number(doc["id"], slot_date)
    appointment_data = {
        "userId": int(user_id),
        "docId": int(doc["id"]),
        "userData": format_user(user),
        "docData": format_doctor(doc),
        "amount": fee,
        "consultationFee": fee,
        "slotDate": slot_date,
        "slotTime": slot_time,
        "actualPatient": {"name": user.get("name"), "isSelf": True},
        "selectedSymptoms": data.get("symptoms") or [],
        "paymentMethod": payment_method,
        "mode": "In-person",
        "tokenNumber": token,
        "status": "pending",
        "source": "WALK_IN",
    }
    new_apt = await appointment_model.create_appointment(appointment_data)
    apt_id = new_apt["id"]

    try:
        await appointment_lifecycle_service.apply_booking_defaults(
            apt_id,
            hospital_id=doc.get("hospital_id") or hospital_id,
            validity_days=policy.get("validity_days"),
            max_visits=policy.get("max_visits"),
            followup_visits_max=policy.get("followup_visits"),
            paid_at_booking=collected,
        )
    except Exception:
        pass

    # Walk-in shares the same per-doctor/day sequence as online bookings:
    # `token` was drawn from MAX(token_number)+1 above, so reuse it as the
    # desk token (no separate walk-in numbering).
    await db.execute(
        "UPDATE appointments SET payment = $1, today_token = $2, reception_status = 'READY_FOR_DOCTOR' WHERE id = $3",
        collected, int(token), apt_id,
    )
    try:
        await appointment_lifecycle_service.transition(
            apt_id, "CHECKED_IN",
            actor_id=receptionist_id, actor_role="receptionist", reason="Walk-in registered at reception",
        )
    except Exception:
        pass

    final = await appointment_model.get_appointment_by_id(apt_id)
    return {"success": True, "message": f"Walk-in registered. Token #{token}", "token": token, "appointment": _format(dict(final))}


# ── Queue ───────────────────────────────────────────────────────────────────
async def queue(hospital_id: Optional[int], doctor_id: Optional[int] = None, date: Optional[str] = None):
    appts = await _hospital_appointments(hospital_id)
    appts = [a for a in appts if (str(a.get("slot_date")) == date if date else _is_today(a))]
    if doctor_id:
        appts = [a for a in appts if str(a.get("doctor_id")) == str(doctor_id)]
    active = [a for a in appts if not a.get("cancelled")]
    active.sort(key=lambda x: (x.get("today_token") or x.get("token_number") or 0))

    groups = {"waiting": [], "ready": [], "inConsultation": [], "completed": [], "noShow": []}
    for a in active:
        lc = (a.get("lifecycle_status") or "").upper()
        rs = a.get("reception_status")
        f = _format(a)
        if lc == "IN_PROGRESS":
            groups["inConsultation"].append(f)
        elif lc == "COMPLETED":
            groups["completed"].append(f)
        elif lc == "NO_SHOW":
            groups["noShow"].append(f)
        elif rs == "READY_FOR_DOCTOR" or lc == "CHECKED_IN":
            groups["ready"].append(f)
        else:
            groups["waiting"].append(f)
    return {"success": True, "groups": groups, "all": [_format(a) for a in active]}


async def queue_action(appointment_id: int, action: str, receptionist_id: int, hospital_id: Optional[int]):
    if action == "ready":
        return await generate_token(appointment_id, receptionist_id, hospital_id)
    if action == "arrived":
        return await mark_arrived(appointment_id, receptionist_id, hospital_id)
    if action == "no-show":
        return await mark_no_show(appointment_id, receptionist_id, hospital_id)
    return {"success": False, "message": "Unknown action"}


# ── Follow-ups ──────────────────────────────────────────────────────────────
async def followups(hospital_id: Optional[int]):
    appts = await _hospital_appointments(hospital_id)
    fu = [a for a in appts if (a.get("lifecycle_status") or "").upper() in ("FOLLOWUP_AVAILABLE", "FOLLOWUP_USED")]
    fu.sort(key=lambda x: x.get("followup_valid_until") or datetime.max.replace(tzinfo=None), reverse=False)
    return {"success": True, "appointments": [_format(a) for a in fu]}


async def use_followup(appointment_id: int, receptionist_id: int, hospital_id: Optional[int]):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    try:
        result = await followup_service.use_followup_visit(int(appointment_id), apt["user_id"])
        # Follow-up visit re-enters today's shared queue with the next token.
        token = await _unified_token(apt["doctor_id"], _today_primary())
        await db.execute(
            "UPDATE appointments SET token_number = $1, today_token = $1, reception_status = 'READY_FOR_DOCTOR' WHERE id = $2",
            int(token), int(appointment_id),
        )
        return {"success": True, "message": f"Follow-up token #{token} generated", "token": token, "result": result}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── Payments ────────────────────────────────────────────────────────────────
async def payments(hospital_id: Optional[int], date: Optional[str] = None):
    appts = await _hospital_appointments(hospital_id)
    if date:
        appts = [a for a in appts if str(a.get("slot_date")) == date]
    else:
        appts = [a for a in appts if _is_today(a)]
    return {"success": True, "appointments": [_format(a) for a in appts]}


async def collect_payment(appointment_id: int, receptionist_id: int, hospital_id: Optional[int], method: str = "cash"):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    try:
        await db.execute(
            "UPDATE appointments SET payment = TRUE, payment_status = 'paid', payment_method = $1, payment_timestamp = $2 WHERE id = $3",
            method,
            # Column is timestamp without time zone — asyncpg rejects aware datetimes
            datetime.now(timezone.utc).replace(tzinfo=None),
            int(appointment_id),
        )
    except Exception as e:
        return {"success": False, "message": str(e)}
    try:
        if (apt.get("lifecycle_status") or "").upper() == "BOOKED":
            await appointment_lifecycle_service.mark_paid_confirmed(int(appointment_id))
    except Exception:
        pass
    return {"success": True, "message": "Payment collected"}


# ── Refund request ──────────────────────────────────────────────────────────
async def request_refund(appointment_id: int, receptionist_id: int, hospital_id: Optional[int], reason: Optional[str] = None):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    try:
        return await lifecycle_controller.cancel_with_policy(
            apt["user_id"],
            int(appointment_id),
            reason=reason or "Refund requested at reception",
        )
    except Exception as e:
        return {"success": False, "message": str(e)}


async def refund_requests(hospital_id: Optional[int]):
    try:
        rows = await refund_service.list_pending_refunds(limit=200)
        if hospital_id:
            appts = await _hospital_appointments(hospital_id)
            ids = {a["id"] for a in appts}
            rows = [r for r in rows if r.get("appointment_id") in ids]
        return {"success": True, "refunds": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "message": str(e), "refunds": []}


# ── No-shows ────────────────────────────────────────────────────────────────
async def no_shows(hospital_id: Optional[int]):
    appts = await _hospital_appointments(hospital_id)
    ns = [a for a in appts if (a.get("lifecycle_status") or "").upper() == "NO_SHOW"]
    ns.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
    return {"success": True, "appointments": [_format(a) for a in ns]}


# ── Consultation summary ────────────────────────────────────────────────────
async def consultation_summary(appointment_id: int, hospital_id: Optional[int]):
    apt, err = await _get_scoped_appointment(appointment_id, hospital_id)
    if err:
        return err
    payload = _format(apt)

    user = await user_model.get_user_by_id(apt["user_id"]) if apt.get("user_id") else None
    previous = []
    if apt.get("user_id"):
        rows = await appointment_model.get_appointments_by_user_id(apt["user_id"])
        for r in rows:
            r = dict(r)
            if r["id"] == apt["id"]:
                continue
            if (r.get("lifecycle_status") or "").upper() in ("COMPLETED", "FOLLOWUP_AVAILABLE", "FOLLOWUP_USED", "CLOSED"):
                dd = parse_json_field(r.get("doctor_data")) or {}
                previous.append({
                    "id": r["id"],
                    "slotDate": r.get("slot_date"),
                    "doctorName": dd.get("name"),
                    "status": r.get("lifecycle_status"),
                })
    return {
        "success": True,
        "appointment": payload,
        "patient": format_user(user) if user else None,
        "previousVisits": previous[:10],
    }


# ── Doctors (for walk-in / queue filter) ────────────────────────────────────
async def doctors(hospital_id: Optional[int]):
    if hospital_id:
        docs = await doctor_model.get_doctors_by_hospital_id(int(hospital_id))
    else:
        docs = await doctor_model.get_all_doctors()
    return {"success": True, "doctors": [format_doctor(d) for d in docs]}


# ── Manage receptionists (admin/dean) ───────────────────────────────────────
async def create_receptionist(data: dict, hospital_id: Optional[int] = None):
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    target_hospital = data.get("hospitalId") or hospital_id
    if not name or not email or not password:
        return {"success": False, "message": "Name, email and password are required"}
    if not target_hospital:
        return {"success": False, "message": "Hospital is required"}
    existing = await receptionist_model.get_by_email(email)
    if existing:
        return {"success": False, "message": "A receptionist with this email already exists"}
    from app.utils.contact_uniqueness import phone_taken_in_table, normalize_phone
    phone = data.get("phone")
    if phone and await phone_taken_in_table("receptionists", phone):
        return {
            "success": False,
            "message": "This mobile number is already registered for another receptionist.",
        }
    if phone:
        phone = normalize_phone(phone) or phone
    rec = await receptionist_model.create({
        "name": name,
        "email": email,
        "password": await _hash(password),
        "phone": phone,
        "hospital_id": int(target_hospital),
    })
    return {"success": True, "message": "Receptionist created", "receptionist": {k: rec[k] for k in ("id", "name", "email", "hospital_id", "is_active")}}


async def list_receptionists(hospital_id: Optional[int] = None):
    try:
        await receptionist_model.backfill_public_ids()
    except Exception:
        pass
    rows = await receptionist_model.list_by_hospital(int(hospital_id)) if hospital_id else await receptionist_model.list_all()
    out = []
    for r in rows:
        d = dict(r)
        d.pop("password", None)
        out.append(d)
    return {"success": True, "receptionists": out}


async def profile(receptionist_id: int):
    rec = await receptionist_model.get_by_id(int(receptionist_id))
    if not rec:
        return {"success": False, "message": "Receptionist not found"}
    rec = dict(rec)
    rec.pop("password", None)
    hospital_name = None
    if rec.get("hospital_id"):
        h = await db.fetch_row("SELECT name FROM hospital_tieups WHERE id = $1", rec["hospital_id"])
        hospital_name = h.get("name") if h else None
    return {
        "success": True,
        "profile": {
            "id": rec["id"],
            "publicId": rec.get("public_id"),
            "name": rec.get("name"),
            "email": rec.get("email"),
            "phone": rec.get("phone"),
            "hospitalId": rec.get("hospital_id"),
            "hospitalName": hospital_name,
            "isActive": rec.get("is_active", True),
            "createdAt": rec.get("created_at"),
        },
    }


async def _assert_rec_scope(rec_id: int, hospital_id: Optional[int]):
    rec = await receptionist_model.get_by_id(int(rec_id))
    if not rec:
        return None, {"success": False, "message": "Receptionist not found"}
    if hospital_id and rec.get("hospital_id") != int(hospital_id):
        return None, {"success": False, "message": "Receptionist belongs to another hospital"}
    return dict(rec), None


async def toggle_receptionist(rec_id: int, is_active: bool, hospital_id: Optional[int] = None):
    rec, err = await _assert_rec_scope(rec_id, hospital_id)
    if err:
        return err
    await receptionist_model.set_active(int(rec_id), bool(is_active))
    return {"success": True, "message": "Updated"}


async def reset_receptionist_password(rec_id: int, new_password: str, hospital_id: Optional[int] = None):
    if not new_password or len(new_password) < 6:
        return {"success": False, "message": "Password must be at least 6 characters"}
    rec, err = await _assert_rec_scope(rec_id, hospital_id)
    if err:
        return err
    await receptionist_model.update_password(int(rec_id), await _hash(new_password))
    return {"success": True, "message": "Password reset"}


async def delete_receptionist(rec_id: int, hospital_id: Optional[int] = None):
    rec, err = await _assert_rec_scope(rec_id, hospital_id)
    if err:
        return err
    await receptionist_model.delete(int(rec_id))
    return {"success": True, "message": "Receptionist removed"}


# ── Existing scan / grace (unchanged) ───────────────────────────────────────
async def scan_qr(booking_id: str, *, scanner_id: int | None = None, scanner_role: str | None = None, hospital_id: int | None = None):
    return await qr_scan_service.scan_and_checkin(
        booking_id, scanner_id=scanner_id, scanner_role=scanner_role, hospital_id=hospital_id, scan_method="QR",
    )


async def list_grace_requests(hospital_id: int | None = None):
    if hospital_id:
        rows = await db.query(
            """
            SELECT g.*, a.public_id, a.booking_id, u.name AS patient_name
            FROM appointment_grace_requests g
            JOIN appointments a ON a.id = g.appointment_id
            JOIN users u ON u.id = g.user_id
            WHERE g.status = 'PENDING' AND a.hospital_id = $1
            ORDER BY g.created_at ASC
            """,
            int(hospital_id),
        )
    else:
        rows = await db.query(
            """
            SELECT g.*, a.public_id, a.booking_id, u.name AS patient_name
            FROM appointment_grace_requests g
            JOIN appointments a ON a.id = g.appointment_id
            JOIN users u ON u.id = g.user_id
            WHERE g.status = 'PENDING'
            ORDER BY g.created_at ASC
            """
        )
    return {"success": True, "requests": [dict(r) for r in rows]}


async def approve_grace(request_id: int, reviewer_id: int, reviewer_role: str, notes: str | None = None):
    return await lifecycle_controller.review_grace_request(
        request_id, approve=True, reviewer_id=reviewer_id, reviewer_role=reviewer_role, notes=notes,
    )


async def reject_grace(request_id: int, reviewer_id: int, reviewer_role: str, notes: str | None = None):
    return await lifecycle_controller.review_grace_request(
        request_id, approve=False, reviewer_id=reviewer_id, reviewer_role=reviewer_role, notes=notes,
    )


async def doctor_status_events(hospital_id: Optional[int], since: Optional[str] = None):
    from app.services.doctor_status_notify_service import get_events_since

    events = get_events_since(since, hospital_id)
    return {"success": True, "events": events}
