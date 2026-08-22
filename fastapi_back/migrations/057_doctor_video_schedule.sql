-- Flexible video consult schedule (mirror OPD capacity model).
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS video_op_start VARCHAR(10),
  ADD COLUMN IF NOT EXISTS video_op_end VARCHAR(10),
  ADD COLUMN IF NOT EXISTS max_video_slots INTEGER,
  ADD COLUMN IF NOT EXISTS video_slot_minutes INTEGER;

ALTER TABLE hospital_tieup_doctors
  ADD COLUMN IF NOT EXISTS video_op_start VARCHAR(10),
  ADD COLUMN IF NOT EXISTS video_op_end VARCHAR(10),
  ADD COLUMN IF NOT EXISTS max_video_slots INTEGER,
  ADD COLUMN IF NOT EXISTS video_slot_minutes INTEGER;

-- Sensible defaults for existing rows (previous fixed grid: 14:00, 4×15min).
UPDATE doctors
SET
  video_op_start = COALESCE(NULLIF(TRIM(video_op_start), ''), '14:00'),
  video_op_end = COALESCE(NULLIF(TRIM(video_op_end), ''), '15:00'),
  max_video_slots = COALESCE(max_video_slots, 4),
  video_slot_minutes = COALESCE(video_slot_minutes, 15)
WHERE video_op_start IS NULL
   OR video_op_end IS NULL
   OR max_video_slots IS NULL
   OR video_slot_minutes IS NULL;

UPDATE hospital_tieup_doctors
SET
  video_op_start = COALESCE(NULLIF(TRIM(video_op_start), ''), '14:00'),
  video_op_end = COALESCE(NULLIF(TRIM(video_op_end), ''), '15:00'),
  max_video_slots = COALESCE(max_video_slots, 4),
  video_slot_minutes = COALESCE(video_slot_minutes, 15)
WHERE video_op_start IS NULL
   OR video_op_end IS NULL
   OR max_video_slots IS NULL
   OR video_slot_minutes IS NULL;

COMMENT ON COLUMN doctors.max_video_slots IS 'Doctor-configured video consult slots per day';
COMMENT ON COLUMN doctors.video_slot_minutes IS 'Minutes per video consult slot';
