-- Refresh token store (hashed tokens only — never store raw refresh JWTs)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    user_id         VARCHAR(128) NOT NULL,
    role            VARCHAR(32)  NOT NULL CHECK (role IN ('patient', 'doctor', 'dean', 'admin')),
    token_hash      VARCHAR(128) NOT NULL,
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    device_info     TEXT,
    ip_address      VARCHAR(45),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_role
    ON refresh_tokens (user_id, role)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
    ON refresh_tokens (expires_at)
    WHERE revoked_at IS NULL;
