-- MEDCLUES public_id columns, backfill, and sequence registry
-- Internal numeric PKs unchanged. No semicolons inside comments (migration runner).

CREATE TABLE IF NOT EXISTS public_id_sequences (
    scope       VARCHAR(32) PRIMARY KEY,
    last_value  BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);
ALTER TABLE deans ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);

UPDATE users u
SET public_id = 'PAT' || lpad(x.rn::text, 8, '0')
FROM (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM users
    WHERE public_id IS NULL
) x
WHERE u.id = x.id AND u.public_id IS NULL;

UPDATE doctors d
SET public_id = 'DOC' || lpad(x.rn::text, 8, '0')
FROM (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM doctors
    WHERE public_id IS NULL
) x
WHERE d.id = x.id AND d.public_id IS NULL;

UPDATE deans d
SET public_id = 'DEA' || lpad(x.rn::text, 8, '0')
FROM (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM deans
    WHERE public_id IS NULL
) x
WHERE d.id = x.id AND d.public_id IS NULL;

UPDATE admins a
SET public_id = 'ADM' || lpad(x.rn::text, 8, '0')
FROM (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM admins
    WHERE public_id IS NULL
) x
WHERE a.id = x.id AND a.public_id IS NULL;

UPDATE appointments a
SET public_id = 'APT' || y.yr::text || lpad(y.rn::text, 5, '0')
FROM (
    SELECT id,
           COALESCE(
               EXTRACT(YEAR FROM created_at)::int,
               EXTRACT(YEAR FROM to_timestamp(NULLIF(date, 0) / 1000.0))::int,
               EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int
           ) AS yr,
           row_number() OVER (
               PARTITION BY COALESCE(
                   EXTRACT(YEAR FROM created_at)::int,
                   EXTRACT(YEAR FROM to_timestamp(NULLIF(date, 0) / 1000.0))::int,
                   EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int
               )
               ORDER BY id
           ) AS rn
    FROM appointments
    WHERE public_id IS NULL
) y
WHERE a.id = y.id AND a.public_id IS NULL;

UPDATE payment_transactions p
SET public_id = 'PAY' || y.yr::text || lpad(y.rn::text, 5, '0')
FROM (
    SELECT id,
           COALESCE(EXTRACT(YEAR FROM created_at)::int, EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int) AS yr,
           row_number() OVER (
               PARTITION BY COALESCE(EXTRACT(YEAR FROM created_at)::int, EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int)
               ORDER BY id
           ) AS rn
    FROM payment_transactions
    WHERE public_id IS NULL
) y
WHERE p.id = y.id AND p.public_id IS NULL;

UPDATE health_records h
SET public_id = 'REC' || y.yr::text || lpad(y.rn::text, 5, '0')
FROM (
    SELECT id,
           COALESCE(
               EXTRACT(YEAR FROM record_date)::int,
               EXTRACT(YEAR FROM created_at)::int,
               EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int
           ) AS yr,
           row_number() OVER (
               PARTITION BY COALESCE(
                   EXTRACT(YEAR FROM record_date)::int,
                   EXTRACT(YEAR FROM created_at)::int,
                   EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::int
               )
               ORDER BY id
           ) AS rn
    FROM health_records
    WHERE public_id IS NULL
) y
WHERE h.id = y.id AND h.public_id IS NULL;

INSERT INTO public_id_sequences (scope, last_value)
SELECT 'PAT', COALESCE(MAX(CAST(substring(public_id FROM 4) AS BIGINT)), 0)
FROM users
WHERE public_id IS NOT NULL
ON CONFLICT (scope) DO UPDATE SET last_value = GREATEST(public_id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public_id_sequences (scope, last_value)
SELECT 'DOC', COALESCE(MAX(CAST(substring(public_id FROM 4) AS BIGINT)), 0)
FROM doctors
WHERE public_id IS NOT NULL
ON CONFLICT (scope) DO UPDATE SET last_value = GREATEST(public_id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public_id_sequences (scope, last_value)
SELECT 'DEA', COALESCE(MAX(CAST(substring(public_id FROM 4) AS BIGINT)), 0)
FROM deans
WHERE public_id IS NOT NULL
ON CONFLICT (scope) DO UPDATE SET last_value = GREATEST(public_id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public_id_sequences (scope, last_value)
SELECT 'ADM', COALESCE(MAX(CAST(substring(public_id FROM 4) AS BIGINT)), 0)
FROM admins
WHERE public_id IS NOT NULL
ON CONFLICT (scope) DO UPDATE SET last_value = GREATEST(public_id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public_id_sequences (scope, last_value)
SELECT 'APT' || yr::text, mx
FROM (
    SELECT
        CAST(substring(public_id FROM 4 FOR 4) AS INT) AS yr,
        MAX(CAST(substring(public_id FROM 8) AS BIGINT)) AS mx
    FROM appointments
    WHERE public_id IS NOT NULL AND length(public_id) >= 12
    GROUP BY 1
) s
ON CONFLICT (scope) DO UPDATE SET last_value = GREATEST(public_id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public_id_sequences (scope, last_value)
SELECT 'PAY' || yr::text, mx
FROM (
    SELECT
        CAST(substring(public_id FROM 4 FOR 4) AS INT) AS yr,
        MAX(CAST(substring(public_id FROM 8) AS BIGINT)) AS mx
    FROM payment_transactions
    WHERE public_id IS NOT NULL AND length(public_id) >= 12
    GROUP BY 1
) s
ON CONFLICT (scope) DO UPDATE SET last_value = GREATEST(public_id_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public_id_sequences (scope, last_value)
SELECT 'REC' || yr::text, mx
FROM (
    SELECT
        CAST(substring(public_id FROM 4 FOR 4) AS INT) AS yr,
        MAX(CAST(substring(public_id FROM 8) AS BIGINT)) AS mx
    FROM health_records
    WHERE public_id IS NOT NULL AND length(public_id) >= 12
    GROUP BY 1
) s
ON CONFLICT (scope) DO UPDATE SET last_value = GREATEST(public_id_sequences.last_value, EXCLUDED.last_value);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_public_id ON doctors (public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_deans_public_id ON deans (public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_public_id ON admins (public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_public_id ON appointments (public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_public_id ON payment_transactions (public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_records_public_id ON health_records (public_id) WHERE public_id IS NOT NULL;
