-- Doctor consultation scheduling: OP timings + available days.
-- Additive only (safe): adds nullable columns used by the doctor dashboard.

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS op_start VARCHAR(10);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS op_end VARCHAR(10);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS available_days JSONB;
