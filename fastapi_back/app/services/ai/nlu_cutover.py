"""Module 8 — Feature-flagged NLU pipeline for gateway intent detection."""
from __future__ import annotations

from typing import Any, Optional

from app.utils.app_logger import get_logger

log = get_logger(__name__)


def detect_for_gateway(
    message: Optional[str] = None,
    *,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Run Modules 1–7 + workflow plan, map to legacy gateway detect_intent shape.

    On failure, falls back to legacy intents.detect_intent so chat never crashes.
    Does not execute tools.
    """
    try:
        from app.services.ai.intent.adapter import to_legacy_intent
        from app.services.ai.intents import INTENT_TOOL
        from app.services.ai.workflow import plan_message

        bundled = plan_message(message, context=context)
        analysis = bundled.get("analysis") or {}
        handoff = analysis.get("handoff") or {}
        plan = bundled.get("plan") or {}
        intent_payload = analysis.get("intent") or {}

        legacy = to_legacy_intent(intent_payload)
        legacy_intent = str(legacy.get("intent") or "unknown")

        proposed = list(plan.get("proposed_tools") or [])
        suggested = None
        for tool in proposed:
            name = str((tool or {}).get("name") or "").strip()
            if not name or name == "none":
                continue
            if tool.get("needs_confirm"):
                continue
            suggested = name
            break
        if not suggested:
            suggested = INTENT_TOOL.get(legacy_intent)

        # Prefer workflow plan clarify (handoff may flag missing optional slots)
        requires_clarification = bool(plan.get("requires_clarification"))
        clarification_question = plan.get("clarification_question")
        if not requires_clarification and legacy.get("requires_clarification"):
            requires_clarification = True
        if requires_clarification and not clarification_question:
            clarification_question = (
                "Could you share a bit more detail so I can help accurately?"
            )

        entities = dict(handoff.get("entities") or {})

        out = {
            "intent": legacy_intent,
            "confidence": float(legacy.get("confidence") or 0.5),
            "source": "nlu_pipeline_v1",
            "query": handoff.get("normalized_message")
            or legacy.get("query")
            or (message or ""),
            "entities": entities,
            "requires_clarification": requires_clarification,
            "clarification_question": clarification_question,
            "suggested_tool": suggested,
            "secondary_intents": list(
                handoff.get("secondary_intents")
                or legacy.get("secondary_intents")
                or []
            ),
            "message_type": handoff.get("message_type") or legacy.get("message_type"),
            "v2_primary": handoff.get("primary_intent") or legacy.get("v2_primary"),
            "plan": {
                "workflow": plan.get("workflow"),
                "step": plan.get("step"),
                "proposed_tools": [
                    t.get("name") for t in proposed if isinstance(t, dict)
                ],
                "requires_clarification": plan.get("requires_clarification"),
            },
        }
        log.info(
            "nlu_cutover intent=%s v2=%s clarify=%s tools=%s",
            out["intent"],
            out.get("v2_primary"),
            requires_clarification,
            out["plan"]["proposed_tools"],
        )
        return out
    except Exception as exc:  # noqa: BLE001
        log.warning("nlu_cutover_fallback err=%s", type(exc).__name__)
        from app.services.ai import intents as intent_engine

        fallback = intent_engine.detect_intent(message or "", context=context)
        fallback = dict(fallback or {})
        fallback["source"] = f"nlu_cutover_fallback:{fallback.get('source') or 'legacy'}"
        fallback.setdefault("entities", {})
        fallback.setdefault("requires_clarification", False)
        fallback.setdefault("clarification_question", None)
        return fallback
