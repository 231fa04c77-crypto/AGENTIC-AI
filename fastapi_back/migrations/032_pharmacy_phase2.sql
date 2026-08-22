-- ============================================================
-- Migration 032: Pharmacy Phase 2 (ops depth)
-- ============================================================

ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS parent_order_id BIGINT REFERENCES pharmacy_orders(id);

ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS payment_transaction_id BIGINT;

ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS refill_of_consultation_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_parent
    ON pharmacy_orders (parent_order_id)
    WHERE parent_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_sandbox
    ON pharmacy_orders (partner_id, is_sandbox, created_at DESC);

CREATE TABLE IF NOT EXISTS pharmacy_availability_quotes (
    id               BIGSERIAL PRIMARY KEY,
    consultation_id  INTEGER NOT NULL,
    pharmacy_id      BIGINT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    partner_id       BIGINT NOT NULL REFERENCES partners(id),
    items            JSONB NOT NULL DEFAULT '[]'::jsonb,
    source           VARCHAR(32) NOT NULL DEFAULT 'probe',
    expires_at       TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_quotes_lookup
    ON pharmacy_availability_quotes (consultation_id, pharmacy_id, expires_at DESC);
