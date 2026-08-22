-- Migration: 060_order_findings_review
-- Human-in-the-loop review fields for AI coordination findings.
-- Does not duplicate investigations/referrals/followups — extends order_findings only.

ALTER TABLE order_findings
    ADD COLUMN IF NOT EXISTS finding_type VARCHAR(60);

ALTER TABLE order_findings
    ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE order_findings
    ADD COLUMN IF NOT EXISTS recommended_action TEXT;

ALTER TABLE order_findings
    ADD COLUMN IF NOT EXISTS review_decision VARCHAR(20)
        CHECK (review_decision IS NULL OR review_decision IN ('PENDING','APPROVED','REJECTED','MODIFIED'));

ALTER TABLE order_findings
    ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;

ALTER TABLE order_findings
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE order_findings
    ADD COLUMN IF NOT EXISTS resolution_note TEXT;

CREATE INDEX IF NOT EXISTS idx_order_findings_type_open
    ON order_findings (finding_type, entity_type, entity_id)
    WHERE status = 'OPEN';
