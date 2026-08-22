"""Tool executors — call internal controllers/services only (no direct SQL)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from app.services.ai.constants import DISCLAIMER
from app.services.ai.permissions import can_use_tool, is_mutating
from app.services.ai.rag import education_ui, format_answer, retrieve
from app.services.ai.workflow_nlu import suggest_specialty_from_symptoms
from app.utils.app_logger import get_logger

log = get_logger(__name__)


async def execute_tool(
    name: str,
    args: dict,
    *,
    role: str,
    user_id: Optional[int] = None,
    hospital_id: Optional[int] = None,
    confirm: bool = False,
) -> dict[str, Any]:
    if not can_use_tool(role, name):
        return {"success": False, "message": f"Tool '{name}' not allowed for role '{role}'"}

    if is_mutating(name) and not confirm:
        return {
            "success": True,
            "needsConfirm": True,
            "tool": name,
            "proposedArgs": args,
            "message": f"Confirm to run `{name}`. Re-send with confirm=true or POST /api/ai/assistant/confirm.",
            "disclaimer": DISCLAIMER,
        }

    handlers = {
        "search_doctors": _search_doctors,
        "search_hospitals": _search_hospitals,
        "search_community": _search_community,
        "knowledge_search": _knowledge_search,
        "platform_faq": _platform_faq,
        "health_education": _health_education,
        "symptom_guidance": _symptom_guidance,
        "wellness_info": _wellness_info,
        "medicine_info": _medicine_info,
        "explain_lab_report": _explain_lab_report,
        "list_saved_profiles": _list_saved_profiles,
        "get_my_profile": _get_my_profile,
        "get_today_appointments": _get_today_appointments,
        "list_my_appointments": _list_appointments,
        "get_doctor_slots": _get_doctor_slots,
        "propose_book_appointment": _propose_book,
        "book_appointment": _book_appointment,
        "propose_cancel_appointment": _propose_cancel,
        "cancel_appointment": _cancel_appointment,
        "request_grace_reschedule": _request_grace_reschedule,
        "confirm_tomorrow_reschedule": _confirm_tomorrow_reschedule,
        "search_medicine": _search_medicine,
        "list_prescriptions": _list_prescriptions,
        "track_medicine_order": _track_orders,
        "search_labs": _search_labs,
        "list_lab_bookings": _list_lab_bookings,
        "book_lab_test": _book_lab,
        "list_payments": _list_payments,
        "navigate_app": _navigate_app,
        "propose_create_support_ticket": _propose_ticket,
        "create_support_ticket": _create_ticket,
        "get_ticket_status": _ticket_status,
        "find_nearest_emergency_hospital": _emergency_hospitals,
        "medicine_reminder_hint": _reminder_hint,
        "doctor_today_schedule": _doctor_today_schedule,
        "doctor_dashboard_summary": _doctor_dashboard_summary,
        "doctor_today_hint": _doctor_today_schedule,
        "hospital_analytics_hint": _analytics_hint,
        "manage_hospitals_hint": _admin_hint,
    }
    fn = handlers.get(name)
    if not fn:
        return {"success": False, "message": "Unknown tool"}
    try:
        return await fn(args, role=role, user_id=user_id, hospital_id=hospital_id)
    except Exception as exc:
        log.warning("tool %s failed: %s", name, type(exc).__name__)
        return {"success": False, "message": f"Tool failed: {type(exc).__name__}", "disclaimer": DISCLAIMER}


async def _search_doctors(args, **_kw):
    from app.controllers import doctor_controller

    q = str(args.get("q") or args.get("query") or "")
    return await doctor_controller.doctor_list(limit=int(args.get("limit") or 5), offset=0, q=q)


async def _search_hospitals(args, **_kw):
    from app.controllers import hospital_controller

    q = str(args.get("q") or args.get("query") or "")
    return await hospital_controller.hospital_list(limit=int(args.get("limit") or 5), offset=0, q=q)


async def _search_community(args, **_kw):
    from app.services import community_service as svc

    q = str(args.get("q") or args.get("query") or "")
    result = await svc.patient_search(q)
    # Community-first clinical grounding
    data = result.get("data") if isinstance(result, dict) else None
    if isinstance(result, dict) and not data:
        result = dict(result)
        result["suggestion"] = (
            "No verified community answer found. Ask Medical Community or book a doctor — "
            "I will not invent clinical information."
        )
    return result


async def _knowledge_search(args, *, hospital_id=None, **_kw):
    q = str(args.get("q") or args.get("query") or args.get("message") or "")
    return await retrieve(q, limit=int(args.get("limit") or 5), hospital_id=hospital_id)


async def _platform_faq(args, **_kw):
    q = str(args.get("message") or args.get("q") or "")
    rag = await retrieve(q or "help", limit=3)
    return {
        "success": True,
        "faqs": rag.get("documents") or [],
        "answer": format_answer(rag.get("documents") or []),
        "disclaimer": DISCLAIMER,
    }


async def _edu_tool(args, *, categories: list[str], hospital_id=None, **_kw):
    q = str(args.get("q") or args.get("query") or args.get("message") or "")
    rag = await retrieve(q, limit=int(args.get("limit") or 4), hospital_id=hospital_id, categories=categories)
    docs = rag.get("documents") or []
    specialty = suggest_specialty_from_symptoms(q)
    answer = format_answer(docs)
    if specialty and docs:
        answer += f" If you want care, I can help book a {specialty}."
    ui = education_ui(docs, suggested_specialty=specialty)
    return {
        "success": True,
        "resultType": "education",
        "documents": docs,
        "answer": answer,
        "grounded": bool(docs),
        "suggestedSpecialty": specialty,
        "ui": ui,
        "actions": ui.get("actions") or [],
        "disclaimer": DISCLAIMER,
        "safetyNote": (
            "General education only — not a diagnosis or personal prescription."
            if args.get("clinicalSoftRedirect")
            else None
        ),
    }


async def _health_education(args, *, hospital_id=None, **_kw):
    return await _edu_tool(
        args,
        categories=["disease_faq", "lab_literacy", "symptom_literacy"],
        hospital_id=hospital_id,
    )


async def _symptom_guidance(args, *, hospital_id=None, **_kw):
    return await _edu_tool(
        args,
        categories=["symptom_literacy", "disease_faq", "wellness"],
        hospital_id=hospital_id,
    )


async def _wellness_info(args, *, hospital_id=None, **_kw):
    return await _edu_tool(args, categories=["wellness"], hospital_id=hospital_id)


async def _medicine_info(args, *, hospital_id=None, **_kw):
    """Grounded RAG + optional openFDA label fields (never invent doses)."""
    base = await _edu_tool(args, categories=["medicine_info"], hospital_id=hospital_id)
    q = str(args.get("q") or args.get("query") or args.get("message") or "")
    # Extract a likely medicine token
    import re

    name = None
    for token in (
        "paracetamol",
        "acetaminophen",
        "ibuprofen",
        "metformin",
        "amoxicillin",
        "aspirin",
        "omeprazole",
    ):
        if re.search(rf"\b{token}\b", q, re.I):
            name = token
            break
    if not name:
        m = re.search(
            r"\b([A-Za-z][A-Za-z-]{2,40})\b(?:\s+(?:tablet|medicine|pill|drug))?",
            q,
            re.I,
        )
        if m and m.group(1).lower() not in {
            "what", "this", "that", "used", "take", "with", "after", "food", "medicine", "tablet"
        }:
            name = m.group(1)

    label_bits: list[str] = []
    if name:
        try:
            from app.services import medicine_service

            details = await medicine_service.medicine_details(name)
            data = (details or {}).get("data") or {}
            for key, label in (
                ("uses", "Uses"),
                ("indications", "Uses"),
                ("warnings", "Warnings"),
                ("doNotUse", "Do not use"),
                ("askDoctor", "Ask a doctor"),
                ("sideEffects", "Side effects"),
            ):
                val = data.get(key)
                if isinstance(val, list):
                    val = " ".join(str(x) for x in val[:2])
                if val:
                    snippet = str(val).strip()[:400]
                    if snippet and not any(snippet[:40] in b for b in label_bits):
                        label_bits.append(f"{label}: {snippet}")
            if label_bits:
                base["openFda"] = True
                base["medicineName"] = name
                extra = " Verified label notes — " + " | ".join(label_bits[:3])
                base["answer"] = (base.get("answer") or "") + extra
                base["grounded"] = True
                docs = list(base.get("documents") or [])
                docs.insert(
                    0,
                    {
                        "title": f"{name.title()} (label)",
                        "body": " ".join(label_bits[:2]),
                        "category": "medicine_info",
                        "source": "openfda",
                    },
                )
                base["documents"] = docs[:4]
                base["ui"] = education_ui(
                    docs[:3],
                    suggested_specialty=base.get("suggestedSpecialty"),
                )
        except Exception as exc:
            log.debug("medicine_info openfda skip: %s", type(exc).__name__)
    return base


def _extract_result_observations(payload: Any) -> list[str]:
    """Pull plain-language observation lines from partner result_payload."""
    lines: list[str] = []
    if payload is None:
        return lines
    data = payload
    if isinstance(payload, str):
        try:
            import json

            data = json.loads(payload)
        except Exception:
            return [payload[:500]] if payload.strip() else []
    if not isinstance(data, dict):
        return lines

    # FHIR-lite shapes
    for obs in data.get("observations") or data.get("result") or []:
        if isinstance(obs, dict):
            name = obs.get("name") or obs.get("code") or obs.get("display") or "Result"
            value = obs.get("value") or obs.get("valueQuantity") or obs.get("valueString")
            unit = ""
            if isinstance(value, dict):
                unit = str(value.get("unit") or "")
                value = value.get("value")
            ref = obs.get("referenceRange") or obs.get("ref") or ""
            bit = f"{name}: {value} {unit}".strip()
            if ref:
                bit += f" (ref {ref})"
            lines.append(bit)
        elif obs is not None:
            lines.append(str(obs)[:200])
    summary = data.get("summary") or data.get("conclusion")
    if summary:
        lines.append(str(summary)[:400])
    presented = data.get("presentedForm") or []
    if isinstance(presented, list) and presented and not lines:
        lines.append("A report document is attached. Open Laboratory for the full file.")
    return lines[:12]


async def _explain_lab_report(args, *, user_id=None, hospital_id=None, **_kw):
    """Explain the user's own lab booking results — never invent numbers."""
    if not user_id:
        return {"success": False, "message": "Login required to explain your lab reports."}
    from app.controllers import lab_controller

    bookings_res = await lab_controller.get_user_lab_bookings(int(user_id))
    bookings = (bookings_res or {}).get("bookings") or []
    with_results = []
    for b in bookings:
        payload = b.get("result_payload") or b.get("resultPayload")
        lines = _extract_result_observations(payload)
        if lines or b.get("result_ready_at") or b.get("resultReadyAt"):
            with_results.append({**dict(b), "_lines": lines})

    q = str(args.get("q") or args.get("message") or "")
    rag = await retrieve(
        q or "hemoglobin blood sugar report",
        limit=3,
        hospital_id=hospital_id,
        categories=["lab_literacy", "disease_faq"],
    )
    docs = rag.get("documents") or []

    if not with_results:
        answer = (
            "I could not find a lab result on your account yet. "
            "When a partner lab uploads results, they appear under Laboratory → My bookings. "
            + format_answer(docs)
        )
        return {
            "success": True,
            "resultType": "education",
            "answer": answer,
            "grounded": bool(docs),
            "documents": docs,
            "ui": education_ui(docs),
            "actions": [{"label": "Open Laboratory", "route": "/labs"}],
            "disclaimer": DISCLAIMER,
        }

    latest = with_results[0]
    lines = latest.get("_lines") or []
    facts = "; ".join(lines) if lines else "Results are marked ready — open Laboratory for the full report."
    answer = (
        f"From your lab booking: {facts}. "
        "This is a plain-language reading of your stored results, not a diagnosis. "
        + format_answer(docs)
    )
    ui_docs = [
        {"title": "Your lab values", "body": facts, "category": "lab_literacy", "source": "user_lab"}
    ] + docs
    return {
        "success": True,
        "resultType": "education",
        "answer": answer,
        "grounded": True,
        "documents": ui_docs[:4],
        "bookings": with_results[:3],
        "ui": education_ui(ui_docs[:3], suggested_specialty="General Physician"),
        "actions": [{"label": "Open Laboratory", "route": "/labs"}],
        "disclaimer": DISCLAIMER,
    }


