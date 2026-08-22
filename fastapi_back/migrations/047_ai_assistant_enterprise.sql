-- 047: AI Assistant enterprise hardening — feedback + expanded knowledge
-- Additive only.

CREATE TABLE IF NOT EXISTS ai_assistant_feedback (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NULL,
    role            TEXT,
    session_id      TEXT,
    intent          TEXT,
    tool            TEXT,
    rating          SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
    comment         TEXT,
    query_hash      TEXT,
    grounded        BOOLEAN,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON ai_assistant_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON ai_assistant_feedback (rating);

CREATE TABLE IF NOT EXISTS ai_assistant_events (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NULL,
    role            TEXT,
    intent          TEXT,
    tool            TEXT,
    success         BOOLEAN,
    grounded        BOOLEAN,
    fallback        BOOLEAN,
    safety          TEXT,
    latency_ms      DOUBLE PRECISION,
    query_hash      TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_events_created ON ai_assistant_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_events_intent ON ai_assistant_events (intent);

-- FTS index for knowledge retrieval (safe if extension unavailable — ignore errors in runner)
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_fts
    ON ai_knowledge_chunks
    USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || coalesce(tags,'')));

INSERT INTO ai_knowledge_chunks (title, body, category, tags, source)
SELECT v.title, v.body, v.category, v.tags, 'seed'
FROM (VALUES
    ('Payments & bills', 'Open Payments or Payment History for consultation fees and pharmacy bills. Some accounts require advance online payment before booking.', 'payments', 'payment,bill,invoice,razorpay'),
    ('Prescriptions', 'After a consultation, prescriptions appear under Pharmacy → Prescriptions. Order from the mapped PharmaSync pharmacy.', 'pharmacy', 'prescription,rx'),
    ('Lab report status', 'Open Laboratory → My bookings to see preparation notes, booking status, and report availability.', 'laboratory', 'lab,report,cbc'),
    ('Reschedule policy', 'Ask the assistant to reschedule a paid appointment. Grace reschedule requests are reviewed by hospital reception.', 'appointments', 'reschedule,grace'),
    ('Video consultation', 'Video visits usually require online payment. Choose an online/video slot when booking.', 'appointments', 'video,online,teleconsult'),
    ('Queue token', 'Your token and live queue appear on today’s appointment card on Home and My Appointments.', 'appointments', 'queue,token'),
    ('Hospital search', 'Open Hospitals or ask the assistant to find a hospital. For emergencies, seek ER care immediately.', 'hospitals', 'hospital,emergency'),
    ('Doctor roles', 'Doctors can ask the assistant for today’s schedule and dashboard summary. Patients cannot see other patients’ data.', 'roles', 'doctor,schedule'),
    ('Dean analytics', 'Hospital admins use the Dean dashboard for departments, doctors, complaints, and analytics. The assistant can guide navigation.', 'roles', 'dean,admin,analytics'),
    ('Refunds', 'Refund eligibility depends on hospital cancellation policy and payment method. Open the appointment or contact support for status.', 'payments', 'refund,cancel')
) AS v(title, body, category, tags)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_chunks k WHERE k.title = v.title
);
