"""Role → tool permission engine."""
from __future__ import annotations

from typing import Any

# Tool catalog: name, description, roles, mutating?
TOOL_DEFS: list[dict[str, Any]] = [
    {"name": "search_doctors", "description": "Search doctors by name/specialty", "roles": ["patient", "dean", "admin", "doctor", "receptionist"], "mutating": False},
    {"name": "search_hospitals", "description": "Search hospitals", "roles": ["patient", "dean", "admin", "receptionist"], "mutating": False},
    {"name": "search_community", "description": "Search Medical Community (not diagnosis)", "roles": ["patient", "doctor", "admin"], "mutating": False},
    {"name": "knowledge_search", "description": "RAG knowledge / FAQ / guides", "roles": ["*"], "mutating": False},
    {"name": "platform_faq", "description": "Platform how-to FAQ", "roles": ["*"], "mutating": False},
    {"name": "health_education", "description": "Grounded disease / lab literacy Q&A", "roles": ["*"], "mutating": False},
    {"name": "symptom_guidance", "description": "General symptom guidance (not diagnosis)", "roles": ["*"], "mutating": False},
    {"name": "wellness_info", "description": "Lifestyle and mental wellness information", "roles": ["*"], "mutating": False},
    {"name": "medicine_info", "description": "General medicine information (not personal dosing)", "roles": ["*"], "mutating": False},
    {"name": "explain_lab_report", "description": "Explain the patient's own lab results in plain language", "roles": ["patient"], "mutating": False},
    {"name": "list_saved_profiles", "description": "List saved family profiles for booking", "roles": ["patient"], "mutating": False},
    {"name": "navigate_app", "description": "Open a MEDCLUES screen via deep link", "roles": ["*"], "mutating": False},
    {"name": "get_my_profile", "description": "Read the authenticated caller’s basic profile", "roles": ["patient"], "mutating": False},
    {"name": "get_today_appointments", "description": "List the caller’s appointments for today", "roles": ["patient"], "mutating": False},
    {"name": "list_my_appointments", "description": "List caller’s appointments", "roles": ["patient"], "mutating": False},
    {"name": "get_doctor_slots", "description": "Get available slots for a selected doctor", "roles": ["patient", "receptionist"], "mutating": False},
    {"name": "propose_book_appointment", "description": "Propose booking steps / hold slot (needs confirm)", "roles": ["patient"], "mutating": False},
    {"name": "book_appointment", "description": "Book appointment (confirm required)", "roles": ["patient"], "mutating": True},
    {"name": "propose_cancel_appointment", "description": "Propose cancel", "roles": ["patient"], "mutating": False},
    {"name": "cancel_appointment", "description": "Cancel appointment (confirm required)", "roles": ["patient"], "mutating": True},
    {"name": "request_grace_reschedule", "description": "Request grace reschedule (confirm required)", "roles": ["patient"], "mutating": True},
    {"name": "confirm_tomorrow_reschedule", "description": "Confirm tomorrow-only reschedule for a MISSED appointment", "roles": ["patient"], "mutating": True},
    {"name": "search_medicine", "description": "Search medicine / PharmaSync availability hint", "roles": ["patient", "dean", "admin"], "mutating": False},
    {"name": "list_prescriptions", "description": "List pharmacy prescriptions", "roles": ["patient"], "mutating": False},
    {"name": "track_medicine_order", "description": "Track pharmacy orders", "roles": ["patient"], "mutating": False},
    {"name": "search_labs", "description": "Find laboratories / tests", "roles": ["patient", "dean", "admin"], "mutating": False},
    {"name": "list_lab_bookings", "description": "List lab bookings / report status", "roles": ["patient"], "mutating": False},
    {"name": "book_lab_test", "description": "Book lab test (confirm required)", "roles": ["patient"], "mutating": True},
    {"name": "list_payments", "description": "List payment / bill history", "roles": ["patient"], "mutating": False},
    {"name": "propose_create_support_ticket", "description": "Draft a support ticket", "roles": ["patient", "doctor", "dean"], "mutating": False},
    {"name": "create_support_ticket", "description": "Create support ticket (confirm required)", "roles": ["patient", "doctor", "dean"], "mutating": True},
    {"name": "get_ticket_status", "description": "Get support ticket status", "roles": ["patient", "doctor", "dean", "admin"], "mutating": False},
    {"name": "find_nearest_emergency_hospital", "description": "Find hospitals for emergency guidance", "roles": ["patient", "receptionist", "dean", "admin"], "mutating": False},
    {"name": "medicine_reminder_hint", "description": "How to set medicine reminders", "roles": ["patient"], "mutating": False},
    {"name": "doctor_today_schedule", "description": "Doctor today’s appointments / queue", "roles": ["doctor"], "mutating": False},
    {"name": "doctor_dashboard_summary", "description": "Doctor dashboard summary", "roles": ["doctor"], "mutating": False},
    {"name": "hospital_analytics_hint", "description": "Hospital analytics navigation", "roles": ["dean", "admin", "super_admin"], "mutating": False},
    {"name": "manage_hospitals_hint", "description": "Super-admin hospital management hint", "roles": ["admin", "super_admin"], "mutating": False},
]


def normalize_role(role: str | None) -> str:
    r = (role or "patient").strip().lower()
    if r == "superadmin":
        return "super_admin"
    return r


def tools_for_role(role: str) -> list[dict[str, Any]]:
    role = normalize_role(role)
    out = []
    for t in TOOL_DEFS:
        roles = t["roles"]
        if "*" in roles or role in roles:
            out.append(
                {
                    "name": t["name"],
                    "description": t["description"],
                    "mutating": bool(t.get("mutating")),
                }
            )
    return out


def can_use_tool(role: str, tool_name: str) -> bool:
    role = normalize_role(role)
    for t in TOOL_DEFS:
        if t["name"] != tool_name:
            continue
        roles = t["roles"]
        return "*" in roles or role in roles
    return False


def is_mutating(tool_name: str) -> bool:
    for t in TOOL_DEFS:
        if t["name"] == tool_name:
            return bool(t.get("mutating"))
    return False
