# Intent Dictionary (Module 2)

Centralized **intent knowledge** for the MedClues Intent Engine. Adding intents,
synonyms, or examples is a YAML edit — no Python matcher changes required.

Live AI chat still uses legacy `intents.py` in the gateway. This dictionary feeds
the library Intent Engine (`detect_intents`) and optional shadow logging only.

## Architecture

```text
intent_dictionary.yaml  →  intent_loader  →  intent_validator
                                    ↓
                         get_intent / list_intents
                                    ↓
              Intent Engine matcher / catalog / confidence
                                    ↓
                         detect_intents (library)
```

| File | Role |
|------|------|
| `intent_dictionary.yaml` | Source of truth |
| `intent_schema.py` | `IntentDefinition` dataclass |
| `intent_loader.py` | Load + cache YAML |
| `intent_validator.py` | Duplicates, ranges, tool allowlist |
| `__init__.py` | Public API |

## YAML format

Each intent record:

```yaml
- id: book_appointment
  name: Book Appointment
  description: User wants to book a doctor appointment
  category: Appointment          # Emergency | Appointment | Doctor | ...
  priority: 90                   # 0–100 (Emergency ~100 … Unknown 0)
  confidence_threshold: 0.55     # 0–1; engine drops weaker hits
  synonyms: [book appointment, schedule visit]
  aliases: [book slot]
  examples:                      # major intents should have ≥20
    - book an appointment
    - schedule a doctor visit
  workflow: appointment_booking  # metadata only
  required_entities: [specialty]
  tool: search_doctors           # metadata; must be on allowlist
  requires_auth: true
  requires_confirmation: true
  supports_followup: true
  emergency: false
  fallback_intent: unknown_intent
  output_category: workflow
  message_type: workflow
  patterns:
    - strength: phrase           # exact | phrase | keyword | weak
      regex: '\b(book|schedule)\b.*\bappointment\b'
  synonyms_hi: []                # optional multilingual (reserved)
  examples_te: []
```

## How to add an intent

1. Copy an existing record in `intent_dictionary.yaml`.
2. Set a unique `id` (snake_case).
3. Fill synonyms, ≥20 examples for major flows, and at least one `patterns` regex.
4. Set `tool` to a known name from Module 3 `INTENT_TOOL_ROUTE` / permissions (or `none`).
5. Point `fallback_intent` at an existing id (usually `unknown_intent`).
6. Restart the API or call `reload()` so the matcher rebuilds.

```python
from app.services.ai.intent.dictionary import reload, get_intent
from app.services.ai.intent import detect_intents

reload()  # validates, rebuilds matcher + catalog caches
assert get_intent("book_appointment") is not None
detect_intents("book an appointment")
```

## Validation rules

**Errors (fail validation):**

- Duplicate intent ids
- Missing `category`, `workflow`, or `tool`
- `priority` outside 0–100
- `confidence_threshold` outside 0–1
- Unknown `fallback_intent`
- Unknown `tool` (not on allowlist)
- Invalid pattern `strength`

**Warnings (logged only):**

- Same synonym string claimed by two intents

Startup: when `AI_INTENT_DICTIONARY_VALIDATE_ON_START=true` (default), FastAPI
lifespan runs a **soft** validate — errors are logged; the API still boots.

## Multilingual note

Optional keys `synonyms_hi` and `examples_te` are reserved for Hindi / Telugu
phrase lists. They are loaded and stored but not required for English matching
today. Leave them empty (`[]`) until localization wires them into the matcher.

## Non-goals

- Does not execute tools or change live gateway routing
- Does not replace Entity Extraction / Workflow / Memory / RAG modules
