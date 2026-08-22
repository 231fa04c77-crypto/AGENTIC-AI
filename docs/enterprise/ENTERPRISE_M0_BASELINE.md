# ENTERPRISE M0 — Baseline Freeze

**Date:** 2026-07-20  
**Git baseline:** `cd0992d` (`fix: polish booking UX, payment success, and notification badge`)  
**Scope:** `flutter_mobile/`, `admin/`, `fastapi_back/`

## Inventories

### FastAPI routers (from `main.py`)
health, link, admin, doctor, user, appointments, blood_bank, lab, hospital, health_records, emergency, ai, job_application, otp, specialty, location, dean, super_appointments, payments, charts, auth, reception, partner_emergency, partner_admin, dispatch, partner_dashboard (+ public), partner_pharmacy, user_pharmacy, dean_pharmacy, partner domain stubs, medicine, health_protection

### Appointment lifecycle (server)
`BOOKED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, (+ `FOLLOWUP_*`, `EXPIRED`, refund states) with dual-write to legacy `status`. Reception overlay: `VERIFIED` / `ARRIVED` / `READY_FOR_DOCTOR`.

### Pharmacy outbound events (registry)
`prescription.created|updated`, `order.placed|cancelled`, `payment.completed`, `availability.probe` — **no** `order.status.changed` at baseline.

### Known P0 inconsistencies (pre-remediation)
Brand MediChain+/MedClues split; deep-link `medichain://` vs `mediclues://`; reception `/reception-online` blank; doctor `?tab=` dead; trust UI vs `assert_can_book`; admin API fallbacks `:4000`; missing Flutter `assets/config.env`; medical_knowledge column risk; pharmacy needs migration 032.

## Baseline scores (estimate 0–100)

| Score | Value | Rationale |
|-------|------:|-----------|
| Enterprise readiness | 52 | Partner platform + lifecycle exist; contracts inconsistent |
| Production readiness | 58 | Live on Render/Vercel; config/docs drift |
| Scalability | 55 | Stateless API; capacity/queue knobs diverge |
| Security | 60 | JWT + partner HMAC; admin bypass + secret hygiene gaps |
| Code quality | 48 | Dual status systems, dead routes, brand debt |

## Exit
Baseline frozen. Proceed to M1 Branding.
