ALTER TABLE hospital_tieups DROP COLUMN IF EXISTS maps_link;

DELETE FROM schema_migrations WHERE version = '016_hospital_maps_link';
