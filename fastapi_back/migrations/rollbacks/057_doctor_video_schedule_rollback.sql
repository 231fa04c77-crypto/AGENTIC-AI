-- Rollback 057_doctor_video_schedule
ALTER TABLE doctors
  DROP COLUMN IF EXISTS video_op_start,
  DROP COLUMN IF EXISTS video_op_end,
  DROP COLUMN IF EXISTS max_video_slots,
  DROP COLUMN IF EXISTS video_slot_minutes;

ALTER TABLE hospital_tieup_doctors
  DROP COLUMN IF EXISTS video_op_start,
  DROP COLUMN IF EXISTS video_op_end,
  DROP COLUMN IF EXISTS max_video_slots,
  DROP COLUMN IF EXISTS video_slot_minutes;
