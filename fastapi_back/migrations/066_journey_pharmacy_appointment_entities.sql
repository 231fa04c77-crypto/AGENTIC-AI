-- Migration: 066_journey_pharmacy_appointment_entities.sql
-- Extend order_findings.entity_type for pharmacy and appointment coordination agents.

ALTER TABLE order_findings DROP CONSTRAINT IF EXISTS order_findings_entity_type_check;
ALTER TABLE order_findings ADD CONSTRAINT order_findings_entity_type_check
    CHECK (entity_type IN ('investigation', 'referral', 'followup', 'pharmacy', 'appointment'));

ALTER TABLE order_events DROP CONSTRAINT IF EXISTS order_events_entity_type_check;
ALTER TABLE order_events ADD CONSTRAINT order_events_entity_type_check
    CHECK (entity_type IN ('investigation', 'referral', 'followup', 'pharmacy', 'appointment'));
