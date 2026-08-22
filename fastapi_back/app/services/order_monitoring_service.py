"""Specialized coordination agents on top of existing order tables.

Investigation / Referral / Follow-up agents detect workflow gaps.
They never interpret lab results or replace the doctor.
"""
import asyncio
from datetime import datetime, timedelta, date
from typing import Optional
from zoneinfo import ZoneInfo

from app.config.db import db
from app.utils.app_logger import get_logger
from app.models import (
    investigation_model,
    referral_model,
    followup_model,
    order_finding_model,
    order_event_model,
    doctor_model,
    user_model,
    pharmacy_order_model,
    appointment_model,
)
from app.services import patient_journey_service

log = get_logger("medclues.order_monitoring")
IST = ZoneInfo("Asia/Kolkata")


def _now_ist() -> datetime:
    return datetime.now(IST)


def _today_ist() -> date:
    return _now_ist().date()


def _parse_db_datetime(dt_val) -> Optional[datetime]:
    if not dt_val:
        return None
    if isinstance(dt_val, str):
        try:
            return datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
        except ValueError:
            return None
    return dt_val


def _iso(val) -> Optional[str]:
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


async def investigation_agent(review_threshold_mins: int = 0, turnaround_threshold_hours: int = 2):
    """Monitor investigation lifecycle. Does not read or interpret report contents."""
    active_invs = await investigation_model.get_active_investigations()
    for inv in active_invs:
        status = inv.get("status")
        inv_id = inv["id"]
        patient_id = inv["patient_id"]
        created_at = _parse_db_datetime(inv.get("created_at"))
        updated_at = _parse_db_datetime(inv.get("updated_at"))

        if status == "REPORT_AVAILABLE":
            rrs = str(inv.get("report_review_status") or "PENDING").upper()
            if rrs != "PENDING":
                continue
            stale_ok = True
            if review_threshold_mins > 0 and updated_at:
                now = datetime.now(updated_at.tzinfo)
                stale_ok = now - updated_at >= timedelta(minutes=review_threshold_mins)
            if stale_ok:
                doc = await doctor_model.get_doctor_by_id(int(inv["ordered_by"])) if inv.get("ordered_by") else None
                await order_finding_model.create_finding(
                    entity_type="investigation",
                    entity_id=inv_id,
                    patient_id=patient_id,
                    finding_type="REPORT_REVIEW_PENDING",
                    message="Investigation report is available but has not yet been reviewed by the responsible doctor.",
                    priority="HIGH",
                    assigned_role="doctor",
                    recommended_action="Review the available investigation report.",
                    evidence={
                        "investigation_id": inv_id,
                        "test_name": inv.get("test_name"),
                        "ordered": _iso(created_at),
                        "report_available_at": _iso(inv.get("published_at") or updated_at),
                        "report": "Available",
                        "doctor_review": "Pending",
                        "report_review_status": rrs,
                        "doctor": (doc or {}).get("name"),
                    },
                )

        elif status in ("ORDERED", "ACCEPTED", "SAMPLE_COLLECTED", "TEST_PERFORMED") and created_at:
            now = datetime.now(created_at.tzinfo)
            if now - created_at > timedelta(hours=turnaround_threshold_hours):
                ftype = (
                    "INVESTIGATION_DELAYED"
                    if status in ("ACCEPTED", "SAMPLE_COLLECTED", "TEST_PERFORMED")
                    else "INVESTIGATION_PENDING"
                )
                await order_finding_model.create_finding(
                    entity_type="investigation",
                    entity_id=inv_id,
                    patient_id=patient_id,
                    finding_type=ftype,
                    message="Investigation pending",
                    priority="MEDIUM",
                    assigned_role="lab_staff",
                    recommended_action="Advance the investigation to the next lab step.",
                    evidence={"ordered": _iso(created_at), "status": status},
                )


