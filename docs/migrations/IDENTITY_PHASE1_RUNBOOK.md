# MEDCLUES Identity — Phase 1 Runbook

**Scope:** Database backfill, indexes, NOT VALID foreign keys.  
**No application code changes in this phase.**

## Files

| File | Purpose |
|------|---------|
| `validation/010_identity_preflight.sql` | Read-only checks (run first) |
| `010_identity_backfill_indexes.sql` | Backfill + indexes (auto on API startup) |
| `011_identity_fk_not_valid.sql` | NOT VALID FKs (auto on API startup) |
| `manual/012_identity_fk_validate.sql` | **Manual** — VALIDATE CONSTRAINT after preflight is clean |
| `rollbacks/*.sql` | Rollback per step |

## Execution order

```bash
cd fastapi_back

# 1) Pre-flight (read-only)
psql "$DATABASE_URL" -f migrations/validation/010_identity_preflight.sql

# 2) Apply 010 + 011 (via API startup OR script)
python -c "
import asyncio
from app.config.db import db
from app.db.migration_runner import run_pending_migrations
async def main():
    await db.connect()
    print(await run_pending_migrations())
    await db.disconnect()
asyncio.run(main())
"

# 3) Re-run preflight — all orphan_count must be 0

# 4) Validate FKs (manual)
psql "$DATABASE_URL" -f migrations/manual/012_identity_fk_validate.sql
```

## Rollback order

1. `rollbacks/011_identity_fk_not_valid_rollback.sql`
2. `rollbacks/010_identity_backfill_indexes_rollback.sql`
3. If validated: `rollbacks/012_identity_fk_validate_rollback.sql` (drops + re-adds NOT VALID)

## What Phase 1 does NOT change

- Existing column names (`user_id`, `patient_user_id`, etc.)
- JWT / FastAPI auth (Phase 3)
- Ownership checks in controllers (Phase 2)
- Automated tests (Phase 4)

## Production backup

Confirm `medclues_backup_before_identity_fix.sql` is stored before running step 2.
