-- Query performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors (email);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments (user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments (doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_slot_date ON appointments (slot_date);
CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON health_records (user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_appointment_id ON consultations (appointment_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts (user_id);
