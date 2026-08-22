"""Intent → tool proposals (read-only planner; no API execution)."""
from __future__ import annotations

from typing import Any

from app.services.ai.intent.adapter import LEGACY_INTENT_MAP
from app.services.ai.workflow.schemas import ToolProposal

# Module-1 intent → preferred tool name(s) for the existing tool catalog
INTENT_TOOL_ROUTE: dict[str, str] = {
    "book_appointment": "search_doctors",  # start of booking; never book_appointment without confirm
    "cancel_appointment": "list_my_appointments",
    "reschedule_appointment": "list_my_appointments",
    "view_appointment": "list_my_appointments",
    "check_appointment_status": "list_my_appointments",
    "check_doctor_availability": "search_doctors",
    "search_doctor": "search_doctors",
    "doctor_details": "search_doctors",
    "search_specialist": "search_doctors",
    "search_hospital": "search_hospitals",
    "nearby_hospital": "search_hospitals",
    "hospital_information": "search_hospitals",
    "search_medicine": "search_medicine",
    "medicine_information": "medicine_info",
    "order_medicine": "search_medicine",
    "track_medicine_order": "track_medicine_order",
    "search_laboratory": "search_labs",
    "book_lab_test": "search_labs",
    "view_reports": "list_lab_bookings",
    "explain_reports": "explain_lab_report",
    "search_community": "search_community",
    "ask_community_question": "search_community",
    "read_community_answers": "search_community",
    "raise_complaint": "propose_create_support_ticket",
    "track_complaint": "get_ticket_status",
    "feedback": "knowledge_search",
    "disease_information": "health_education",
    "symptom_guidance": "symptom_guidance",
    "wellness_advice": "wellness_info",
    "nutrition": "wellness_info",
    "exercise": "wellness_info",
    "mental_health": "wellness_info",
    "emergency_help": "find_nearest_emergency_hospital",
    "ambulance": "find_nearest_emergency_hospital",
    "nearest_emergency_hospital": "find_nearest_emergency_hospital",
    "open_pharmacy": "navigate_app",
    "open_reports": "navigate_app",
    "open_appointments": "navigate_app",
    "open_dashboard": "navigate_app",
    "open_profile": "get_my_profile",
    "open_settings": "navigate_app",
    "greeting": "none",
    "small_talk": "none",
    "thank_you": "none",
    "goodbye": "none",
    "help": "knowledge_search",
    "faq": "knowledge_search",
    "unknown_intent": "knowledge_search",
}

_NAV_ROUTES = {
    "open_pharmacy": "/pharmacy",
    "open_reports": "/labs",
    "open_appointments": "/appointments",
    "open_dashboard": "/dashboard",
    "open_settings": "/settings",
}

_MUTATING_TOOLS = frozenset(
    {
        "book_appointment",
        "cancel_appointment",
        "create_support_ticket",
    }
)


def build_tool_args(intent: str, entities: dict[str, Any], message: str) -> dict[str, Any]:
    """Args derived only from extracted entities / message — never invented IDs."""
    ents = entities or {}
    q = message or ""
    args: dict[str, Any] = {"q": q, "query": q, "message": q}

    if ents.get("specialty"):
        args["specialty"] = ents["specialty"]
        args["q"] = ents["specialty"]
    if ents.get("doctor_name"):
        args["doctorName"] = ents["doctor_name"]
        args["q"] = ents["doctor_name"]
    if ents.get("date"):
        args["date"] = ents["date"]
        args["slotDate"] = ents["date"]
    if ents.get("time"):
        args["time"] = ents["time"]
        args["slotTime"] = ents["time"]
    if ents.get("time_hint"):
        args["timeHint"] = ents["time_hint"]
    if ents.get("mode"):
        args["mode"] = ents["mode"]
    if ents.get("medicine_name"):
        args["q"] = ents["medicine_name"]
    if ents.get("lab_test"):
        args["q"] = ents["lab_test"]
        args["test"] = ents["lab_test"]
    if ents.get("disease_name") and intent in {
        "disease_information",
        "symptom_guidance",
        "health_education",
    }:
        args["q"] = ents["disease_name"]
    if ents.get("relationship"):
        args["relationship"] = ents["relationship"]
        args["actualPatient"] = {
            "isSelf": False,
            "relationship": ents["relationship"],
            "name": ents.get("relationship") or "Family member",
        }
    if intent in _NAV_ROUTES:
        args["route"] = _NAV_ROUTES[intent]
        args["target"] = intent.replace("open_", "")
    return args


def route_intent_to_tools(
    intent: str,
    *,
    entities: dict[str, Any],
    message: str,
) -> list[ToolProposal]:
    tool_name = INTENT_TOOL_ROUTE.get(intent, "knowledge_search")
    if tool_name == "none":
        return []
    args = build_tool_args(intent, entities, message)
    needs_confirm = tool_name in _MUTATING_TOOLS
    return [
        ToolProposal(
            name=tool_name,
            args=args,
            needs_confirm=needs_confirm,
            reason=f"Routed from intent={intent}",
        )
    ]


def legacy_intent_name(primary_intent: str) -> str:
    return LEGACY_INTENT_MAP.get(primary_intent, "unknown")
