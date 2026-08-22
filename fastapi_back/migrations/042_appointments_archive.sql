-- 042: appointment archive table for growth / cold storage
CREATE TABLE IF NOT EXISTS appointments_archive (
    LIKE appointments INCLUDING DEFAULTS INCLUDING COMMENTS
);

ALTER TABLE appointments_archive
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_appointments_archive_slot_date
    ON appointments_archive (slot_date);

CREATE INDEX IF NOT EXISTS idx_appointments_archive_user
    ON appointments_archive (user_id);

CREATE INDEX IF NOT EXISTS idx_appointments_archive_doctor
    ON appointments_archive (doctor_id);

-- Hot-path index for archive candidate scans (completed/cancelled old rows)
CREATE INDEX IF NOT EXISTS idx_appointments_archive_candidates
    ON appointments (cancelled, is_completed, created_at)
    WHERE cancelled = true OR is_completed = true;
