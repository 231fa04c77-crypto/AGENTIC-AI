-- =============================================================================
-- ROLLBACK: 011_identity_fk_not_valid
-- Drops NOT VALID / validated FK constraints from migration 011.
-- Run BEFORE rolling back 010 if you intend to drop user_id columns.
-- =============================================================================

ALTER TABLE super_appointments
    DROP CONSTRAINT IF EXISTS fk_super_appointments_user;

ALTER TABLE job_applications
    DROP CONSTRAINT IF EXISTS fk_job_applications_user;

ALTER TABLE call_sessions
    DROP CONSTRAINT IF EXISTS fk_call_sessions_appointment;

ALTER TABLE call_sessions
    DROP CONSTRAINT IF EXISTS fk_call_sessions_patient_user;

ALTER TABLE user_fcm_tokens
    DROP CONSTRAINT IF EXISTS fk_user_fcm_tokens_user;

ALTER TABLE emergency_events
    DROP CONSTRAINT IF EXISTS fk_emergency_events_user;

ALTER TABLE payment_transactions
    DROP CONSTRAINT IF EXISTS fk_payment_tx_user;

DELETE FROM schema_migrations WHERE version = '011_identity_fk_not_valid';
