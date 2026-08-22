-- In-call chat messages between doctor and patient during a video consultation.

CREATE TABLE IF NOT EXISTS vc_messages (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL,
    sender_role VARCHAR(16) NOT NULL,
    sender_name VARCHAR(160),
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vc_messages_appt ON vc_messages (appointment_id, id);
