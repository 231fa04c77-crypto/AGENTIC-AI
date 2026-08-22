# Spelling Correction Engine (Module 7)

Healthcare-safe spelling correction using external dictionaries, Entity
Dictionary / Synonym misspellings, and lexicon-limited fuzzy matching.

## Pipeline position

```text
Synonym (M5) → Abbreviation (M6) → Spelling (M7) → Entity Extraction
```

## API

```python
from app.services.ai.spelling import correct_message, reload

reload()
print(correct_message("Need dermotologist tomorow in hydrabad").to_dict())
```

Low-confidence guesses are **not** applied. Unknown medicine-like tokens are
not invented.

## Config

YAML under `config/`. Soft validate: `AI_SPELLING_VALIDATE_ON_START=true`.

Target: &lt;50ms after warm load on seed dictionaries.

## Non-goals

Open-domain spellcheck, workflow execution, gateway cutover.
