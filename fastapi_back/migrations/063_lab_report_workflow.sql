-- Lab report workflow: acceptance, upload, publish, doctor review tracking.

ALTER TABLE investigations ADD COLUMN IF NOT EXISTS accepted_by INTEGER;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS published_by INTEGER;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS report_uploaded_at TIMESTAMPTZ;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS report_public_id TEXT;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS report_review_status VARCHAR(20) DEFAULT 'PENDING';
