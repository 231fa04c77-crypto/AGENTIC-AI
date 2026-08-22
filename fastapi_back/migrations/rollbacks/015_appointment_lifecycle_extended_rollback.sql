ALTER TABLE consultations DROP COLUMN IF EXISTS attachments;
ALTER TABLE consultations DROP COLUMN IF EXISTS followup_date;
ALTER TABLE consultations DROP COLUMN IF EXISTS advice;
ALTER TABLE consultations DROP COLUMN IF EXISTS diagnosis;

ALTER TABLE users DROP COLUMN IF EXISTS trust_level;
ALTER TABLE users DROP COLUMN IF EXISTS booking_restricted_until;
ALTER TABLE users DROP COLUMN IF EXISTS first_refund_used;
ALTER TABLE users DROP COLUMN IF EXISTS refunds_granted;
ALTER TABLE users DROP COLUMN IF EXISTS refund_requests;
ALTER TABLE users DROP COLUMN IF EXISTS late_cancellations;
ALTER TABLE users DROP COLUMN IF EXISTS total_cancellations;
ALTER TABLE users DROP COLUMN IF EXISTS total_no_shows;
ALTER TABLE users DROP COLUMN IF EXISTS completed_visits;
ALTER TABLE users DROP COLUMN IF EXISTS total_bookings;
ALTER TABLE users DROP COLUMN IF EXISTS trust_score;

DROP TABLE IF EXISTS appointment_visit_log;
DROP TABLE IF EXISTS appointment_grace_requests;
DROP TABLE IF EXISTS appointment_refunds;
