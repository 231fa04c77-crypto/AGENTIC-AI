-- Rollback for 018_doctor_schedule.sql

ALTER TABLE doctors DROP COLUMN IF EXISTS op_start;
ALTER TABLE doctors DROP COLUMN IF EXISTS op_end;
ALTER TABLE doctors DROP COLUMN IF EXISTS available_days;
