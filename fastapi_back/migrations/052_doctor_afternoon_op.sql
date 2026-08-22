-- Doctor afternoon OP timings + per-session appointment caps.
-- Additive only (safe): used by doctor dashboard OP slot edits and slot generation.

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS op_start_afternoon VARCHAR(10);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS op_end_afternoon VARCHAR(10);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS max_appointments_morning INTEGER;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS max_appointments_afternoon INTEGER;

ALTER TABLE hospital_tieup_doctors ADD COLUMN IF NOT EXISTS op_start_afternoon VARCHAR(10);
ALTER TABLE hospital_tieup_doctors ADD COLUMN IF NOT EXISTS op_end_afternoon VARCHAR(10);
ALTER TABLE hospital_tieup_doctors ADD COLUMN IF NOT EXISTS max_appointments_morning INTEGER;
ALTER TABLE hospital_tieup_doctors ADD COLUMN IF NOT EXISTS max_appointments_afternoon INTEGER;

-- Soft defaults where still NULL (match formatter / slot-service fallbacks).
UPDATE doctors
SET op_start_afternoon = COALESCE(op_start_afternoon, '16:00'),
    op_end_afternoon = COALESCE(op_end_afternoon, '20:00')
WHERE op_start_afternoon IS NULL OR op_end_afternoon IS NULL;

UPDATE hospital_tieup_doctors
SET op_start_afternoon = COALESCE(op_start_afternoon, '16:00'),
    op_end_afternoon = COALESCE(op_end_afternoon, '20:00')
WHERE op_start_afternoon IS NULL OR op_end_afternoon IS NULL;
