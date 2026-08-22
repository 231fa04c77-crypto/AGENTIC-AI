-- MEDCLUES patient onboarding state (per user).
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Mark all existing accounts complete (run once on deploy).
UPDATE users SET
  onboarding_completed = TRUE,
  tutorial_completed = TRUE,
  emergency_contact_completed = TRUE,
  profile_completed = TRUE,
  onboarding_step = 8;
