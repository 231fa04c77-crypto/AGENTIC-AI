# Entity Dictionary (Module 4)

Centralized **entity knowledge** for the MedClues Entity Extraction Engine.
Adding aliases, misspellings, or abbreviations is a YAML edit — no Python
extractor changes required for closed vocabularies.

## Architecture

```text
catalogs/*.yaml  →  entity_loader  →  entity_validator
                           ↓
                    inverted index
                           ↓
                    entity_search (exact / alias / fuzzy)
                           ↓
              extractors.py + workflow_nlu.extract_specialty
                           ↓
                    extract_entities (library)
```

Live AI chat routing is unchanged. This module only feeds extraction.

## YAML format

```yaml
version: 1
category: Medicine
entities:
  - id: paracetamol
    canonical: Paracetamol
    category: Medicine
    normalized: Paracetamol
    aliases: [acetaminophen, pcm]
    synonyms: [painkiller]
    abbreviations: [PCM]
    misspellings: [paracetmol]
    plurals: []
    metadata:
      strengths: ["500 mg", "650 mg"]
      forms: [Tablet, Syrup]
    aliases_hi: []
    aliases_te: []
```

## How to add an entity

1. Open the right file under `catalogs/` (or add a new YAML + map it in `FILE_CATEGORY_MAP`).
2. Add a unique `id` within that category.
3. Fill `canonical`, aliases / misspellings / abbreviations.
4. Restart the API or call `reload()` so the index rebuilds.

```python
from app.services.ai.entity.dictionary import reload, resolve, resolve_in_message

reload()
print(resolve("paracetmol", categories=["Medicine"]))
print(resolve_in_message("need PCM and CBC", categories=["Medicine", "Laboratory"]))
```

## Validation rules

**Errors:** duplicate ids in a category; empty id/canonical; doctor `hospital_id` not in hospitals; non-bool `metadata.emergency`.

**Warnings:** duplicate aliases within the same category.

Startup: `AI_ENTITY_DICTIONARY_VALIDATE_ON_START=true` (default) soft-validates in FastAPI lifespan — never blocks boot.

## Search

| Mode | Behavior |
|------|----------|
| Exact / case-insensitive | Canonical + normalized |
| Alias / synonym / abbreviation / misspelling | Inverted index |
| Partial | Multi-word term containment |
| Fuzzy | `difflib` cutoff 0.86 |

## Performance

Seed catalogs are small (~200 entities). In-process inverted index is the primary cache.
`AI_ENTITY_DICTIONARY_REDIS_CACHE` is reserved (default off); Redis client is async so warm is a no-op marker today.

## PostgreSQL note

Dynamic doctors/hospitals remain SoT in PostgreSQL. Seed YAML proves schema only.
A future sync worker can upsert into these catalogs or a side index without changing extractors.

## Multilingual

`aliases_hi` / `aliases_te` are loaded and indexed when present; leave empty until localization expands them.

## Non-goals

- Workflow / tool execution, Memory, RAG, gateway cutover
- Admin CRUD UI or full PG doctor sync
