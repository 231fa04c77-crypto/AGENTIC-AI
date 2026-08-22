"""Enterprise AI Gateway: conversation, personalized reads, and confirmed actions."""
from __future__ import annotations

import json
import re
import time
from datetime import date
from typing import Any, Optional

from app.config.config import settings
from app.services.ai import intents as intent_engine
from app.services.ai import memory as ai_memory
from app.services.ai import metrics as ai_metrics
from app.services.ai import provider
from app.services.ai import flows as action_flows
from app.services.ai import workflow_nlu as nlu
from app.services.ai.constants import DISCLAIMER
from app.services.ai.language import detect_language
from app.services.ai.permissions import is_mutating, normalize_role, tools_for_role
from app.services.ai.rag import format_answer
from app.services.ai.safety import attach_disclaimer, safety_block
from app.services.ai.tools import execute_tool
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_SYSTEM_PROMPT = """You are the MEDCLUES Healthcare Platform Assistant — an enterprise healthcare navigation and workflow assistant.
Be warm, concise, accurate, and action-oriented.
Never diagnose, prescribe, claim certainty about treatment, or invent user/platform data.
For personal facts, appointments, doctors, slots, pharmacy, labs, tickets, payments, or policies,
use only the trusted MEDCLUES context supplied below. If context is insufficient, say so clearly.
Do not claim that an action occurred unless the trusted tool result confirms success.
Prefer short replies with a clear next step."""


def is_enabled() -> bool:
    return bool(getattr(settings, "AI_ASSISTANT_ENABLED", False))


def list_tools_for_role(role: str) -> list[dict]:
    return tools_for_role(role)


def _tool_summary(tool: str | None, result: dict) -> str:
    if not result:
        return "I could not complete that request."
    if result.get("needsConfirm"):
        return str(result.get("message") or "Please confirm to continue.")
    if not result.get("success", True):
        return str(result.get("message") or "The request could not be completed.")
    if result.get("answer"):
        return str(result["answer"])
    if tool == "get_my_profile":
        name = (result.get("profile") or {}).get("name")
        return f"Your name is {name}." if name else "Your profile does not have a name yet."
    if tool == "get_today_appointments":
        appointments = result.get("appointments") or []
        if not appointments:
            return "You have no active appointments today."
        parts = []
        for item in appointments[:5]:
            doctor = item.get("docData") or {}
            parts.append(
                f"{doctor.get('name') or 'Doctor'} at {item.get('slotTime') or 'scheduled time'}"
            )
        return "Today you have: " + "; ".join(parts) + "."
    if tool == "list_my_appointments":
        appointments = result.get("appointments") or []
        return (
            f"You have {len(appointments)} appointment(s). They are shown below."
            if appointments
            else "You do not have any appointments."
        )
    if tool == "search_doctors":
        doctors = result.get("doctors") or []
        if not doctors:
            return "No matching doctors were found. Try another specialty or name."
        return "I found these doctors: " + ", ".join(
            str(item.get("name") or "Doctor") for item in doctors[:5]
        )
    if tool in {"search_hospitals", "find_nearest_emergency_hospital"}:
        hospitals = result.get("hospitals") or []
        if not hospitals:
            return "No matching hospitals were found."
        return "Matching hospitals: " + ", ".join(
            str(item.get("name") or "Hospital") for item in hospitals[:5]
        )
    if tool == "search_community":
        rows = result.get("data") or []
        if not rows:
            return str(
                result.get("suggestion")
                or "No verified Community answer was found. You can ask a doctor or book an appointment."
            )
        return "Related verified Community topics: " + "; ".join(
            str(item.get("title") or "") for item in rows[:3]
        )
    if tool in {"knowledge_search", "platform_faq", "health_education", "symptom_guidance", "wellness_info", "medicine_info"}:
        docs = result.get("documents") or result.get("faqs") or []
        return format_answer(docs) if docs or tool != "platform_faq" else format_answer(docs)
    if tool == "list_payments":
        payments = result.get("payments") or []
        return (
            f"I found {len(payments)} payment record(s). Open Payments for full details."
            if payments
            else "No payment records were found."
        )
    if tool == "navigate_app":
        return str(result.get("message") or "I can open the relevant MEDCLUES screen.")
    if tool == "doctor_today_schedule":
        return str(result.get("message") or "Here is your schedule.")
    if result.get("message"):
        return str(result["message"])
    return "Done."


def _ui_from_result(tool: str | None, result: dict) -> dict | None:
    if not result:
        return None
    if result.get("actions"):
        return {"type": "actions", "items": result.get("actions") or []}
    rtype = result.get("resultType")
    if rtype == "education" or result.get("ui", {}).get("type") == "education":
        return result.get("ui") or {
            "type": "education",
            "title": "Health information",
            "bullets": [str(result.get("answer") or "")],
            "actions": [{"label": "Book a doctor", "message": "Book appointment"}],
        }
    if rtype == "appointments":
        return {"type": "appointments", "items": result.get("appointments") or []}
    if rtype == "profile":
        return {"type": "profile", "profile": result.get("profile") or {}}
    if rtype == "payments":
        return {"type": "payments", "items": result.get("payments") or []}
    if rtype == "hospitals":
        return {"type": "hospitals", "items": result.get("hospitals") or []}
    if rtype == "navigation":
        return {"type": "actions", "items": result.get("actions") or []}
    if rtype == "doctorSchedule":
        return {"type": "appointments", "items": result.get("appointments") or []}
    if tool == "search_doctors":
        return {
            "type": "doctors",
            "items": [_doctor_card(item) for item in (result.get("doctors") or [])],
        }
    return None