async def _list_saved_profiles(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    from app.controllers import user_controller

    result = await user_controller.get_saved_profiles(int(user_id))
    if not isinstance(result, dict) or not result.get("success"):
        return result if isinstance(result, dict) else {"success": False, "message": "Could not load profiles"}
    profiles = []
    for r in result.get("profiles") or []:
        row = dict(r) if not isinstance(r, dict) else r
        profiles.append(
            {
                "id": row.get("id"),
                "name": row.get("name"),
                "age": row.get("age"),
                "gender": row.get("gender"),
                "relationship": row.get("relationship"),
                "phone": row.get("phone") or "",
                "isSelf": False,
            }
        )
    return {
        "success": True,
        "resultType": "profiles",
        "profiles": profiles,
        "count": len(profiles),
    }


async def _list_appointments(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    from app.controllers import user_controller

    return await user_controller.list_appointments(int(user_id))


async def _get_my_profile(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    from app.controllers import user_controller

    result = await user_controller.get_profile(int(user_id))
    if not result.get("success"):
        return result
    profile = result.get("userData") or {}
    # Only expose the minimum identity fields needed by the assistant.
    return {
        "success": True,
        "resultType": "profile",
        "profile": {
            "id": profile.get("id"),
            "name": profile.get("name"),
            "image": profile.get("image"),
        },
    }


def _is_today(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, datetime):
        return value.date() == date.today()
    if isinstance(value, date):
        return value == date.today()
    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10]) == date.today()
    except ValueError:
        pass
    return text.lower() in {
        date.today().strftime("%d %B %Y").lower(),
        date.today().strftime("%Y-%m-%d").lower(),
    }


async def _get_today_appointments(args, *, user_id=None, **_kw):
    result = await _list_appointments(args, user_id=user_id)
    if not result.get("success"):
        return result
    appointments = [
        item
        for item in (result.get("appointments") or [])
        if _is_today(item.get("slotDate"))
        and not item.get("cancelled")
        and not item.get("isCompleted")
    ]
    return {
        "success": True,
        "resultType": "appointments",
        "date": date.today().isoformat(),
        "appointments": appointments,
        "count": len(appointments),
    }


async def _get_doctor_slots(args, **_kw):
    """Live slots only — Scheduling API via doctor_slot_service (never LLM/fake)."""
    doctor_id = args.get("doctorId") or args.get("docId")
    mode = str(args.get("mode") or "offline").lower()
    if mode not in {"offline", "online"}:
        mode = "offline"
    if not doctor_id:
        return {"success": False, "message": "doctorId required", "availableSlots": []}
    try:
        from app.controllers import doctor_slot_controller

        raw = await doctor_slot_controller.get_doctor_slots(str(doctor_id), mode)
    except Exception as exc:
        return {
            "success": False,
            "message": "Scheduling service temporarily unavailable. Would you like me to retry?",
            "error": type(exc).__name__,
            "availableSlots": [],
            "resultType": "slots",
            "retryable": True,
        }
    if not isinstance(raw, dict) or not raw.get("success"):
        return {
            "success": False,
            "message": (raw or {}).get("message")
            if isinstance(raw, dict)
            else "Scheduling service temporarily unavailable. Would you like me to retry?",
            "availableSlots": [],
            "resultType": "slots",
            "retryable": True,
        }

    groups: list[dict] = []
    for day in raw.get("days") or []:
        iso = day.get("date")
        legacy = day.get("slotDate") or day.get("slotDatePadded")
        display = day.get("displayDate")
        slots: list[dict] = []
        for block in day.get("blocks") or []:
            if not block.get("bookable"):
                continue
            slots.append(
                {
                    "date": legacy,
                    "isoDate": iso,
                    "time": block.get("display") or block.get("label"),
                    "displayDate": display,
                    "displayTime": block.get("display") or block.get("label"),
                    "label": block.get("label"),
                    "slot_type": block.get("slot_type"),
                    "slotId": block.get("slot_id") or block.get("representative_slot_id"),
                    "mode": mode,
                    "available_count": block.get("available_count"),
                }
            )
        for item in day.get("slots") or []:
            if item.get("available") is False:
                continue
            slots.append(
                {
                    "date": legacy,
                    "isoDate": iso,
                    "time": item.get("start_time"),
                    "displayDate": display,
                    "displayTime": item.get("display") or item.get("start_time"),
                    "slot_type": item.get("slot_type"),
                    "slotId": item.get("slot_id"),
                    "mode": mode,
                }
            )
        if slots:
            groups.append(
                {
                    "date": legacy,
                    "isoDate": iso,
                    "displayDate": display,
                    "slots": slots,
                }
            )
    return {
        "success": True,
        "mode": mode,
        "availableSlots": groups,
        "days": raw.get("days"),
        "resultType": "slots",
        "source": "scheduling_api",
    }


async def _propose_book(args, **_kw):
    q = str(args.get("specialty") or args.get("q") or args.get("message") or "")
    doctors = await _search_doctors({"q": q, "limit": 5})
    return {
        "success": True,
        "message": (
            "To book: pick a doctor and slot, then confirm with tool=book_appointment and confirm=true "
            "(docId, slotDate, slotTime). I found matching doctors below."
        ),
        "doctorsResult": doctors,
        "nextTool": "book_appointment",
        "disclaimer": DISCLAIMER,
    }


async def _book_appointment(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    from app.controllers import user_controller

    body = {
        "docId": args.get("docId") or args.get("doctorId"),
        "slotDate": args.get("slotDate") or args.get("date"),
        "slotTime": args.get("slotTime") or args.get("time"),
        "slotId": args.get("slotId"),
        "mode": args.get("mode") or "offline",
        "slotType": args.get("slotType") or args.get("slot_type"),
        "actualPatient": args.get("actualPatient")
        or args.get("actual_patient")
        or {"isSelf": True},
    }
    return await user_controller.book_appointment(int(user_id), body)


async def _propose_cancel(args, *, user_id=None, **_kw):
    appts = await _list_appointments(args, user_id=user_id)
    return {
        "success": True,
        "message": "Select an appointmentId and confirm with tool=cancel_appointment confirm=true.",
        "appointments": appts,
        "nextTool": "cancel_appointment",
        "disclaimer": DISCLAIMER,
    }


async def _cancel_appointment(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    aid = args.get("appointmentId") or args.get("id")
    if not aid:
        return {"success": False, "message": "appointmentId required"}
    from app.controllers import user_controller

    return await user_controller.cancel_appointment(int(user_id), int(aid))


async def _request_grace_reschedule(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    aid = args.get("appointmentId") or args.get("id")
    requested = args.get("requestedDate") or args.get("date")
    if not aid:
        return {"success": False, "message": "appointmentId required"}
    if not requested:
        return {
            "success": True,
            "message": "Provide requestedDate (YYYY-MM-DD) then confirm to send a grace reschedule request.",
            "nextTool": "request_grace_reschedule",
            "disclaimer": DISCLAIMER,
        }
    from app.controllers import lifecycle_controller

    return await lifecycle_controller.request_grace_reschedule(
        int(user_id), int(aid), str(requested)
    )


async def _confirm_tomorrow_reschedule(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    aid = args.get("appointmentId") or args.get("id")
    if not aid:
        return {"success": False, "message": "appointmentId required"}
    from app.controllers import lifecycle_controller

    return await lifecycle_controller.confirm_tomorrow_reschedule(
        int(user_id),
        int(aid),
        requested_date=args.get("requestedDate") or args.get("date"),
        preferred_slot_type=args.get("slotType") or args.get("slot_type"),
    )


async def _search_medicine(args, **_kw):
    q = str(args.get("q") or args.get("query") or args.get("medicine") or "")
    # Prefer medicine autocomplete / search service when present
    try:
        from app.services import medicine_service

        if hasattr(medicine_service, "autocomplete"):
            return await medicine_service.autocomplete(q, limit=int(args.get("limit") or 8))
        if hasattr(medicine_service, "search"):
            return await medicine_service.search(q)
    except Exception:
        pass
    try:
        from app.controllers import user_controller  # noqa: F401
    except Exception:
        pass
    return {
        "success": True,
        "message": (
            f"Search PharmaSync-connected pharmacies for '{q}'. "
            "Open Pharmacy in the app for availability, price, and order."
        ),
        "query": q,
        "cta": "pharmacy",
        "disclaimer": DISCLAIMER,
    }


async def _list_prescriptions(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    try:
        from app.services import pharmacy_service as ps

        if hasattr(ps, "list_patient_prescriptions"):
            result = await ps.list_patient_prescriptions(int(user_id))
            if isinstance(result, dict):
                result = dict(result)
                result["resultType"] = "prescriptions"
                result["actions"] = [{"label": "Open Pharmacy", "route": "/pharmacy"}]
            return result
    except Exception as exc:
        return {"success": False, "message": str(type(exc).__name__)}
    return {
        "success": True,
        "message": "Open Pharmacy → Prescriptions in the app to view Rx from consultations.",
        "actions": [{"label": "Open Pharmacy", "route": "/pharmacy"}],
        "disclaimer": DISCLAIMER,
    }


async def _track_orders(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    try:
        from app.services import pharmacy_service as ps

        if hasattr(ps, "list_patient_orders"):
            return await ps.list_patient_orders(int(user_id))
    except Exception as exc:
        return {"success": False, "message": str(type(exc).__name__)}
    return {
        "success": True,
        "message": "Open Pharmacy → Orders to track delivery status.",
        "disclaimer": DISCLAIMER,
    }


async def _search_labs(args, **_kw):
    try:
        from app.controllers import lab_controller

        if hasattr(lab_controller, "list_labs"):
            return await lab_controller.list_labs()
        if hasattr(lab_controller, "get_labs"):
            return await lab_controller.get_labs()
    except Exception:
        pass
    q = str(args.get("q") or args.get("test") or "lab")
    return {
        "success": True,
        "message": f"Open Laboratory to find '{q}' tests, preparation, prices, and slots.",
        "query": q,
        "cta": "laboratory",
        "disclaimer": DISCLAIMER,
    }


async def _list_lab_bookings(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    try:
        from app.controllers import lab_controller

        if hasattr(lab_controller, "get_user_lab_bookings"):
            result = await lab_controller.get_user_lab_bookings(int(user_id))
            if isinstance(result, dict):
                result = dict(result)
                result["resultType"] = "labBookings"
                result["actions"] = [{"label": "Open Laboratory", "route": "/labs"}]
            return result
    except Exception as exc:
        return {"success": False, "message": str(type(exc).__name__)}
    return {
        "success": True,
        "message": "Open Laboratory → My bookings for reports and status.",
        "actions": [{"label": "Open Laboratory", "route": "/labs"}],
        "disclaimer": DISCLAIMER,
    }


async def _book_lab(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    try:
        from app.controllers import lab_controller

        if hasattr(lab_controller, "book_lab_test"):
            return await lab_controller.book_lab_test(int(user_id), args)
    except Exception as exc:
        return {"success": False, "message": str(type(exc).__name__)}
    return {"success": False, "message": "Lab booking API unavailable — use Laboratory screen."}


async def _propose_ticket(args, **_kw):
    subject = str(args.get("subject") or args.get("message") or "Support request")[:200]
    category = str(args.get("category") or _infer_category(subject))
    return {
        "success": True,
        "draft": {"subject": subject, "category": category, "body": str(args.get("message") or "")[:2000]},
        "message": "Confirm with tool=create_support_ticket and confirm=true to open a ticket.",
        "nextTool": "create_support_ticket",
        "disclaimer": DISCLAIMER,
    }


async def _create_ticket(args, *, user_id=None, role="patient", hospital_id=None, **_kw):
    from app.services.ai import support_tickets

    return await support_tickets.create_ticket(
        user_id=user_id,
        role=role,
        hospital_id=hospital_id,
        subject=str(args.get("subject") or "Support request")[:200],
        body=str(args.get("body") or args.get("message") or "")[:4000],
        category=str(args.get("category") or _infer_category(str(args.get("message") or ""))),
    )


async def _ticket_status(args, *, user_id=None, **_kw):
    from app.services.ai import support_tickets

    tid = args.get("ticketId") or args.get("id")
    return await support_tickets.get_ticket(ticket_id=tid, user_id=user_id)


async def _emergency_hospitals(args, **_kw):
    from app.controllers import hospital_controller

    lat = args.get("lat") or args.get("latitude")
    lng = args.get("lng") or args.get("lon") or args.get("longitude")
    result: dict[str, Any]
    if lat is not None and lng is not None:
        try:
            result = await hospital_controller.get_nearby_hospitals(
                float(lat), float(lng), float(args.get("radiusKm") or 50)
            )
        except Exception:
            result = await hospital_controller.hospital_list(
                limit=5, offset=0, q=str(args.get("q") or "emergency")
            )
    else:
        result = await hospital_controller.hospital_list(
            limit=5, offset=0, q=str(args.get("q") or "emergency")
        )
    if isinstance(result, dict):
        result = dict(result)
        result["resultType"] = "hospitals"
        result["safety"] = (
            "If symptoms are life-threatening, call emergency services / go to ER immediately. "
            "This list is navigation help only."
        )
        result["disclaimer"] = DISCLAIMER
        result["actions"] = [
            {"label": "Open Emergency", "route": "/emergency"},
            {"label": "Find Hospitals", "route": "/hospitals"},
        ]
    return result


async def _list_payments(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Login required"}
    from app.controllers import payments_controller

    result = await payments_controller.get_payment_history(int(user_id), limit=10, offset=0)
    if isinstance(result, dict):
        result = dict(result)
        result["resultType"] = "payments"
        result["actions"] = [{"label": "Open Payments", "route": "/payments"}]
    return result


async def _navigate_app(args, **_kw):
    text = str(args.get("q") or args.get("message") or args.get("target") or "").lower()
    routes = [
        (("pharmacy", "medicine", "drug"), "/pharmacy", "Pharmacy"),
        (("lab", "laboratory", "cbc", "report"), "/labs", "Laboratory"),
        (("appointment", "booking", "my visit"), "/appointments", "My Appointments"),
        (("community", "forum", "question"), "/community", "Medical Community"),
        (("payment", "bill", "invoice"), "/payments", "Payments"),
        (("profile", "my name", "account"), "/profile", "Profile"),
        (("emergency", "sos"), "/emergency", "Emergency"),
        (("hospital", "clinic"), "/hospitals", "Hospitals"),
        (("doctor", "specialist"), "/doctors", "Doctors"),
        (("help", "support", "faq"), "/help", "Help Center"),
    ]
    for keys, route, label in routes:
        if any(k in text for k in keys):
            return {
                "success": True,
                "resultType": "navigation",
                "message": f"Open {label} to continue.",
                "actions": [{"label": f"Open {label}", "route": route}],
                "disclaimer": DISCLAIMER,
            }
    return {
        "success": True,
        "resultType": "navigation",
        "message": "I can open Pharmacy, Laboratory, Appointments, Community, Payments, or Help.",
        "actions": [
            {"label": "Pharmacy", "route": "/pharmacy"},
            {"label": "Appointments", "route": "/appointments"},
            {"label": "Help", "route": "/help"},
        ],
        "disclaimer": DISCLAIMER,
    }


async def _reminder_hint(args, **_kw):
    return {
        "success": True,
        "message": "Use Medicine Reminders in the app (or Health Protection) to schedule dose alerts. I won’t prescribe doses.",
        "actions": [{"label": "Open Pharmacy", "route": "/pharmacy"}],
        "disclaimer": DISCLAIMER,
    }


async def _doctor_today_schedule(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Doctor login required"}
    from app.controllers import doctor_controller

    result = await doctor_controller.appointments_doctor(int(user_id))
    if not isinstance(result, dict):
        return {"success": False, "message": "Could not load schedule"}
    appointments = result.get("appointments") or []
    today = date.today()
    todays = []
    for item in appointments:
        slot = item.get("slotDate") or item.get("slot_date")
        try:
            if isinstance(slot, date):
                ok = slot == today
            else:
                text = str(slot or "")
                ok = (
                    text[:10] == today.isoformat()
                    or text.replace("_", "/") == today.strftime("%d/%m/%Y")
                    or text == today.strftime("%d_%m_%Y")
                )
        except Exception:
            ok = False
        if ok and not item.get("cancelled"):
            todays.append(item)
    return {
        "success": True,
        "resultType": "doctorSchedule",
        "appointments": todays[:20],
        "count": len(todays),
        "message": f"You have {len(todays)} appointment(s) today.",
        "disclaimer": DISCLAIMER,
    }


async def _doctor_dashboard_summary(args, *, user_id=None, **_kw):
    if not user_id:
        return {"success": False, "message": "Doctor login required"}
    from app.controllers import doctor_controller

    result = await doctor_controller.doctor_dashboard(int(user_id))
    if isinstance(result, dict):
        result = dict(result)
        result["resultType"] = "doctorDashboard"
    return result


async def _analytics_hint(args, **_kw):
    return {
        "success": True,
        "message": "Open Dean / Admin dashboard for hospital analytics, departments, doctors, and complaints.",
        "disclaimer": DISCLAIMER,
    }


async def _admin_hint(args, **_kw):
    return {
        "success": True,
        "message": "Open Super Admin → Hospitals / Partners / SLO & Health to monitor platform and integrations.",
        "disclaimer": DISCLAIMER,
    }


def _infer_category(text: str) -> str:
    t = (text or "").lower()
    if any(w in t for w in ("medicine", "deliver", "pharmacy", "order")):
        return "pharmacy_delivery"
    if any(w in t for w in ("bill", "pay", "refund", "payment")):
        return "billing"
    if any(w in t for w in ("appoint", "slot", "doctor", "queue")):
        return "appointments"
    if any(w in t for w in ("lab", "report", "test")):
        return "laboratory"
    return "general"
