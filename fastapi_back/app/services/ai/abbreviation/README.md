# Abbreviation Engine (Module 6)

Config-driven expansion of healthcare abbreviations with context-aware
disambiguation. Does **not** diagnose or execute business logic.

## Pipeline position

```text
Synonym (M5) → Abbreviation (M6) → Spelling (M7) → Entity Extraction
```

## API

```python
from app.services.ai.abbreviation import expand_term, expand_message, reload

reload()
print(expand_term("BP").to_dict())
print(expand_term("OP", context="OP ticket").to_dict())
print(expand_term("OP", context="hello").to_dict())  # requires_clarification
print(expand_message("Book ECG and CBC tomorrow").to_dict())
```

Ambiguous abbreviations are **not** replaced in `expand_message`; they appear
in `expansions` with `requires_clarification=true` and `possible_values`.

## Config

YAML under `config/`. Soft validate: `AI_ABBREVIATION_VALIDATE_ON_START=true`.

## Non-goals

Workflow execution, gateway cutover, replacing Synonym Engine.
