-- Persistent payment order / transaction store (replaces in-memory payment state)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id                  BIGSERIAL PRIMARY KEY,
    external_id         UUID NOT NULL DEFAULT gen_random_uuid(),
    razorpay_order_id   VARCHAR(64) NOT NULL,
    razorpay_payment_id VARCHAR(64),
    checkout_token      VARCHAR(64),
    user_id             INTEGER,
    doctor_id           VARCHAR(64),
    appointment_id      VARCHAR(64),
    status              VARCHAR(32) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    amount_paise        INTEGER NOT NULL,
    currency            VARCHAR(8) NOT NULL DEFAULT 'INR',
    doctor_name         TEXT,
    customer_name       TEXT,
    customer_email      TEXT,
    customer_phone      TEXT,
    booking_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at             TIMESTAMPTZ,
    CONSTRAINT uq_payment_razorpay_order UNIQUE (razorpay_order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_checkout_token
    ON payment_transactions (checkout_token)
    WHERE checkout_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_user_status
    ON payment_transactions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_status_created
    ON payment_transactions (status, created_at DESC);
