# Step 4 — Database & Compliance (Completed)

## Migration framework

- `schema_migrations` table tracks applied versions
- `scripts/run_migrations.py` — manual apply
- Auto-run on API startup when DB connected
- See `migrations/README.md`

## Schema changes (backward compatible)

| Change | API impact |
|--------|------------|
| `audit_logs` table | None — write-only from server |
| Performance indexes | None |
| FK constraints (when data clean) | None |
| Drop `deans.password_text` | Admin list no longer returns plaintext passwords |
| Emergency contact update/delete ownership check | 403-style `success: false` if wrong owner |

## Audit logging (PHI)

Logged automatically (non-blocking):

- `health_record.view_url` — patient opens record URL
- `health_record.download` — patient downloads file
- `health_record.list_for_appointment` — doctor views patient records

Query: `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50;`

## Dean passwords

- New deans: bcrypt hash only
- Plaintext column dropped by migration `008`
- Admin UI (`DeanPortals.jsx`) may show "N/A" for password — reset via admin update password flow

## Post-deploy

1. Check startup logs for `SQL migrations applied: ...`
2. Check for `Skipping FK` warnings — run orphan cleanup if needed
3. Verify `password_text` gone: `\d deans` in psql
