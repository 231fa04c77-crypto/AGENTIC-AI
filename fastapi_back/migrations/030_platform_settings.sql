-- Global Super Admin platform configuration (single-row)
CREATE TABLE IF NOT EXISTS platform_settings (
    id                       INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    system_name              VARCHAR(120) NOT NULL DEFAULT 'MedClues',
    email_notifications      BOOLEAN NOT NULL DEFAULT TRUE,
    maintenance_mode         BOOLEAN NOT NULL DEFAULT FALSE,
    audit_log_retention_days INT NOT NULL DEFAULT 30,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
