-- =============================================================================
-- MEDCLUES Identity Phase 1 — PRE-FLIGHT VALIDATION (read-only)
-- Run BEFORE 010_identity_backfill_indexes.sql
-- All counts should be 0 before applying 011 NOT VALID FKs (nullable user_id OK).
-- =============================================================================

-- 1) users.id is primary key
SELECT
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'users'
  AND tc.constraint_type = 'PRIMARY KEY';

-- 2) Duplicate emails (should be 0 — users_email_key exists in production backup)
SELECT email, COUNT(*) AS cnt
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- 3) Orphan user_id references (must be 0 before FK validate)
SELECT 'appointments' AS tbl, COUNT(*) AS orphan_count
FROM appointments a
WHERE a.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id)
UNION ALL
SELECT 'health_records', COUNT(*)
FROM health_records hr
WHERE hr.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = hr.user_id)
UNION ALL
SELECT 'emergency_contacts', COUNT(*)
FROM emergency_contacts ec
WHERE ec.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ec.user_id)
UNION ALL
SELECT 'consultations', COUNT(*)
FROM consultations c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id)
UNION ALL
SELECT 'lab_bookings', COUNT(*)
FROM lab_bookings lb
WHERE lb.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = lb.user_id)
UNION ALL
SELECT 'saved_profiles', COUNT(*)
FROM saved_profiles sp
WHERE sp.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = sp.user_id)
UNION ALL
SELECT 'notifications', COUNT(*)
FROM notifications n
WHERE n.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = n.user_id)
UNION ALL
SELECT 'telegram_user_links', COUNT(*)
FROM telegram_user_links t
WHERE t.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)
UNION ALL
SELECT 'telegram_link_codes', COUNT(*)
FROM telegram_link_codes t
WHERE t.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)
UNION ALL
SELECT 'payment_transactions', COUNT(*)
FROM payment_transactions pt
WHERE pt.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pt.user_id)
UNION ALL
SELECT 'emergency_events', COUNT(*)
FROM emergency_events ee
WHERE ee.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ee.user_id)
UNION ALL
SELECT 'user_fcm_tokens', COUNT(*)
FROM user_fcm_tokens f
WHERE f.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id)
UNION ALL
SELECT 'call_sessions.patient_user_id', COUNT(*)
FROM call_sessions cs
WHERE cs.patient_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cs.patient_user_id)
UNION ALL
SELECT 'call_sessions.appointment_id', COUNT(*)
FROM call_sessions cs
WHERE cs.appointment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id = cs.appointment_id);

-- 4) Rows still missing user_id after backfill preview (informational)
SELECT 'payment_transactions null user_id' AS check_name, COUNT(*) AS cnt
FROM payment_transactions WHERE user_id IS NULL
UNION ALL
SELECT 'emergency_events null user_id', COUNT(*)
FROM emergency_events WHERE user_id IS NULL;

-- 5) call_sessions patient vs appointment mismatch (should be 0 after backfill)
SELECT cs.id, cs.appointment_id, cs.patient_user_id, a.user_id AS appointment_user_id
FROM call_sessions cs
JOIN appointments a ON a.id = cs.appointment_id
WHERE cs.patient_user_id IS DISTINCT FROM a.user_id
LIMIT 50;
