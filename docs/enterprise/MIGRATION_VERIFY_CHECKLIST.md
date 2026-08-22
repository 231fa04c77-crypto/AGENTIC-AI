# Migration verify checklist (Neon / production)

Run against production Postgres (Neon) before relying on pharmacy orders or medical knowledge lookup.

## Required

| Migration | File | Purpose |
|-----------|------|---------|
| **032** | `fastapi_back/migrations/032_pharmacy_phase2.sql` | `is_sandbox`, refill columns, availability quotes |
| **037** | `fastapi_back/migrations/037_medical_knowledge_align.sql` | Additive `keyword` / action columns for medical_knowledge |

## Verify SQL (examples)

```sql
-- Pharmacy phase2 columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pharmacy_orders'
  AND column_name IN ('is_sandbox', 'parent_order_id', 'refill_of_consultation_id');

-- Medical knowledge align
SELECT column_name FROM information_schema.columns
WHERE table_name = 'medical_knowledge'
  AND column_name IN ('keyword', 'immediate_action', 'do_not', 'source');
```

## Apply

Use your usual migration runner (app startup auto-migrate if enabled, or `psql $DATABASE_URL -f ...`).

## Ops verification (local DB — 2026-07-20)

Ran `python scripts/verify_migrations_032_037.py` against configured `DATABASE_URL`:

- `032_pharmacy_phase2` — present; pharmacy columns OK
- `037_medical_knowledge_align` — **applied this session** via `run_pending_migrations()`; medical columns OK
- RESULT: **OK**

Production Render/Neon: restart API after deploy so migrator applies 037 if not already present.
