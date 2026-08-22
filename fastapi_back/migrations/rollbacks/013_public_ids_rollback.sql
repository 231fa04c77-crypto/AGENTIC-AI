-- Rollback 013_public_ids

DROP INDEX IF EXISTS idx_health_records_public_id;
DROP INDEX IF EXISTS idx_payment_transactions_public_id;
DROP INDEX IF EXISTS idx_appointments_public_id;
DROP INDEX IF EXISTS idx_admins_public_id;
DROP INDEX IF EXISTS idx_deans_public_id;
DROP INDEX IF EXISTS idx_doctors_public_id;
DROP INDEX IF EXISTS idx_users_public_id;

ALTER TABLE health_records DROP COLUMN IF EXISTS public_id;
ALTER TABLE payment_transactions DROP COLUMN IF EXISTS public_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS public_id;
ALTER TABLE admins DROP COLUMN IF EXISTS public_id;
ALTER TABLE deans DROP COLUMN IF EXISTS public_id;
ALTER TABLE doctors DROP COLUMN IF EXISTS public_id;
ALTER TABLE users DROP COLUMN IF EXISTS public_id;

DROP TABLE IF EXISTS public_id_sequences;

DELETE FROM schema_migrations WHERE version = '013_public_ids';
