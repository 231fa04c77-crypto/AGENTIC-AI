-- Compliance audit trail (PHI access, admin actions)
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    BIGINT,
    actor_role  VARCHAR(32),
    action      VARCHAR(64) NOT NULL,
    resource    VARCHAR(128) NOT NULL,
    resource_id VARCHAR(64),
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_resource
    ON audit_logs (resource, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action_created
    ON audit_logs (action, created_at DESC);
