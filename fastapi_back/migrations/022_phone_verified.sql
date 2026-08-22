-- Track whether a user's phone number was verified via Firebase phone OTP.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
