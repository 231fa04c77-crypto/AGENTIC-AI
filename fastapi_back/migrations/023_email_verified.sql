-- Track whether a user's email was verified via OTP (onboarding step 8).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
