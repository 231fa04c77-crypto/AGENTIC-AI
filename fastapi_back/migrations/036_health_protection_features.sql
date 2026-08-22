-- ============================================================
-- Migration 036: Health Protection features (Phases 2–6)
-- ============================================================

CREATE TABLE IF NOT EXISTS hp_family_members (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL,
    relation         VARCHAR(40) NOT NULL,
    name             VARCHAR(120) NOT NULL,
    coverage_amount  NUMERIC(14,2) DEFAULT 0,
    status           VARCHAR(40) NOT NULL DEFAULT 'covered',
    renewal_date     DATE,
    medical_history  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_family_user ON hp_family_members(user_id);

CREATE TABLE IF NOT EXISTS hp_claims (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL,
    title                VARCHAR(255) NOT NULL DEFAULT 'Insurance claim',
    amount_claimed       NUMERIC(14,2) DEFAULT 0,
    amount_approved      NUMERIC(14,2),
    status               VARCHAR(40) NOT NULL DEFAULT 'draft',
    timeline             JSONB NOT NULL DEFAULT '[]'::jsonb,
    expected_settlement  DATE,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_claims_user ON hp_claims(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hp_claim_documents (
    id         BIGSERIAL PRIMARY KEY,
    claim_id   BIGINT NOT NULL REFERENCES hp_claims(id) ON DELETE CASCADE,
    doc_type   VARCHAR(40) NOT NULL,
    file_url   TEXT NOT NULL,
    public_id  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hp_policy_uploads (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL,
    file_url           TEXT NOT NULL,
    public_id          TEXT,
    file_name          VARCHAR(255),
    summary            JSONB NOT NULL DEFAULT '{}'::jsonb,
    plain_explanation  TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_policy_uploads_user ON hp_policy_uploads(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hp_expenses (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    category   VARCHAR(40) NOT NULL,
    amount     NUMERIC(14,2) NOT NULL,
    spent_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    note       TEXT,
    claim_id   BIGINT REFERENCES hp_claims(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_expenses_user ON hp_expenses(user_id, spent_at DESC);

CREATE TABLE IF NOT EXISTS hp_risk_scores (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL,
    level            VARCHAR(20) NOT NULL,
    score            INT NOT NULL,
    inputs           JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendations  JSONB NOT NULL DEFAULT '[]'::jsonb,
    computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_risk_user ON hp_risk_scores(user_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS hp_chat_messages (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    role       VARCHAR(20) NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hp_chat_user ON hp_chat_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hp_cashless_hospitals (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    address       TEXT,
    phone         VARCHAR(40),
    lat           DOUBLE PRECISION,
    lng           DOUBLE PRECISION,
    rating        NUMERIC(3,2) DEFAULT 4.0,
    open_now      BOOLEAN NOT NULL DEFAULT TRUE,
    emergency     BOOLEAN NOT NULL DEFAULT TRUE,
    insurer_tags  TEXT[] NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hp_notifications_log (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    type       VARCHAR(60) NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
