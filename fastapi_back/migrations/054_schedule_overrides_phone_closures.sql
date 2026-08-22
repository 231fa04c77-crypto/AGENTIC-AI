-- Per-day OP override fields + role-scoped unique phones.

-- 1) Enrich doctor_schedule_overrides for morning/afternoon half-days
ALTER TABLE doctor_schedule_overrides
    ADD COLUMN IF NOT EXISTS morning_start TIME,
    ADD COLUMN IF NOT EXISTS morning_end TIME,
    ADD COLUMN IF NOT EXISTS afternoon_start TIME,
    ADD COLUMN IF NOT EXISTS afternoon_end TIME,
    ADD COLUMN IF NOT EXISTS max_appointments_morning INTEGER,
    ADD COLUMN IF NOT EXISTS max_appointments_afternoon INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_schedule_override_date
    ON doctor_schedule_overrides (doctor_id, override_date);

-- 2) Doctor / dean phone columns (role-scoped uniqueness)
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE deans ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Digits-only unique among non-empty phones (cross-role reuse still allowed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone_digits
    ON users ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')))
    WHERE phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_receptionists_phone_digits
    ON receptionists ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')))
    WHERE phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_doctors_phone_digits
    ON doctors ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')))
    WHERE phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_deans_phone_digits
    ON deans ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')))
    WHERE phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') <> '';

-- 3) Hospital closed-day patient offers (notify + reschedule deadline)
CREATE TABLE IF NOT EXISTS hospital_closure_offers (
    id                  BIGSERIAL PRIMARY KEY,
    hospital_id         INTEGER NOT NULL,
    appointment_id      INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    closed_date         DATE NOT NULL,
    status              VARCHAR(24) NOT NULL DEFAULT 'offered'
                        CHECK (status IN ('offered', 'accepted', 'expired', 'cancelled')),
    deadline_at         TIMESTAMPTZ NOT NULL,
    notified_at         TIMESTAMPTZ DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (appointment_id, closed_date)
);

CREATE INDEX IF NOT EXISTS idx_closure_offers_deadline
    ON hospital_closure_offers (status, deadline_at);
