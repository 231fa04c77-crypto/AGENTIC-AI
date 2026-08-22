# Module 3 — Workflow Engine / Tool Router

**Plan-only** layer that turns Intent + Entities into a structured workflow plan.

**Does:** choose next step, propose tools + args from entities, ask clarification.  
**Does not:** execute tools, invent doctors/slots, mutate appointments, call LLMs.

## Public API

```python
from app.services.ai.workflow import plan_message, plan_from_handoff

result = plan_message("Book a dermatologist tomorrow morning")
print(result["plan"])
# proposed_tools: [{ name: search_doctors, args: { q: Dermatologist, date: ... } }]
```

## Booking steps

```mermaid
flowchart TD
  start[book_appointment] --> spec{specialty or doctorName?}
  spec -->|no| awaitSpec[await_specialty]
  spec -->|yes| date{date?}
  date -->|no| awaitDate[await_date]
  date -->|yes| doc{doctorId from prior turn?}
  doc -->|no| search[propose search_doctors]
  doc -->|yes| slot{slotTime?}
  slot -->|no| slots[propose get_doctor_slots]
  slot -->|yes| confirm[await_confirm book_appointment needs_confirm]
```

Hard rule: **never invent** `doctorId`, `slotTime`, or lab values. Those appear in `proposedArgs` only after live tool results are merged into `flow_data` by the gateway (existing booking flow).

## Pipeline

```mermaid
flowchart LR
  msg[Message] --> m1[Intent M1]
  m1 --> m2[Entities M2]
  m2 --> m3[Workflow plan M3]
  m3 -.->|"shadow log"| logs[Gateway logs]
  m3 -.->|"Module 4 later"| exec[Execute tools with confirm]
```

## Shadow

`AI_INTENT_ENGINE_SHADOW=true` logs `ai_workflow_shadow` (workflow, step, tools) without changing live replies.

## Tests

`tests/test_ai_workflow_engine.py`
