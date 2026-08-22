# MedClues — Database Audit & Cleanup Report

**Source:** live Neon PostgreSQL (`neondb`, production) — introspected directly
**Date:** 18 Jun 2026
**Method:** live `information_schema` introspection + row counts, cross-referenced against backend code in `fastapi_back/app`

> ⚠️ **The committed `fastapi_back/medclues_schema_before.sql` is a stale pre-migration snapshot.**
> The live DB has run migrations through #016 and now has **5 extra tables** and many extra
> columns not present in that file. This report is built from the **live database**, not the dump.
>
> Tables live but missing from the dump: `appointment_grace_requests`, `appointment_refunds`,
> `appointment_visit_log`, `hospital_appointment_policies`, `public_id_sequences` — plus a whole
> lifecycle / trust-score column set on `appointments` and `users`.

---

## 1. Executive summary

| Metric | Value |
|---|---|
| Total tables | **46** (8 `neon_auth` + 38 `public`) |
| Dead — no code references | **11** (8 `neon_auth.*` + 3 `public`) |
| Wired but empty (0 rows) | **9** |
| Active (referenced + has data) | **26** |
| Largest table | `doctor_slots` — 22,469 rows |

---

## 2. Dead tables — defined but never referenced in code

No `SELECT/INSERT/UPDATE` anywhere in the backend, 0 rows, **no inbound foreign keys**, no dependent views.

| Table | Schema | Rows | Why it's dead |
|---|---|---|---|
| `conversations` | public | 0 | Doctor–patient chat feature never wired up |
| `queue_settings` | public | 0 | Queue config superseded by per-doctor columns + `hospital_appointment_policies` |
| `notifications` | public | 0 | In-app notifications replaced by FCM push (`user_fcm_tokens`) + Telegram |

Plus all **8 `neon_auth.*`** tables (see §6) — a Neon Auth integration the FastAPI backend never calls.

---

## 3. Wired but empty — feature exists, no data yet

These have working models/controllers but 0 rows in production. **Do not drop** — the code actively
queries them, so dropping causes runtime 500s the moment the feature is used.

| Table | Rows | Status | Notes |
|---|---|---|---|
| `medical_knowledge` | 0 | **BROKEN** | Code queries columns `keyword/category/source/immediate_action/do_not` that **don't exist**; live table has `symptom/conditions/severity/otc_medicines/precautions/when_to_see_doctor` |
| `job_applications` | 0 | Idle | Full CRUD (careers form), no applicants |
| `lab_bookings` | 0 | Idle | Full CRUD, no bookings |
| `super_appointments` | 0 | Idle | Full CRUD, no data |
| `saved_profiles` | 0 | Idle | Family-member profiles, unused so far |
| `hospital_tieup_doctors` | 0 | Idle | Heavily referenced, but doctor data lives in `doctors` |
| `appointment_grace_requests` | 0 | New | Reschedule grace flow (lifecycle), no requests yet |
| `appointment_refunds` | 0 | New | Refund ledger (`refund_service`), no refunds yet |
| `appointment_visit_log` | 0 | New | QR-scan visit log, no scans yet |

---

## 4. Full public-schema inventory (active tables)

