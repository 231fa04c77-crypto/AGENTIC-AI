-- Video call session state machine (patient request → doctor accept/reject)
CREATE TABLE IF NOT EXISTS call_sessions (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL,
    consultation_id INTEGER,
    patient_user_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    reject_reason VARCHAR(64),
    agora_channel VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_appointment ON call_sessions (appointment_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_doctor_status ON call_sessions (doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_patient ON call_sessions (patient_user_id, appointment_id);
