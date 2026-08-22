-- Live pharmacy master catalog (patient All Medicines + optional Express sync target).
-- Replaces OpenFDA for patient pharmacy browse/search.

CREATE TABLE IF NOT EXISTS pharmacy_master_catalog (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    brand           VARCHAR(255),
    salt            VARCHAR(255),
    category        VARCHAR(120) NOT NULL DEFAULT 'General',
    price           NUMERIC(10,2) NOT NULL,
    mrp             NUMERIC(10,2) NOT NULL,
    stock           INTEGER NOT NULL DEFAULT 0,
    requires_rx     BOOLEAN NOT NULL DEFAULT FALSE,
    image           TEXT,
    hsn_code        VARCHAR(32),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    external_id     VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_master_catalog_active_name
    ON pharmacy_master_catalog (is_active, lower(name));

CREATE INDEX IF NOT EXISTS idx_pharmacy_master_catalog_category
    ON pharmacy_master_catalog (category)
    WHERE is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacy_master_catalog_external
    ON pharmacy_master_catalog (external_id)
    WHERE external_id IS NOT NULL;

-- Seed only when empty so re-runs stay idempotent.
INSERT INTO pharmacy_master_catalog
    (name, brand, salt, category, price, mrp, stock, requires_rx)
SELECT * FROM (VALUES
    ('Dolo 650 Tablet', 'Micro Labs', 'Paracetamol 650mg', 'Fever & Pain', 30.00, 35.00, 200, FALSE),
    ('Crocin Advance Tablet', 'GSK', 'Paracetamol 500mg', 'Fever & Pain', 28.00, 32.00, 180, FALSE),
    ('Combiflam Tablet', 'Sanofi', 'Ibuprofen + Paracetamol', 'Fever & Pain', 45.00, 52.00, 150, FALSE),
    ('Calpol 650 Tablet', 'GSK', 'Paracetamol 650mg', 'Fever & Pain', 32.00, 38.00, 160, FALSE),
    ('Glycomet 500 Tablet', 'USV', 'Metformin 500mg', 'Diabetes', 22.00, 28.00, 120, TRUE),
    ('Janumet 50/500 Tablet', 'MSD', 'Sitagliptin + Metformin', 'Diabetes', 285.00, 320.00, 40, TRUE),
    ('Amlong 5 Tablet', 'Micro Labs', 'Amlodipine 5mg', 'Blood Pressure', 48.00, 55.00, 100, TRUE),
    ('Telma 40 Tablet', 'Glenmark', 'Telmisartan 40mg', 'Blood Pressure', 95.00, 110.00, 90, TRUE),
    ('Shelcal 500 Tablet', 'Torrent', 'Calcium + Vitamin D3', 'Vitamins & Supplements', 110.00, 130.00, 140, FALSE),
    ('Becosules Capsule', 'Pfizer', 'B-Complex + Vitamin C', 'Vitamins & Supplements', 42.00, 48.00, 200, FALSE),
    ('Limcee Tablet', 'Abbott', 'Vitamin C 500mg', 'Vitamins & Supplements', 24.00, 28.00, 220, FALSE),
    ('Pantocid 40 Tablet', 'Sun Pharma', 'Pantoprazole 40mg', 'Stomach Care', 85.00, 98.00, 130, TRUE),
    ('Digene Gel', 'Abbott', 'Antacid', 'Stomach Care', 115.00, 135.00, 80, FALSE),
    ('Omez 20 Capsule', 'Dr Reddy''s', 'Omeprazole 20mg', 'Stomach Care', 55.00, 65.00, 110, TRUE),
    ('Augmentin 625 Duo Tablet', 'GSK', 'Amoxicillin + Clavulanic Acid', 'General', 185.00, 210.00, 60, TRUE),
    ('Azithral 500 Tablet', 'Alembic', 'Azithromycin 500mg', 'General', 95.00, 110.00, 70, TRUE)
) AS v(name, brand, salt, category, price, mrp, stock, requires_rx)
WHERE NOT EXISTS (SELECT 1 FROM pharmacy_master_catalog LIMIT 1);
