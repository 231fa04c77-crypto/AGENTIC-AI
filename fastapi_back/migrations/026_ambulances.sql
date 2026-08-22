-- ============================================================
-- Migration 026: Ambulance Fleet & Dispatch
-- ============================================================

-- Registered ambulances
CREATE TABLE IF NOT EXISTS ambulances (
    id              BIGSERIAL PRIMARY KEY,
    vehicle_number  VARCHAR(32) UNIQUE NOT NULL,
    vehicle_type    VARCHAR(32) NOT NULL DEFAULT 'BLS',   -- BLS | ALS | MICU
    operator_name   VARCHAR(255),
    operator_phone  VARCHAR(20),
    hospital_id     INTEGER REFERENCES hospital_tieups(id),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    status          VARCHAR(32) NOT NULL DEFAULT 'available', -- available|busy|offline
    device_token    VARCHAR(128),   -- FCM token for push notifications
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ambulance JWT credentials (operator login)
CREATE TABLE IF NOT EXISTS ambulance_operators (
    id             BIGSERIAL PRIMARY KEY,
    ambulance_id   BIGINT NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
    username       VARCHAR(128) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link: which ambulance is assigned to which emergency case
CREATE TABLE IF NOT EXISTS ambulance_assignments (
    id              BIGSERIAL PRIMARY KEY,
    case_id         BIGINT NOT NULL REFERENCES emergency_cases(id),
    ambulance_id    BIGINT NOT NULL REFERENCES ambulances(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    distance_km     DOUBLE PRECISION,
    eta_minutes     INTEGER,
    UNIQUE (case_id)
);

-- Live GPS breadcrumb trail (pruned by age in Phase 4)
CREATE TABLE IF NOT EXISTS ambulance_gps_pings (
    id              BIGSERIAL PRIMARY KEY,
    ambulance_id    BIGINT NOT NULL REFERENCES ambulances(id),
    case_id         BIGINT REFERENCES emergency_cases(id),
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    speed_kmh       DOUBLE PRECISION,
    heading         DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_amb_status   ON ambulances (status);
CREATE INDEX IF NOT EXISTS idx_amb_hosp     ON ambulances (hospital_id);
CREATE INDEX IF NOT EXISTS idx_gps_amb      ON ambulance_gps_pings (ambulance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_case     ON ambulance_gps_pings (case_id, created_at DESC);
