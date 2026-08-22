-- ============================================================
-- Migration 027: Phase 4 — Scale & Harden
-- PostGIS spatial indexing, read-replica routing comments,
-- and custom partner metadata schema enforcement.
-- ============================================================

-- ── 1. PostGIS extension (requires PostGIS installed on Neon / Postgres 15+) ──
-- Neon supports pgvector and PostGIS. Enable once on the primary DB.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 2. Add geometry columns to existing lat/lon tables ────────────────────────

-- Emergency cases: spatial point for fast nearby queries
ALTER TABLE emergency_cases
    ADD COLUMN IF NOT EXISTS location_geom GEOMETRY(Point, 4326);

-- Backfill existing rows
UPDATE emergency_cases
SET location_geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE location_geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Function to auto-sync lat/lon → geometry on INSERT/UPDATE
CREATE OR REPLACE FUNCTION sync_ec_geom()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.location_geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ec_geom ON emergency_cases;
CREATE TRIGGER trg_ec_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude ON emergency_cases
    FOR EACH ROW EXECUTE FUNCTION sync_ec_geom();

-- Spatial index (GIST) — ~10-100x faster than Haversine table scan
CREATE INDEX IF NOT EXISTS idx_ec_location_geom
    ON emergency_cases USING GIST (location_geom);

-- Ambulances: spatial location for live nearest-ambulance queries
ALTER TABLE ambulances
    ADD COLUMN IF NOT EXISTS location_geom GEOMETRY(Point, 4326);

UPDATE ambulances
SET location_geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE location_geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_amb_geom()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.location_geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_amb_geom ON ambulances;
CREATE TRIGGER trg_amb_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude ON ambulances
    FOR EACH ROW EXECUTE FUNCTION sync_amb_geom();

CREATE INDEX IF NOT EXISTS idx_amb_location_geom
    ON ambulances USING GIST (location_geom);

-- ── 3. Partner metadata schema validation ─────────────────────────────────────
-- Enforce custom metadata keys per partner_type using check constraints.
-- Example: IRCTC must supply pnr_number, TRANSPORT must supply trip_id.

CREATE TABLE IF NOT EXISTS partner_metadata_schemas (
    id              BIGSERIAL PRIMARY KEY,
    partner_type    VARCHAR(64) UNIQUE NOT NULL,
    required_keys   JSONB NOT NULL DEFAULT '[]',
    optional_keys   JSONB NOT NULL DEFAULT '[]',
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO partner_metadata_schemas (partner_type, required_keys, optional_keys, description)
VALUES
    ('TRANSPORT',      '["trip_id"]',     '["vehicle_type","driver_name","passengers"]', 'Uber/Rapido/SHAMS transport partners'),
    ('INFRASTRUCTURE', '["gate_id"]',     '["toll_plaza","location_code"]',             'FASTag/highway partners'),
    ('EDUCATION',      '["student_id"]',  '["hostel_block","room_number","guardian_phone"]', 'University/hostel partners'),
    ('GOVERNMENT',     '["district_id"]', '["scheme_id","citizen_id"]',                 'Government integration partners'),
    ('CORPORATE',      '["employee_id"]', '["department","building","floor"]',           'Corporate campus partners')
ON CONFLICT (partner_type) DO NOTHING;

-- ── 4. GPS pings pruning — keep last 24h per ambulance ────────────────────────
-- Run this as a cron job (via pg_cron extension or external scheduler):
--   DELETE FROM ambulance_gps_pings WHERE created_at < NOW() - INTERVAL '24 hours';

-- ── 5. Read-replica routing comment ──────────────────────────────────────────
-- In Phase 4, analytical queries (partner_api_logs, webhook_deliveries stats,
-- revenue aggregates) should be routed to a read replica.
-- Implementation: set DATABASE_REPLICA_URL env var and use a second db pool
-- in app/config/db.py with a `db_replica` object.
-- Tag heavy queries with: /* replica */ at the start of the SQL string.

-- ── 6. Webhook delivery cleanup ──────────────────────────────────────────────
-- Keep permanently_failed records for 90 days, then archive.
-- Schedule (pg_cron or external):
--   DELETE FROM webhook_deliveries
--   WHERE status = 'permanently_failed'
--     AND created_at < NOW() - INTERVAL '90 days';
