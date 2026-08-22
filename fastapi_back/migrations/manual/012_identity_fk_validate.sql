-- =============================================================================
-- MEDCLUES Identity Phase 1 — VALIDATE foreign keys (manual step)
-- NOT auto-applied by migration_runner (lives in migrations/manual/).
--
-- Prerequisites:
--   1. 010_identity_backfill_indexes applied
--   2. 011_identity_fk_not_valid applied
--   3. validation/010_identity_preflight.sql shows 0 orphans
--
-- Run: psql $DATABASE_URL -f migrations/manual/012_identity_fk_validate.sql
-- =============================================================================

ALTER TABLE payment_transactions
    VALIDATE CONSTRAINT fk_payment_tx_user;

ALTER TABLE emergency_events
    VALIDATE CONSTRAINT fk_emergency_events_user;

ALTER TABLE user_fcm_tokens
    VALIDATE CONSTRAINT fk_user_fcm_tokens_user;

ALTER TABLE call_sessions
    VALIDATE CONSTRAINT fk_call_sessions_patient_user;

ALTER TABLE call_sessions
    VALIDATE CONSTRAINT fk_call_sessions_appointment;

ALTER TABLE job_applications
    VALIDATE CONSTRAINT fk_job_applications_user;

ALTER TABLE super_appointments
    VALIDATE CONSTRAINT fk_super_appointments_user;

-- Post-validate sanity
SELECT conname, convalidated
FROM pg_constraint
WHERE conname IN (
    'fk_payment_tx_user',
    'fk_emergency_events_user',
    'fk_user_fcm_tokens_user',
    'fk_call_sessions_patient_user',
    'fk_call_sessions_appointment',
    'fk_job_applications_user',
    'fk_super_appointments_user'
)
ORDER BY conname;
