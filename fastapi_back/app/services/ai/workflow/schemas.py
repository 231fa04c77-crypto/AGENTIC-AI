"""Module 3 — Workflow / Tool Router schemas."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ToolProposal:
    """A tool the gateway MAY execute later — never auto-run mutating tools here."""

    name: str
    args: dict[str, Any] = field(default_factory=dict)
    needs_confirm: bool = False
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "args": dict(self.args),
            "needs_confirm": self.needs_confirm,
            "reason": self.reason,
        }


@dataclass
class WorkflowPlan:
    """Structured plan for downstream gateway / Module 4 execution."""

    workflow: str  # e.g. book_appointment | none | emergency | education
    step: str  # await_specialty | propose_search_doctors | clarify | done | ...
    primary_intent: str = "unknown_intent"
    message_type: str = "unknown"
    proposed_tools: list[ToolProposal] = field(default_factory=list)
    flow_data: dict[str, Any] = field(default_factory=dict)
    clarification_question: Optional[str] = None
    requires_clarification: bool = False
    secondary_intents: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    processing_ms: float = 0.0
    # Hard rule reminder for executors
    never_invent: tuple[str, ...] = ("doctors", "slots", "lab_values", "diagnoses")

    def to_dict(self) -> dict[str, Any]:
        return {
            "workflow": self.workflow,
            "step": self.step,
            "primary_intent": self.primary_intent,
            "message_type": self.message_type,
            "proposed_tools": [t.to_dict() for t in self.proposed_tools],
            "flow_data": dict(self.flow_data),
            "clarification_question": self.clarification_question,
            "requires_clarification": self.requires_clarification,
            "secondary_intents": list(self.secondary_intents),
            "notes": list(self.notes),
            "processing_ms": round(self.processing_ms, 3),
            "never_invent": list(self.never_invent),
        }
