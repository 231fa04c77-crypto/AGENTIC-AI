# MEDCLUES Public ID System — Runbook

Professional human-readable identifiers alongside unchanged internal numeric primary keys.

## Priority

Implemented **before Phase 4 (automated tests)** so tests can assert `publicId` fields on API responses.

## ID Formats

| Entity          | Column table              | Format example  | Scope key   |
|-----------------|---------------------------|-----------------|-------------|
| Patient         | `users.public_id`         | `PAT00000125`   | `PAT`       |
| Doctor          | `doctors.public_id`       | `DOC00000045`   | `DOC`       |
| Dean            | `deans.public_id`         | `DEA00000012`   | `DEA`       |
| Admin           | `admins.public_id`        | `ADM00000001`   | `ADM`       |
| Appointment     | `appointments.public_id`  | `APT202600001`  | `APT{year}` |
| Payment         | `payment_transactions.public_id` | `PAY202600001` | `PAY{year}` |
| Health record   | `health_records.public_id`| `REC202600001`  | `REC{year}` |

- Internal PKs (`id`) unchanged for FKs, JWT `id`/`userId`, and queries.
- `appointments.booking_id` (`BK…`) remains the QR/receipt scan code — separate from `public_id`.
- API exposes **`publicId`** (camelCase) in addition to numeric **`id`**.

---

## SECTION A — Files modified

### Database
- `migrations/013_public_ids.sql`
- `migrations/rollbacks/013_public_ids_rollback.sql`

### Backend
- `app/services/public_id_service.py` (new)
- `app/models/user_model.py`
- `app/models/doctor_model.py`
- `app/models/dean_model.py`
- `app/models/admin_model.py`
- `app/models/appointment_model.py`
- `app/models/payment_transaction_model.py`
- `app/models/health_record_model.py`
- `app/utils/formatters.py`
- `app/controllers/user_controller.py`
- `app/controllers/admin_controller.py`
- `app/controllers/doctor_controller.py`
- `app/services/telegram_notify_service.py`
- `app/services/telegram_messages.py`
- `app/services/email_templates.py`

### Admin panel
- `admin/src/pages/Admin/ManageUsers.jsx`
- `admin/src/pages/Admin/AllAppointments.jsx`
- `admin/src/utils/appointmentDisplay.js`

### Flutter
- `lib/models/user_model.dart`
- `lib/models/appointment_model.dart`
- `lib/providers/booking_state_provider.dart`
- `lib/screens/booking/booking_screen.dart`
- `lib/screens/booking/booking_receipt_screen.dart`
- `lib/screens/appointments/appointment_detail_screen.dart`
- `lib/utils/appointment_receipt_pdf.dart`

---

## SECTION B — Migration SQL

File: `migrations/013_public_ids.sql`

1. Creates `public_id_sequences(scope, last_value)` for atomic allocation.
2. Adds nullable `public_id VARCHAR(20)` to seven tables.
3. Backfills existing rows with deterministic row-number-based IDs per entity/year.
4. Seeds sequence counters from `MAX` of backfilled values.
5. Creates partial unique indexes (`WHERE public_id IS NOT NULL`).

Apply automatically on API startup via `migration_runner`, or manually:

```bash
cd fastapi_back
python -c "import asyncio; from app.db.migration_runner import run_pending_migrations; print(asyncio.run(run_pending_migrations()))"
```

---

## SECTION C — Backfill strategy

| Table | Rule |
|-------|------|
| `users` | `PAT` + zero-padded row number ordered by `id` |
| `doctors` | `DOC` + row number by `id` |
| `deans` | `DEA` + row number by `id` |
| `admins` | `ADM` + row number by `id` |
| `appointments` | `APT` + year (from `created_at` or `date` ms) + 5-digit sequence per year |
| `payment_transactions` | `PAY` + year from `created_at` + 5-digit sequence per year |
| `health_records` | `REC` + year from `record_date`/`created_at` + 5-digit sequence per year |

**New rows** after migration use `public_id_service._next_sequence()` (UPSERT on `public_id_sequences`) — no collisions with backfill when sequences are seeded from `MAX`.

Safe properties:
- No PK changes, no column renames, no deletes.
- Backfill only touches rows where `public_id IS NULL`.
- Idempotent re-run: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.

---

## SECTION D — Rollback SQL

File: `migrations/rollbacks/013_public_ids_rollback.sql`

1. Drops unique indexes on `public_id`.
2. Drops `public_id` columns from all seven tables.
3. Drops `public_id_sequences`.
4. Removes `schema_migrations` row for `013_public_ids`.

**Note:** Rollback removes public IDs from the database. Restore from backup if you need to preserve assigned IDs after rollback.

---

## SECTION E — API impact

| Area | Change |
|------|--------|
| All formatted entities | New optional field `publicId` alongside `id` |
| `POST /api/user/book-appointment` | Response adds `publicId` |
| `GET /api/user/appointments` | Each appointment includes `publicId` |
| Payment records (`row_to_payment_record`) | Adds `publicId` |
| Health records (`format_health_record`) | Adds `publicId` |
| Auth / JWT | **Unchanged** — still numeric `id` / `userId` |
| Route params | **Unchanged** — still accept numeric IDs |
| `bookingId` | **Unchanged** — still `BK…` for QR |

Backward compatible: clients that ignore `publicId` continue to work.

---

## SECTION F — Flutter impact

- `UserModel.publicId`, `AppointmentModel.publicId` parsed from API.
- Appointment detail shows **Appointment ID** (`publicId`) and **Booking ID** (`bookingId` for QR).
- Receipt PDF includes Appointment ID when present; QR still encodes `bookingId`.
- Booking draft stores `publicId` from book/payment success response.

No breaking changes to existing navigation or API calls.

---

## SECTION G — Testing checklist

### Database
- [ ] Migration `013_public_ids` applies cleanly on production copy
- [ ] No duplicate `public_id` values per table
- [ ] `public_id_sequences` last_value ≥ max backfilled suffix
- [ ] Rollback script tested on staging

### API
- [ ] New patient registration gets `PAT…` id
- [ ] New doctor/dean/admin gets correct prefix
- [ ] Book appointment returns `publicId` + `bookingId`
- [ ] Payment checkout creates `PAY…` id
- [ ] Health record upload creates `REC…` id
- [ ] `GET /api/admin/users` includes `publicId`
- [ ] Numeric `id` still works for all existing endpoints

### Integrations
- [ ] Confirmation email shows Appointment ID + Receipt/QR code
- [ ] Telegram booking message shows Appointment ID
- [ ] Cancel/rejection emails use `publicId`

### UI
- [ ] Admin Manage Users shows Patient ID column
- [ ] Admin appointment search matches `publicId` / `bookingId`
- [ ] Flutter appointment detail + PDF receipt show public ID

### Regression
- [ ] JWT login unchanged
- [ ] FK relationships unchanged
- [ ] QR scan at hospital still uses `booking_id`
