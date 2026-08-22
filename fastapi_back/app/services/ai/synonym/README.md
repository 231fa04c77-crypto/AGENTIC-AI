# Synonym Engine (Module 5)

Config-driven **language normalization** for the MedClues AI Assistant.
Resolves colloquial phrases, abbreviations, regional brand names, and
misspellings into canonical values — without diagnosis or business actions.

## Architecture

```text
User text
   → normalize_message / resolve_term
   → synonym config YAML (+ regional overlay)
   → optional Entity Dictionary fallback
   → extract_entities (uses normalized_text)
```

Live gateway routing is unchanged.

## Public API

```python
from app.services.ai.synonym import resolve_term, normalize_message, reload

reload()
print(resolve_term("skin doctor").to_dict())
# {"original":"skin doctor","canonical":"Dermatologist","category":"specialty",...}

print(normalize_message("Need PCM from medicine store").to_dict())
```

## Matching strategy

1. Exact (canonical)
2. Abbreviation / synonym / alias / plural / misspelling (inverted index)
3. Fuzzy (`difflib`, cutoff 0.86)
4. Entity Dictionary fallback for entity categories

Longest phrases are replaced first in `normalize_message`.

## Configuration

YAML under `config/`. Region overlay: `regional_{AI_SYNONYM_REGION}.yaml` (default `IN`).

| File | Purpose |
|------|---------|
| `specialties.yaml` | Skin doctor → Dermatologist, … |
| `medicines.yaml` | PCM → Paracetamol, … |
| `symptoms.yaml` / `diseases.yaml` / `laboratories.yaml` | Clinical terms |
| `navigation.yaml` | Medicine store → Pharmacy, … |
| `appointment.yaml` / `emergency.yaml` / `general.yaml` | Flows + abbrevs |
| `spelling.yaml` | Extra misspellings |
| `regional_IN.yaml` | Tylenol / Crocin / Dolo → Paracetamol |

### Add a synonym

1. Edit the right YAML; unique `id`; set `canonical` + source lists.
2. Avoid mapping the same source term to two different canonicals.
3. Call `reload()` or restart the API.

## Validation

- Duplicate source → different canonicals = **error**
- Same canonical shared = **warning**
- Circular A↔B synonym pairs = **error**
- Soft startup: `AI_SYNONYM_VALIDATE_ON_START=true`

## Performance

In-process inverted index is the primary cache. Seed size resolves in well under 50ms.
`AI_SYNONYM_REDIS_CACHE` is reserved (default off).

## Relation to Entity Dictionary

Synonym Engine owns colloquial / navigation / regional maps.
Entity Dictionary remains the structured entity catalog; the matcher may consult it on miss.
Do not duplicate full entity catalogs here.

## Non-goals

Workflow execution, Memory, RAG, diagnosis, gateway cutover.
