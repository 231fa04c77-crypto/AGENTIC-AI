# Enterprise AI Medical Assistant — Architecture

**Status:** Implemented as an **extractable module** inside the MEDCLUES modular monolith (`fastapi_back/app/services/ai/`).  
**Flag:** `AI_ASSISTANT_ENABLED=true` (default **off**).  
**Hard rule:** AI **never** opens PostgreSQL directly — tools call internal controllers/services only.  
**Hard rule:** AI **never** diagnoses, prescribes, or replaces clinicians.

---

## Layers

```
Clients (Flutter / React / Admin)
        ↓
   /api/ai/assistant/*   ← AI Gateway
        ↓
┌───────────────────────────────────────────┐
│  Layer 1 — Cohere / Mistral / OpenAI / Qwen LLM │
│  Meaning normalize · conversation polish · classify │
│  (never invents doctors / slots / status)       │
├───────────────────────────────────────────┤
│  Layer 1b — Workflow engine + NLU         │
│  Redis/local memory · step machine        │
│  Intent→tool map · follow-ups (Yes/Tomorrow)│
├───────────────────────────────────────────┤
│  Layer 2 — Knowledge (RAG)                │
│  FAQ · policies · guides (static only)    │
├───────────────────────────────────────────┤
│  Layer 3 — Tools (live APIs only)         │
│  Scheduling · appointments · pharmacy     │
│  lab · community · tickets · payments     │
└───────────────────────────────────────────┘
        ↓
   Existing MEDCLUES internal APIs/services
        ↓
   PostgreSQL (source of truth) · PharmaSync · partners
```

Redis (when `REDIS_URL` set): conversation + workflow state, rate limits, FAQ/tool short TTL cache. **Process-local memory fallback** keeps workflows alive if Redis is down. **No permanent clinical records in Redis.**

---

## Conversation behavior

| Path | Example | Behavior |
|------|---------|----------|
| Basic conversation | “Hi”, “What can you do?” | LLM response with short history; no tool |
| Personalized read | “What is my name?”, “My appointments” | Deterministic tool reply from live APIs (no LLM facts) |
| Action workflow | “Book / cancel / reschedule …” | Multi-turn step machine + cards → confirm → booking APIs |
| Follow-ups | “Tomorrow”, “Yes”, “first doctor”, “Evening” | Stay in `active_flow`; NLU fills slots without restarting |
| Navigation | “Open Pharmacy” | Structured deep-link actions in Flutter |
| Support | “My medicine wasn’t delivered” | Draft ticket → confirm → ticket ID |

**Slots/doctors always come from the Scheduling API** (`doctor_slot_service`), never from the LLM or synthetic AI controller slots.

The Flutter assistant renders profile, appointment, doctor, slot, payment, hospital, confirmation, receipt, and navigation action cards. A model cannot mutate data: write tools require explicit confirmation and gateway permission checks.

Continuous improvement: `POST /api/ai/assistant/feedback` stores thumbs up/down; `ai_assistant_events` records grounded/fallback outcomes for knowledge expansion (not model fine-tuning).

---

## Request pipeline (AI Gateway)

1. Feature flag  
2. Authentication (JWT)  
3. Role resolution (patient / doctor / dean / admin / receptionist)  
4. Hospital isolation (dean/reception scoped by `hospital_id`)  
5. Rate limit  
6. Request validation  
7. Safety scan (refuse diagnose/prescribe; urgency → emergency/book)  
8. Load conversation memory  
9. Intent detection  
10. Permission check for tools  
11. RAG retrieve (if Q&A / FAQ / help)  
12. Tool execution (service layer)  
13. Response validation + disclaimer  
14. Metrics / audit log  

Provider configuration is backend-only:

