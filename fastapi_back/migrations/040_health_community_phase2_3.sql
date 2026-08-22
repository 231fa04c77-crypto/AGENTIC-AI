-- ============================================================
-- Migration 040: Health Community Phase 2–3
-- AI moderation logs, reputation, votes, Plus, FTS, archive
-- ============================================================

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Moderation decision logs
CREATE TABLE IF NOT EXISTS community_moderation_logs (
    id              BIGSERIAL PRIMARY KEY,
    target_type     VARCHAR(16) NOT NULL,
    target_id       BIGINT,
    author_user_id  INTEGER,
    decision        VARCHAR(32) NOT NULL,
    -- safe | suspicious | dangerous
    reasons         JSONB NOT NULL DEFAULT '[]'::jsonb,
    score           NUMERIC(6, 3) DEFAULT 0,
    engine          VARCHAR(32) NOT NULL DEFAULT 'rules',
    raw_excerpt     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_mod_logs_created
    ON community_moderation_logs (created_at DESC);

-- Community reputation (separate from booking trust_score)
CREATE TABLE IF NOT EXISTS community_reputation (
    id              BIGSERIAL PRIMARY KEY,
    subject_type    VARCHAR(16) NOT NULL,
    -- user | doctor
    subject_id      INTEGER NOT NULL,
    score           INTEGER NOT NULL DEFAULT 100,
    helpful_count   INTEGER NOT NULL DEFAULT 0,
    spam_flags      INTEGER NOT NULL DEFAULT 0,
    questions_asked INTEGER NOT NULL DEFAULT 0,
    answers_given   INTEGER NOT NULL DEFAULT 0,
    questions_resolved INTEGER NOT NULL DEFAULT 0,
    avg_response_seconds INTEGER,
    requires_moderation BOOLEAN NOT NULL DEFAULT false,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_community_rep_subject
    ON community_reputation (subject_type, subject_id);

-- Helpful votes on answers
CREATE TABLE IF NOT EXISTS community_answer_votes (
    id              BIGSERIAL PRIMARY KEY,
    answer_id       BIGINT NOT NULL REFERENCES community_answers(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value           SMALLINT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (answer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_votes_answer
    ON community_answer_votes (answer_id);

-- Community Plus entitlements
CREATE TABLE IF NOT EXISTS community_plus_subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan            VARCHAR(32) NOT NULL DEFAULT 'plus',
    daily_question_limit INTEGER NOT NULL DEFAULT 5,
    status          VARCHAR(16) NOT NULL DEFAULT 'active',
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

-- Question extras for FTS + archive
ALTER TABLE community_questions
    ADD COLUMN IF NOT EXISTS search_vector tsvector,
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS disease_keywords TEXT;

ALTER TABLE community_answers
    ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0;

-- Warnings / suspensions for community abuse
CREATE TABLE IF NOT EXISTS community_user_sanctions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sanction_type   VARCHAR(32) NOT NULL,
    -- warn | suspend | block
    reason          TEXT,
    issued_by_admin BOOLEAN NOT NULL DEFAULT true,
    issued_by_dean_id INTEGER,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_sanctions_user
    ON community_user_sanctions (user_id, created_at DESC);

-- FTS trigger
CREATE OR REPLACE FUNCTION community_questions_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.disease_keywords, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.specialty, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_questions_search ON community_questions;
CREATE TRIGGER trg_community_questions_search
    BEFORE INSERT OR UPDATE OF title, body, specialty, disease_keywords
    ON community_questions
    FOR EACH ROW EXECUTE PROCEDURE community_questions_search_vector_update();

CREATE INDEX IF NOT EXISTS idx_community_q_fts
    ON community_questions USING gin (search_vector);

CREATE INDEX IF NOT EXISTS idx_community_q_archived
    ON community_questions (archived_at)
    WHERE archived_at IS NOT NULL;

-- Backfill search vectors
UPDATE community_questions
SET search_vector =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(disease_keywords, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(specialty, '')), 'C')
WHERE search_vector IS NULL;