def _grounded(result: dict | None) -> bool | None:
    if not result:
        return None
    if "grounded" in result:
        return bool(result.get("grounded"))
    if result.get("documents") or result.get("faqs"):
        return bool(result.get("documents") or result.get("faqs"))
    if result.get("appointments") or result.get("doctors") or result.get("hospitals") or result.get("payments"):
        return True
    if result.get("success") is False:
        return False
    return None


def _grounding(tool: str | None, result: dict) -> str:
    safe = {
        "tool": tool,
        "success": bool(result.get("success", True)),
        "result": result,
    }
    return json.dumps(safe, default=str, ensure_ascii=False)[:7000]


async def _natural_reply(
    message: str,
    *,
    history: list[dict[str, Any]],
    fallback: str,
    tool: str | None = None,
    result: dict | None = None,
) -> str:
    return await _phrase_reply(
        fallback,
        message=message,
        history=history,
        grounding={"tool": tool, "facts": _grounding(tool, result or {}) if result is not None else ""},
        language="en",
    )


async def _phrase_reply(
    fallback: str,
    *,
    message: str,
    history: list[dict[str, Any]] | None = None,
    grounding: dict[str, Any] | str | None = None,
    language: str = "en",
) -> str:
    """LLM-first patient wording; templates only when LLM off or fails."""
    text = (fallback or "").strip()
    if not text:
        return fallback or ""
    if not provider.is_enabled():
        return text
    lang_name = {"hi": "Hindi", "te": "Telugu"}.get((language or "en").lower(), "English")
    if isinstance(grounding, dict):
        ground_txt = json.dumps(grounding, default=str, ensure_ascii=False)[:5000]
    else:
        ground_txt = str(grounding or "")[:5000]
    generated = await provider.complete_text(
        system_prompt=(
            f"You are the MEDCLUES Healthcare Platform Assistant. "
            f"Rewrite the FALLBACK reply in clear, warm {lang_name} for the patient. "
            "Use ONLY facts from FALLBACK and GROUNDING. "
            "Keep doctor names, specialty names, dates, times, booking IDs, token numbers, "
            "and lab values exactly unchanged. "
            "Never diagnose, prescribe, invent doctors/slots, or invent clinical facts. "
            "If FALLBACK asks a question, keep that question. "
            "Return only the patient-facing reply text."
        ),
        user_message=f"User said: {message}\n\nFALLBACK:\n{text}\n\nGROUNDING:\n{ground_txt}",
        history=list(history or [])[-8:],
        grounding="",
    )
    if generated.success and (generated.content or "").strip():
        return generated.content.strip()
    return text


async def _classify_unknown(message: str) -> dict[str, Any]:
    if not provider.is_enabled():
        return {}
    return await provider.complete_json(
        system_prompt=(
            "Classify a MEDCLUES message. Allowed intents: basic_conversation, "
            "get_my_profile, get_today_appointments, view_appointments, book_appointment, "
            "cancel_appointment, reschedule_appointment, find_doctor, find_hospital, find_pharmacy, "
            "health_education, symptom_guidance, wellness_info, medicine_info, "
            "track_medicine_order, view_prescription, view_lab_report, "
            "book_lab_test, raise_complaint, track_complaint, community_search, "
            "platform_help, unknown. Return keys intent and entities. "
            "entities may contain specialty, date, doctorName, time, appointmentId. "
            "Use health_education for 'what is diabetes' style questions. "
            "Use medicine_info for tablet uses (not buy). "
            "Use book_appointment when user wants to see a doctor with symptoms/date."
        ),
        user_message=message,
        fallback={},
    )


def _doctor_card(item: dict) -> dict:
    return {
        "id": item.get("id") or item.get("_id"),
        "name": item.get("name"),
        "speciality": item.get("speciality") or item.get("specialization"),
        "image": item.get("image"),
        "fees": item.get("fees"),
        "experience": item.get("experience"),
        "rating": item.get("rating"),
    }


def _flatten_slots(groups: list[dict], requested_date: str | None) -> tuple[list[dict], list[dict]]:
    """Return (slots_for_date, alternative_slots_nearby). Live data only."""
    requested_iso = None
    requested_legacy = None
    if requested_date:
        try:
            requested_iso = date.fromisoformat(requested_date[:10]).isoformat()
            requested_legacy = date.fromisoformat(requested_date[:10]).strftime("%d_%m_%Y")
        except ValueError:
            requested_legacy = requested_date

    matched: list[dict] = []
    alternatives: list[dict] = []
    for group in groups:
        iso = group.get("isoDate") or group.get("date")
        for slot in group.get("slots") or []:
            entry = {
                "date": slot.get("date") or group.get("date"),
                "isoDate": slot.get("isoDate") or iso,
                "time": slot.get("time"),
                "displayDate": slot.get("displayDate") or group.get("displayDate"),
                "displayTime": slot.get("displayTime") or slot.get("time") or slot.get("label"),
                "label": slot.get("label"),
                "slot_type": slot.get("slot_type"),
                "slotId": slot.get("slotId"),
                "mode": slot.get("mode") or "offline",
            }
            same_day = False
            if requested_iso and (entry.get("isoDate") == requested_iso or entry.get("date") == requested_legacy):
                same_day = True
            elif requested_legacy and entry.get("date") == requested_legacy:
                same_day = True
            if same_day or not requested_date:
                matched.append(entry)
            else:
                alternatives.append(entry)
    if not matched and not requested_date:
        matched = alternatives
        alternatives = []
    return matched[:8], alternatives[:6]


