# Migration verify script + ops status

This documents how MedClues confirms migrations **032** and **037**.

## Automatic path (preferred)

On FastAPI boot, [`fastapi_back/app/db/migration_runner.py`](../../fastapi_back/app/db/migration_runner.py) applies every pending `migrations/*.sql` (including `032_pharmacy_phase2` and `037_medical_knowledge_align`) and records versions in `schema_migrations`.

**Action:** Redeploy / restart the Render API once after these files are on `main`. Check logs for `Applying migration 032` / `037` or confirm they are already applied.

## Manual verify (Neon SQL editor)

```sql
SELECT version, applied_at
FROM schema_migrations
WHERE version IN (
  '032_pharmacy_phase2',
  '037_medical_knowledge_align'
)
ORDER BY version;

-- Column smoke checks
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pharmacy_orders'
  AND column_name IN ('is_sandbox', 'parent_order_id', 'refill_of_consultation_id');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'medical_knowledge'
  AND column_name IN ('keyword', 'immediate_action', 'do_not', 'source');
```

## Exit criteria

- Both versions present in `schema_migrations`, **or**
- Column smoke checks return the expected columns

If missing: run `psql $DATABASE_URL -f fastapi_back/migrations/032_pharmacy_phase2.sql` then `037_medical_knowledge_align.sql`, or restart API with DB access.
