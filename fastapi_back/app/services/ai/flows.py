"""Multi-turn patient action flows (cancel / reschedule) with Redis memory."""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from app.services.ai import memory as ai_memory
from app.services.ai.tools import execute_tool


def _abort(message: str) -> bool:
    return bool(re.fullmatch(r"\s*(cancel|stop|never mind|nevermind)\s*", message, re.I))


def _confirm(message: str) -> bool:
    return bool(
        re.fullmatch(
            r"\s*(yes|y|yeah|yep|ok|okay|sure|yes\s*,?\s*please|confirm|confirmed|"
            r"proceed|go ahead|do it|haan|haa|ji|avunu|sare|"
            r"हाँ|हां|जी|అవును|సరే)\s*[!.]?\s*",
            message,
            re.I,
        )
    )


def _pick(message: str, options: list[dict], *keys: str) -> dict | None:
    text = message.strip().lower()
    if text.isdigit():
        index = int(text) - 1
        if 0 <= index < len(options):
            return options[index]
    for option in options:
        for key in keys:
            value = str(option.get(key) or "").strip().lower()
            if value and (text == value or value in text or text in value):
                return option
        aid = str(option.get("id") or "")
        if aid and aid == text:
            return option
    return None


def _appt_card(item: dict) -> dict:
    doctor = item.get("docData") or {}
    return {
        "id": item.get("id") or item.get("_id"),
        "_id": item.get("id") or item.get("_id"),
        "doctor": doctor.get("name") or "Doctor",
        "speciality": doctor.get("speciality") or doctor.get("specialization"),
        "slotDate": item.get("slotDate"),
        "slotTime": item.get("slotTime"),
        "status": item.get("lifecycleStatus") or item.get("status"),
        "bookingId": item.get("bookingId"),
        "cancelled": item.get("cancelled"),
        "isCompleted": item.get("isCompleted"),
        "docData": {
            "name": doctor.get("name") or "Doctor",
            "speciality": doctor.get("speciality") or doctor.get("specialization"),
        },
        "lifecycleStatus": item.get("lifecycleStatus") or item.get("status"),
    }


async def _save(
    user_id: int,
    session_id: str,
    *,
    intent: str,
    message: str,
    reply: str,
    flow_data: dict[str, Any],
) -> None:
    await ai_memory.save_context(
        user_id,
        session_id,
        turn={"role": "user", "intent": intent, "tool": None, "text": message},
        active_flow=intent,
        flow_data=flow_data,
    )
    await ai_memory.save_context(
        user_id,
        session_id,
        turn={"role": "assistant", "intent": intent, "tool": None, "text": reply},
        active_flow=intent,
        flow_data=flow_data,
    )


