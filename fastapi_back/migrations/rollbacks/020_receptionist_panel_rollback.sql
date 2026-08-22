-- Rollback for 020_receptionist_panel.sql

ALTER TABLE appointments DROP COLUMN IF EXISTS today_token;
ALTER TABLE appointments DROP COLUMN IF EXISTS arrived_at;
ALTER TABLE appointments DROP COLUMN IF EXISTS verification_notes;
ALTER TABLE appointments DROP COLUMN IF EXISTS verified_at;
ALTER TABLE appointments DROP COLUMN IF EXISTS verified_by;
ALTER TABLE appointments DROP COLUMN IF EXISTS reception_status;

ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_role_check;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_role_check
    CHECK (role IN ('patient', 'doctor', 'dean', 'admin'));

DROP TABLE IF EXISTS receptionists;
