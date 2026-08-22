ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS actual_patient_phone VARCHAR(32);
