-- ============================================================
-- Migration 033: Phase 3 future partner domain templates
-- Additive metadata only — no clinical tables yet.
-- ============================================================

INSERT INTO partner_metadata_schemas (partner_type, required_keys, optional_keys, description)
VALUES
    (
        'LAB',
        '["hospital_id"]'::jsonb,
        '["lab_code","branch_code","test_catalog_version"]'::jsonb,
        'Laboratory LIS / diagnostic lab ERP partners'
    ),
    (
        'RADIOLOGY',
        '["hospital_id"]'::jsonb,
        '["modality","pacs_ref","center_code"]'::jsonb,
        'Radiology / imaging center partners'
    ),
    (
        'INSURANCE',
        '["payer_id"]'::jsonb,
        '["policy_prefix","tpa_code","claim_format"]'::jsonb,
        'Insurance / TPA claim and eligibility partners'
    ),
    (
        'CORPORATE_HEALTH',
        '["employer_id"]'::jsonb,
        '["campus","department","employee_id_field"]'::jsonb,
        'Corporate health / campus wellness partners'
    ),
    (
        'WEARABLES',
        '["device_vendor"]'::jsonb,
        '["data_types","oauth_client_id"]'::jsonb,
        'Wearable / remote vitals data partners'
    ),
    (
        'TELEMEDICINE',
        '["platform_id"]'::jsonb,
        '["specialty_map","callback_url"]'::jsonb,
        'External telemedicine platform partners'
    ),
    (
        'HOME_HEALTHCARE',
        '["provider_id"]'::jsonb,
        '["service_types","coverage_geo"]'::jsonb,
        'Home healthcare / nursing visit partners'
    )
ON CONFLICT (partner_type) DO NOTHING;
