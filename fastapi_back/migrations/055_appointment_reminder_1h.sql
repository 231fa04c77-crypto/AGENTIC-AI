-- 1-hour appointment reminder tracking (alongside existing 24h column).
ALTER TABLE appointment_reminder_sent
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ;

-- Allow 24h column to be null so a 1h-only insert does not fake a 24h send.
ALTER TABLE appointment_reminder_sent
  ALTER COLUMN reminder_24h_sent_at DROP NOT NULL;

COMMENT ON COLUMN appointment_reminder_sent.reminder_1h_sent_at
  IS 'When 1-hour-before appointment reminder was sent';
