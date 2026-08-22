ALTER TABLE hospital_tieups DROP COLUMN IF EXISTS background_image;

DELETE FROM schema_migrations WHERE version = '017_hospital_background_image';
