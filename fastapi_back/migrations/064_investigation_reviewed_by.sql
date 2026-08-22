-- Track which doctor/staff marked an investigation report as reviewed.

ALTER TABLE investigations ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
