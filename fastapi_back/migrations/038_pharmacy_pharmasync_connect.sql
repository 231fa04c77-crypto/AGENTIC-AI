-- Migration 038: Pharmacy contact fields + PharmaSync connection ref
-- Additive only. Safe to re-run.

ALTER TABLE pharmacies
    ADD COLUMN IF NOT EXISTS manager_name     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email            VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone            VARCHAR(32),
    ADD COLUMN IF NOT EXISTS address          TEXT,
    ADD COLUMN IF NOT EXISTS license_number   VARCHAR(128),
    ADD COLUMN IF NOT EXISTS partner_pharmacy_ref VARCHAR(64),
    ADD COLUMN IF NOT EXISTS connection_status VARCHAR(32) NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_pharmacies_partner_ref
    ON pharmacies (partner_pharmacy_ref)
    WHERE partner_pharmacy_ref IS NOT NULL;
