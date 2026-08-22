-- ============================================================
-- Migration 034: Medicine information module (openFDA)
-- Search history, favorites, and popular/trending counters.
-- ============================================================

CREATE TABLE IF NOT EXISTS medicine_search_history (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL,
    query        VARCHAR(255) NOT NULL,
    result_count INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_search_history_user_created
    ON medicine_search_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medicine_search_history_query
    ON medicine_search_history (lower(query));

CREATE TABLE IF NOT EXISTS medicine_favorites (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    medicine_key    VARCHAR(255) NOT NULL,
    brand_name      VARCHAR(255),
    generic_name    VARCHAR(255),
    manufacturer    VARCHAR(255),
    dosage_form     VARCHAR(120),
    short_description TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, medicine_key)
);

CREATE INDEX IF NOT EXISTS idx_medicine_favorites_user
    ON medicine_favorites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS medicine_popular (
    query        VARCHAR(255) PRIMARY KEY,
    search_count BIGINT NOT NULL DEFAULT 1,
    last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_popular_count
    ON medicine_popular (search_count DESC, last_searched_at DESC);
