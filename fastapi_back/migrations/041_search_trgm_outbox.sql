-- 041: search trigram indexes + notification outbox
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_name_trgm
    ON users USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_phone_trgm
    ON users USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm
    ON users USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_doctors_name_trgm
    ON doctors USING gin (name gin_trgm_ops);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doctors' AND column_name = 'speciality'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_doctors_speciality_trgm ON doctors USING gin ((COALESCE(speciality, '''')) gin_trgm_ops)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hospital_tieups_name_trgm
    ON hospital_tieups USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS notification_outbox (
    id              BIGSERIAL PRIMARY KEY,
    channel         VARCHAR(16) NOT NULL,
    recipient       VARCHAR(255) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempts        INT NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
    ON notification_outbox (status, next_retry_at)
    WHERE status IN ('pending', 'failed');
