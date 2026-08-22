-- 044: Monthly partition helper for appointments_archive (cold store)
-- Hot appointments stays unpartitioned (Neon-friendly).
-- Ops may CONVERT archive to PARTITION BY RANGE (archived_at) offline.
-- This migration installs the helper and pre-creates children only when
-- the parent is already partitioned.

CREATE OR REPLACE FUNCTION ensure_appointments_archive_partition(p_month date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  start_ts timestamptz := date_trunc('month', p_month::timestamptz);
  end_ts timestamptz := start_ts + interval '1 month';
  part_name text := 'appointments_archive_' || to_char(start_ts, 'YYYYMM');
  is_partitioned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'appointments_archive'
      AND n.nspname = 'public'
  ) INTO is_partitioned;

  IF NOT COALESCE(is_partitioned, false) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF appointments_archive
     FOR VALUES FROM (%L) TO (%L)',
    part_name, start_ts, end_ts
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ensure_appointments_archive_partition(%): %', p_month, SQLERRM;
END;
$$;

-- Pre-create current + next 6 months when parent is partitioned
DO $$
DECLARE
  g int;
BEGIN
  FOR g IN 0..6 LOOP
    PERFORM ensure_appointments_archive_partition(
      (date_trunc('month', NOW()) + (g || ' month')::interval)::date
    );
  END LOOP;
END $$;
