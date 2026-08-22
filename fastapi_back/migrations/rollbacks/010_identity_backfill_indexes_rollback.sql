-- =============================================================================
-- ROLLBACK: 010_identity_backfill_indexes
-- Does NOT revert backfilled user_id values (data preserved).
-- Drops indexes + optional columns added in 010.
-- =============================================================================

DROP INDEX IF EXISTS idx_super_appointments_user_id;
DROP INDEX IF EXISTS idx_job_applications_user_id;
DROP INDEX IF EXISTS idx_lab_bookings_user_id;
DROP INDEX IF EXISTS idx_emergency_events_user_id;
DROP INDEX IF EXISTS idx_payment_transactions_user_id;
DROP INDEX IF EXISTS idx_call_sessions_patient_user_id;

-- Remove migration marker so 010 can be re-applied if needed
DELETE FROM schema_migrations WHERE version = '010_identity_backfill_indexes';

-- Optional columns (only if no dependent FK from 011 — drop 011 FKs first)
-- ALTER TABLE super_appointments DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE job_applications DROP COLUMN IF EXISTS user_id;
