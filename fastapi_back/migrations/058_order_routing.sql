-- Migration: 058_order_routing
-- Creates tables for doctor orders (investigations, referrals, followups), order lifecycle audit events, and AI-generated findings/alerts.

-- 1. Investigations Table
CREATE TABLE IF NOT EXISTS investigations (
    id              BIGSERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ordered_by      INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    hospital_id     INTEGER,                  
    test_name       VARCHAR(200) NOT NULL,
    priority        VARCHAR(20) NOT NULL DEFAULT 'ROUTINE'
                        CHECK (priority IN ('ROUTINE','URGENT','STAT')),
    status          VARCHAR(30) NOT NULL DEFAULT 'ORDERED'
                        CHECK (status IN (
                            'ORDERED','ACCEPTED','SAMPLE_COLLECTED',
                            'TEST_PERFORMED','REPORT_AVAILABLE','REVIEWED'
                        )),
    assigned_to     INTEGER,                  
    notes           TEXT,
    report_url      TEXT,                     
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    id              BIGSERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ordered_by      INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    hospital_id     INTEGER,
    from_dept       VARCHAR(120),
    to_dept         VARCHAR(120) NOT NULL,
    reason          TEXT NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                            'PENDING','ACCEPTED','APPOINTMENT_BOOKED',
                            'SPECIALIST_CONSULTATION','COMPLETED'
                        )),
    assigned_to     INTEGER,                  
    appointment_date TIMESTAMPTZ,            
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Followups Table
CREATE TABLE IF NOT EXISTS followups (
    id              BIGSERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ordered_by      INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    hospital_id     INTEGER,
    due_date        DATE NOT NULL,
    instructions    TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
                        CHECK (status IN (
                            'SCHEDULED','REMINDED','COMPLETED','OVERDUE'
                        )),
    assigned_to     INTEGER,                  
    reminded_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Order Events Table
CREATE TABLE IF NOT EXISTS order_events (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     VARCHAR(20) NOT NULL
                        CHECK (entity_type IN ('investigation','referral','followup')),
    entity_id       BIGINT NOT NULL,
    event_type      VARCHAR(60) NOT NULL,     
    actor_id        INTEGER,                  
    actor_role      VARCHAR(30),              
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AI Findings Table
CREATE TABLE IF NOT EXISTS order_findings (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     VARCHAR(20) NOT NULL
                        CHECK (entity_type IN ('investigation','referral','followup')),
    entity_id       BIGINT NOT NULL,
    patient_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT NOT NULL,            
    priority        VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                        CHECK (priority IN ('LOW','MEDIUM','HIGH')),
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
    assigned_role   VARCHAR(40) NOT NULL,     
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_investigations_patient   ON investigations (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigations_doctor    ON investigations (ordered_by, status);
CREATE INDEX IF NOT EXISTS idx_investigations_status    ON investigations (status) WHERE status NOT IN ('REVIEWED');

CREATE INDEX IF NOT EXISTS idx_referrals_patient        ON referrals (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_doctor         ON referrals (ordered_by, status);

CREATE INDEX IF NOT EXISTS idx_followups_patient        ON followups (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followups_due            ON followups (due_date) WHERE status NOT IN ('COMPLETED','OVERDUE');

CREATE INDEX IF NOT EXISTS idx_order_events_entity      ON order_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_findings_open      ON order_findings (status, assigned_role) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_order_findings_entity    ON order_findings (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_order_findings_patient   ON order_findings (patient_id, created_at DESC);