- **Cohere (primary for NLU + reply phrasing):** `AI_LLM_PROVIDER=cohere`, `AI_LLM_MODEL=command-r-plus`, `COHERE_API_KEY=...` (rotate if exposed; never commit; never put in Flutter)
- Mistral: `AI_LLM_PROVIDER=mistral`, `AI_LLM_MODEL=mistral-medium-latest`, `MISTRAL_API_KEY=...`
- OpenAI: `AI_LLM_PROVIDER=openai`, `AI_LLM_MODEL=gpt-4.1-mini`, `OPENAI_API_KEY=...`

Meaning normalization runs in the gateway before intent detection (`normalize_meaning.py`): broken English / Telugu-English / typos → clear English for NLU + RAG. On Cohere failure, synonym → abbreviation → spelling fallback is used. JSON is never shown to users.

Provider keys are never sent to Flutter. Changing the model does not grant database access: authenticated tools and explicit confirmation remain mandatory for booking.

**Recommended Render (after golden NL tests):**

```
AI_ASSISTANT_ENABLED=true
AI_LLM_ENABLED=true
AI_LLM_PROVIDER=cohere
AI_LLM_MODEL=command-r-plus
COHERE_API_KEY=***rotated***
AI_NLU_PIPELINE_CUTOVER=true
```

Start with `AI_NLU_PIPELINE_CUTOVER=false` if you want shadow-first.

**Qwen (DashScope):** set `AI_LLM_PROVIDER=qwen`, `DASHSCOPE_API_KEY` (or `QWEN_API_KEY`), `AI_LLM_MODEL=qwen-plus` (or another model enabled in your Alibaba Model Studio console), and optionally `AI_LLM_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. Enable `AI_ASSISTANT_ENABLED=true` and `AI_LLM_ENABLED=true`. If the API returns `AccessDenied.Unpurchased`, activate that model for your account in Model Studio.

---

## NLU pipeline cutover (Module 8)

Live chat intent detection can use the new synonym → abbreviation → spelling → intent/entity → workflow **plan** pipeline behind a flag.

| Flag | Default | Effect |
|------|---------|--------|
| `AI_NLU_PIPELINE_CUTOVER` | `false` | **Off:** legacy `intents.detect_intent` (production unchanged). **On:** `nlu_cutover.detect_for_gateway` maps the new pipeline into the existing gateway shape. |
| `AI_INTENT_ENGINE_SHADOW` | `false` | Independent log-only shadow of `plan_message`. Skipped when cutover is on (plan already ran). |

**Enable (staging first):** set `AI_NLU_PIPELINE_CUTOVER=true` and restart the API.

**Rollback:** set `AI_NLU_PIPELINE_CUTOVER=false` and restart. No code deploy required.

Cutover replaces **detection only**. Existing `_booking_flow` / `execute_tool` paths and confirm UX for mutating tools are unchanged. Soft fallback to legacy detection on pipeline errors (`nlu_cutover_fallback` log).

---

## Endpoints (additive)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/ai/assistant/status` | public |
| GET | `/api/ai/assistant/tools` | any assistant role |
| POST | `/api/ai/assistant/chat` | any assistant role |
| POST | `/api/ai/assistant/confirm` | any assistant role (write tools) |

Legacy `/api/ai/chat*` unchanged.

---

## Write-tool safety

Mutating tools (`book_appointment`, `cancel_appointment`, `create_support_ticket`, `book_lab_test`) require `confirm=true` (or `/assistant/confirm`).  
Otherwise the gateway returns a **proposal** for the user to confirm.

---

## Microservice extraction path

Package boundary is already `app/services/ai/*`. To split later:

1. Move package + thin FastAPI app to `ai_service/`  
2. Call monolith over internal HTTP with service auth  
3. Keep same `/api/ai/assistant/*` contract behind API gateway  

Until then: **one process, clear module boundary** (matches MEDCLUES modular-monolith decision).

---

## Future (designed, not blocking)

Voice STT/TTS · OCR reports · multilingual · wearables · insurance · family accounts · consult summaries — same gateway + new tools.
