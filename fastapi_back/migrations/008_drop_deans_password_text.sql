-- Remove plaintext dean passwords (bcrypt hash in password column remains)
ALTER TABLE deans DROP COLUMN IF EXISTS password_text;
