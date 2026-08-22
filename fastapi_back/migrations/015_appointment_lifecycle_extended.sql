-- Refunds, grace requests, visit log, trust score, consultation summary fields

CREATE TABLE IF NOT EXISTS appointment_refunds (
    id                      BIGSERIAL PRIMARY KEY,
    appointment_id          INTEGER NOT NULL,
    user_id                 INTEGER NOT NULL,
    payment_transaction_id  BIGINT,
    refund_amount_paise     INTEGER NOT NULL DEFAULT 0,
    platform_fee_paise      INTEGER NOT NULL DEFAULT 0,
    refund_reason           TEXT,
    refund_status           VARCHAR(24) NOT NULL DEFAULT 'PENDING'
        CHECK (refund_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
    is_first_refund         BOOLEAN NOT NULL DEFAULT FALSE,
    refund_processed_at     TIMESTAMPTZ,
    expected_by             DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_refunds_user
    ON appointment_refunds (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointment_refunds_status
    ON appointment_refunds (refund_status, created_at DESC);

CREATE TABLE IF NOT EXISTS appointment_grace_requests (
    id              BIGSERIAL PRIMARY KEY,
    appointment_id  INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    requested_date  DATE NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by     INTEGER,
    reviewed_role   VARCHAR(24),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grace_requests_status
    ON appointment_grace_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS appointment_visit_log (
    id              BIGSERIAL PRIMARY KEY,
    appointment_id  INTEGER NOT NULL,
    visit_number    SMALLINT NOT NULL,
    scanned_by_id   INTEGER,
    scanned_by_role VARCHAR(24),
    hospital_id     INTEGER,
    doctor_id       INTEGER,
    scan_method     VARCHAR(16) NOT NULL DEFAULT 'QR'
        CHECK (scan_method IN ('QR', 'MANUAL', 'ADMIN')),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_log_appointment
    ON appointment_visit_log (appointment_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score SMALLINT NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_bookings INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_visits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_no_shows INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_cancellations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS late_cancellations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refund_requests INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refunds_granted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_refund_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_restricted_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_level VARCHAR(24);

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS advice TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS followup_date DATE;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE users u
SET total_bookings = x.cnt
FROM (
    SELECT user_id, COUNT(*)::int AS cnt FROM appointments GROUP BY user_id
) x
WHERE u.id = x.user_id;

UPDATE users u
SET completed_visits = x.cnt
FROM (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM appointments
    WHERE is_completed = true OR lifecycle_status = 'COMPLETED'
    GROUP BY user_id
) x
WHERE u.id = x.user_id;

UPDATE users u
SET total_cancellations = x.cnt
FROM (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM appointments WHERE cancelled = true GROUP BY user_id
) x
WHERE u.id = x.user_id;

UPDATE users SET trust_level = 'NORMAL' WHERE trust_level IS NULL;
