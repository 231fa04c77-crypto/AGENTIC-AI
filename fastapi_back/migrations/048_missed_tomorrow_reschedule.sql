-- Missed appointment → tomorrow-only patient reschedule → EOD auto-cancel
-- Adds MISSED workflow columns (lifecycle_status remains free VARCHAR)

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS missed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tomorrow_reschedule_deadline DATE,
    ADD COLUMN IF NOT EXISTS tomorrow_reschedule_offered BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tomorrow_reschedule_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_missed_deadline
    ON appointments (lifecycle_status, tomorrow_reschedule_deadline)
    WHERE lifecycle_status = 'MISSED';

COMMENT ON COLUMN appointments.missed_at IS 'When appointment was marked MISSED after slot/date passed';
COMMENT ON COLUMN appointments.tomorrow_reschedule_deadline IS 'IST calendar day: confirm tomorrow reschedule before end of this day or auto-cancel';
COMMENT ON COLUMN appointments.tomorrow_reschedule_offered IS 'Patient was offered tomorrow-only reschedule';
COMMENT ON COLUMN appointments.tomorrow_reschedule_confirmed_at IS 'When patient confirmed tomorrow reschedule';
