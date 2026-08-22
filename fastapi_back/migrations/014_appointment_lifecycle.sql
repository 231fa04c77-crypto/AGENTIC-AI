-- Appointment lifecycle core columns and hospital policies
-- Backward compatible: legacy status column preserved

CREATE TABLE IF NOT EXISTS hospital_appointment_policies (
    id                      SERIAL PRIMARY KEY,
    hospital_id             INTEGER NOT NULL UNIQUE,
    validity_days           SMALLINT NOT NULL DEFAULT 7,
    max_visits              SMALLINT NOT NULL DEFAULT 3,
    followup_days           SMALLINT NOT NULL DEFAULT 7,
    followup_visits         SMALLINT NOT NULL DEFAULT 1,
    opd_slot_capacity       SMALLINT NOT NULL DEFAULT 20,
    video_slot_capacity     SMALLINT NOT NULL DEFAULT 4,
    platform_fee_percent    NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    grace_reschedule_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    no_show_auto_hours      SMALLINT NOT NULL DEFAULT 2,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'BOOKED';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS lifecycle_status_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS visit_count SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS max_visits SMALLINT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS validity_days SMALLINT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS followup_visits_used SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS followup_visits_max SMALLINT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS followup_valid_until TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS grace_extension_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_at_booking BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE appointments a
SET hospital_id = d.hospital_id
FROM doctors d
WHERE a.doctor_id = d.id
  AND a.hospital_id IS NULL
  AND d.hospital_id IS NOT NULL;

INSERT INTO hospital_appointment_policies (hospital_id)
SELECT DISTINCT d.hospital_id
FROM doctors d
WHERE d.hospital_id IS NOT NULL
ON CONFLICT (hospital_id) DO NOTHING;

INSERT INTO hospital_appointment_policies (hospital_id)
SELECT DISTINCT h.id
FROM hospital_tieups h
WHERE NOT EXISTS (
    SELECT 1 FROM hospital_appointment_policies p WHERE p.hospital_id = h.id
)
ON CONFLICT (hospital_id) DO NOTHING;

INSERT INTO hospital_appointment_policies (hospital_id)
SELECT DISTINCT h.id
FROM hospitals h
WHERE NOT EXISTS (
    SELECT 1 FROM hospital_appointment_policies p WHERE p.hospital_id = h.id
)
ON CONFLICT (hospital_id) DO NOTHING;

UPDATE appointments
SET lifecycle_status = 'CANCELLED'
WHERE cancelled = true AND lifecycle_status = 'BOOKED';

UPDATE appointments
SET lifecycle_status = 'COMPLETED',
    completed_at = COALESCE(completed_at, updated_at, created_at)
WHERE is_completed = true AND lifecycle_status NOT IN ('CANCELLED', 'CLOSED', 'EXPIRED');

UPDATE appointments
SET lifecycle_status = 'IN_PROGRESS'
WHERE LOWER(COALESCE(status, '')) = 'in-consult'
  AND lifecycle_status IN ('BOOKED', 'CONFIRMED');

UPDATE appointments
SET lifecycle_status = 'CONFIRMED'
WHERE LOWER(COALESCE(status, '')) = 'confirmed'
  AND lifecycle_status = 'BOOKED';

UPDATE appointments
SET paid_at_booking = true
WHERE COALESCE(payment, false) = true
   OR LOWER(COALESCE(payment_method, '')) IN ('razorpay', 'onlinepayment', 'online');

UPDATE appointments a
SET max_visits = COALESCE(a.max_visits, p.max_visits),
    validity_days = COALESCE(a.validity_days, p.validity_days),
    valid_until = COALESCE(
        a.valid_until,
        COALESCE(a.created_at, NOW()) + (COALESCE(p.validity_days, 7) || ' days')::interval
    )
FROM doctors d
LEFT JOIN hospital_appointment_policies p ON p.hospital_id = d.hospital_id
WHERE a.doctor_id = d.id
  AND (a.max_visits IS NULL OR a.valid_until IS NULL);

CREATE INDEX IF NOT EXISTS idx_appointments_user_lifecycle
    ON appointments (user_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_appointments_valid_until
    ON appointments (valid_until)
    WHERE lifecycle_status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW');

CREATE INDEX IF NOT EXISTS idx_appointments_hospital_doctor_slot
    ON appointments (hospital_id, doctor_id, slot_date, slot_time);
