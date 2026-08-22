DROP INDEX IF EXISTS idx_appointments_hospital_doctor_slot;
DROP INDEX IF EXISTS idx_appointments_valid_until;
DROP INDEX IF EXISTS idx_appointments_user_lifecycle;

ALTER TABLE appointments DROP COLUMN IF EXISTS completed_at;
ALTER TABLE appointments DROP COLUMN IF EXISTS checked_in_at;
ALTER TABLE appointments DROP COLUMN IF EXISTS closed_at;
ALTER TABLE appointments DROP COLUMN IF EXISTS paid_at_booking;
ALTER TABLE appointments DROP COLUMN IF EXISTS grace_extension_used;
ALTER TABLE appointments DROP COLUMN IF EXISTS followup_valid_until;
ALTER TABLE appointments DROP COLUMN IF EXISTS followup_visits_max;
ALTER TABLE appointments DROP COLUMN IF EXISTS followup_visits_used;
ALTER TABLE appointments DROP COLUMN IF EXISTS valid_until;
ALTER TABLE appointments DROP COLUMN IF EXISTS validity_days;
ALTER TABLE appointments DROP COLUMN IF EXISTS max_visits;
ALTER TABLE appointments DROP COLUMN IF EXISTS visit_count;
ALTER TABLE appointments DROP COLUMN IF EXISTS hospital_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS lifecycle_status_reason;
ALTER TABLE appointments DROP COLUMN IF EXISTS lifecycle_status;

DROP TABLE IF EXISTS hospital_appointment_policies;
