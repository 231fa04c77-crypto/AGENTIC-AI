-- Care-journey extras on investigations + doctor skip/treatment decisions.
-- Does not replace investigations / referrals / followups.

ALTER TABLE investigations ADD COLUMN IF NOT EXISTS result_summary TEXT;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS next_step VARCHAR(32);

CREATE TABLE IF NOT EXISTS care_decisions (
    patient_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    investigation_required BOOLEAN,
    referral_required BOOLEAN,
    specialist_required BOOLEAN,
    treatment_notes TEXT,
    decided_by INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
