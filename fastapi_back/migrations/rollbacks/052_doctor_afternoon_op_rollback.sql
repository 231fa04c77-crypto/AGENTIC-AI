-- Rollback 052_doctor_afternoon_op.sql
ALTER TABLE doctors DROP COLUMN IF EXISTS op_start_afternoon;
ALTER TABLE doctors DROP COLUMN IF EXISTS op_end_afternoon;
ALTER TABLE doctors DROP COLUMN IF EXISTS max_appointments_morning;
ALTER TABLE doctors DROP COLUMN IF EXISTS max_appointments_afternoon;

ALTER TABLE hospital_tieup_doctors DROP COLUMN IF EXISTS op_start_afternoon;
ALTER TABLE hospital_tieup_doctors DROP COLUMN IF EXISTS op_end_afternoon;
ALTER TABLE hospital_tieup_doctors DROP COLUMN IF EXISTS max_appointments_morning;
ALTER TABLE hospital_tieup_doctors DROP COLUMN IF EXISTS max_appointments_afternoon;
