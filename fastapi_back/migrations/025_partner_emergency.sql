-- ============================================================
-- Migration 025: Emergency Partner Platform Foundation
-- Safe, additive-only. No existing tables are modified.
-- ============================================================

-- 1. Partners registry
CREATE TABLE IF NOT EXISTS partners (
    id              BIGSERIAL PRIMARY KEY,
    public_id       VARCHAR(32) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    partner_type    VARCHAR(64) NOT NULL,
    contact_name    VARCHAR(255),
    email           VARCHAR(255),
    phone           VARCHAR(20),
    webhook_url     TEXT,
    allowed_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_apis    JSONB NOT NULL DEFAULT '[]'::jsonb,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    police_enabled  BOOLEAN NOT NULL DEFAULT false,
    rate_limit_rpm  INTEGER NOT NULL DEFAULT 60,
    ip_whitelist    JSONB NOT NULL DEFAULT '[]'::jsonb,
    billing_plan    VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- 2. Partner API keys (one partner can have multiple keys — sandbox + prod)
CREATE TABLE IF NOT EXISTS partner_api_keys (
    id            BIGSERIAL PRIMARY KEY,
    partner_id    BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    api_key       VARCHAR(64) UNIQUE NOT NULL,
    secret_hash   VARCHAR(255) NOT NULL,
    environment   VARCHAR(16) NOT NULL DEFAULT 'sandbox',
    expires_at    TIMESTAMPTZ,
    last_used_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Partner webhook configuration
CREATE TABLE IF NOT EXISTS partner_webhooks (
    id                   BIGSERIAL PRIMARY KEY,
    partner_id           BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    url                  TEXT NOT NULL,
    signing_secret_hash  VARCHAR(255) NOT NULL,
    events               JSONB NOT NULL DEFAULT '[]'::jsonb,
    retry_policy         JSONB NOT NULL DEFAULT '{"max_attempts": 5, "backoff_seconds": [60,300,1800,7200,86400]}'::jsonb,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Emergency cases (core table)
CREATE TABLE IF NOT EXISTS emergency_cases (
    id                      BIGSERIAL PRIMARY KEY,
    public_id               VARCHAR(32) UNIQUE NOT NULL,
    partner_id              BIGINT NOT NULL REFERENCES partners(id),
    partner_request_id      VARCHAR(128) NOT NULL,
    patient_name            VARCHAR(255) NOT NULL,
    patient_phone           VARCHAR(20) NOT NULL,
    user_id                 INTEGER REFERENCES users(id),
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    location_text           TEXT,
    emergency_type          VARCHAR(64) NOT NULL DEFAULT 'MEDICAL_EMERGENCY',
    additional_info         JSONB NOT NULL DEFAULT '{}'::jsonb,
    partner_metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    status                  VARCHAR(64) NOT NULL DEFAULT 'CREATED',
    hospital_id             INTEGER REFERENCES hospital_tieups(id),
    hospital_name           VARCHAR(255),
    hospital_address        TEXT,
    hospital_distance_km    DOUBLE PRECISION,
    assigned_ambulance_id   BIGINT,
    ambulance_eta_minutes   INTEGER,
    police_notified         BOOLEAN NOT NULL DEFAULT false,
    tracking_token          VARCHAR(128),
    tracking_url            TEXT,
    is_sandbox              BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    cancel_reason           TEXT,
    UNIQUE (partner_id, partner_request_id)
);

-- 5. Emergency status history (audit trail of every transition)
CREATE TABLE IF NOT EXISTS emergency_status_history (
    id          BIGSERIAL PRIMARY KEY,
    case_id     BIGINT NOT NULL REFERENCES emergency_cases(id) ON DELETE CASCADE,
    from_status VARCHAR(64),
    to_status   VARCHAR(64) NOT NULL,
    actor_id    BIGINT,
    actor_role  VARCHAR(32),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Hospital notifications (one row per hospital contacted per case)
CREATE TABLE IF NOT EXISTS hospital_notifications (
    id                BIGSERIAL PRIMARY KEY,
    case_id           BIGINT NOT NULL REFERENCES emergency_cases(id) ON DELETE CASCADE,
    hospital_id       INTEGER REFERENCES hospital_tieups(id),
    hospital_name     VARCHAR(255),
    hospital_phone    VARCHAR(50),
    status            VARCHAR(32) NOT NULL DEFAULT 'pending',
    contact_method    VARCHAR(32) NOT NULL DEFAULT 'dashboard',
    responded_at      TIMESTAMPTZ,
    rejection_reason  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Partner API request logs (for billing + debugging)
CREATE TABLE IF NOT EXISTS partner_api_logs (
    id            BIGSERIAL PRIMARY KEY,
    partner_id    BIGINT NOT NULL REFERENCES partners(id),
    case_id       BIGINT REFERENCES emergency_cases(id),
    endpoint      VARCHAR(255) NOT NULL,
    method        VARCHAR(8) NOT NULL,
    request_hash  VARCHAR(64),
    response_code INTEGER,
    latency_ms    INTEGER,
    error         TEXT,
    ip_address    VARCHAR(45),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Outbound webhook delivery tracking
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              BIGSERIAL PRIMARY KEY,
    partner_id      BIGINT NOT NULL REFERENCES partners(id),
    case_id         BIGINT REFERENCES emergency_cases(id),
    delivery_id     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at   TIMESTAMPTZ,
    response_code   INTEGER,
    response_body   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
-- emergency_cases: fast partner timeline queries
CREATE INDEX IF NOT EXISTS idx_ec_partner_created
    ON emergency_cases (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ec_status
    ON emergency_cases (status);

CREATE INDEX IF NOT EXISTS idx_ec_public_id
    ON emergency_cases (public_id);

-- emergency_status_history: fast case lookup
CREATE INDEX IF NOT EXISTS idx_esh_case_id
    ON emergency_status_history (case_id, created_at DESC);

-- hospital_notifications: fast case lookup
CREATE INDEX IF NOT EXISTS idx_hn_case_id
    ON hospital_notifications (case_id);

-- webhook_deliveries: find pending retries
CREATE INDEX IF NOT EXISTS idx_wd_pending
    ON webhook_deliveries (status, next_retry_at)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_wd_partner
    ON webhook_deliveries (partner_id, created_at DESC);

-- partner_api_keys: fast lookup by api_key string
CREATE INDEX IF NOT EXISTS idx_pak_api_key
    ON partner_api_keys (api_key)
    WHERE revoked_at IS NULL;
