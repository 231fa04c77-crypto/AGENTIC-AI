-- Audit log for emergency SOS activations and SMS alerts
CREATE TABLE IF NOT EXISTS emergency_events (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER,
    event_type      VARCHAR(64) NOT NULL,
    severity        VARCHAR(32),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    location_text   TEXT,
    symptoms        JSONB NOT NULL DEFAULT '[]'::jsonb,
    recipient_phone VARCHAR(20),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    source          VARCHAR(32),
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_events_user_created
    ON emergency_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_events_type_created
    ON emergency_events (event_type, created_at DESC);
