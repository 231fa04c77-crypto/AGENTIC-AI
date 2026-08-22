-- Backfill appointments.hospital_id from doctors when missing.
UPDATE appointments a
SET hospital_id = d.hospital_id
FROM doctors d
WHERE a.doctor_id = d.id
  AND a.hospital_id IS NULL
  AND d.hospital_id IS NOT NULL;
