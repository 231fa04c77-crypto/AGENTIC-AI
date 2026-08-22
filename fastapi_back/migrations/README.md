# Database migrations

Numbered SQL files applied in order by `schema_migrations` tracking.

## Apply manually

```bash
cd fastapi_back
python scripts/run_migrations.py
```

Migrations also run automatically on API startup when PostgreSQL is connected.

## Files

| Version | Purpose |
|---------|---------|
| `001_refresh_tokens` | Refresh token store |
| `002_user_onboarding` | Onboarding columns on users |
| `003_payment_transactions` | Persistent Razorpay orders |
| `004_emergency_events` | Emergency SOS audit |
| `005_audit_logs` | PHI / compliance audit trail |
| `006_performance_indexes` | Query indexes |
| `007_foreign_keys` | FK hardening (via `schema_hardening.py`) |
| `008_drop_deans_password_text` | Remove plaintext dean passwords |
| `010_identity_backfill_indexes` | Identity backfill and indexes |
| `011_identity_fk_not_valid` | FK constraints (NOT VALID) |
| `013_public_ids` | Human-readable public IDs (`PAT`, `DOC`, `APT`, …) |
| `014_appointment_lifecycle` | Lifecycle status, hospital policies, visit validity |
| `015_appointment_lifecycle_extended` | Refunds, grace requests, trust score, visit log |
| `016_hospital_maps_link` | Google Maps share link on hospital tie-ups |

### Manual / validation (not auto-applied)

| Path | Purpose |
|------|---------|
| `manual/012_identity_fk_validate.sql` | Validate identity FKs after backfill |
| `validation/010_identity_preflight.sql` | Pre-migration orphan checks |
| `validation/014_appointment_lifecycle_preflight.sql` | Pre-flight checks for lifecycle migration |

## Rollbacks

Reverse-order SQL in `rollbacks/` — run only after backing up data:

| Rollback | Reverses |
|----------|----------|
| `013_public_ids_rollback.sql` | Public ID columns |
| `014_appointment_lifecycle_rollback.sql` | Lifecycle columns and policies |
| `015_appointment_lifecycle_extended_rollback.sql` | Refunds, trust, visit log |

## Runbooks

| Document | Topic |
|----------|-------|
| [PUBLIC_IDS_RUNBOOK.md](../../docs/migrations/PUBLIC_IDS_RUNBOOK.md) | Public ID allocation and verification |
| [IDENTITY_PHASE1_RUNBOOK.md](../../docs/migrations/IDENTITY_PHASE1_RUNBOOK.md) | Identity FK phase 1 |

## Foreign keys

`007` triggers `app/db/schema_hardening.py`, which adds FKs only when no orphan rows exist. Check server logs for skipped constraints.

`011` adds `NOT VALID` FKs; run `manual/012_identity_fk_validate.sql` when preflight checks pass.

## Appointment lifecycle (014–015)

After applying `014` and `015`:

- `appointments.lifecycle_status` — canonical state (`BOOKED`, `COMPLETED`, …)
- `hospital_appointment_policies` — per-hospital validity, follow-up, slot capacity
- `appointment_refunds` — cancellation refund workflow
- `appointment_grace_requests` — paid no-show reschedule requests
- `appointment_visit_log` — reception QR scan audit trail
- `users.trust_score` — patient trust and abuse prevention

Set in `fastapi_back/.env`:

```env
APPOINTMENT_LIFECYCLE_ENFORCED=true
TRUST_SCORE_ENFORCED=true
# Production (Render): true. Local DEBUG=true defaults off if unset.
AUTO_NO_SHOW_JOB=true
```
