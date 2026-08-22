-- Migration: 059_followup_notes_reason
-- Align followups with investigations/referrals: free-text notes + structured reason label.

ALTER TABLE followups ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE followups ADD COLUMN IF NOT EXISTS reason TEXT;

UPDATE followups
SET reason = instructions
WHERE reason IS NULL AND instructions IS NOT NULL;
