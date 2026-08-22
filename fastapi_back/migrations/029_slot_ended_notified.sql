-- Track one-time "consultation slot ended" push notifications
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS slot_ended_notified BOOLEAN NOT NULL DEFAULT FALSE;
