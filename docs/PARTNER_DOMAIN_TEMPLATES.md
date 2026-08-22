# Phase 3 — Partner Domain Templates

MEDCLUES Enterprise Integrations supports multiple verticals on **one** partner platform (API keys, HMAC, scopes, webhooks, logs). Phase 3 adds **templates** for future domains — not full clinical MVPs.

Pharmacy (Phase 1–2) and Emergency remain the live implementations.

## Architecture rule

```
Partner ERP  ←HMAC→  MEDCLUES /api/v1/partner/{domain}/*
Patient APK  ←JWT→   MEDCLUES /api/user/...   (never talks to partner ERP)
```

No shared databases. New verticals = new `partner_type` + scopes + route module.

## Domain catalog

| Slug | partner_type | Status | Base path |
|------|--------------|--------|-----------|
| pharmacy | PHARMACY | live | `/api/v1/partner/pharmacy` |
| emergency | TRANSPORT (etc.) | live | `/api/partner/emergency` |
| lab | LAB | template | `/api/v1/partner/lab` |
| radiology | RADIOLOGY | template | `/api/v1/partner/radiology` |
| insurance | INSURANCE | template | `/api/v1/partner/insurance` |
| corporate-health | CORPORATE_HEALTH | template | `/api/v1/partner/corporate-health` |
| wearables | WEARABLES | template | `/api/v1/partner/wearables` |
| telemedicine | TELEMEDICINE | template | `/api/v1/partner/telemedicine` |
| home-healthcare | HOME_HEALTHCARE | template | `/api/v1/partner/home-healthcare` |

Source of truth: [`fastapi_back/app/services/partner_domain_registry.py`](fastapi_back/app/services/partner_domain_registry.py)

## Template endpoints (every template domain)

Auth: `X-Api-Key` + `X-Timestamp` + `X-Signature` + scopes for that domain.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/partner/{slug}/health` | Credential + scope smoke test |
| GET | `/api/v1/partner/{slug}/capabilities` | Contract discovery (events, planned APIs) |

Admin catalog (Super Admin JWT / `aToken`):

| Method | Path |
|--------|------|
| GET | `/api/admin/partner-domains/` |

## Super Admin onboarding

1. Enterprise Integrations → Register partner with type `LAB` / `RADIOLOGY` / …
2. Activate partner; issue sandbox key (scopes auto-default from registry)
3. Set webhook URL + rotate signing secret
4. Partner calls `GET .../health` and `GET .../capabilities`
5. When building a full MVP (like pharmacy): add tables, patient APIs, Dean mapping, Flutter surface — **keep the same partner row**

## Building the next live domain (e.g. Lab)

Follow the pharmacy pattern:

1. Migration for domain tables (`lab_orders`, hospital mapping, …)
2. `partner_lab_routes.py` operational APIs under `/api/v1/partner/lab/*`
3. Patient `/api/user/lab/*` + Flutter module
4. Dean hospital mapping (no API keys)
5. Webhooks: `lab.order.placed`, `lab.result.ready`, …
6. Mark domain `status: live` in `partner_domain_registry.py`

## Migration

- `033_partner_domain_templates.sql` — `partner_metadata_schemas` for new types

## Related

- [PHARMASYNC_INTEGRATION_PLATFORM.md](./PHARMASYNC_INTEGRATION_PLATFORM.md)
- [PHARMASYNC_README.md](./PHARMASYNC_README.md)
- [EMERGENCY_PARTNER_PLATFORM.md](./EMERGENCY_PARTNER_PLATFORM.md)
