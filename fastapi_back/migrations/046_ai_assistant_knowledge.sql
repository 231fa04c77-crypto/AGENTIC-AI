-- 046: Enterprise AI Assistant — knowledge chunks + support tickets
-- Additive only.

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
    id              BIGSERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    category        TEXT,
    tags            TEXT,
    source          TEXT DEFAULT 'manual',
    hospital_id     BIGINT NULL,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_category ON ai_knowledge_chunks (category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_hospital ON ai_knowledge_chunks (hospital_id);

CREATE TABLE IF NOT EXISTS ai_support_tickets (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    role            TEXT DEFAULT 'patient',
    hospital_id     BIGINT NULL,
    subject         TEXT NOT NULL,
    body            TEXT,
    category        TEXT DEFAULT 'general',
    status          TEXT DEFAULT 'open',
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_tickets_user ON ai_support_tickets (user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tickets_status ON ai_support_tickets (status);

INSERT INTO ai_knowledge_chunks (title, body, category, tags, source)
SELECT v.title, v.body, v.category, v.tags, 'seed'
FROM (VALUES
    ('Book an appointment', 'Open Find Doctors, pick specialty and slot, then confirm booking. Pay at clinic or online if enabled.', 'appointments', 'book,slot,doctor'),
    ('Cancel appointment', 'Open appointment details and Cancel if the visit has not started. Policies may apply.', 'appointments', 'cancel'),
    ('Pharmacy & PharmaSync', 'After consultation open Pharmacy to order from the hospital mapped pharmacy. Track under Pharmacy Orders.', 'pharmacy', 'medicine,order,delivery'),
    ('Laboratory tests', 'Open Laboratory for tests such as CBC, preparation notes, prices, and booking slots.', 'laboratory', 'lab,cbc,report'),
    ('Medical Community', 'Search verified doctor answers. Not a personal diagnosis. Ask a new question or book the doctor.', 'community', 'forum,question'),
    ('Emergency guidance', 'For life-threatening symptoms seek emergency care immediately. MedClues helps find hospitals only.', 'safety', 'emergency,urgent'),
    ('Support tickets', 'Tell the AI Assistant your issue to open a ticket and receive a ticket ID for tracking.', 'support', 'complaint,ticket')
) AS v(title, body, category, tags)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_chunks k WHERE k.title = v.title
);