async def referral_agent(booking_threshold_hours: int = 0):
    """Monitor referral coordination across primary doctor, specialist, and patient."""
    active_refs = await referral_model.get_active_referrals()
    for ref in active_refs:
        status = str(ref.get("status") or "").upper()
        ref_id = ref["id"]
        patient_id = ref["patient_id"]
        assigned = ref.get("assigned_to")
        booked = bool(ref.get("appointment_date")) or bool(ref.get("specialist_appointment_id")) or status in {
            "APPOINTMENT_BOOKED",
            "SPECIALIST_CONSULTATION",
            "COMPLETED",
        }

        if status in {"COMPLETED", "REJECTED"}:
            continue

        patient = await user_model.get_user_by_id(int(patient_id)) if patient_id else None
        spec_doc = await doctor_model.get_doctor_by_id(int(assigned)) if assigned else None
        specialist_label = (spec_doc or {}).get("name") or (str(assigned) if assigned else "Not assigned")

        if not assigned:
            await order_finding_model.create_finding(
                entity_type="referral",
                entity_id=ref_id,
                patient_id=patient_id,
                finding_type="REFERRAL_NO_SPECIALIST",
                message="Referral created but no specialist doctor was assigned.",
                priority="HIGH",
                assigned_role="referral_coordinator",
                recommended_action="Assign a specialist doctor to this referral.",
                evidence={
                    "referral_id": ref_id,
                    "patient": (patient or {}).get("name"),
                    "created": _iso(ref.get("created_at")),
                    "specialist": "Not assigned",
                    "status": status,
                },
            )
            continue

        if status == "PENDING":
            updated_at = _parse_db_datetime(ref.get("updated_at"))
            delayed = False
            if booking_threshold_hours > 0 and updated_at:
                now = datetime.now(updated_at.tzinfo)
                delayed = now - updated_at > timedelta(hours=booking_threshold_hours)
            await order_finding_model.create_finding(
                entity_type="referral",
                entity_id=ref_id,
                patient_id=patient_id,
                finding_type="REFERRAL_AWAITING_SPECIALIST" if not delayed else "REFERRAL_DELAYED",
                message=f"Awaiting specialist response from {specialist_label}.",
                priority="HIGH" if delayed else "MEDIUM",
                assigned_role="referral_coordinator",
                recommended_action="Follow up with the specialist to accept or decline the referral.",
                evidence={
                    "referral_id": ref_id,
                    "patient": (patient or {}).get("name"),
                    "created": _iso(ref.get("created_at")),
                    "specialist": specialist_label,
                    "status": status,
                    "appointment": "Not booked",
                },
            )
            continue

        if booked:
            continue

        updated_at = _parse_db_datetime(ref.get("updated_at"))
        delayed = False
        if booking_threshold_hours > 0 and updated_at:
            now = datetime.now(updated_at.tzinfo)
            delayed = now - updated_at > timedelta(hours=booking_threshold_hours)

        ftype = "REFERRAL_DELAYED" if delayed else "REFERRAL_APPOINTMENT_PENDING"
        await order_finding_model.create_finding(
            entity_type="referral",
            entity_id=ref_id,
            patient_id=patient_id,
            finding_type=ftype,
            message=(
                f"Referral accepted by {specialist_label}, but the specialist appointment "
                "has not yet been scheduled."
            ),
            priority="HIGH" if delayed else "MEDIUM",
            assigned_role="referral_coordinator",
            recommended_action="Coordinate the specialist appointment with the patient.",
            evidence={
                "referral_id": ref_id,
                "patient": (patient or {}).get("name"),
                "created": _iso(ref.get("created_at")),
                "accepted": _iso(updated_at) if status == "ACCEPTED" else None,
                "specialist": specialist_label,
                "appointment": "Not booked",
                "to_dept": ref.get("to_dept"),
                "status": status,
            },
        )


