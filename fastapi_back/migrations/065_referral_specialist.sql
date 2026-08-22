-- Specialist doctor referral workflow: notifications + REJECTED status.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS doctor_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_notifications_doctor_created
    ON notifications (doctor_id, created_at DESC) WHERE doctor_id IS NOT NULL;

ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check
    CHECK (status IN (
        'PENDING', 'ACCEPTED', 'REJECTED',
        'APPOINTMENT_BOOKED', 'SPECIALIST_CONSULTATION', 'COMPLETED'
    ));

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS specialist_appointment_id INTEGER;
