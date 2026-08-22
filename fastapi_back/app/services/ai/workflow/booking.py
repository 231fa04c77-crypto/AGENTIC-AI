"""Booking workflow planner — decides next step; never invents doctors/slots."""
from __future__ import annotations

from typing import Any

from app.services.ai.workflow.schemas import ToolProposal, WorkflowPlan


def plan_booking(
    *,
    entities: dict[str, Any],
    message: str,
    flow_data: dict[str, Any] | None = None,
    secondary_intents: list[str] | None = None,
    message_type: str = "workflow",
) -> WorkflowPlan:
    """
    Deterministic booking steps.

    Produces tool proposals for search_doctors / get_doctor_slots only when
    required entities exist. Never fabricates doctorId or slotTime.
    """
    data = dict(flow_data or {})
    ents = dict(entities or {})
    # Merge entity facts into flow scratchpad (facts only)
    if ents.get("specialty") and not data.get("specialty"):
        data["specialty"] = ents["specialty"]
    if ents.get("date") and not data.get("date"):
        data["date"] = ents["date"]
    if ents.get("time_hint") and not data.get("timeHint"):
        data["timeHint"] = ents["time_hint"]
    if ents.get("time") and not data.get("slotTime"):
        data["requestedTime"] = ents["time"]
    if ents.get("mode") and not data.get("mode"):
        data["mode"] = ents["mode"]
    if ents.get("doctor_name") and not data.get("doctorName"):
        data["doctorName"] = ents["doctor_name"]
    if ents.get("relationship"):
        data["bookingFor"] = ents["relationship"]
        data.setdefault(
            "actualPatient",
            {
                "isSelf": False,
                "relationship": ents["relationship"],
                "name": ents["relationship"],
            },
        )

    notes: list[str] = [
        "Doctors and slots must come from live Scheduling APIs only.",
        "book_appointment requires explicit user confirm.",
    ]

    # Already have doctor + slot from a prior turn — propose confirm only
    if data.get("doctorId") and data.get("slotTime") and data.get("date"):
        proposed = {
            "docId": data["doctorId"],
            "slotDate": data.get("slotDate") or data.get("date"),
            "slotTime": data["slotTime"],
            "slotId": data.get("slotId"),
            "mode": data.get("mode") or "offline",
            "slotType": data.get("slotType"),
            "actualPatient": data.get("actualPatient") or {"isSelf": True},
        }
        data["proposedArgs"] = proposed
        data["step"] = "await_confirm"
        return WorkflowPlan(
            workflow="book_appointment",
            step="await_confirm",
            primary_intent="book_appointment",
            message_type=message_type,
            proposed_tools=[
                ToolProposal(
                    name="book_appointment",
                    args=proposed,
                    needs_confirm=True,
                    reason="All booking facts present — confirm with patient before mutate",
                )
            ],
            flow_data=data,
            clarification_question=(
                f"Please confirm booking"
                f"{' for ' + str(data.get('bookingFor')) if data.get('bookingFor') else ''}"
                f" with the selected doctor on {data.get('date')} at {data.get('slotTime')}. "
                "Reply Yes to proceed."
            ),
            requires_clarification=True,
            secondary_intents=list(secondary_intents or []),
            notes=notes,
        )

    if not data.get("specialty") and not data.get("doctorName"):
        data["step"] = "await_specialty"
        return WorkflowPlan(
            workflow="book_appointment",
            step="await_specialty",
            primary_intent="book_appointment",
            message_type=message_type,
            proposed_tools=[],
            flow_data=data,
            clarification_question="Which specialty or doctor would you like to book?",
            requires_clarification=True,
            secondary_intents=list(secondary_intents or []),
            notes=notes,
        )

    if not data.get("date"):
        data["step"] = "await_date"
        spec = data.get("specialty") or data.get("doctorName") or "doctor"
        return WorkflowPlan(
            workflow="book_appointment",
            step="await_date",
            primary_intent="book_appointment",
            message_type=message_type,
            proposed_tools=[],
            flow_data=data,
            clarification_question=(
                f"What date should I check for a {spec} appointment? "
                "You can say tomorrow, next Monday, or 24 July."
            ),
            requires_clarification=True,
            secondary_intents=list(secondary_intents or []),
            notes=notes,
        )

    # Have specialty + date — propose live doctor search (no invented doctors)
    if not data.get("doctorId"):
        q = str(data.get("specialty") or data.get("doctorName") or "doctor")
        data["step"] = "propose_search_doctors"
        return WorkflowPlan(
            workflow="book_appointment",
            step="propose_search_doctors",
            primary_intent="book_appointment",
            message_type=message_type,
            proposed_tools=[
                ToolProposal(
                    name="search_doctors",
                    args={"q": q, "limit": 5, "date": data.get("date")},
                    needs_confirm=False,
                    reason="Live doctor search required — never invent doctors",
                )
            ],
            flow_data=data,
            clarification_question=None,
            requires_clarification=False,
            secondary_intents=list(secondary_intents or []),
            notes=notes
            + [
                "After search_doctors returns, ask user to pick a doctor; "
                "then call get_doctor_slots with real doctorId."
            ],
        )

    # Have doctorId but no slot — propose live slots
    data["step"] = "propose_get_slots"
    return WorkflowPlan(
        workflow="book_appointment",
        step="propose_get_slots",
        primary_intent="book_appointment",
        message_type=message_type,
        proposed_tools=[
            ToolProposal(
                name="get_doctor_slots",
                args={
                    "doctorId": data["doctorId"],
                    "mode": data.get("mode") or "offline",
                    "date": data.get("date"),
                },
                needs_confirm=False,
                reason="Live slots from scheduling API only",
            )
        ],
        flow_data=data,
        clarification_question=None,
        requires_clarification=False,
        secondary_intents=list(secondary_intents or []),
        notes=notes
        + [
            "After get_doctor_slots, present real times; never invent slotTime/slotId."
        ],
    )
