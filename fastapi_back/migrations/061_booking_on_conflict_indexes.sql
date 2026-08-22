-- Fix Pay-on-Visit booking upserts: ON CONFLICT needs a unique index.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'doctor_slots'
    ) THEN
        ALTER TABLE doctor_slots ALTER COLUMN slot_code TYPE VARCHAR(80);

        DELETE FROM doctor_slots a
        USING doctor_slots b
        WHERE a.id > b.id
          AND a.slot_code IS NOT NULL
          AND a.slot_code = b.slot_code;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_slots_slot_code_unique
            ON doctor_slots (slot_code);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'public_id_sequences'
    ) THEN
        DELETE FROM public_id_sequences a
        USING public_id_sequences b
        WHERE a.ctid > b.ctid
          AND a.scope = b.scope;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_public_id_sequences_scope
            ON public_id_sequences (scope);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'hospital_appointment_policies'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_appointment_policies_hospital
            ON hospital_appointment_policies (hospital_id);
    END IF;
END $$;
