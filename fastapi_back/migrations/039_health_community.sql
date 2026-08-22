-- ============================================================
-- Migration 039: Health Community (Q&A knowledge base)
-- Additive only. Safe to re-run (IF NOT EXISTS).
-- ============================================================

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS community_questions (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           VARCHAR(32) UNIQUE NOT NULL,
    author_user_id      INTEGER NOT NULL REFERENCES users(id),
    title               VARCHAR(300) NOT NULL,
    body                TEXT NOT NULL,
    image_url           TEXT,
    specialty           VARCHAR(64) NOT NULL DEFAULT 'general',
    status              VARCHAR(32) NOT NULL DEFAULT 'new',
    moderation_status   VARCHAR(32) NOT NULL DEFAULT 'published',
    answer_count        INTEGER NOT NULL DEFAULT 0,
    view_count          INTEGER NOT NULL DEFAULT 0,
    bookmark_count      INTEGER NOT NULL DEFAULT 0,
    is_anonymous        BOOLEAN NOT NULL DEFAULT false,
    resolved_at         TIMESTAMPTZ,
    resolved_by_doctor_id INTEGER REFERENCES doctors(id),
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_q_status
    ON community_questions (status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_q_specialty
    ON community_questions (specialty, status, created_at DESC)
    WHERE deleted_at IS NULL AND moderation_status = 'published';

CREATE INDEX IF NOT EXISTS idx_community_q_author
    ON community_questions (author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_q_author_day
    ON community_questions (author_user_id, created_at);

DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_community_q_title_trgm
        ON community_questions USING gin (title gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS community_answers (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           VARCHAR(32) UNIQUE NOT NULL,
    question_id         BIGINT NOT NULL REFERENCES community_questions(id) ON DELETE CASCADE,
    parent_answer_id    BIGINT REFERENCES community_answers(id) ON DELETE CASCADE,
    author_role         VARCHAR(16) NOT NULL,
    author_user_id      INTEGER REFERENCES users(id),
    author_doctor_id    INTEGER REFERENCES doctors(id),
    body                TEXT NOT NULL,
    recommend_appointment BOOLEAN NOT NULL DEFAULT false,
    recommend_emergency   BOOLEAN NOT NULL DEFAULT false,
    is_accepted         BOOLEAN NOT NULL DEFAULT false,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_a_question
    ON community_answers (question_id, created_at ASC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_a_doctor
    ON community_answers (author_doctor_id, created_at DESC)
    WHERE deleted_at IS NULL AND author_role = 'doctor';

CREATE TABLE IF NOT EXISTS community_bookmarks (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id     BIGINT NOT NULL REFERENCES community_questions(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS community_reports (
    id              BIGSERIAL PRIMARY KEY,
    reporter_user_id INTEGER REFERENCES users(id),
    reporter_doctor_id INTEGER REFERENCES doctors(id),
    target_type     VARCHAR(16) NOT NULL,
    target_id       BIGINT NOT NULL,
    reason          VARCHAR(64) NOT NULL,
    details         TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_reports_status
    ON community_reports (status, created_at DESC);
