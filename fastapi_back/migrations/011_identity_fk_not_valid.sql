-- =============================================================================
-- MEDCLUES Identity Phase 1 — Foreign keys (NOT VALID)
-- Migration: 011_identity_fk_not_valid
-- Idempotent: DROP IF EXISTS then ADD (safe for migration_runner semicolon split)
-- =============================================================================

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS fk_payment_tx_user;
ALTER TABLE payment_transactions
    ADD CONSTRAINT fk_payment_tx_user
    FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;

ALTER TABLE emergency_events DROP CONSTRAINT IF EXISTS fk_emergency_events_user;
ALTER TABLE emergency_events
    ADD CONSTRAINT fk_emergency_events_user
    FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;

ALTER TABLE user_fcm_tokens DROP CONSTRAINT IF EXISTS fk_user_fcm_tokens_user;
ALTER TABLE user_fcm_tokens
    ADD CONSTRAINT fk_user_fcm_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS fk_call_sessions_patient_user;
ALTER TABLE call_sessions
    ADD CONSTRAINT fk_call_sessions_patient_user
    FOREIGN KEY (patient_user_id) REFERENCES users(id) NOT VALID;

ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS fk_call_sessions_appointment;
ALTER TABLE call_sessions
    ADD CONSTRAINT fk_call_sessions_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS fk_job_applications_user;
ALTER TABLE job_applications
    ADD CONSTRAINT fk_job_applications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE super_appointments DROP CONSTRAINT IF EXISTS fk_super_appointments_user;
ALTER TABLE super_appointments
    ADD CONSTRAINT fk_super_appointments_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
