-- 043: Lab partner orders / results (HL7/FHIR-lite JSON payloads)
ALTER TABLE lab_bookings
    ADD COLUMN IF NOT EXISTS partner_id INTEGER,
    ADD COLUMN IF NOT EXISTS partner_order_ref VARCHAR(128),
    ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'BOOKED',
    ADD COLUMN IF NOT EXISTS result_payload JSONB,
    ADD COLUMN IF NOT EXISTS result_ready_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lab_id INTEGER,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_lab_bookings_partner
    ON lab_bookings (partner_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_lab_bookings_partner_ref
    ON lab_bookings (partner_order_ref)
    WHERE partner_order_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS lab_result_events (
    id              BIGSERIAL PRIMARY KEY,
    lab_booking_id  INTEGER NOT NULL REFERENCES lab_bookings(id) ON DELETE CASCADE,
    partner_id      INTEGER,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_result_events_booking
    ON lab_result_events (lab_booking_id, created_at DESC);
