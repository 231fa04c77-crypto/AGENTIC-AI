-- 045: Additive hot-path indexes (non-destructive)

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_slot_date
    ON appointments (doctor_id, slot_date)
    WHERE cancelled = false;

CREATE INDEX IF NOT EXISTS idx_appointments_lifecycle_status
    ON appointments (lifecycle_status)
    WHERE cancelled = false;

CREATE INDEX IF NOT EXISTS idx_doctors_hospital_available
    ON doctors (hospital_id, available);

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_hospital_tieups_name_trgm
    ON hospital_tieups USING gin (name gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'idx_hospital_tieups_name_trgm skipped: %', SQLERRM;
END $$;