async def _save_flow(
    user_id: int,
    session_id: str,
    *,
    message: str,
    reply: str,
    flow_data: dict[str, Any],
    step: str | None = None,
) -> None:
    flow_data = {**flow_data, "step": step or flow_data.get("step")}
    await ai_memory.save_context(
        user_id,
        session_id,
        turn={
            "role": "user",
            "intent": "book_appointment",
            "tool": None,
            "text": message,
            "step": step,
        },
        active_flow="book_appointment",
        flow_data=flow_data,
    )
    await ai_memory.save_context(
        user_id,
        session_id,
        turn={
            "role": "assistant",
            "intent": "book_appointment",
            "tool": None,
            "text": reply,
            "step": step,
        },
        active_flow="book_appointment",
        flow_data=flow_data,
    )


async def _booking_flow(
    *,
    message: str,
    user_id: int,
    role: str,
    hospital_id: int | None,
    session_id: str,
    context: dict[str, Any],
    entities: dict[str, Any],
) -> dict[str, Any]:
    """Deterministic appointment booking workflow — LLM never invents doctors/slots."""
    if nlu.is_abort(message):
        await ai_memory.clear_flow(user_id, session_id)
        log.info("ai_workflow abort workflow=book_appointment user=%s", user_id)
        return {
            "success": True,
            "intent": "book_appointment",
            "reply": "Booking cancelled. No appointment was created.",
            "workflow": "book_appointment",
            "step": "aborted",
        }

    data = dict(context.get("flow_data") or {})
    data["workflow"] = "appointment_booking"
    proposed_args = data.get("proposedArgs")

    # Family / saved-profile patient for booking
    relationship = nlu.extract_booking_relationship(message)
    if relationship and not data.get("actualPatient"):
        data["bookingFor"] = relationship
        profiles_res = await execute_tool(
            "list_saved_profiles",
            {},
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
        )
        profiles = list((profiles_res or {}).get("profiles") or [])
        data["savedProfiles"] = profiles
        matched = nlu.match_saved_profile(
            profiles, relationship=relationship, message=message
        )
        if matched:
            data["actualPatient"] = nlu.build_actual_patient(
                relationship=relationship, profile=matched, is_self=False
            )
        elif profiles:
            # Ask user to pick a saved profile when relationship is ambiguous
            items = [
                {
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "relationship": p.get("relationship"),
                    "label": f"{p.get('name')} ({p.get('relationship')})",
                }
                for p in profiles[:6]
            ]
            data["profileCandidates"] = items
            data["step"] = "await_patient"
            reply = (
                f"Booking for your {relationship}. Which saved profile should I use? "
                "Reply with a name, or say Self for you."
            )
            await _save_flow(
                user_id, session_id, message=message, reply=reply, flow_data=data, step="await_patient"
            )
            return {
                "success": True,
                "intent": "book_appointment",
                "reply": reply,
                "workflow": "book_appointment",
                "step": "await_patient",
                "ui": {"type": "profiles", "items": items},
            }
        else:
            data["actualPatient"] = nlu.build_actual_patient(
                relationship=relationship, is_self=False
            )

    if data.get("step") == "await_patient" and not data.get("actualPatient"):
        if re.search(r"\b(self|myself|me)\b", message or "", re.I):
            data["actualPatient"] = {"isSelf": True}
            data.pop("bookingFor", None)
        else:
            picked = nlu.match_saved_profile(
                list(data.get("savedProfiles") or []),
                relationship=data.get("bookingFor"),
                message=message,
            )
            if not picked:
                candidates = list(data.get("profileCandidates") or [])
                picked = nlu.pick_option(message, candidates, "name", "label", "relationship")
            if picked:
                data["actualPatient"] = nlu.build_actual_patient(
                    relationship=str(picked.get("relationship") or data.get("bookingFor") or "Other"),
                    profile=picked,
                    is_self=False,
                )
            else:
                reply = "Please reply with a saved profile name, or say Self."
                await _save_flow(
                    user_id, session_id, message=message, reply=reply, flow_data=data, step="await_patient"
                )
                return {
                    "success": True,
                    "intent": "book_appointment",
                    "reply": reply,
                    "workflow": "book_appointment",
                    "step": "await_patient",
                    "ui": {"type": "profiles", "items": data.get("profileCandidates") or []},
                }
        data["step"] = "await_specialty"

    if proposed_args and nlu.is_confirm(message):
        log.info(
            "ai_workflow confirm workflow=book_appointment tool=book_appointment user=%s",
            user_id,
        )
        result = await execute_tool(
            "book_appointment",
            dict(proposed_args),
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
            confirm=True,
        )
        success = bool(result.get("success"))
        if success:
            await ai_memory.clear_flow(user_id, session_id)
            reply = (
                f"Your appointment is booked. Booking ID: "
                f"{result.get('bookingId') or result.get('appointmentId')}."
            )
            log.info("ai_workflow complete workflow=book_appointment user=%s", user_id)
        else:
            reply = str(
                result.get("message")
                or "Scheduling could not complete this booking. Would you like me to retry?"
            )
            log.warning(
                "ai_workflow failure workflow=book_appointment user=%s msg=%s",
                user_id,
                reply[:120],
            )
        return {
            "success": success,
            "intent": "book_appointment",
            "reply": reply,
            "tool": "book_appointment",
            "toolResult": result,
            "workflow": "book_appointment",
            "step": "completed" if success else "confirm_failed",
            "ui": (
                {
                    "type": "bookingReceipt",
                    "title": "Appointment booked",
                    "details": {
                        "doctor": data.get("doctorName"),
                        "specialty": data.get("specialty"),
                        "date": data.get("date"),
                        "time": data.get("slotTime"),
                        "bookingId": result.get("bookingId"),
                        "appointmentId": result.get("appointmentId"),
                        "tokenNumber": result.get("tokenNumber"),
                    },
                }
                if success
                else None
            ),
        }

    # Fill slots from natural language without restarting the workflow
    data["specialty"] = data.get("specialty") or nlu.extract_specialty(message, entities)
    parsed_date = nlu.extract_date(message, entities)
    if parsed_date:
        data["date"] = parsed_date
    time_hint = nlu.extract_time_hint(message)
    if time_hint:
        data["timeHint"] = time_hint

    candidates = list(data.get("doctorCandidates") or [])
    if not data.get("doctorId") and candidates:
        selected = nlu.pick_option(message, candidates, "name")
        if selected:
            data["doctorId"] = selected.get("id")
            data["doctorName"] = selected.get("name")
            data.pop("slotCandidates", None)
            data.pop("slotTime", None)
            data.pop("proposedArgs", None)

    slots = list(data.get("slotCandidates") or [])
    if data.get("doctorId") and not data.get("slotTime") and slots:
        selected_slot = nlu.pick_option(
            message, slots, "time", "displayTime", "label", "slot_type"
        )
        if selected_slot:
            data["slotDate"] = selected_slot.get("date")
            data["slotTime"] = selected_slot.get("time") or selected_slot.get("displayTime")
            data["slotId"] = selected_slot.get("slotId")
            data["slotType"] = selected_slot.get("slot_type")
            data["mode"] = selected_slot.get("mode") or "offline"
            if selected_slot.get("isoDate"):
                data["date"] = selected_slot.get("isoDate")

    if not data.get("specialty"):
        reply = "Which specialty or type of doctor would you like to book?"
        data["step"] = "await_specialty"
        await _save_flow(
            user_id, session_id, message=message, reply=reply, flow_data=data, step="await_specialty"
        )
        return {
            "success": True,
            "intent": "book_appointment",
            "reply": reply,
            "workflow": "book_appointment",
            "step": "await_specialty",
            "ui": {"type": "question", "field": "specialty"},
        }

    # Natural lead-in when specialty came from symptoms in this message
    if (
        nlu.suggest_specialty_from_symptoms(message)
        and data.get("specialty")
        and not data.get("doctorId")
        and not data.get("doctorCandidates")
    ):
        time_bit = ""
        if data.get("timeHint") in {"morning", "evening"}:
            time_bit = f" {data['timeHint']}"
        date_bit = f" on {data['date']}" if data.get("date") else ""
        # Continue into doctor search below; stamp a soft lead for the reply later
        data["_lead"] = (
            f"A {data['specialty']} may be a suitable first consultation"
            f"{date_bit}{time_bit}. "
        )

    if not data.get("date"):
        reply = (
            f"What date should I check for a {data['specialty']} appointment? "
            "You can say tomorrow, next Monday, or 24 July."
        )
        data["step"] = "await_date"
        await _save_flow(
            user_id, session_id, message=message, reply=reply, flow_data=data, step="await_date"
        )
        return {
            "success": True,
            "intent": "book_appointment",
            "reply": reply,
            "workflow": "book_appointment",
            "step": "await_date",
            "ui": {"type": "question", "field": "date"},
        }

    if not data.get("doctorId"):
        log.info(
            "ai_workflow tool=search_doctors specialty=%s date=%s user=%s",
            data.get("specialty"),
            data.get("date"),
            user_id,
        )
        doctors_result = await execute_tool(
            "search_doctors",
            {"q": data["specialty"], "limit": 5},
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
        )
        if doctors_result.get("success") is False:
            reply = (
                "Doctor search is temporarily unavailable. Would you like me to retry, "
                "or raise a support ticket?"
            )
            data["step"] = "await_doctor"
            await _save_flow(
                user_id, session_id, message=message, reply=reply, flow_data=data, step="await_doctor"
            )
            return {
                "success": False,
                "intent": "book_appointment",
                "reply": reply,
                "tool": "search_doctors",
                "toolResult": doctors_result,
                "workflow": "book_appointment",
                "step": "tool_retry",
            }
        doctors = [_doctor_card(item) for item in (doctors_result.get("doctors") or [])]
        if not doctors:
            reply = (
                f"No {data['specialty']} doctor was found for booking. "
                "Would you like to try another specialty or search nearby hospitals?"
            )
            data["step"] = "await_specialty"
            data.pop("specialty", None)
            await _save_flow(
                user_id, session_id, message=message, reply=reply, flow_data=data, step="await_specialty"
            )
            return {
                "success": True,
                "intent": "book_appointment",
                "reply": reply,
                "tool": "search_doctors",
                "toolResult": doctors_result,
                "workflow": "book_appointment",
                "step": "no_doctors",
            }
        data["doctorCandidates"] = doctors
        data["step"] = "await_doctor"
        lead = str(data.pop("_lead", "") or "")
        reply = (
            f"{lead}Available {data['specialty']} doctors"
            f"{f' for {data['date']}' if data.get('date') else ''}. "
            "Reply with a number, name, or “book first doctor”."
        )
        await _save_flow(
            user_id, session_id, message=message, reply=reply, flow_data=data, step="await_doctor"
        )
        return {
            "success": True,
            "intent": "book_appointment",
            "reply": reply,
            "tool": "search_doctors",
            "toolResult": doctors_result,
            "workflow": "book_appointment",
            "step": "await_doctor",
            "ui": {"type": "doctors", "items": doctors},
        }

    if not data.get("slotTime"):
        # Prefer selecting from already-fetched candidates before re-hitting scheduling
        if not slots:
            log.info(
                "ai_workflow tool=get_doctor_slots doctor=%s date=%s user=%s",
                data.get("doctorId"),
                data.get("date"),
                user_id,
            )
            slot_result = await execute_tool(
                "get_doctor_slots",
                {"doctorId": data["doctorId"], "mode": data.get("mode") or "offline"},
                role=role,
                user_id=user_id,
                hospital_id=hospital_id,
            )
            if slot_result.get("success") is False:
                reply = str(
                    slot_result.get("message")
                    or "Scheduling service temporarily unavailable. Would you like me to retry?"
                )
                data["step"] = "await_slot"
                await _save_flow(
                    user_id, session_id, message=message, reply=reply, flow_data=data, step="await_slot"
                )
                return {
                    "success": False,
                    "intent": "book_appointment",
                    "reply": reply,
                    "tool": "get_doctor_slots",
                    "toolResult": slot_result,
                    "workflow": "book_appointment",
                    "step": "tool_retry",
                }
            matched, alternatives = _flatten_slots(
                slot_result.get("availableSlots") or [], data.get("date")
            )
            if data.get("timeHint") in {"morning", "evening"} and matched:
                preferred = [
                    s
                    for s in matched
                    if data["timeHint"] in str(s.get("label") or "").lower()
                    or data["timeHint"] in str(s.get("slot_type") or "").lower()
                    or data["timeHint"] in str(s.get("displayTime") or "").lower()
                ]
                if preferred:
                    matched = preferred
            if not matched:
                alt_lines = [
                    f"• {a.get('displayDate') or a.get('isoDate')} – {a.get('displayTime')}"
                    for a in alternatives[:3]
                ]
                if alt_lines:
                    reply = (
                        f"No {data.get('specialty') or 'doctor'} slots are available on {data['date']}.\n\n"
                        "Available alternatives:\n"
                        + "\n".join(alt_lines)
                        + "\n\nWhich would you like to book?"
                    )
                    data["slotCandidates"] = alternatives[:6]
                    data["step"] = "await_slot"
                    await _save_flow(
                        user_id,
                        session_id,
                        message=message,
                        reply=reply,
                        flow_data=data,
                        step="await_slot",
                    )
                    return {
                        "success": True,
                        "intent": "book_appointment",
                        "reply": reply,
                        "tool": "get_doctor_slots",
                        "toolResult": slot_result,
                        "workflow": "book_appointment",
                        "step": "await_slot",
                        "ui": {"type": "slots", "items": alternatives[:6]},
                    }
                data.pop("doctorId", None)
                data.pop("doctorName", None)
                reply = (
                    f"No slots are available for that doctor on {data['date']}. "
                    "Choose another doctor, or say a different date."
                )
                data["step"] = "await_doctor"
                await _save_flow(
                    user_id, session_id, message=message, reply=reply, flow_data=data, step="await_doctor"
                )
                return {
                    "success": True,
                    "intent": "book_appointment",
                    "reply": reply,
                    "tool": "get_doctor_slots",
                    "toolResult": slot_result,
                    "workflow": "book_appointment",
                    "step": "no_slots",
                    "ui": {"type": "doctors", "items": data.get("doctorCandidates") or []},
                }
            data["slotCandidates"] = matched
            slots = matched
            reply = (
                f"Live slots for {data.get('doctorName') or 'the doctor'} on {data['date']}. "
                "Reply with morning/evening, a time, or “second slot”."
            )
            data["step"] = "await_slot"
            await _save_flow(
                user_id, session_id, message=message, reply=reply, flow_data=data, step="await_slot"
            )
            return {
                "success": True,
                "intent": "book_appointment",
                "reply": reply,
                "tool": "get_doctor_slots",
                "toolResult": slot_result,
                "workflow": "book_appointment",
                "step": "await_slot",
                "ui": {"type": "slots", "items": matched},
            }

        reply = (
            f"Please pick a slot for {data.get('doctorName') or 'the doctor'} "
            "(morning, evening, a time, or a number)."
        )
        data["step"] = "await_slot"
        await _save_flow(
            user_id, session_id, message=message, reply=reply, flow_data=data, step="await_slot"
        )
        return {
            "success": True,
            "intent": "book_appointment",
            "reply": reply,
            "workflow": "book_appointment",
            "step": "await_slot",
            "ui": {"type": "slots", "items": slots},
        }

    proposed = {
        "docId": data["doctorId"],
        "slotDate": data.get("slotDate") or nlu.to_legacy_slot_date(data.get("date")),
        "slotTime": data["slotTime"],
        "slotId": data.get("slotId"),
        "mode": data.get("mode") or "offline",
        "slotType": data.get("slotType"),
        "actualPatient": data.get("actualPatient") or {"isSelf": True},
    }
    result = {
        "success": True,
        "needsConfirm": True,
        "tool": "book_appointment",
        "proposedArgs": proposed,
        "message": "Please confirm this appointment before I book it.",
    }
    patient_bit = ""
    ap = proposed.get("actualPatient") or {}
    if not ap.get("isSelf"):
        patient_bit = f" for {ap.get('name') or ap.get('relationship') or 'family member'}"
    reply = (
        f"Please confirm{patient_bit}: {data.get('doctorName') or data['specialty']} on "
        f"{data.get('date')} at {data['slotTime']}. Reply Yes to proceed."
    )
    data["proposedArgs"] = proposed
    data["step"] = "await_confirm"
    await _save_flow(
        user_id, session_id, message=message, reply=reply, flow_data=data, step="await_confirm"
    )
    return {
        "success": True,
        "intent": "book_appointment",
        "reply": reply,
        "tool": "book_appointment",
        "toolResult": result,
        "workflow": "book_appointment",
        "step": "await_confirm",
        "ui": {
            "type": "confirmation",
            "title": "Confirm appointment",
            "tool": "book_appointment",
            "args": proposed,
            "details": {
                "doctor": data.get("doctorName"),
                "specialty": data.get("specialty"),
                "date": data.get("date"),
                "time": data.get("slotTime"),
            },
        },
    }