async def followup_agent():
    """Monitor follow-up schedule. Does not change treatment."""
    active_followups = await followup_model.get_active_followups()
    today = _today_ist()
    for f in active_followups:
        f_id = f["id"]
        patient_id = f["patient_id"]
        due_date = f.get("due_date")
        status = str(f.get("status") or "")

        if not due_date:
            continue
        if isinstance(due_date, str):
            try:
                due_date = date.fromisoformat(due_date[:10])
            except ValueError:
                continue

        if due_date < today and status != "COMPLETED":
            if status != "OVERDUE":
                await followup_model.update_followup(f_id, {"status": "OVERDUE"})
                await order_event_model.create_order_event(
                    entity_type="followup",
                    entity_id=f_id,
                    event_type="STATUS_CHANGED",
                    payload={"old_status": status, "new_status": "OVERDUE", "actor_role": "agent"},
                )
            ftype = "FOLLOWUP_MISSED" if status == "OVERDUE" else "FOLLOWUP_OVERDUE"
            await order_finding_model.create_finding(
                entity_type="followup",
                entity_id=f_id,
                patient_id=patient_id,
                finding_type=ftype,
                message="Follow-up appointment overdue",
                priority="HIGH",
                assigned_role="appointment_coordinator",
                recommended_action="Reschedule or complete the overdue follow-up.",
                evidence={"followup": due_date.isoformat(), "status": "Overdue"},
            )

        elif status in ("SCHEDULED", "REMINDED"):
            diff = (due_date - today).days
            if 0 <= diff <= 2:
                patient = await user_model.get_user_by_id(int(patient_id)) if patient_id else None
                await order_finding_model.create_finding(
                    entity_type="followup",
                    entity_id=f_id,
                    patient_id=patient_id,
                    finding_type="FOLLOWUP_UPCOMING",
                    message="Scheduled follow-up is approaching.",
                    priority="LOW",
                    assigned_role="appointment_coordinator",
                    recommended_action="Confirm the patient will attend the upcoming follow-up.",
                    evidence={
                        "followup_id": f_id,
                        "patient": (patient or {}).get("name"),
                        "followup": due_date.isoformat(),
                        "status": "Upcoming",
                    },
                )


def _parse_slot_date(slot_date) -> Optional[date]:
    if not slot_date:
        return None
    parts = str(slot_date).split("_")
    if len(parts) == 3:
        try:
            d, m, y = (int(parts[0]), int(parts[1]), int(parts[2]))
            return date(y, m, d)
        except ValueError:
            return None
    return None


async def pharmacy_agent():
    """Monitor pharmacy order coordination. Does not dispense or change prescriptions."""
    orders = await pharmacy_order_model.get_active_orders(limit=200)
    for order in orders:
        oid = order["id"]
        patient_id = order["patient_id"]
        status = str(order.get("status") or "").lower()
        patient = await user_model.get_user_by_id(int(patient_id)) if patient_id else None
        if not patient:
            continue

        if status == "placed":
            ftype = "PHARMACY_ORDER_PENDING"
            msg = "Pharmacy order placed but not yet accepted by the pharmacy."
            action = "Follow up with the pharmacy to accept the order."
        elif status == "billed":
            ftype = "PHARMACY_PAYMENT_PENDING"
            msg = "Pharmacy order is billed but payment has not been completed."
            action = "Remind the patient to complete pharmacy payment."
        elif status == "ready":
            ftype = "PHARMACY_READY_NOT_COLLECTED"
            msg = "Pharmacy order is ready but has not been collected or delivered."
            action = "Notify the patient that their medicines are ready."
        elif status in {"accepted", "paid", "out_for_delivery"}:
            continue
        else:
            continue

        await order_finding_model.create_finding(
            entity_type="pharmacy",
            entity_id=oid,
            patient_id=patient_id,
            finding_type=ftype,
            message=msg,
            priority="MEDIUM" if status != "billed" else "HIGH",
            assigned_role="pharmacy_coordinator",
            recommended_action=action,
            evidence={
                "order_id": oid,
                "public_id": order.get("public_id"),
                "patient": (patient or {}).get("name"),
                "pharmacy": order.get("pharmacy_name"),
                "status": status,
                "created": _iso(order.get("created_at")),
            },
        )


