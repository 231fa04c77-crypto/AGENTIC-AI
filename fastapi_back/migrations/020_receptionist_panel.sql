-- Receptionist panel: first-class receptionist role + reception desk columns.

CREATE TABLE IF NOT EXISTS receptionists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone VARCHAR(20),
    hospital_id INTEGER,
    public_id VARCHAR(40),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receptionists_hospital ON receptionists (hospital_id);

-- Allow receptionist refresh tokens.
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_role_check;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_role_check
    CHECK (role IN ('patient', 'doctor', 'dean', 'admin', 'receptionist'));

-- Reception desk sub-state on appointments (lifecycle_status remains canonical).
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reception_status VARCHAR(24);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS verified_by INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS today_token INTEGER;
