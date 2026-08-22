"""Shared constants for the Enterprise AI Assistant."""
from __future__ import annotations

DISCLAIMER = (
    "MedClues AI Assistant helps you navigate the platform and automate workflows. "
    "It does not diagnose conditions, prescribe medicines, or replace a licensed clinician. "
    "For urgent symptoms, seek emergency care or book an appointment."
)

URGENCY_HINT = (
    "If this feels urgent or life-threatening, go to the nearest emergency department "
    "or call local emergency services. You can also search hospitals for emergency care on MedClues."
)

# Roles accepted by the assistant gateway
ASSISTANT_ROLES = frozenset(
    {"patient", "doctor", "dean", "admin", "receptionist", "super_admin"}
)

# Intents (Layer 1 output → Layer 3 tools)
INTENTS = (
    "basic_conversation",
    "get_my_profile",
    "get_today_appointments",
    "view_appointments",
    "book_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "find_doctor",
    "find_hospital",
    "find_pharmacy",
    "track_medicine_order",
    "view_prescription",
    "view_lab_report",
    "explain_lab_report",
    "pay_bill",
    "raise_complaint",
    "track_complaint",
    "emergency_help",
    "find_department",
    "community_search",
    "book_lab_test",
    "medicine_reminder",
    "view_queue",
    "view_schedule",
    "platform_help",
    "navigation_help",
    "analytics",
    "health_education",
    "symptom_guidance",
    "wellness_info",
    "medicine_info",
    "refuse_clinical",
    "unknown",
)
