# Database Migration Report (M7)

**Date:** 2026-07-20  
**Scope:** Pharmacy phase-2 schema + `medical_knowledge` alignment  
**Policy:** Additive only — do not drop production columns or tables.

## Migration 032 — Pharmacy Phase 2 (required)

**File:** `fastapi_back/migrations/032_pharmacy_phase2.sql`

Must be applied for pharmacy ops depth (sandbox/refill/payment linkage and availability quotes):

| Change | Purpose |
|--------|---------|
| `pharmacy_orders.is_sandbox` | Sandbox vs live order isolation |
| `pharmacy_orders.parent_order_id` | Refill / child order linkage |
| `pharmacy_orders.payment_transaction_id` | Razorpay ledger link |
| `pharmacy_orders.refill_of_consultation_id` | Refill provenance |
| Indexes on parent + sandbox | Partner dashboard / list performance |
| Table `pharmacy_availability_quotes` | Price/availability probe cache |

**Action:** Confirm `032` is recorded in `schema_migrations` on every environment that runs pharmacy APIs. The migration runner applies pending files on backend startup.

## Migration 037 — `medical_knowledge` align

**File:** `fastapi_back/migrations/037_medical_knowledge_align.sql`

### Problem

Live / dump schema for `medical_knowledge` used legacy columns:

- `symptom`, `conditions` (JSONB), `severity`, `otc_medicines`, `precautions`, `when_to_see_doctor`

App code (`medical_model.py`) queried / inserted:

- `keyword`, `category`, `source`, `immediate_action`, `do_not` (plus shared fields)

That mismatch caused runtime SQL errors whenever AI medical search hit the empty table.

### Fix (additive)

037 **adds** nullable columns without removing `symptom` or other existing fields:

- `keyword`, `category`, `source`, `immediate_action`, `do_not` (JSONB), `summary`
- Backfills `keyword` from `symptom` where `keyword` is null
- Indexes on `keyword` and `category`

`medical_model.py` was updated to:

- Search both `keyword` and `symptom`
- Treat `conditions` as JSONB (`jsonb_array_elements_text`)
- Insert into both `keyword` and `symptom` for compatibility

### Data safety

- No `DROP COLUMN` / `DROP TABLE`
- Existing rows (if any) keep `symptom` and JSONB payload columns
- Empty production table remains empty until knowledge is seeded

## Related reference

- Baseline audit notes: `docs/backend/DB_AUDIT_REPORT.md` (§3 `medical_knowledge` BROKEN)
- Pharmacy outbound contracts: `docs/enterprise/PHARMACY_WEBHOOKS.md`
