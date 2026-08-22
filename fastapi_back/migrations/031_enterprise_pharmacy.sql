-- ============================================================
-- Migration 031: Enterprise Integrations harden + Pharmacy MVP
-- Additive only. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ── Phase 0: Partner credential encryption columns ───────────

ALTER TABLE partner_api_keys
    ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;

ALTER TABLE partners
    ADD COLUMN IF NOT EXISTS webhook_signing_secret_encrypted TEXT;

ALTER TABLE partner_webhooks
    ADD COLUMN IF NOT EXISTS signing_secret_encrypted TEXT;

-- PHARMACY partner type metadata
INSERT INTO partner_metadata_schemas (partner_type, required_keys, optional_keys, description)
VALUES (
    'PHARMACY',
    '["hospital_id"]'::jsonb,
    '["branch_code","pharmacy_code","fulfillment_modes"]'::jsonb,
    'Pharmacy ERP partners (e.g. PharmaSync) — prescriptions and medicine orders'
)
ON CONFLICT (partner_type) DO NOTHING;

-- ── Phase 1: Structured prescription line items ──────────────

CREATE TABLE IF NOT EXISTS prescription_items (
    id               BIGSERIAL PRIMARY KEY,
    consultation_id  INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    dosage           VARCHAR(128),
    frequency        VARCHAR(128),
    duration         VARCHAR(128),
    quantity         NUMERIC(12, 2),
    instructions     TEXT,
    sku              VARCHAR(64),
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_consultation
    ON prescription_items (consultation_id);

-- ── Phase 1: Hospital ↔ pharmacy mapping ─────────────────────

CREATE TABLE IF NOT EXISTS pharmacies (
    id                 BIGSERIAL PRIMARY KEY,
    hospital_id        INTEGER NOT NULL REFERENCES hospital_tieups(id) ON DELETE CASCADE,
    partner_id         BIGINT NOT NULL REFERENCES partners(id),
    name               VARCHAR(255) NOT NULL,
    pharmacy_type      VARCHAR(32) NOT NULL DEFAULT 'main',
    supports_pickup    BOOLEAN NOT NULL DEFAULT true,
    supports_delivery  BOOLEAN NOT NULL DEFAULT false,
    hours              JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority           INTEGER NOT NULL DEFAULT 100,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_hospital
    ON pharmacies (hospital_id, is_active, priority);

CREATE INDEX IF NOT EXISTS idx_pharmacies_partner
    ON pharmacies (partner_id);

-- ── Phase 1: Pharmacy orders ─────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           VARCHAR(32) UNIQUE NOT NULL,
    patient_id          INTEGER NOT NULL REFERENCES users(id),
    hospital_id         INTEGER NOT NULL REFERENCES hospital_tieups(id),
    pharmacy_id         BIGINT NOT NULL REFERENCES pharmacies(id),
    partner_id          BIGINT NOT NULL REFERENCES partners(id),
    consultation_id     INTEGER REFERENCES consultations(id),
    status              VARCHAR(32) NOT NULL DEFAULT 'placed',
    fulfillment         VARCHAR(16) NOT NULL DEFAULT 'pickup',
    amount_subtotal     NUMERIC(12, 2),
    amount_tax          NUMERIC(12, 2),
    amount_total        NUMERIC(12, 2),
    currency            VARCHAR(8) NOT NULL DEFAULT 'INR',
    invoice_url         TEXT,
    partner_order_ref   VARCHAR(128),
    partner_request_id  VARCHAR(128),
    delivery_address    TEXT,
    notes               TEXT,
    bill_payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (partner_id, partner_request_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_patient
    ON pharmacy_orders (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_partner
    ON pharmacy_orders (partner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy
    ON pharmacy_orders (pharmacy_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pharmacy_order_items (
    id                    BIGSERIAL PRIMARY KEY,
    order_id              BIGINT NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    prescription_item_id  BIGINT REFERENCES prescription_items(id),
    name                  VARCHAR(255) NOT NULL,
    dosage                VARCHAR(128),
    quantity              NUMERIC(12, 2),
    unit_price            NUMERIC(12, 2),
    line_total            NUMERIC(12, 2),
    confirmed_quantity    NUMERIC(12, 2),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order
    ON pharmacy_order_items (order_id);

CREATE TABLE IF NOT EXISTS pharmacy_order_status_history (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    from_status VARCHAR(32),
    to_status   VARCHAR(32) NOT NULL,
    actor_role  VARCHAR(32),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_status_history_order
    ON pharmacy_order_status_history (order_id, created_at DESC);
