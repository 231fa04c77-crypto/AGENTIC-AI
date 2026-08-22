-- =============================================================================
-- MEDCLUES Identity Phase 1 — Backfill + indexes (safe, additive)
-- Migration: 010_identity_backfill_indexes
-- Rules: no deletes, no renames, nullable columns first
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Optional user_id on lead-capture tables (backward compatible)
-- ---------------------------------------------------------------------------
ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE super_appointments
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Backfill job_applications.user_id from exact email match (case-insensitive)
UPDATE job_applications ja
SET user_id = u.id
FROM users u
WHERE ja.user_id IS NULL
  AND ja.email IS NOT NULL
  AND lower(trim(ja.email)) = lower(trim(u.email));

-- Backfill super_appointments.user_id from exact email match
UPDATE super_appointments sa
SET user_id = u.id
FROM users u
WHERE sa.user_id IS NULL
  AND sa.email IS NOT NULL
  AND lower(trim(sa.email)) = lower(trim(u.email));

-- ---------------------------------------------------------------------------
-- B) payment_transactions.user_id backfill (column already exists)
-- ---------------------------------------------------------------------------
UPDATE payment_transactions pt
SET user_id = (pt.booking_metadata->>'user_id')::integer
WHERE pt.user_id IS NULL
  AND jsonb_typeof(pt.booking_metadata->'user_id') IS NOT NULL
  AND (pt.booking_metadata->>'user_id') ~ '^[0-9]+$'
  AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (pt.booking_metadata->>'user_id')::integer
  );

UPDATE payment_transactions pt
SET user_id = a.user_id
FROM appointments a
WHERE pt.user_id IS NULL
  AND pt.appointment_id IS NOT NULL
  AND length(trim(pt.appointment_id)) > 0
  AND pt.appointment_id NOT LIKE 'pending_%'
  AND pt.appointment_id ~ '^[0-9]+$'
  AND a.id = pt.appointment_id::integer;

-- Rows with appointment_id pending_* stay user_id NULL until booking completes

-- ---------------------------------------------------------------------------
-- C) call_sessions — align patient_user_id with appointments.user_id
-- ---------------------------------------------------------------------------
UPDATE call_sessions cs
SET patient_user_id = a.user_id
FROM appointments a
WHERE cs.appointment_id = a.id
  AND cs.patient_user_id IS DISTINCT FROM a.user_id;

-- ---------------------------------------------------------------------------
-- D) Indexes (before NOT VALID FKs in 011)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id
    ON payment_transactions (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emergency_events_user_id
    ON emergency_events (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_bookings_user_id
    ON lab_bookings (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_applications_user_id
    ON job_applications (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_super_appointments_user_id
    ON super_appointments (user_id)
    WHERE user_id IS NOT NULL;

-- user_fcm_tokens index exists — add call_sessions patient index if missing
CREATE INDEX IF NOT EXISTS idx_call_sessions_patient_user_id
    ON call_sessions (patient_user_id)
    WHERE patient_user_id IS NOT NULL;