async def _remember_exchange(
    user_id: int | None,
    session_id: str,
    *,
    message: str,
    reply: str,
    intent: str,
    tool: str | None,
) -> None:
    if user_id is None:
        return
    await ai_memory.save_context(
        user_id,
        session_id,
        turn={"role": "user", "intent": intent, "tool": tool, "text": message},
    )
    await ai_memory.save_context(
        user_id,
        session_id,
        turn={"role": "assistant", "intent": intent, "tool": tool, "text": reply},
    )


async def assistant_chat(
    *,
    message: str,
    role: str = "patient",
    user_id: Optional[int] = None,
    hospital_id: Optional[int] = None,
    session_id: str = "default",
    tool: Optional[str] = None,
    tool_args: Optional[dict] = None,
    confirm: bool = False,
    lat: float | None = None,
    lng: float | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    role = normalize_role(role)
    msg = (message or "").strip()
    args = dict(tool_args or {})
    confirm = bool(confirm or args.pop("confirm", False))
    lang = detect_language(msg) if msg else "en"
    soft_redirect: dict[str, Any] | None = None
    context: dict[str, Any] = {"turns": [], "active_flow": None, "flow_data": {}}
    if lat is not None:
        args.setdefault("lat", lat)
    if lng is not None:
        args.setdefault("lng", lng)

    async def _finish(
        payload: dict[str, Any],
        *,
        intent: str | None,
        tool_name: str | None,
        success: bool,
        fallback: bool = False,
        safety: str | None = None,
        grounded: bool | None = None,
        skip_phrase: bool = False,
    ) -> dict[str, Any]:
        payload.setdefault("tools", tools_for_role(role))
        payload.setdefault("userId", user_id)
        payload.setdefault("llm", provider.is_enabled())
        payload["language"] = lang
        out = attach_disclaimer(payload)
        reply_text = out.get("reply") or out.get("message")
        if reply_text and success is not False and not skip_phrase:
            try:
                phrased = await _phrase_reply(
                    str(reply_text),
                    message=msg,
                    history=context.get("turns") or [],
                    grounding={
                        "intent": intent,
                        "tool": tool_name,
                        "workflow": out.get("workflow"),
                        "step": out.get("step"),
                        "ui": out.get("ui"),
                        "toolResult": out.get("toolResult"),
                        "safety": safety,
                    },
                    language=lang,
                )
                if out.get("reply") is not None:
                    out["reply"] = phrased
                elif out.get("message") is not None:
                    out["message"] = phrased
            except Exception:
                pass
        await ai_metrics.record_event(
            intent=intent,
            tool=tool_name,
            role=role,
            latency_ms=(time.perf_counter() - started) * 1000,
            success=success,
            fallback=fallback,
            safety=safety,
            grounded=grounded,
            user_id=user_id,
            query=msg,
        )
        return out

    if not is_enabled():
        return await _finish(
            {"success": False, "message": "AI Assistant is disabled."},
            intent=None,
            tool_name=None,
            success=False,
            skip_phrase=True,
        )
    if not msg and not tool:
        return await _finish(
            {"success": False, "message": "Message required"},
            intent=None,
            tool_name=None,
            success=False,
            skip_phrase=True,
        )
    if user_id is not None:
        rpm = int(getattr(settings, "AI_ASSISTANT_RATE_LIMIT_RPM", 30) or 30)
        if not await ai_memory.rate_limit_ok(user_id, limit=rpm):
            return await _finish(
                {"success": False, "message": "Rate limit exceeded. Please wait a minute."},
                intent=None,
                tool_name=None,
                success=False,
                skip_phrase=True,
            )

    loaded = (
        await ai_memory.load_context(user_id, session_id)
        if user_id is not None
        else None
    )
    if loaded:
        context = loaded

    # Meaning normalize (Cohere/LLM) before intent — keep raw msg for display/memory
    nlu_msg = msg
    meaning = None
    if msg and not tool:
        try:
            from app.services.ai.normalize_meaning import normalize_meaning

            meaning = await normalize_meaning(msg, history=context.get("turns") or [])
            if meaning and (meaning.normalized_english or "").strip():
                nlu_msg = meaning.normalized_english.strip()
        except Exception as exc:  # noqa: BLE001
            log.debug("normalize_meaning skip: %s", type(exc).__name__)
            meaning = None

    async def _apply_safety_block(blocked: dict[str, Any]) -> dict[str, Any] | None:
        if blocked.get("softRedirect"):
            return blocked
        if blocked.get("proposeTool") == "find_nearest_emergency_hospital":
            result = await execute_tool(
                "find_nearest_emergency_hospital",
                {"q": "emergency", **args},
                role=role,
                user_id=user_id,
                hospital_id=hospital_id,
            )
            blocked.update(
                tool="find_nearest_emergency_hospital",
                toolResult=result,
                reply=_tool_summary("find_nearest_emergency_hospital", result),
                ui=_ui_from_result("find_nearest_emergency_hospital", result),
            )
            return await _finish(
                blocked,
                intent=blocked.get("intent"),
                tool_name=blocked.get("tool"),
                success=True,
                safety=blocked.get("safety"),
            )
        return await _finish(
            blocked,
            intent=blocked.get("intent"),
            tool_name=blocked.get("tool"),
            success=True,
            safety=blocked.get("safety"),
        )

    # Safety on raw + normalized English (urgency / clinical refuse)
    blocked = safety_block(msg) if msg else None
    if blocked and not tool:
        applied = await _apply_safety_block(blocked)
        if applied is not None and not applied.get("softRedirect"):
            return applied
        if applied and applied.get("softRedirect"):
            soft_redirect = applied
    if msg and not tool and nlu_msg and nlu_msg != msg and soft_redirect is None:
        blocked_norm = safety_block(nlu_msg)
        if blocked_norm:
            applied = await _apply_safety_block(blocked_norm)
            if applied is not None and not applied.get("softRedirect"):
                return applied
            if applied and applied.get("softRedirect"):
                soft_redirect = applied
    if meaning and meaning.emergency_risk and not tool and soft_redirect is None:
        urgency = safety_block("I have chest pain")
        if urgency and urgency.get("safety") == "urgency":
            applied = await _apply_safety_block(urgency)
            if applied is not None and not applied.get("softRedirect"):
                return applied

    if tool:
        result = await execute_tool(
            tool,
            args if args else {"message": msg, "q": msg},
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
            confirm=confirm,
        )
        fallback = _tool_summary(tool, result)
        reply = fallback
        if confirm and is_mutating(tool) and result.get("success") and user_id is not None:
            await ai_memory.clear_flow(user_id, session_id)
        ui = None
        if tool == "book_appointment" and result.get("success"):
            flow_data = context.get("flow_data") or {}
            ui = {
                "type": "bookingReceipt",
                "title": "Appointment booked",
                "details": {
                    "doctor": flow_data.get("doctorName"),
                    "specialty": flow_data.get("specialty"),
                    "date": flow_data.get("date"),
                    "time": flow_data.get("slotTime"),
                    "bookingId": result.get("bookingId"),
                    "appointmentId": result.get("appointmentId"),
                    "tokenNumber": result.get("tokenNumber"),
                },
            }
        else:
            ui = _ui_from_result(tool, result)
        payload = {
            "success": bool(result.get("success", True)),
            "intent": "explicit_tool",
            "reply": reply,
            "tool": tool,
            "toolResult": result,
            "ui": ui,
        }
        await _remember_exchange(
            user_id, session_id, message=msg, reply=reply, intent="explicit_tool", tool=tool
        )
        return await _finish(
            payload,
            intent="explicit_tool",
            tool_name=tool,
            success=payload["success"],
            grounded=_grounded(result),
        )

    cutover = bool(getattr(settings, "AI_NLU_PIPELINE_CUTOVER", False))
    if cutover:
        from app.services.ai.nlu_cutover import detect_for_gateway

        detected = detect_for_gateway(nlu_msg, context=context)
    else:
        detected = intent_engine.detect_intent(nlu_msg, context=context)
    # Prefer Cohere meaning hint when legacy/cutover still unknown
    if (
        meaning
        and meaning.intent_hint
        and str(detected.get("intent") or "unknown") in {"unknown", "unknown_intent", ""}
    ):
        hint = str(meaning.intent_hint).strip()
        if hint in intent_engine.INTENT_TOOL or hint in {
            "book_appointment",
            "symptom_guidance",
            "health_education",
            "medicine_info",
            "emergency_help",
        }:
            detected = {
                **detected,
                "intent": hint,
                "source": "meaning_normalize",
                "suggested_tool": intent_engine.INTENT_TOOL.get(hint),
            }
    # Enrich existing plan/cutover clarification; do not force-clarify from NLU alone
    if (
        meaning
        and meaning.needs_clarification
        and detected.get("requires_clarification")
        and not detected.get("clarification_question")
    ):
        detected = {
            **detected,
            "clarification_question": "Could you share a bit more detail so I can help?",
        }
    intent = str(detected.get("intent") or "unknown")
    log.info(
        "ai_intent intent=%s source=%s flow=%s user=%s",
        intent,
        detected.get("source"),
        context.get("active_flow"),
        user_id,
    )
    # Module 1–3 NLU/workflow shadow — log-only (skip when cutover already ran plan)
    if getattr(settings, "AI_INTENT_ENGINE_SHADOW", False) and not cutover:
        try:
            from app.services.ai.workflow import plan_message

            shadow = plan_message(nlu_msg, context=context)
            plan = shadow.get("plan") or {}
            handoff = (shadow.get("analysis") or {}).get("handoff") or {}
            log.info(
                "ai_workflow_shadow workflow=%s step=%s tools=%s primary=%s "
                "entities=%s clarify=%s legacy=%s",
                plan.get("workflow"),
                plan.get("step"),
                [t.get("name") for t in (plan.get("proposed_tools") or [])],
                handoff.get("primary_intent"),
                list((handoff.get("entities") or {}).keys()),
                plan.get("requires_clarification"),
                intent,
            )
        except Exception as exc:  # noqa: BLE001
            log.debug("ai_workflow_shadow skip: %s", type(exc).__name__)
    if soft_redirect:
        intent = str(soft_redirect.get("intent") or intent)
        detected = {
            **detected,
            "intent": intent,
            "source": "safety_soft",
            "suggested_tool": soft_redirect.get("suggested_tool"),
        }
        log.info("ai_intent soft_redirect intent=%s user=%s", intent, user_id)
    elif intent == "unknown":
        llm_classification = await _classify_unknown(nlu_msg)
        llm_intent = str(llm_classification.get("intent") or "unknown")
        if llm_intent in intent_engine.INTENT_TOOL:
            intent = llm_intent
            detected = {
                **detected,
                "intent": intent,
                "source": "llm",
                "entities": llm_classification.get("entities") or {},
                "suggested_tool": intent_engine.INTENT_TOOL.get(intent),
            }
            log.info("ai_intent llm_refine intent=%s user=%s", intent, user_id)

    # Cutover-only: clarify when plan waits on user input (no tools proposed yet).
    # Skip when tools are proposed (e.g. await_confirm) — existing flows own UX.
    _plan_meta = detected.get("plan") or {}
    _plan_tools = list(_plan_meta.get("proposed_tools") or [])
    if (
        cutover
        and not soft_redirect
        and detected.get("requires_clarification")
        and detected.get("clarification_question")
        and not _plan_tools
    ):
        reply = str(detected.get("clarification_question") or "").strip()
        await _remember_exchange(
            user_id, session_id, message=msg, reply=reply, intent=intent, tool=None
        )
        return await _finish(
            {
                "success": True,
                "intent": intent,
                "reply": reply,
                "tool": None,
                "requiresClarification": True,
            },
            intent=intent,
            tool_name=None,
            success=True,
        )

    if intent == "basic_conversation" and not soft_redirect:
        fallback = (
            "Hello! I’m your MedClues Assistant. I can answer platform questions, "
            "show your appointments, and help you book, cancel, or manage services."
        )
        reply = fallback
        await _remember_exchange(
            user_id, session_id, message=msg, reply=reply, intent=intent, tool=None
        )
        return await _finish(
            {"success": True, "intent": intent, "reply": reply, "tool": None},
            intent=intent,
            tool_name=None,
            success=True,
        )

    if user_id is not None and role == "patient" and not soft_redirect:
        if intent == "book_appointment":
            payload = await _booking_flow(
                message=nlu_msg,
                user_id=user_id,
                role=role,
                hospital_id=hospital_id,
                session_id=session_id,
                context=context,
                entities=detected.get("entities") or {},
            )
            return await _finish(
                payload,
                intent="book_appointment",
                tool_name=payload.get("tool"),
                success=bool(payload.get("success", True)),
                grounded=_grounded(payload.get("toolResult")),
            )
        if intent == "cancel_appointment":
            payload = await action_flows.cancel_flow(
                message=nlu_msg,
                user_id=user_id,
                role=role,
                hospital_id=hospital_id,
                session_id=session_id,
                context=context,
            )
            return await _finish(
                payload,
                intent="cancel_appointment",
                tool_name=payload.get("tool"),
                success=bool(payload.get("success", True)),
            )
        if intent == "reschedule_appointment":
            payload = await action_flows.reschedule_flow(
                message=nlu_msg,
                user_id=user_id,
                role=role,
                hospital_id=hospital_id,
                session_id=session_id,
                context=context,
            )
            return await _finish(
                payload,
                intent="reschedule_appointment",
                tool_name=payload.get("tool"),
                success=bool(payload.get("success", True)),
            )

    # Role-aware schedule for doctors
    if intent in {"view_schedule", "get_today_appointments"} and role == "doctor":
        suggested = "doctor_today_schedule"
    else:
        suggested = detected.get("suggested_tool") or intent_engine.INTENT_TOOL.get(intent)
    if not suggested or suggested == "none":
        suggested = "knowledge_search"

    # Educational / clinicalish → education lane (not Community-first)
    edu_intents = {"health_education", "symptom_guidance", "wellness_info", "medicine_info"}
    clinicalish = any(
        word in nlu_msg.lower()
        for word in ("symptom", "fever", "pain", "rash", "cough", "headache", "infection", "diabetes", "asthma")
    )
    if intent in edu_intents:
        suggested = intent_engine.INTENT_TOOL.get(intent) or suggested
    elif intent == "unknown" and clinicalish:
        suggested = "symptom_guidance"
    elif intent == "community_search":
        suggested = "search_community"

    # Prefer normalized English for RAG / education tool queries
    tool_q = nlu_msg or msg
    tool_args_auto = {"q": tool_q, "query": tool_q, "message": tool_q, **args}
    if soft_redirect:
        tool_args_auto["clinicalSoftRedirect"] = True
    result = await execute_tool(
        suggested,
        tool_args_auto,
        role=role,
        user_id=user_id,
        hospital_id=hospital_id,
        confirm=confirm,
    )

    # Fallback chain
    fallback_used = False
    if suggested == "search_community" and not (result.get("data") or []):
        fallback_used = True
        result = await execute_tool(
            "symptom_guidance", tool_args_auto, role=role, user_id=user_id, hospital_id=hospital_id
        )
        suggested = "symptom_guidance"
    if suggested in edu_intents | {"knowledge_search"} and not (result.get("documents") or result.get("grounded")):
        fallback_used = True
        faq = await execute_tool(
            "platform_faq", tool_args_auto, role=role, user_id=user_id, hospital_id=hospital_id
        )
        result = faq
        suggested = "platform_faq"

    fallback_text = result.get("answer") or _tool_summary(suggested, result)
    if soft_redirect and soft_redirect.get("prefix"):
        fallback_text = str(soft_redirect["prefix"]) + fallback_text
    if fallback_used or intent == "unknown":
        fallback_text += (
            " If you need more help: try Help Center, Medical Community, contact support, "
            "or ask me to book an appointment."
        )

    # Template facts only here — _finish phrases via LLM when enabled
    reply = fallback_text
    log.info(
        "ai_tool tool=%s intent=%s success=%s fallback=%s soft=%s user=%s",
        suggested,
        intent,
        bool(result.get("success", True)),
        fallback_used,
        bool(soft_redirect),
        user_id,
    )
    await _remember_exchange(
        user_id, session_id, message=msg, reply=reply, intent=intent, tool=suggested
    )

    ui = result.get("ui") if isinstance(result.get("ui"), dict) else _ui_from_result(suggested, result)
    payload = {
        "success": bool(result.get("success", True)),
        "intent": intent,
        "intentMeta": detected,
        "reply": reply,
        "tool": suggested,
        "toolResult": result,
        "ui": ui,
        "actions": result.get("actions"),
        "safety": (soft_redirect or {}).get("safety"),
        "fallback": fallback_used,
    }
    return await _finish(
        payload,
        intent=intent,
        tool_name=suggested,
        success=payload["success"],
        fallback=fallback_used or not provider.is_enabled(),
        grounded=_grounded(result),
        safety=(soft_redirect or {}).get("safety"),
    )