async def appointment_agent():
    """Monitor primary consultation appointment coordination."""
    appts = await appointment_model.get_active_coordination_appointments(limit=200)
    today = _today_ist()
    for apt in appts:
        aid = apt["id"]
        patient_id = apt.get("user_id")
        if not patient_id:
            continue
        life = str(apt.get("lifecycle_status") or apt.get("status") or "").upper()
        if life in {"CANCELLED", "COMPLETED", "CLOSED"}:
            continue

        patient = await user_model.get_user_by_id(int(patient_id))
        if not patient:
            continue
        doc = await doctor_model.get_doctor_by_id(int(apt["doctor_id"])) if apt.get("doctor_id") else None
        slot_d = _parse_slot_date(apt.get("slot_date"))

        if life in {"BOOKED", "PENDING", ""} and life not in {"CONFIRMED", "CHECKED_IN", "IN_PROGRESS"}:
            await order_finding_model.create_finding(
                entity_type="appointment",
                entity_id=aid,
                patient_id=int(patient_id),
                finding_type="APPOINTMENT_AWAITING_CONFIRMATION",
                message="Primary consultation is booked but awaiting doctor confirmation.",
                priority="MEDIUM",
                assigned_role="appointment_coordinator",
                recommended_action="Confirm the appointment with the patient and doctor.",
                evidence={
                    "appointment_id": aid,
                    "patient": (patient or {}).get("name"),
                    "doctor": (doc or {}).get("name"),
                    "slot_date": apt.get("slot_date"),
                    "lifecycle_status": life,
                },
            )
            continue

        if life == "MISSED" or (slot_d and slot_d < today and not apt.get("is_completed")):
            ftype = "APPOINTMENT_MISSED" if life == "MISSED" else "APPOINTMENT_NOT_COMPLETED"
            await order_finding_model.create_finding(
                entity_type="appointment",
                entity_id=aid,
                patient_id=int(patient_id),
                finding_type=ftype,
                message=(
                    "Consultation appointment was missed."
                    if ftype == "APPOINTMENT_MISSED"
                    else "Consultation slot has passed without completion."
                ),
                priority="HIGH",
                assigned_role="appointment_coordinator",
                recommended_action="Reschedule or complete the consultation appointment.",
                evidence={
                    "appointment_id": aid,
                    "patient": (patient or {}).get("name"),
                    "doctor": (doc or {}).get("name"),
                    "slot_date": apt.get("slot_date"),
                    "lifecycle_status": life,
                },
            )


monitor_investigations = investigation_agent
monitor_referrals = referral_agent
monitor_followups = followup_agent


_cycle_lock = asyncio.Lock()


async def run_order_monitoring_cycle():
    """Runs a single pass of all order monitoring agents plus stale-finding verification."""
    if _cycle_lock.locked():
        log.info("Skipping overlapping AI Order Monitoring cycle")
        return
    async with _cycle_lock:
        try:
            log.info("Running AI Order Monitoring Agent cycle...")
            await patient_journey_service.verify_and_close_stale_findings()
            await investigation_agent(review_threshold_mins=0, turnaround_threshold_hours=2)
            await referral_agent(booking_threshold_hours=0)
            await followup_agent()
            await pharmacy_agent()
            await appointment_agent()
            log.info("AI Order Monitoring Agent cycle completed successfully.")
        except (TimeoutError, asyncio.TimeoutError):
            log.warning("AI Order Monitoring skipped: database pool busy")
        except Exception as e:
            log.error("Error in AI Order Monitoring Agent cycle: %s", e, exc_info=True)


async def start_order_monitoring_worker(interval_seconds: int = 180) -> None:
    log.info("AI Order Monitoring Agent worker started (interval=%ss)", interval_seconds)
    await asyncio.sleep(45)
    while True:
        try:
            if db.pool:
                await run_order_monitoring_cycle()
        except Exception as e:
            log.warning("AI Order Monitoring worker iteration error: %s", e)
        await asyncio.sleep(interval_seconds)
