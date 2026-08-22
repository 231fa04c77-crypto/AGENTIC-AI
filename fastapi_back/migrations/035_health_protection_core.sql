-- ============================================================
-- Migration 035: Health Protection core (Phases 0–1)
-- ============================================================

CREATE TABLE IF NOT EXISTS hp_insurance_companies (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL UNIQUE,
    logo_url     TEXT,
    claim_ratio  NUMERIC(5,2) DEFAULT 90,
    rating       NUMERIC(3,2) DEFAULT 4.0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hp_insurance_plans (
    id                        BIGSERIAL PRIMARY KEY,
    company_id                BIGINT NOT NULL REFERENCES hp_insurance_companies(id) ON DELETE CASCADE,
    name                      VARCHAR(255) NOT NULL,
    monthly_premium           NUMERIC(12,2) NOT NULL DEFAULT 0,
    coverage_amount           NUMERIC(14,2) NOT NULL DEFAULT 0,
    cashless_hospitals_count  INT NOT NULL DEFAULT 0,
    waiting_period_days       INT NOT NULL DEFAULT 30,
    room_rent                 VARCHAR(120),
    maternity                 BOOLEAN NOT NULL DEFAULT FALSE,
    critical_illness          BOOLEAN NOT NULL DEFAULT FALSE,
    ped_waiting_days          INT NOT NULL DEFAULT 365,
    dental                    BOOLEAN NOT NULL DEFAULT FALSE,
    vision                    BOOLEAN NOT NULL DEFAULT FALSE,
    network_notes             TEXT,
    pros                      TEXT[],
    cons                      TEXT[],
    features                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_plans_company ON hp_insurance_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_hp_plans_premium ON hp_insurance_plans(monthly_premium);

CREATE TABLE IF NOT EXISTS hp_user_policies (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL,
    plan_id          BIGINT REFERENCES hp_insurance_plans(id) ON DELETE SET NULL,
    company_name     VARCHAR(200),
    policy_number    VARCHAR(120),
    coverage_amount  NUMERIC(14,2) DEFAULT 0,
    premium          NUMERIC(12,2) DEFAULT 0,
    status           VARCHAR(40) NOT NULL DEFAULT 'active',
    starts_at        DATE,
    expires_at       DATE,
    members_covered  INT NOT NULL DEFAULT 1,
    has_critical     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_user_policies_user ON hp_user_policies(user_id);

CREATE TABLE IF NOT EXISTS hp_health_scores (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL,
    score        INT NOT NULL CHECK (score >= 0 AND score <= 100),
    factors      JSONB NOT NULL DEFAULT '{}'::jsonb,
    suggestions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_health_scores_user ON hp_health_scores(user_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS hp_emergency_cards (
    user_id                   BIGINT PRIMARY KEY,
    photo_url                 TEXT,
    blood_group               VARCHAR(10),
    policy_number             VARCHAR(120),
    company                   VARCHAR(200),
    coverage                  VARCHAR(120),
    emergency_contact_name    VARCHAR(120),
    emergency_contact_phone   VARCHAR(40),
    qr_payload                TEXT,
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
