-- ============================================================
-- Migration 037: Align medical_knowledge with app queries
-- Additive only — preserves existing symptom / conditions / etc.
-- ============================================================

ALTER TABLE medical_knowledge
    ADD COLUMN IF NOT EXISTS keyword VARCHAR(255);

ALTER TABLE medical_knowledge
    ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE medical_knowledge
    ADD COLUMN IF NOT EXISTS source VARCHAR(255);

ALTER TABLE medical_knowledge
    ADD COLUMN IF NOT EXISTS immediate_action TEXT;

ALTER TABLE medical_knowledge
    ADD COLUMN IF NOT EXISTS do_not JSONB DEFAULT '[]'::jsonb;

ALTER TABLE medical_knowledge
    ADD COLUMN IF NOT EXISTS summary TEXT;

-- Backfill keyword from legacy symptom where missing (no data loss).
UPDATE medical_knowledge
SET keyword = symptom
WHERE keyword IS NULL AND symptom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_keyword
    ON medical_knowledge (keyword);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_category
    ON medical_knowledge (category)
    WHERE category IS NOT NULL;