| Table | Rows | Used by | Purpose |
|---|---|---|---|
| `doctor_slots` | 22,469 | `doctor_slot_service` | Generated availability slots — by far the biggest table |
| `refresh_tokens` | 228 | auth | JWT refresh-token store (patient/doctor/dean/admin) |
| `appointments` | 48 | `appointment_model` | Core booking table (60+ columns, see §5) |
| `specialties` | 37 | `specialty_controller` | Specialty directory + helplines |
| `doctors` | 32 | `doctor_model` | Doctor accounts/profiles |
| `users` | 21 | `user_model` | Patient accounts (+ trust-score columns) |
| `call_sessions` | 17 | `call_session_model` | Video-call request/accept lifecycle (Agora) |
| `consultations` | 17 | `consultation_model` | Consultation notes/prescriptions |
| `audit_logs` | 16 | `audit_service` | Security/audit trail |
| `schema_migrations` | 16 | `migration_runner` | Applied migration versions |
| `user_fcm_tokens` | 15 | `fcm_token_model` | Push-notification device tokens |
| `emergency_contacts` | 14 | `user_controller` | Patient emergency contacts |
| `payment_transactions` | 12 | `payment_transaction_model` | Razorpay order/payment ledger |
| `deans` | 11 | `dean_model` | Hospital dean accounts |
| `hospital_tieups` | 11 | `hospital_model` | Partner hospitals (home/landing) |
| `hospitals` | 10 | `hospital_model` | Hospital login accounts |
| `hospital_appointment_policies` | 10 | `hospital_policy_model` | Per-hospital booking rules/capacity/fees |
| `public_id_sequences` | 7 | `public_id_service` | Counters for human-friendly public IDs |
| `health_records` | 7 | `health_record_model` | Patient documents/diagnoses |
| `appointment_reminder_sent` | 6 | `followup_service` | 24h reminder dedupe ledger |
| `blood_banks` | 5 | `blood_bank_model` | Blood-bank directory |
| `labs` | 5 | `lab_model` | Diagnostic-lab directory |
| `admins` | 1 | `admin_model` | Admin account(s) |
| `emergency_events` | 1 | `emergency_event_model` | SOS event log |
| `telegram_link_codes` | 1 | `telegram_model` | One-time Telegram link codes |
| `telegram_user_links` | 1 | `telegram_model` | Telegram chat ↔ user mapping |

---

## 5. Unused / legacy columns

Column-level scan of the heaviest tables. These columns exist in the live DB but are never
read or written by the backend.

**`appointments` — legacy columns, never referenced:**
- `upi_transaction_id`, `payer_vpa` — old UPI / pre-Razorpay payment fields, superseded by `payment_transactions`
- `recent_prescription` — never read/written
- `channel_name` — early video-call field, superseded by `call_sessions`

**Duplicated concepts:**
- `consultations` has both `follow_up_date` **and** `followup_date`, and both `notes`/`prescription`
  **and** `diagnosis`/`advice` — two generations of the same fields coexist.
- Video-call timing exists in `appointments` (`call_started_at`, `call_ended_at`, `call_duration`,
  `doctor_joined_at`) **and** in `call_sessions`. `call_sessions` is the active one.

> Column usage was checked by grepping each name across the backend. A flagged column is
> unread/unwritten in app code, but may still hold old data — confirm before dropping.

---

## 6. The entire `neon_auth` schema is unused

8 tables installed by Neon's managed auth (Better Auth). The FastAPI backend has its own
`users`/`doctors`/`deans`/`admins` auth and never touches this schema. All empty except
`project_config` (1 config row).

`account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, `verification`

> Do **not** `DROP SCHEMA neon_auth` manually — it can break the Neon dashboard's auth
> integration and may be recreated. If you want it gone, disable Neon Auth from the Neon console.

---

## 7. Cleanup — what's safe to delete

| Action | Tables | Errors? |
|---|---|---|
| ✅ Drop | `conversations`, `queue_settings`, `notifications` | **None** — no code refs, no inbound FKs, no views |
| ❌ Keep | all 9 "wired but empty" tables (§3) | Would cause 500s — code queries them despite being empty |
| ⚠️ Leave to Neon console | all `neon_auth.*` | Manual drop can break Neon Auth integration |

### Migration created

- `fastapi_back/migrations/018_drop_dead_tables.sql` — drops the 3 safe tables (idempotent `DROP TABLE IF EXISTS`)
- `fastapi_back/migrations/rollbacks/018_drop_dead_tables_rollback.sql` — recreates them if needed

The `migration_runner` auto-applies pending migrations on app startup and records the version in
`schema_migrations`, so #018 runs once on the next backend boot/deploy.

**Before running on production:** take a Neon branch/snapshot first (instant) for a guaranteed
rollback point beyond the SQL rollback file.

---

## 8. Side note — secrets

`fastapi_back/.env` contains live production secrets (DB URL, Razorpay, OpenAI, Gemini, WhatsApp,
Agora, Brevo, etc.). Confirm it is gitignored and rotate any keys that may have been committed.
