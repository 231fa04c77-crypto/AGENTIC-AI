-- Pre-migration checks for 014 appointment lifecycle

SELECT 'appointments_without_doctor' AS check_name, COUNT(*) AS cnt
FROM appointments a
WHERE NOT EXISTS (SELECT 1 FROM doctors d WHERE d.id = a.doctor_id);

SELECT 'duplicate_active_per_user' AS check_name, user_id, COUNT(*) AS cnt
FROM appointments
WHERE cancelled = false
  AND is_completed = false
  AND COALESCE(status, 'pending') NOT IN ('cancelled', 'completed')
GROUP BY user_id
HAVING COUNT(*) > 5;
