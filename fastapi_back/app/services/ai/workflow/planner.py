"""Module 3 orchestrator — plan workflows / tool routes without executing them."""
from __future__ import annotations

import time
from typing import Any, Optional

from app.services.ai.entity.compose import analyze_message
from app.services.ai.workflow.booking import plan_booking
from app.services.ai.workflow.router import route_intent_to_tools
from app.services.ai.workflow.schemas import ToolProposal, WorkflowPlan
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_BOOKING_INTENTS = frozenset(
    {
        "book_appointment",
        "check_doctor_availability",
    }
)
_CANCEL_INTENTS = frozenset({"cancel_appointment"})
_RESCHEDULE_INTENTS = frozenset({"reschedule_appointment"})


def plan_from_handoff(
    handoff: dict[str, Any],
    *,
    message: str = "",
    flow_data: dict[str, Any] | None = None,
) -> WorkflowPlan:
    """Build a WorkflowPlan from Module 1+2 handoff (no tool execution)."""
    started = time.perf_counter()
    primary = str(handoff.get("primary_intent") or "unknown_intent")
    secondary = list(handoff.get("secondary_intents") or [])
    entities = dict(handoff.get("entities") or {})
    message_type = str(handoff.get("message_type") or "unknown")
    clarify = bool(handoff.get("requires_clarification"))

    # Secondary education note (do not drop)
    notes: list[str] = []
    if secondary:
        notes.append(f"Secondary intents retained: {', '.join(secondary)}")

    if primary in {"emergency_help", "ambulance", "nearest_emergency_hospital"}:
        tools = route_intent_to_tools(primary, entities=entities, message=message)
        plan = WorkflowPlan(
            workflow="emergency",
            step="propose_emergency_hospital",
            primary_intent=primary,
            message_type="emergency",
            proposed_tools=tools,
            flow_data=dict(flow_data or {}),
            clarification_question=None,
            requires_clarification=False,
            secondary_intents=secondary,
            notes=notes
            + ["Emergency has priority; booking intents deferred until safe."],
        )
    elif primary in _BOOKING_INTENTS:
        plan = plan_booking(
            entities=entities,
            message=message,
            flow_data=flow_data,
            secondary_intents=secondary,
            message_type=message_type,
        )
        plan.notes = notes + list(plan.notes)
    elif primary in _CANCEL_INTENTS:
        tools = [
            ToolProposal(
                name="list_my_appointments",
                args={"q": message, "message": message},
                needs_confirm=False,
                reason="List appointments so user can pick one to cancel",
            )
        ]
        plan = WorkflowPlan(
            workflow="cancel_appointment",
            step="await_appointment_pick",
            primary_intent=primary,
            message_type=message_type,
            proposed_tools=tools,
            flow_data=dict(flow_data or {}),
            clarification_question="Which appointment should I cancel?",
            requires_clarification=True,
            secondary_intents=secondary,
            notes=notes
            + ["cancel_appointment tool requires explicit confirm after pick."],
        )
    elif primary in _RESCHEDULE_INTENTS:
        tools = [
            ToolProposal(
                name="list_my_appointments",
                args={"q": message, "message": message},
                needs_confirm=False,
                reason="List appointments for reschedule pick",
            )
        ]
        plan = WorkflowPlan(
            workflow="reschedule_appointment",
            step="await_appointment_pick",
            primary_intent=primary,
            message_type=message_type,
            proposed_tools=tools,
            flow_data=dict(flow_data or {}),
            clarification_question="Which appointment should I reschedule?",
            requires_clarification=True,
            secondary_intents=secondary,
            notes=notes,
        )
    elif primary in {
        "greeting",
        "small_talk",
        "thank_you",
        "goodbye",
    }:
        plan = WorkflowPlan(
            workflow="none",
            step="conversation",
            primary_intent=primary,
            message_type="conversation",
            proposed_tools=[],
            flow_data={},
            requires_clarification=False,
            secondary_intents=secondary,
            notes=notes,
        )
    else:
        tools = route_intent_to_tools(primary, entities=entities, message=message)
        # Ambiguous short asks
        if clarify and not tools:
            plan = WorkflowPlan(
                workflow="clarify",
                step="clarify",
                primary_intent=primary,
                message_type=message_type,
                proposed_tools=[],
                clarification_question="Could you tell me a bit more about what you need?",
                requires_clarification=True,
                secondary_intents=secondary,
                notes=notes,
            )
        else:
            step = "propose_tool" if tools else "clarify"
            plan = WorkflowPlan(
                workflow=message_type if message_type != "unknown" else "general",
                step=step,
                primary_intent=primary,
                message_type=message_type,
                proposed_tools=tools,
                flow_data={"entities": entities},
                clarification_question=(
                    "Could you tell me a bit more about what you need?"
                    if clarify and not tools
                    else None
                ),
                requires_clarification=clarify and not tools,
                secondary_intents=secondary,
                notes=notes,
            )

    plan.processing_ms = (time.perf_counter() - started) * 1000
    log.info(
        "workflow_plan workflow=%s step=%s tools=%s clarify=%s ms=%.2f",
        plan.workflow,
        plan.step,
        [t.name for t in plan.proposed_tools],
        plan.requires_clarification,
        plan.processing_ms,
    )
    return plan


def plan_message(
    message: Optional[str] = None,
    *,
    context: dict[str, Any] | None = None,
    flow_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Full Module 1→2→3 pipeline (plan only).

    Does not execute tools or mutate appointments.
    """
    analysis = analyze_message(message, context=context)
    handoff = analysis.get("handoff") or {}
    plan = plan_from_handoff(
        handoff,
        message=message or "",
        flow_data=flow_data or (context or {}).get("flow_data"),
    )
    return {
        "analysis": analysis,
        "plan": plan.to_dict(),
    }
