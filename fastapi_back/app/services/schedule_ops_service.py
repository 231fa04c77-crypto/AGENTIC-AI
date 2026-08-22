"""Doctor day-override and hospital-closure helpers used by controllers."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from app.config.db import db
from app.models import doctor_schedule_model as dsm
from app.services import doctor_slot_service
from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def save_day_override(doc_id: int, body: dict[str, Any]) -> dict[str, Any]:
    raw_date = (body.get("date") or body.get("overrideDate") or "").strip()
    if not raw_date:
        return {"success": False, "message": "date is required (YYYY-MM-DD)"}
    try:
        override_date = date.fromisoformat(raw_date[:10])
    except ValueError:
        return {"success": False, "message": "Invalid date"}

    is_cancelled = bool(body.get("isCancelled") or body.get("is_cancelled") or False)
    half_day = (body.get("halfDay") or body.get("session") or "").strip().lower()
    # halfDay: morning | afternoon | both | none(cancel)

    morning_start = body.get("morningStart") or body.get("opStart")
    morning_end = body.get("morningEnd") or body.get("opEnd")
    afternoon_start = body.get("afternoonStart") or body.get("opStartAfternoon")
    afternoon_end = body.get("afternoonEnd") or body.get("opEndAfternoon")
    max_m = body.get("maxAppointmentsMorning")
    max_a = body.get("maxAppointmentsAfternoon")

    if half_day == "morning":
        afternoon_start = None
        afternoon_end = None
        max_a = 0
    elif half_day == "afternoon":
        morning_start = None
        morning_end = None
        max_m = 0
    elif half_day in ("none", "cancel", "off"):
        is_cancelled = True

    payload = {
        "doctor_id": int(doc_id),
        "override_date": override_date,
        "is_cancelled": is_cancelled,
        "morning_start": morning_start,
        "morning_end": morning_end,
        "afternoon_start": afternoon_start,
        "afternoon_end": afternoon_end,
        "max_appointments_morning": int(max_m) if max_m is not None else None,
        "max_appointments_afternoon": int(max_a) if max_a is not None else None,
        "mode": "OP",
    }
    row = await dsm.upsert_day_override(payload)
    await doctor_slot_service.generate_day_slots(
        str(doc_id), int(doc_id), override_date, force_regenerate=True
    )
    try:
        from app.controllers.doctor_slot_controller import invalidate_slots_cache
        invalidate_slots_cache(str(doc_id))
    except Exception:
        pass
    return {"success": True, "override": dict(row) if row else payload}


async def list_day_overrides(doc_id: int) -> dict[str, Any]:
    rows = await dsm.list_overrides_for_doctor(int(doc_id))
    return {"success": True, "overrides": [dict(r) for r in (rows or [])]}


async def delete_day_override(doc_id: int, override_id: int) -> dict[str, Any]:
    row = await db.fetch_row(
        "SELECT * FROM doctor_schedule_overrides WHERE id = $1 AND doctor_id = $2",
        int(override_id),
        int(doc_id),
    )
    if not row:
        return {"success": False, "message": "Override not found"}
    await dsm.delete_override(int(override_id))
    od = row["override_date"]
    await doctor_slot_service.generate_day_slots(
        str(doc_id), int(doc_id), od, force_regenerate=True
    )
    try:
        from app.controllers.doctor_slot_controller import invalidate_slots_cache
        invalidate_slots_cache(str(doc_id))
    except Exception:
        pass
    return {"success": True, "message": "Override removed; default schedule restored for that day"}


async def mark_hospital_closed_day(
    hospital_id: int,
    closed_date: date,
    *,
    reason: str = "Hospital closed",
    deadline_hours: int = 12,
) -> dict[str, Any]:
    """A+B+C: update calendar, clear available seats, notify + offer reschedule, set deadline."""
    cal = await dsm.get_hospital_calendar(int(hospital_id))
    holidays = list(cal.get("holidays") or []) if cal else []
    target = closed_date.isoformat()
    if not any(h.get("date") == target for h in holidays):
        holidays.append({"date": target, "reason": reason})
    await dsm.upsert_hospital_calendar(
        int(hospital_id),
        default_closed_days=list(cal.get("default_closed_days") or [0]) if cal else [0],
        holidays=holidays,
    )

    # Clear available seats for hospital doctors that day.
    await db.execute(
        """
        DELETE FROM doctor_slots ds
        USING doctors d
        WHERE ds.doctor_numeric_id = d.id
          AND d.hospital_id = $1
          AND ds.slot_date = $2
          AND ds.status = 'available'
        """,
        int(hospital_id),
        closed_date,
    )

    # Legacy slot_date format used by appointments: D_M_YYYY
    legacy = f"{closed_date.day}_{closed_date.month}_{closed_date.year}"
    apts = await db.fetch_all(
        """
        SELECT a.*
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        WHERE d.hospital_id = $1
          AND a.cancelled = false
          AND a.lifecycle_status = ANY($2::varchar[])
          AND (a.slot_date = $3 OR a.slot_date = $4)
        """,
        int(hospital_id),
        ["BOOKED", "CONFIRMED", "PAYMENT_PENDING", "CHECKED_IN", "READY_FOR_DOCTOR"],
        legacy,
        closed_date.isoformat(),
    )

    deadline = datetime.now(timezone.utc) + timedelta(hours=int(deadline_hours))
    offered = 0
    for apt in apts or []:
        try:
            await db.execute(
                """
                INSERT INTO hospital_closure_offers
                    (hospital_id, appointment_id, closed_date, status, deadline_at)
                VALUES ($1, $2, $3, 'offered', $4)
                ON CONFLICT (appointment_id, closed_date) DO UPDATE
                    SET status = 'offered', deadline_at = EXCLUDED.deadline_at, notified_at = NOW()
                """,
                int(hospital_id),
                int(apt["id"]),
                closed_date,
                deadline,
            )
            offered += 1
            # Soft flag on appointment for patient UI (reuse tomorrow-reschedule fields when present).
            try:
                await db.execute(
                    """
                    UPDATE appointments
                    SET tomorrow_reschedule_offered = TRUE,
                        tomorrow_reschedule_deadline = $2
                    WHERE id = $1
                    """,
                    int(apt["id"]),
                    deadline,
                )
            except Exception:
                pass
            try:
                from app.services import fcm_service, email_service
                from app.models import user_model
                user = await user_model.get_user_by_id(int(apt["user_id"]))
                if user:
                    msg = (
                        f"Hospital is closed on {closed_date.isoformat()}. "
                        f"Please reschedule your appointment before the deadline."
                    )
                    try:
                        await fcm_service.send_to_user(int(user["id"]), "Hospital closed", msg)
                    except Exception:
                        pass
                    if user.get("email"):
                        try:
                            await email_service.send_email(
                                user["email"],
                                "Hospital closed — reschedule needed",
                                msg,
                            )
                        except Exception:
                            pass
            except Exception as notify_err:
                log.warning("closure notify failed apt=%s: %s", apt.get("id"), notify_err)
        except Exception as exc:
            log.warning("closure offer failed apt=%s: %s", apt.get("id"), exc)

    return {
        "success": True,
        "closedDate": closed_date.isoformat(),
        "appointmentsOffered": offered,
        "deadlineAt": deadline.isoformat(),
        "message": "Hospital marked closed; patients notified with reschedule deadline.",
    }


async def expire_closure_offers() -> int:
    """Auto-cancel appointments whose closure reschedule deadline passed (policy C)."""
    from app.controllers import lifecycle_controller

    rows = await db.fetch_all(
        """
        SELECT o.*, a.user_id
        FROM hospital_closure_offers o
        JOIN appointments a ON a.id = o.appointment_id
        WHERE o.status = 'offered' AND o.deadline_at < NOW()
          AND a.cancelled = false
        LIMIT 100
        """
    )
    n = 0
    for o in rows or []:
        try:
            await lifecycle_controller.cancel_with_policy(
                int(o["user_id"]),
                int(o["appointment_id"]),
                reason="Auto-cancelled: hospital closed and reschedule deadline passed",
            )
            await db.execute(
                "UPDATE hospital_closure_offers SET status = 'expired' WHERE id = $1",
                int(o["id"]),
            )
            n += 1
        except Exception as exc:
            log.warning("expire closure offer %s: %s", o.get("id"), exc)
    return n