async def cancel_flow(
    *,
    message: str,
    user_id: int,
    role: str,
    hospital_id: int | None,
    session_id: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    if _abort(message):
        await ai_memory.clear_flow(user_id, session_id)
        return {
            "success": True,
            "intent": "cancel_appointment",
            "reply": "Cancel flow stopped. No appointment was cancelled.",
        }

    data = dict(context.get("flow_data") or {})
    proposed = data.get("proposedArgs")
    if proposed and _confirm(message):
        result = await execute_tool(
            "cancel_appointment",
            dict(proposed),
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
            confirm=True,
        )
        success = bool(result.get("success"))
        if success:
            await ai_memory.clear_flow(user_id, session_id)
        reply = (
            "Your appointment has been cancelled."
            if success
            else str(result.get("message") or "Cancellation failed.")
        )
        return {
            "success": success,
            "intent": "cancel_appointment",
            "reply": reply,
            "tool": "cancel_appointment",
            "toolResult": result,
            "ui": {"type": "bookingReceipt", "title": "Appointment cancelled"} if success else None,
        }

    candidates = list(data.get("appointmentCandidates") or [])
    if not data.get("appointmentId") and candidates:
        selected = _pick(message, candidates, "doctor", "bookingId")
        if selected:
            data["appointmentId"] = selected.get("id")
            data["selected"] = selected

    if not data.get("appointmentId"):
        listed = await execute_tool(
            "list_my_appointments",
            {},
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
        )
        active = [
            _appt_card(item)
            for item in (listed.get("appointments") or [])
            if not item.get("cancelled") and not item.get("isCompleted")
        ]
        if not active:
            await ai_memory.clear_flow(user_id, session_id)
            return {
                "success": True,
                "intent": "cancel_appointment",
                "reply": "You have no active appointments to cancel.",
                "tool": "list_my_appointments",
                "toolResult": listed,
            }
        data["appointmentCandidates"] = active
        reply = "Which appointment should I cancel? Tap a card or reply with its number."
        await _save(
            user_id,
            session_id,
            intent="cancel_appointment",
            message=message,
            reply=reply,
            flow_data=data,
        )
        return {
            "success": True,
            "intent": "cancel_appointment",
            "reply": reply,
            "tool": "list_my_appointments",
            "toolResult": listed,
            "ui": {"type": "appointments", "items": active, "action": "cancel"},
        }

    proposed_args = {"appointmentId": data["appointmentId"]}
    data["proposedArgs"] = proposed_args
    selected = data.get("selected") or {}
    reply = (
        f"Confirm cancel: {selected.get('doctor') or 'appointment'} on "
        f"{selected.get('slotDate')} at {selected.get('slotTime')}?"
    )
    await _save(
        user_id,
        session_id,
        intent="cancel_appointment",
        message=message,
        reply=reply,
        flow_data=data,
    )
    return {
        "success": True,
        "intent": "cancel_appointment",
        "reply": reply,
        "tool": "cancel_appointment",
        "toolResult": {
            "success": True,
            "needsConfirm": True,
            "tool": "cancel_appointment",
            "proposedArgs": proposed_args,
            "message": reply,
        },
        "ui": {
            "type": "confirmation",
            "title": "Confirm cancellation",
            "tool": "cancel_appointment",
            "args": proposed_args,
            "details": selected,
        },
    }


async def reschedule_flow(
    *,
    message: str,
    user_id: int,
    role: str,
    hospital_id: int | None,
    session_id: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    if _abort(message):
        await ai_memory.clear_flow(user_id, session_id)
        return {
            "success": True,
            "intent": "reschedule_appointment",
            "reply": "Reschedule flow stopped. No request was sent.",
        }

    data = dict(context.get("flow_data") or {})
    proposed = data.get("proposedArgs")
    if proposed and _confirm(message):
        result = await execute_tool(
            "request_grace_reschedule",
            dict(proposed),
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
            confirm=True,
        )
        success = bool(result.get("success"))
        if success:
            await ai_memory.clear_flow(user_id, session_id)
        reply = (
            "Reschedule request sent to reception. You will be notified after review."
            if success
            else str(result.get("message") or "Reschedule request failed.")
        )
        return {
            "success": success,
            "intent": "reschedule_appointment",
            "reply": reply,
            "tool": "request_grace_reschedule",
            "toolResult": result,
            "ui": {"type": "bookingReceipt", "title": "Reschedule requested"} if success else None,
        }

    candidates = list(data.get("appointmentCandidates") or [])
    if not data.get("appointmentId") and candidates:
        selected = _pick(message, candidates, "doctor", "bookingId")
        if selected:
            data["appointmentId"] = selected.get("id")
            data["selected"] = selected

    if not data.get("appointmentId"):
        listed = await execute_tool(
            "list_my_appointments",
            {},
            role=role,
            user_id=user_id,
            hospital_id=hospital_id,
        )
        active = [
            _appt_card(item)
            for item in (listed.get("appointments") or [])
            if not item.get("cancelled") and not item.get("isCompleted")
        ]
        if not active:
            await ai_memory.clear_flow(user_id, session_id)
            return {
                "success": True,
                "intent": "reschedule_appointment",
                "reply": "You have no active appointments to reschedule.",
                "tool": "list_my_appointments",
                "toolResult": listed,
            }
        data["appointmentCandidates"] = active
        reply = "Which appointment should I reschedule? Tap a card or reply with its number."
        await _save(
            user_id,
            session_id,
            intent="reschedule_appointment",
            message=message,
            reply=reply,
            flow_data=data,
        )
        return {
            "success": True,
            "intent": "reschedule_appointment",
            "reply": reply,
            "tool": "list_my_appointments",
            "toolResult": listed,
            "ui": {"type": "appointments", "items": active, "action": "reschedule"},
        }

    if not data.get("requestedDate"):
        # Accept ISO date or tomorrow/today keywords
        lower = message.lower()
        requested = None
        if "tomorrow" in lower:
            requested = (date.today() + timedelta(days=1)).isoformat()
        elif "today" in lower and "appointment" not in lower:
            requested = date.today().isoformat()
        else:
            match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", message)
            if match:
                requested = match.group(1)
        if not requested:
            reply = "What new date do you want? Reply with YYYY-MM-DD or ‘tomorrow’."
            await _save(
                user_id,
                session_id,
                intent="reschedule_appointment",
                message=message,
                reply=reply,
                flow_data=data,
            )
            return {
                "success": True,
                "intent": "reschedule_appointment",
                "reply": reply,
                "ui": {"type": "question", "field": "date"},
            }
        data["requestedDate"] = requested

    proposed_args = {
        "appointmentId": data["appointmentId"],
        "requestedDate": data["requestedDate"],
    }
    data["proposedArgs"] = proposed_args
    selected = data.get("selected") or {}
    reply = (
        f"Confirm reschedule request for {selected.get('doctor') or 'appointment'} "
        f"to {data['requestedDate']}? Reception must approve paid grace reschedules."
    )
    await _save(
        user_id,
        session_id,
        intent="reschedule_appointment",
        message=message,
        reply=reply,
        flow_data=data,
    )
    return {
        "success": True,
        "intent": "reschedule_appointment",
        "reply": reply,
        "tool": "request_grace_reschedule",
        "toolResult": {
            "success": True,
            "needsConfirm": True,
            "tool": "request_grace_reschedule",
            "proposedArgs": proposed_args,
            "message": reply,
        },
        "ui": {
            "type": "confirmation",
            "title": "Confirm reschedule request",
            "tool": "request_grace_reschedule",
            "args": proposed_args,
            "details": {
                **selected,
                "requestedDate": data["requestedDate"],
            },
        },
    }
