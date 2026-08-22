-- Explicit booking channel for appointments:
--   ONLINE  = booked by the patient from the app
--   WALK_IN = booked at the reception desk
-- Backward-compatible: nullable column, with a best-effort backfill for old rows.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_source VARCHAR(16);

-- Reception walk-ins were created with slot_time = 'Walk-in'.
UPDATE appointments
SET appointment_source = 'WALK_IN'
WHERE appointment_source IS NULL
  AND slot_time IS NOT NULL
  AND lower(slot_time) IN ('walk-in', 'walkin');

-- Everything else predates the reception desk → treat as app (online) bookings.
UPDATE appointments
SET appointment_source = 'ONLINE'
WHERE appointment_source IS NULL;
