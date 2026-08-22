# MEDCLUES — Production Remediation & Implementation Plan

**Document type:** Master implementation plan (single source of truth)  
**Project:** MEDCLUES Healthcare SaaS Platform  
**Version:** 1.0  
**Date:** 2026-06-08  
**Status:** AWAITING APPROVAL — No changes executed yet  
**Audience:** Engineering, Database, Security, DevOps, Product, Compliance, Leadership  

---

## Document Control

| Field | Value |
|-------|-------|
| Prepared by | Senior Architecture / DB / Security / DevOps audit synthesis |
| Applies to | `fastapi_back/`, `frontend/`, `admin/`, `flutter_mobile/`, `mobile/`, infra |
| Current verdict | **MVP READY** (single server) — **NOT PRODUCTION READY** for healthcare SaaS |
| Target verdict | **PRODUCTION READY** for multi-hospital SaaS at 10,000+ users |
| Estimated program duration | 16–20 weeks (4–5 months) with dedicated team |
| Estimated effort | 1,400–1,800 engineering hours (see Section 12) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)  
2. [Program Governance & Roles](#2-program-governance--roles)  
3. [Current State Assessment](#3-current-state-assessment)  
4. [Target Architecture](#4-target-architecture)  
5. [Master Issue Registry (All Levels)](#5-master-issue-registry-all-levels)  
6. [Phase 0 — Emergency Stabilization (Week 0–1)](#6-phase-0--emergency-stabilization-week-01)  
7. [Phase 1 — Security & Secrets (Week 1–3)](#7-phase-1--security--secrets-week-13)  
8. [Phase 2 — Database Remediation (Week 2–6)](#8-phase-2--database-remediation-week-26)  
9. [Phase 3 — Backend Hardening (Week 4–8)](#9-phase-3--backend-hardening-week-48)  
10. [Phase 4 — Client Unification (Week 6–10)](#10-phase-4--client-unification-week-610)  
11. [Phase 5 — Flutter Production Release (Week 8–11)](#11-phase-5--flutter-production-release-week-811)  
12. [Phase 6 — Scalability & Infrastructure (Week 8–14)](#12-phase-6--scalability--infrastructure-week-814)  
13. [Phase 7 — Observability & DevOps (Week 10–14)](#13-phase-7--observability--devops-week-1014)  
14. [Phase 8 — Healthcare Compliance (Week 12–16)](#14-phase-8--healthcare-compliance-week-1216)  
15. [Phase 9 — Cleanup & Technical Debt (Week 14–18)](#15-phase-9--cleanup--technical-debt-week-1418)  
16. [Phase 10 — Production Launch (Week 18–20)](#16-phase-10--production-launch-week-1820)  
17. [Database Migration Playbook](#17-database-migration-playbook)  
18. [API Consolidation Plan](#18-api-consolidation-plan)  
19. [Risk Register](#19-risk-register)  
20. [Testing Strategy](#20-testing-strategy)  
21. [Rollback & Incident Response](#21-rollback--incident-response)  
22. [Success Criteria & KPIs](#22-success-criteria--kpis)  
23. [Resource Plan (HR / Project Head)](#23-resource-plan-hr--project-head)  
24. [Appendix A — Safe Delete Manifest](#24-appendix-a--safe-delete-manifest)  
25. [Appendix B — Do-Not-Touch List](#25-appendix-b--do-not-touch-list)  
26. [Appendix C — Environment Variable Matrix](#26-appendix-c--environment-variable-matrix)  
27. [Appendix D — Issue ID Cross-Reference](#27-appendix-d--issue-id-cross-reference)  

---

## 1. Executive Summary

MEDCLUES is a **multi-client healthcare monorepo** (FastAPI backend, patient web, admin/dean/doctor portal, Flutter mobile, legacy Expo mobile) with **working core flows** but **critical gaps** preventing production deployment as a healthcare SaaS product.

### What works today
- Patient registration, login, doctor discovery, appointment booking
- Razorpay payments (Flutter modern path; web legacy path)
- Agora video consultation (patient + doctor)
- Admin, dean, and doctor portals with queue management
- PostgreSQL as primary datastore (asyncpg, not ORM)
- Flutter architecture (Riverpod, repositories, go_router)

### What blocks production
| Blocker | Business risk |
|---------|---------------|
| Hardcoded secrets & credentials in git/README | Full system compromise |
| Social login without OAuth verification | Account takeover |
| In-memory payments & OTP | Revenue loss, auth failures at scale |
| Duplicate DB domains (doctors, hospitals, appointments) | Wrong data, orphan records, broken multi-hospital |
| No migrations, no audit logs, public PHI uploads | Compliance failure |
| No Docker, CI/CD, monitoring | Cannot operate safely in production |
| Flutter emergency `testingMode=true` | Emergency feature broken in prod |
| Client API drift (web vs Flutter payments/emergency) | Inconsistent patient experience |

### Program objective
Transform MEDCLUES from **MVP/demo** to **production-grade multi-hospital healthcare SaaS** with:
- Single source of truth for identity, appointments, and payments
- Horizontal scalability (2+ backend workers)
- Security posture suitable for PHI handling
- Operational readiness (monitoring, backups, CI/CD)
- One canonical mobile client (Flutter)

---

## 2. Program Governance & Roles

### 2.1 Steering committee (weekly)
| Role | Responsibility |
|------|----------------|
| **Project Head / PM** | Timeline, scope, stakeholder sign-off, go/no-go |
| **Senior Software Architect** | Architecture decisions, API contracts, client alignment |
| **Senior DB Architect / DBA** | Schema design, migrations, index strategy, data integrity |
| **Senior Security Engineer** | Threat model, secret rotation, pen test coordination |
| **Senior DevOps Engineer** | Infra, CI/CD, monitoring, DR |
| **Healthcare Compliance Lead** | PHI policy, vendor BAAs, audit requirements |
| **QA Lead** | Test strategy, regression, UAT sign-off |
| **Flutter Tech Lead** | Mobile release, store submission |
| **Backend Tech Lead** | FastAPI remediation, payment/webhook implementation |

### 2.2 Decision gates (mandatory sign-off)
| Gate | When | Approvers |
|------|------|-----------|
| **G0** | Before any prod secret rotation | Security + DevOps + PM |
| **G1** | Before first DB migration on staging | DBA + Backend Lead + Architect |
| **G2** | Before payment migration live | Backend + Finance/Ops + QA |
| **G3** | Before Flutter store release | Flutter Lead + QA + Compliance |
| **G4** | Before production cutover | All leads + Project Head |

### 2.3 Environments (required)
```
local → dev → staging → pre-prod → production
```
- **Staging must mirror production** schema and use Razorpay test mode until G2.
- **No direct schema changes on production** without migration file + rollback script.

### 2.4 Change management rules
1. No production deploy on Fridays or without rollback plan.
2. All DB changes via numbered migrations only.
3. All breaking API changes versioned (`/api/v1/` then deprecate legacy).
4. Credential rotation documented in runbook; never commit secrets.
5. Every phase ends with written sign-off checklist.

---

## 3. Current State Assessment

### 3.1 Scores (baseline)
| Dimension | Score | Target |
|-----------|-------|--------|
| Project Health | 5.0/10 | 8.5/10 |
| Database | 3.5/10 | 9.0/10 |
| Security | 2.5/10 | 8.5/10 |
| Backend | 5.0/10 | 8.5/10 |
| Flutter | 6.5/10 | 9.0/10 |
| Scalability | 3.0/10 | 8.0/10 |
| Production Readiness | 2.0/10 | 9.0/10 |

### 3.2 Scale readiness (current)
| Scale | Current | After program |
|-------|---------|---------------|
| 100 users | ⚠️ Single server | ✅ |
| 1,000 users | ❌ | ✅ |
| 10,000 users | ❌ | ✅ (with Redis + indexes + pagination) |
| 100,000 users | ❌ | ⚠️ Phase 2 program (read replicas, CDN) |
| Multi-hospital SaaS | ⚠️ Partial | ✅ |

---

## 4. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS (CDN)                             │
│  frontend (Vercel) │ admin (Vercel) │ flutter_mobile (stores) │
└────────────┬────────────────┬───────────────────┬───────────────┘
             │                │                   │
             ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Gateway / Load Balancer (HTTPS)                 │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐  (horizontal scale: N instances)
    ▼                 ▼
┌─────────┐     ┌─────────┐
│ FastAPI │     │ FastAPI │   Stateless API workers
│ Worker 1│     │ Worker 2│
└────┬────┘     └────┬────┘
     │               │
     └───────┬───────┘
             │
    ┌────────┼────────┬──────────────┐
    ▼        ▼        ▼              ▼
 PostgreSQL Redis  Cloudinary/S3  Razorpay Webhooks
 (primary)  (OTP,   (PHI private)  (payment truth)
            cache,
            sessions)
             │
    ┌────────┴────────┐
    ▼                 ▼
 Worker Process   Telegram Bot
 (email, SMS,     (optional separate
  slot jobs)       service)
```

### 4.1 Architectural principles (non-negotiable)
1. **Single writer for payments** — PostgreSQL + Razorpay webhooks; no in-memory payment state.
2. **Single doctor identity model** — No ambiguous `emb_*` without discriminator + FK.
3. **Single appointment table** — Merge or isolate `super_appointments` with clear product boundary.
4. **PHI never public** — Signed URLs or authenticated proxy only.
5. **All secrets in vault** — No defaults in code; fail startup if missing in prod.
6. **Flutter is canonical mobile** — Deprecate Expo `mobile/` after parity checklist.

---

## 5. Master Issue Registry (All Levels)

Every audited issue is listed below with **Issue ID**, **severity**, **owner**, and **target phase**.

### 5.1 CRITICAL — Must fix before any production launch

| ID | Category | Location | Description | Phase |
|----|----------|----------|-------------|-------|
| SEC-001 | Secrets | `config.py:10` | JWT_SECRET defaults to `"greatstack"` | 0, 1 |
| SEC-002 | Secrets | `config.py:24` | PG_PASSWORD default `"Javali786"` | 0, 1 |
| SEC-003 | Secrets | `config.py:51-52` | Hardcoded MediChain bot API key/password | 0, 1 |
| SEC-004 | Secrets | `mistral_service.py:9` | Hardcoded Mistral API key fallback | 0, 1 |
| SEC-005 | Auth | `user_controller.social_login` | No OAuth token verification — account takeover | 1 |
| SEC-006 | Data leak | `ai_routes.py:54-57` | DATABASE_URL sent to external AI service | 1 |
| SEC-007 | CORS | `main.py:119-125` | Prod CORS `*` + credentials | 1 |
| SEC-008 | PHI | `health_record_controller.py:52` | Cloudinary `access_mode="public"` for health records | 1, 8 |
| SEC-009 | Abuse | `emergency_routes.py` | Unauthenticated emergency SMS endpoint | 1, 3 |
| SEC-010 | Abuse | `super_appointment_routes.py:8-12` | Unauthenticated POST book super appointment | 2, 3 |
| SEC-011 | Payments | `payments_routes.py:9-17` | Unauthenticated checkout-complete | 3 |
| SEC-012 | Credentials | `README.md`, `all_*_credentials.md` | Plaintext passwords in repository | 0 |
| SEC-013 | Emergency | `emergency_constants.dart:6` | `testingMode=true` blocks real emergency calls | 5 |
| DB-001 | Migrations | `main.py` lifespan | Runtime DDL instead of versioned migrations | 2 |
| DB-003 | Schema | `doctor_model.py` | Dual doctor identity (`doctors` + `emb_*`) | 2 |
| DB-005 | Schema | `dean_model.py` | `password_text` plaintext column | 2 |
| DB-006 | Payments | `payments_controller.py` | In-memory payment state | 2, 3 |
| DB-014 | OTP | `otp_storage.py` | In-memory OTP/password reset | 2, 6 |
| P1-015 | Credentials | README + credential md files | Production passwords documented in git | 0 |
| PR-001 | DevOps | Repo root | No Dockerfile | 6, 7 |
| PR-002 | DevOps | — | No CI/CD pipeline | 7 |
| PR-003 | Compliance | Multiple | No audit logs, public PHI, no BAA process | 8 |
| PR-004 | DR | — | No backup/DR documented | 7 |
| SC-001 | Scale | payments + OTP in memory | Cannot run 2+ workers | 2, 6 |

### 5.2 HIGH — Must fix before beta / paid production

| ID | Category | Location | Description | Phase |
|----|----------|----------|-------------|-------|
| SEC-014 | JWT | `auth.py` | Shared secret; patient/doctor same claim shape; 7-day token | 1, 3 |
| SEC-015 | IDOR | Multiple controllers | Missing ownership checks | 3 |
| SEC-016 | Rate limit | All routes | No rate limiting | 1, 3 |
| SEC-017 | Logging | `auth.py`, Flutter logger | Sensitive data in logs | 3, 7 |
| SEC-018 | Storage | Frontend localStorage | JWT in XSS-vulnerable storage | 4 |
| SEC-020 | UI | Admin pages | Passwords displayed in UI | 3, 4 |
| DB-002 | Schema | `super_appointments` | Duplicate appointment domain | 2 |
| DB-004 | Schema | `hospitals` vs `hospital_tieups` | Duplicate hospital domain | 2 |
| DB-007 | Schema | JSON columns on appointments | Denormalization / reporting pain | 2 |
| DB-008 | FK | Core tables | Missing foreign keys | 2 |
| DB-009 | Index | — | Missing indexes on hot columns | 2 |
| DB-011 | Audit | — | No audit_logs table | 8 |
| DB-013 | Sync | emergency_contacts | Web DB vs Flutter local divergence | 4, 5 |
| BE-001 | API | Duplicate routes | Legacy + modern payment/OTP/appointment paths | 3, 4 |
| BE-002 | API | ~55 public endpoints | Oversized unauthenticated surface | 3 |
| BE-003 | Backend | In-memory state | Payments/OTP not durable | 2, 3 |
| BE-005 | Ops | print() only | No structured logging / health checks | 7 |
| BE-006 | Perf | `get_all_appointments` | No pagination | 3 |
| BE-008 | Realtime | WebSocket/Socket.IO | No auth on connect | 3, 6 |
| FL-002 | Flutter | emergency module | No backend integration | 5 |
| FL-004 | Flutter | appointment fetch | Loads all appointments for one ID | 4 |
| FL-005 | Flutter | token storage | No refresh; web unencrypted | 5 |
| FL-007 | Flutter | config.env | Dev LAN IP in release bundle risk | 5 |
| P1-010 | Config | `render.yaml` | Stale Node backend deploy config | 7 |
| P1-011 | Config | Missing .env.example | Misconfiguration risk | 0, 7 |
| P1-012 | API drift | frontend payments | Legacy Razorpay path | 4 |
| P1-017 | Admin | Hidden routes | system-settings, queue-management orphaned | 9 |
| PR-005 | Env | DEBUG default true | Insecure defaults in prod | 1 |
| SC-002 | Scale | db pool + indexes | Connection/query bottlenecks | 2, 6 |
| SC-003 | Scale | Socket.IO | Single-instance realtime | 6 |
| SC-004 | Scale | `/uploads` local | Not shared across workers | 6 |
| SC-006 | Jobs | Same process | Telegram/email/slot warm in API process | 6 |

### 5.3 MEDIUM — Fix before scale / multi-hospital GA

| ID | Category | Location | Description | Phase |
|----|----------|----------|-------------|-------|
| DB-010 | Column | `appointments.hospital_id` | Not populated on INSERT | 2 |
| DB-012 | Soft delete | All models | Hard DELETE on PHI tables | 8 |
| BE-004 | Validation | Controllers | No Pydantic request models | 3 |
| BE-007 | Startup | doctor slot warm-up | Slow cold starts | 6 |
| FL-008 | Architecture | Partial repositories | Inconsistent Flutter layers | 9 |
| P1-001 | Legacy | `mobile/` Expo | Duplicate mobile codebase | 9 |
| P1-002 | Dead code | Admin orphan pages | DeanPortals, SpecialtyHelpline, SuperAppointments | 9 |
| P1-007 | Duplicate | videoConsult.js | Duplicated across admin/frontend | 9 |
| P1-009 | Git | `__pycache__` tracked | Build artifacts in VCS | 0, 9 |
| P1-014 | Dev | scratch/ folders | 135+ dev scripts with hardcoded passwords | 9 |
| SEC-019 | SQLi | Production code | Low risk (parameterized) — maintain discipline | Ongoing |
| I-* | DB tables | super_appointments, hospitals, saved_profiles | Underused / ambiguous | 2, 9 |

### 5.4 LOW — Post-GA / continuous improvement

| ID | Category | Location | Description | Phase |
|----|----------|----------|-------------|-------|
| P1-003 | Dead imports | admin App.jsx | LiveTips, AnimatedQuotes, BackgroundFX | 9 |
| P1-004 | Dead components | admin VideoConsultRoom | Unused duplicate | 9 |
| P1-005 | Dead UI | 13 frontend landing sections | Never wired | 9 |
| P1-006 | Orphan | BloodPlus.jsx | No route | 9 |
| P1-008 | Assets | Root ambulancia.* | Duplicate assets | 9 |
| P1-013 | Debug | console.log across clients | Verbose client logging | 9 |
| P1-016 | Naming | MediChain vs MEDCLUES | Brand inconsistency | 9 |
| P1-018 | Routes | Duplicate /hospitals paths | frontend | 9 |
| FL-006 | Dead code | api_config constants | Unused endpoint constants | 9 |
| BE-001 | API versioning | — | No `/api/v1/` | 10+ |

---

## 6. Phase 0 — Emergency Stabilization (Week 0–1)

**Objective:** Stop active security bleeding before structural work.  
**Gate:** G0 — Security sign-off.

### 6.1 Tasks

| # | Task | Owner | Deliverable |
|---|------|-------|-------------|
| 0.1 | **Rotate ALL secrets** — JWT, DB, Razorpay, Agora, Cloudinary, Brevo, Mistral, OpenAI, Gemini, Telegram, MediChain bot | Security + DevOps | Rotation log (offline); new values in vault only |
| 0.2 | Remove `all_doctors_credentials.md`, `all_deans_credentials.md` from git tracking | Security | Files untracked; team notified |
| 0.3 | Redact production passwords from `README.md` — replace with "contact admin" or seed script reference | PM + Backend | README PR |
| 0.4 | Set `DEBUG=false` on any shared/staging/prod `.env` immediately | DevOps | Env checklist signed |
| 0.5 | Disable or IP-restrict `/api/ai/chat/stream` until SEC-006 fixed | Backend | Temporary WAF rule or route disable doc |
| 0.6 | Add `__pycache__/`, `*.pyc`, `*credentials*.md` to `.gitignore` | DevOps | .gitignore PR |
| 0.7 | Create `.env.example` for: `fastapi_back`, `frontend`, `admin`, `flutter_mobile` | DevOps | 4 example files |
| 0.8 | Inventory all dean/doctor accounts — force password reset after rotation | DBA + Backend | Reset runbook |
| 0.9 | Freeze new feature development until Phase 1 complete | Project Head | Team communication |

### 6.2 Exit criteria
- [ ] No secrets in git history plan documented (BFG/git-filter-repo schedule if repo was public)
- [ ] All environments using rotated secrets
- [ ] DEBUG=false on non-local envs
- [ ] `.env.example` files merged
- [ ] AI stream route mitigated

---

## 7. Phase 1 — Security & Secrets (Week 1–3)

**Objective:** Production-grade authentication, authorization, and secret handling.

### 7.1 Backend security tasks

| # | Task | Files | Details |
|---|------|-------|---------|
| 1.1 | Remove ALL default secrets from `config.py` | `app/config/config.py` | `JWT_SECRET`, `PG_PASSWORD`, bot keys — raise on missing in prod |
| 1.2 | Add startup validation module | `app/config/startup_checks.py` (new) | Required vars: JWT_SECRET, DATABASE_URL, RAZORPAY_*, ADMIN_EMAIL, etc. |
| 1.3 | Fix CORS for production | `main.py` | Explicit allowlist from env `CORS_ORIGINS`; never `*` + credentials |
| 1.4 | Implement OAuth verification for social login | `user_controller.py`, new `oauth_service.py` | Verify Google ID token server-side; Apple/Facebook similarly |
| 1.5 | Remove DATABASE_URL from AI proxy payload | `ai_routes.py` | Read-only DB user for AI if needed; never send connection string externally |
| 1.6 | Require auth on AI routes | `ai_routes.py` | `Depends(auth_user)` + rate limit |
| 1.7 | JWT hardening | All token creators, `auth.py` | Add `role`, `typ`, `jti`; shorten access token to 15–60 min |
| 1.8 | Implement refresh token flow | New `refresh_tokens` table + endpoints | Rotate refresh tokens; revoke on logout |
| 1.9 | Rate limiting middleware | New `app/middleware/rate_limit.py` | slowapi or Redis: login 5/min, OTP 3/hr, emergency 2/hr, AI 20/hr |
| 1.10 | Auth-gate emergency endpoint | `emergency_routes.py` | Optional: allow anonymous with CAPTCHA + strict rate limit + phone verification |
| 1.11 | Remove `dev_otp` from all API responses | `auth_controller.py`, `otp_controller.py` | Even in dev, log OTP server-side only |
| 1.12 | Redact auth logging | `auth.py` | Never log full headers or token fragments |
| 1.13 | Remove Mistral hardcoded fallback | `mistral_service.py` | Require env var |
| 1.14 | Admin route guards | `admin/src/App.jsx` | Separate route trees for aToken/dToken/deanToken |
| 1.15 | Stop returning passwords from APIs | `dean_model.py`, admin controllers, admin UI | Strip `password_text` from all SELECTs and UI |

### 7.2 Exit criteria
- [ ] Pen test checklist passed (internal)
- [ ] Social login verified with real Google token test
- [ ] No default secrets in codebase
- [ ] Rate limits active on auth/OTP/emergency/AI
- [ ] CORS tested from prod frontend origins only

---

## 8. Phase 2 — Database Remediation (Week 2–6)

**Objective:** Single source of truth schema with migrations, integrity, and payment persistence.  
**Gate:** G1 — DBA sign-off on staging migration.

### 8.1 Migration infrastructure

| # | Task | Deliverable |
|---|------|-------------|
| 2.1 | Add Alembic to `fastapi_back/` | `alembic/` directory, `alembic.ini` |
| 2.2 | Baseline migration from current prod/staging schema | `001_baseline.sql` snapshot |
| 2.3 | Remove runtime DDL from `main.py` lifespan | Move to migrations only |
| 2.4 | Staging migration dry-run procedure | Runbook document |

### 8.2 New tables (required)

```sql
-- Migration 002: payment_transactions
CREATE TABLE payment_transactions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    appointment_id  BIGINT REFERENCES appointments(id),
    razorpay_order_id   VARCHAR(64) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(64),
    amount_paise    INTEGER NOT NULL,
    currency        VARCHAR(8) DEFAULT 'INR',
    status          VARCHAR(32) NOT NULL, -- created|paid|failed|refunded
    checkout_token  UUID,
    idempotency_key UUID UNIQUE,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Migration 003: otp_requests (or use Redis — document choice)
CREATE TABLE otp_requests (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    otp_hash    VARCHAR(255) NOT NULL,
    purpose     VARCHAR(32) NOT NULL, -- login_reset|verify_email
    attempts    SMALLINT DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_otp_email_purpose ON otp_requests(email, purpose);

-- Migration 004: refresh_tokens
CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Migration 005: audit_logs
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    BIGINT,
    actor_role  VARCHAR(32),
    action      VARCHAR(64) NOT NULL,
    resource    VARCHAR(128) NOT NULL,
    resource_id VARCHAR(64),
    ip_address  INET,
    user_agent  TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_resource ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);

-- Migration 006: doctor_identity (unification layer)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_source VARCHAR(32);
-- Values: 'doctors' | 'hospital_tieup_doctors'
-- Backfill script required for existing rows
```

### 8.3 Doctor identity unification (DB-003)

**Problem:** `appointments.doctor_id` holds integer OR logical `emb_{id}` without FK.

**Target model:**
```
Option A (recommended): doctor_registry VIEW
  - Unified view joining doctors + hospital_tieup_doctors with synthetic unified_id
  - appointments.doctor_unified_id + doctor_source

Option B: Migrate all hospital_tieup_doctors into doctors with hospital_id FK
  - One table; deprecate hospital_tieup_doctors
```

| Step | Action |
|------|--------|
| 2.5 | Audit all `emb_*` references in appointments, consultations, slots | Data report |
| 2.6 | Choose Option A or B — architecture sign-off | ADR document |
| 2.7 | Backfill migration script with rollback | `migrations/007_doctor_unify.py` |
| 2.8 | Update all models/controllers to use unified lookup | `doctor_model.py`, controllers |

### 8.4 Super appointments decision (DB-002)

| Option | Action |
|--------|--------|
| **Merge** | Migrate `super_appointments` rows into `appointments` with `source='super'` flag; deprecate table |
| **Isolate** | Move routes to `/api/super-appointments/*`; require auth; separate admin UI |

**Recommendation:** Merge if volume low; else isolate with auth immediately (Phase 3).

### 8.5 Hospital consolidation (DB-004)

| Step | Action |
|------|--------|
| 2.9 | Document which features use `hospitals` vs `hospital_tieups` | Matrix doc |
| 2.10 | Deprecate `hospitals` login if unused; or link via `hospital_tieup_id` FK | Migration |
| 2.11 | Populate `appointments.hospital_id` on every booking | Controller fix |

### 8.6 Index migration (DB-009)

Apply via Alembic (from `optimize_database_indexes.py` + additions):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doctors_email ON doctors(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_slot_date ON appointments(slot_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_hospital_id ON appointments(hospital_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_records_user_id ON health_records(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_appointment_id ON consultations(appointment_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
```

### 8.7 Foreign keys (DB-008)

Add after data cleanup (orphan report first):

```sql
ALTER TABLE appointments ADD CONSTRAINT fk_appt_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE health_records ADD CONSTRAINT fk_hr_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE emergency_contacts ADD CONSTRAINT fk_ec_user FOREIGN KEY (user_id) REFERENCES users(id);
-- doctor FK deferred until doctor unification complete
```

### 8.8 Dean password_text removal (DB-005)

| Step | Action |
|------|--------|
| 2.12 | Stop writing `password_text` on dean create/update | `dean_model.py`, controllers |
| 2.13 | Migration: `ALTER TABLE deans DROP COLUMN password_text` | After UI/API stop reading it |
| 2.14 | Force dean password reset notification | Email runbook |

### 8.9 Exit criteria
- [ ] Alembic migrations run clean on staging
- [ ] `payment_transactions` table live; in-memory dict removed
- [ ] OTP in Redis or DB (not memory)
- [ ] All indexes applied
- [ ] Doctor unification ADR approved and backfill tested
- [ ] Orphan record report = 0 blocking FKs

---

## 9. Phase 3 — Backend Hardening (Week 4–8)

**Objective:** Secure, consistent, paginated, validated API.  
**Gate:** G2 for payment changes.

### 9.1 Payment system rewrite (DB-006, SEC-011, BE-003)

| # | Task | Details |
|---|------|---------|
| 3.1 | Persist all orders in `payment_transactions` | Replace `_pending_orders`, `_checkout_tokens`, `_payment_history` |
| 3.2 | Implement Razorpay webhook endpoint | `POST /api/payments/webhook` — signature verify, idempotent |
| 3.3 | Auth-gate `checkout-complete` OR remove in favor of webhook-only completion | Security review |
| 3.4 | Idempotency keys on create-order | Prevent duplicate appointments on retry |
| 3.5 | Deprecate legacy `/api/user/payment-razorpay` | Return 410 with migration message after frontend migrated |
| 3.6 | Payment ownership checks | Verify `user_id` on all payment operations |
| 3.7 | WebSocket auth | JWT on `/payment-updates` connect |

### 9.2 API standardization

| # | Task | Details |
|---|------|---------|
| 3.8 | Introduce Pydantic models for all request/response bodies | `app/schemas/` directory |
| 3.9 | Standard error middleware | Proper HTTP status codes; no success:false with 200 |
| 3.10 | Pagination on all list endpoints | `limit`, `cursor`, `total` pattern |
| 3.11 | Fix all IDOR issues (SEC-015) | Consultation, emergency contacts, lab cancel, mark-alerted |
| 3.12 | Auth super appointment routes | Require auth or merge table (Phase 2 decision) |
| 3.13 | Consolidate OTP routes | Single `/api/auth/otp/*` namespace |
| 3.14 | API versioning prep | Mount v1 routers; legacy shims with deprecation headers |

### 9.3 PHI & uploads (SEC-008)

| # | Task | Details |
|---|------|---------|
| 3.15 | Change health record uploads to private Cloudinary | Signed URLs with expiry |
| 3.16 | Authenticated download proxy | `GET /api/user/health-records/{id}/download` |
| 3.17 | File validation middleware | Max 10MB; MIME whitelist PDF/JPG/PNG; reject executables |
| 3.18 | Remove public `/uploads` mount or restrict to non-PHI assets | `main.py` |

### 9.4 Realtime

| # | Task | Details |
|---|------|---------|
| 3.19 | Socket.IO JWT auth on connect | `socket_service.py` |
| 3.20 | Document queue event schema | For admin client stability |

### 9.5 Exit criteria
- [ ] Payment E2E test: create → pay → webhook → appointment confirmed
- [ ] Restart backend mid-payment — state recovers from DB
- [ ] All list endpoints paginated
- [ ] IDOR test suite passes
- [ ] Health records not publicly accessible via URL guessing

---

## 10. Phase 4 — Client Unification (Week 6–10)

**Objective:** All clients use canonical APIs; consistent UX.

### 10.1 Patient web (`frontend/`)

| # | Task | Files | Details |
|---|------|-------|---------|
| 4.1 | Migrate payments to `/api/payments/*` | `Appointment.jsx`, `MyAppointments.jsx`, `PaymentModal.jsx` | Match Flutter flow |
| 4.2 | Remove legacy Razorpay direct integration | Same | Single codepath |
| 4.3 | Strip debug console.log in production build | vite config drop_console | |
| 4.4 | Evaluate HttpOnly cookie auth OR CSP hardening | Security review | If staying with localStorage |
| 4.5 | Wire or remove 13 dead landing components | `components/*Section.jsx` | Product decision |
| 4.6 | Fix/remove BloodPlus orphan | `BloodPlus.jsx`, `App.jsx` | |
| 4.7 | Standardize backend URL fallback to port 5000 | Already correct in AppContext | Verify all pages |

### 10.2 Admin portal (`admin/`)

| # | Task | Files | Details |
|---|------|-------|---------|
| 4.8 | Role-based route guards | `App.jsx` | Admin/doctor/dean separated |
| 4.9 | Fix port 4000 fallbacks → 5000 | `QueueManager.jsx`, `AllAppointments.jsx`, `SocketContext.jsx` | |
| 4.10 | Wire or remove orphan pages | DeanPortals, SpecialtyHelpline, SuperAppointments | |
| 4.11 | Add sidebar links for queue-management | `Sidebar.jsx` | If feature kept |
| 4.12 | Remove password display from UI | ManageDeans, AddDoctor, HospitalTieUps | |
| 4.13 | Remove dead imports | `App.jsx` | LiveTips, etc. |
| 4.14 | Delete unused admin VideoConsultRoom.jsx | After QA on doctor video | |

### 10.3 Shared client work

| # | Task | Details |
|---|------|---------|
| 4.15 | Publish OpenAPI spec from FastAPI | `openapi.json` auto-generated + hosted |
| 4.16 | Create API changelog document | Breaking changes per phase |
| 4.17 | Shared videoConsult utility decision | npm workspace or copy-with-sync script |

### 10.4 Exit criteria
- [ ] Web payment flow identical outcome to Flutter
- [ ] Admin cannot access other role routes by URL
- [ ] No port 4000 references remain
- [ ] OpenAPI spec published

---

## 11. Phase 5 — Flutter Production Release (Week 8–11)

**Objective:** Store-ready mobile app with working emergency and backend sync.  
**Gate:** G3 — Flutter release sign-off.

### 11.1 Critical fixes

| # | Task | File | Details |
|---|------|------|---------|
| 5.1 | Set `testingMode = false` for release | `emergency_constants.dart` | Use `--dart-define=EMERGENCY_TESTING=false` or flavors |
| 5.2 | Build flavors: dev / staging / prod | `android/`, `ios/`, CI | Separate bundle IDs or app names for staging |
| 5.3 | Prod API URL via CI secret | Remove LAN IP from `assets/config.env` in prod builds | |
| 5.4 | Wire emergency contacts to backend API | New service methods | `/api/user/emergency-contacts/*` |
| 5.5 | Optional: wire `/api/emergency/send-alert` | With auth + rate limit | Align with web |
| 5.6 | Fix fetchById — single appointment API | `appointment_service.dart` + backend endpoint | |
| 5.7 | Implement refresh token flow | `auth_service.dart`, `storage_helper.dart` | Match backend Phase 1 |
| 5.8 | Disable PrettyDioLogger in release | `api_service.dart` | Already conditional — verify |
| 5.9 | Remove dead code | See Appendix A | |
| 5.10 | Encrypt emergency medical data | `emergency_storage_service.dart` | flutter_secure_storage for PHI fields |

### 11.2 Store readiness

| # | Task | Details |
|---|------|---------|
| 5.11 | Android: signing config, ProGuard rules | Release keystore in CI secrets |
| 5.12 | iOS: provisioning, App Store privacy manifest | PHI usage declarations |
| 5.13 | Privacy policy URL live | Required for health apps |
| 5.14 | App Store / Play Store screenshots + metadata | Marketing |
| 5.15 | Crash reporting (Firebase Crashlytics or Sentry) | Mobile observability |

### 11.3 Exit criteria
- [ ] Emergency calls 108/100/101 on physical device (release build)
- [ ] Payment E2E on Android + iOS
- [ ] Video consult E2E on Android + iOS
- [ ] Emergency contacts sync with web after login
- [ ] Store submission checklist complete

---

## 12. Phase 6 — Scalability & Infrastructure (Week 8–14)

**Objective:** Run 2+ backend workers; handle 10,000 users.

### 12.1 Redis introduction

| Use case | Key pattern | TTL |
|----------|-------------|-----|
| OTP storage | `otp:{email}` | 5 min |
| Rate limits | `rl:{ip}:{route}` | 1 min – 1 hr |
| Session/cache | `cache:doctors:list` | 5 min |
| Socket.IO adapter | Redis pub/sub | — |

### 12.2 Database scaling

| # | Task | Details |
|---|------|---------|
| 6.1 | Increase pool size via env | `DB_POOL_MIN`, `DB_POOL_MAX` (default 5–30) |
| 6.2 | Connection health check endpoint | `/ready` checks DB + Redis |
| 6.3 | Read replica for analytics (optional) | Dean/admin dashboards |
| 6.4 | Lazy doctor slot generation | Remove startup warm-up |

### 12.3 File storage

| # | Task | Details |
|---|------|---------|
| 6.5 | Migrate all local uploads to Cloudinary/S3 | Deprecate `uploads/` mount |
| 6.6 | CDN for doctor/hospital images | Cloudinary transformations |

### 12.4 Background workers

| # | Task | Details |
|---|------|---------|
| 6.7 | Extract Telegram bot to separate process | Docker service |
| 6.8 | Job queue for email/SMS | Celery + Redis or ARQ |
| 6.9 | Socket.IO Redis adapter | `socketio.AsyncRedisManager` |

### 12.5 Exit criteria
- [ ] Load test: 100 concurrent users, p95 < 500ms on doctor list
- [ ] 2 Uvicorn workers + Redis — payment flow succeeds
- [ ] Socket.IO events reach clients across workers

---

## 13. Phase 7 — Observability & DevOps (Week 10–14)

**Objective:** Deploy safely, detect failures, recover quickly.  
**Gate:** G4 prerequisites.

### 13.1 Docker & deploy

| # | Deliverable |
|---|-------------|
| 7.1 | `fastapi_back/Dockerfile` — multi-stage, non-root user |
| 7.2 | `docker-compose.yml` — api + postgres + redis (local dev) |
| 7.3 | Replace `render.yaml` with FastAPI service config OR delete |
| 7.4 | Production start command: `uvicorn main:app --workers 4` (no reload) |
| 7.5 | Vercel env vars documented for frontend/admin |

### 13.2 CI/CD pipeline

```yaml
# .github/workflows/ci.yml (target structure)
on: [push, pull_request]
jobs:
  backend-lint-test:
    - ruff/flake8, pytest, alembic check
  frontend-build:
    - npm ci, eslint, vite build
  admin-build:
    - npm ci, eslint, vite build
  flutter-analyze:
    - flutter analyze, flutter test
  security:
    - secret scan (gitleaks), dependency audit
  deploy-staging:
    - on merge to main → deploy staging
  deploy-prod:
    - manual approval → deploy prod
```

### 13.3 Observability

| # | Task | Tool suggestion |
|---|------|-----------------|
| 7.6 | Structured JSON logging | structlog + correlation ID middleware |
| 7.7 | Error tracking | Sentry (backend + Flutter + frontend) |
| 7.8 | Metrics | Prometheus `/metrics` or Datadog |
| 7.9 | Uptime monitoring | Better Uptime / Pingdom on `/health` |
| 7.10 | Log aggregation | CloudWatch / Loki / ELK |

### 13.4 Backup & DR (PR-004)

| # | Task | RPO/RTO target |
|---|------|----------------|
| 7.11 | Automated PostgreSQL backups | RPO 1 hour, RTO 4 hours |
| 7.12 | Quarterly restore drill | Documented |
| 7.13 | Cloudinary backup policy | Vendor-managed + export procedure |

### 13.5 Exit criteria
- [ ] One-click staging deploy works
- [ ] `/health` and `/ready` return 200
- [ ] Sentry receiving errors from all apps
- [ ] Backup restore tested on staging

---

## 14. Phase 8 — Healthcare Compliance (Week 12–16)

**Objective:** Minimum viable compliance posture for healthcare SaaS.

### 14.1 PHI controls

| # | Control | Implementation |
|---|---------|----------------|
| 8.1 | PHI access audit | `audit_logs` on every health record view/download |
| 8.2 | Minimum necessary access | Role-based API scoping review |
| 8.3 | Encryption at rest | PostgreSQL provider encryption + private Cloudinary |
| 8.4 | Encryption in transit | TLS everywhere; HSTS on API |
| 8.5 | Soft delete for PHI | `deleted_at` on health_records, appointments |
| 8.6 | Data retention policy | Document 7-year retention or local law |
| 8.7 | Patient data export | `GET /api/user/export-my-data` (GDPR-style) |
| 8.8 | Patient data deletion request | Anonymize workflow |

### 14.2 Vendor management

| Vendor | Action |
|--------|--------|
| Cloudinary | BAA / DPA; private mode only for PHI |
| Razorpay | PCI scope documentation (SAQ A — hosted checkout) |
| Agora | DPA; no PHI in video metadata |
| Firebase/Google | Restrict API keys; App Check |
| Brevo/email | DPA |
| Hosting (Vercel, Render, etc.) | DPA |

### 14.3 Policies (HR / Compliance deliverables)

| Document | Owner |
|----------|-------|
| Information Security Policy | Compliance |
| Incident Response Plan | Security + DevOps |
| Access Control Policy | Security |
| Employee HIPAA/security training | HR |
| Vendor risk assessment register | Compliance |

### 14.4 Exit criteria
- [ ] No public PHI URLs in penetration test
- [ ] Audit log query demo for admin access to patient record
- [ ] Vendor DPA checklist 80%+ complete
- [ ] IR plan tabletop exercise completed

---

## 15. Phase 9 — Cleanup & Technical Debt (Week 14–18)

**Objective:** Reduce maintenance burden; single mobile client.

| # | Task | Details |
|---|------|---------|
| 9.1 | Execute Safe Delete Manifest (Appendix A) | After QA regression |
| 9.2 | Deprecate Expo `mobile/` app | Announce EOL; archive repo folder |
| 9.3 | Archive `fastapi_back/scratch/` to separate repo | 124 scripts |
| 9.4 | Remove unused requirements | motor, sqlalchemy if confirmed unused |
| 9.5 | Consolidate duplicate utilities | videoConsult.js |
| 9.6 | Standardize branding MEDCLUES everywhere | README, UI, emails |
| 9.7 | Complete Flutter repository pattern | labs, blood, hospital, payment |
| 9.8 | Remove dead api_config.dart constants | |
| 9.9 | git-filter-repo for secrets in history if repo was public | Security |

---

## 16. Phase 10 — Production Launch (Week 18–20)

### 16.1 Pre-launch checklist (all must pass)

**Security**
- [ ] Pen test remediation complete
- [ ] All CRITICAL issues closed
- [ ] Secrets in vault only
- [ ] Rate limits active

**Database**
- [ ] Migrations applied to prod
- [ ] Indexes live
- [ ] Backup restore verified within 30 days
- [ ] Orphan record count acceptable

**Payments**
- [ ] Razorpay live keys in prod
- [ ] Webhook endpoint registered with Razorpay
- [ ] 10 successful live test transactions

**Clients**
- [ ] Web on `/api/payments/*`
- [ ] Flutter store approved or sideload prod APK
- [ ] Admin/dean/doctor smoke tests pass

**Ops**
- [ ] Monitoring alerts configured
- [ ] On-call rotation defined
- [ ] Rollback procedure tested

### 16.2 Launch day runbook
1. Enable maintenance mode banner (optional)
2. Apply final migration
3. Deploy backend workers (rolling)
4. Deploy frontend/admin (Vercel)
5. Release Flutter (phased rollout 10% → 100%)
6. Monitor error rate, payment success, API latency for 4 hours
7. Go/no-go review at T+4h

### 16.3 Post-launch (first 30 days)
- Daily error rate review
- Weekly DB slow query review
- Weekly security log review
- User feedback triage for payment/emergency/video

---

## 17. Database Migration Playbook

### 17.1 Migration naming
```
fastapi_back/alembic/versions/
  001_baseline.py
  002_payment_transactions.py
  003_otp_refresh_tokens.py
  004_audit_logs.py
  005_indexes_concurrent.py
  006_doctor_source_column.py
  007_drop_deans_password_text.py
  008_foreign_keys.py
```

### 17.2 Execution rules
1. Always backup before migration on staging/prod.
2. Use `CREATE INDEX CONCURRENTLY` for large tables — never block writes.
3. Backfill scripts run separately with batch size 1000 and progress logging.
4. Every migration has `downgrade()` or documented manual rollback SQL.
5. DBA reviews every migration PR.

### 17.3 Data backfill: doctor_source example
```python
# Pseudocode — run as management command, not on every startup
for row in appointments_with_emb_doctor_id:
    update doctor_source = 'hospital_tieup_doctors'
for row in appointments_with_numeric_doctor_id:
    update doctor_source = 'doctors'
```

### 17.4 Orphan cleanup (pre-FK)
Run read-only audit queries on staging:
```sql
-- Appointments with no matching user
SELECT COUNT(*) FROM appointments a
LEFT JOIN users u ON a.user_id = u.id WHERE u.id IS NULL;

-- Appointments with doctor_id not in doctors or emb mapping
-- (custom script required)
```

---

## 18. API Consolidation Plan

### 18.1 Canonical endpoints (post-remediation)

| Domain | Canonical | Deprecated |
|--------|-----------|------------|
| Payments | `/api/payments/*` | `/api/user/payment-razorpay`, `/api/user/verifyRazorpay` |
| OTP | `/api/auth/otp/send`, `/api/auth/otp/verify` | `/api/send-otp`, `/api/verify-otp` |
| Password reset | `/api/auth/forgot-password`, etc. | `/api/user/forgot-password` |
| Appointments | `/api/user/book-appointment`, admin lists | `/api/appointments/` public super POST |
| Emergency | `/api/emergency/send-alert` (auth + rate limit) | — |
| Video | `/api/user/appointments/{id}/agora-token` | — |

### 18.2 Deprecation policy
- Deprecated routes return `Deprecation: true` header + sunset date.
- Minimum 90-day deprecation window for mobile clients.
- Document in `API_CHANGELOG.md`.

---

## 19. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | Payment migration breaks live bookings | Medium | Critical | Feature flag; parallel run; webhook idempotency |
| R2 | Doctor unification corrupts appointments | Medium | Critical | Staging backfill; rollback script; ADR review |
| R3 | Secret rotation locks out users | High | High | Staged rotation; force reset comms |
| R4 | Flutter store rejection (health/PHI) | Medium | High | Privacy manifest; policy URL; legal review |
| R5 | Team scope creep delays program | High | Medium | Phase gates; freeze features in Phase 0–3 |
| R6 | Razorpay webhook misconfiguration | Medium | Critical | Staging webhook tests; manual reconcile tool |
| R7 | Multi-worker race on slot booking | Medium | High | `FOR UPDATE SKIP LOCKED` (already partial); test concurrency |
| R8 | Compliance audit failure | Medium | Critical | Phase 8 dedicated; external consultant if budget allows |
| R9 | Legacy Expo users stranded | Low | Medium | EOL notice; Flutter feature parity checklist |
| R10 | DB migration timeout on large table | Medium | High | CONCURRENTLY indexes; off-peak window |

---

## 20. Testing Strategy

### 20.1 Test pyramid

| Layer | Coverage target | Tools |
|-------|-----------------|-------|
| Unit | Backend services 70% | pytest |
| Integration | All payment/auth flows | pytest + test DB |
| API contract | OpenAPI diff | schemathesis |
| E2E web | Booking + payment + video | Playwright |
| E2E mobile | Booking + payment + emergency | Flutter integration tests |
| Load | 100–1000 concurrent | k6 or Locust |
| Security | OWASP top 10 | OWASP ZAP + manual |

### 20.2 Critical test cases (must pass before launch)

1. Register → login → book → pay (Razorpay test) → appointment confirmed
2. Payment webhook arrives after client disconnect → appointment still confirmed
3. Backend restart during pending payment → recover from DB
4. Doctor joins video → patient joins → call ends → timer synced
5. Emergency call dials 108 on release Flutter build
6. User A cannot access User B consultation/health record (IDOR)
7. Social login rejects forged email token
8. Rate limit blocks 6th login attempt in 1 minute
9. Dean sees only own hospital data
10. Admin audit log entry on health record download

---

## 21. Rollback & Incident Response

### 21.1 Rollback triggers
- Payment success rate drops below 95%
- Error rate > 5% for 10 minutes
- Database migration failure
- Security incident (credential leak)

### 21.2 Rollback procedure
1. Revert to previous Docker image / git tag
2. Run migration downgrade if schema changed (pre-tested)
3. Restore DB from backup if data corrupted (last resort)
4. Notify users via status page
5. Post-incident review within 48 hours

### 21.3 Incident severity
| SEV | Example | Response time |
|-----|---------|---------------|
| SEV1 | PHI breach, payment system down | 15 min |
| SEV2 | Auth broken, video consult down | 30 min |
| SEV3 | Non-critical feature degraded | 4 hours |
| SEV4 | Cosmetic/minor | Next sprint |

---

## 22. Success Criteria & KPIs

### 22.1 Technical KPIs (30 days post-launch)
| Metric | Target |
|--------|--------|
| API uptime | 99.5% |
| Payment success rate | > 98% |
| p95 API latency (read) | < 400ms |
| Error rate | < 0.5% |
| Failed login brute force blocked | 100% |

### 22.2 Program completion KPIs
| Metric | Target |
|--------|--------|
| CRITICAL issues closed | 100% |
| HIGH issues closed | 95% |
| Test coverage backend | > 70% critical paths |
| Zero secrets in git | Verified by gitleaks CI |

---

## 23. Resource Plan (HR / Project Head)

### 23.1 Recommended team (minimum)
| Role | FTE | Duration |
|------|-----|----------|
| Senior Backend Engineer | 1.0 | 20 weeks |
| Senior Flutter Engineer | 0.75 | 12 weeks |
| Frontend Engineer (React) | 0.5 | 8 weeks |
| DBA / Data Engineer | 0.5 | 10 weeks |
| DevOps Engineer | 0.5 | 14 weeks |
| Security Engineer (consult) | 0.25 | 8 weeks |
| QA Engineer | 0.75 | 16 weeks |
| Project Manager | 0.5 | 20 weeks |
| Compliance advisor | 0.1 | 6 weeks |

**Total estimated effort:** ~1,500 engineering hours

### 23.2 Budget considerations
- Redis hosting (Upstash/ElastiCache)
- Sentry/monitoring SaaS
- Razorpay transaction fees (unchanged)
- Pen test (external): $5k–15k recommended
- Apple Developer + Google Play accounts
- Cloudinary upgraded plan for private PHI

### 23.3 Hiring / training notes (HR)
- Team must understand **healthcare data sensitivity** — mandatory security training before prod access
- No contractor access to production DB without NDA + audit logging
- On-call compensation policy required before launch

---

## 24. Appendix A — Safe Delete Manifest

**Execute only in Phase 9 after regression QA and explicit approval.**

| Path | Condition |
|------|-----------|
| `fastapi_back/**/__pycache__/` | Always safe |
| Root `ambulancia.gif`, `ambulancia.lottie` | After confirming app bundles have copies |
| `admin/src/components/VideoConsultRoom.jsx` | After doctor video QA |
| `admin/src/components/MobileFixedActions.jsx` | Always safe |
| `flutter_mobile/lib/services/integration_service.dart` | Always safe |
| `flutter_mobile/lib/screens/common/placeholder_screen.dart` | Always safe |
| `flutter_mobile/lib/screens/emergency/emergency_screen.dart` | After emergency module QA |
| Flutter brand widget chain (3 files) | After logo QA |
| `frontend/src/hooks/useGeolocation.js` | Always safe |
| `render.yaml` | If not used for deploy |
| `fastapi_back/all_*_credentials.md` | After credential rotation |

---

## 25. Appendix B — Do-Not-Touch List (Without Migration Plan)

| Path | Reason |
|------|--------|
| `fastapi_back/app/controllers/payments_controller.py` | Migrate to DB first |
| `fastapi_back/app/models/appointment_model.py` | Core booking data |
| `fastapi_back/app/models/doctor_model.py` | Embedded doctor logic |
| `fastapi_back/app/controllers/consultation_controller.py` | Active video production path |
| `admin/src/components/DoctorVideoConsultRoom.jsx` | Active doctor video |
| `frontend/src/components/VideoConsultRoom.jsx` | Active patient video |
| `flutter_mobile/lib/features/emergency/` | Flip testingMode only |
| Production `.env` files | Rotate, never delete blindly |
| Live PostgreSQL data | Backup before any change |

---

## 26. Appendix C — Environment Variable Matrix

### fastapi_back/.env (required in production)
| Variable | Required | Notes |
|----------|----------|-------|
| DATABASE_URL | Yes | PostgreSQL |
| JWT_SECRET | Yes | Min 32 random bytes |
| DEBUG | Yes | Must be `false` in prod |
| CORS_ORIGINS | Yes | Comma-separated frontend URLs |
| RAZORPAY_KEY_ID | Yes | Live key in prod |
| RAZORPAY_KEY_SECRET | Yes | |
| RAZORPAY_WEBHOOK_SECRET | Yes | New — for webhooks |
| AGORA_APP_ID | Yes | Video |
| AGORA_APP_CERTIFICATE | Yes | |
| CLOUDINARY_* | Yes | Private PHI mode |
| BREVO_API_KEY | Yes | Email |
| ADMIN_EMAIL | Yes | |
| ADMIN_PASSWORD | Yes | Strong; not in git |
| REDIS_URL | Yes (Phase 6) | OTP, rate limit, socket |
| SENTRY_DSN | Recommended | |

### frontend/.env
| Variable | Required |
|----------|----------|
| VITE_BACKEND_URL | Yes |
| VITE_FIREBASE_* | Yes (if Google login) |
| VITE_RAZORPAY_KEY_ID | Optional (backend returns key) |

### admin/.env
| Variable | Required |
|----------|----------|
| VITE_BACKEND_URL | Yes |
| VITE_ENABLE_SOCKET | Yes for queue |

### flutter_mobile (CI / dart-define)
| Variable | Required |
|----------|----------|
| API_BASE_URL | Yes — prod API URL |
| EMERGENCY_TESTING | `false` in prod |
| FIREBASE_* | Yes |

---

## 27. Appendix D — Issue ID Cross-Reference

| Phase | Issue IDs addressed |
|-------|---------------------|
| 0 | P1-015, P1-009, SEC-001–004, SEC-012 |
| 1 | SEC-005–007, SEC-009–017, SEC-020, PR-005, DB-005 (read path) |
| 2 | DB-001–011, DB-014, SC-001, SC-002 |
| 3 | DB-006, SEC-008, SEC-011, SEC-015, BE-001–008, SC-001 |
| 4 | P1-012, P1-017, DB-013, SEC-018, FL-004 |
| 5 | SEC-013, FL-002, FL-005, FL-007 |
| 6 | SC-002–006, BE-007, DB-014 |
| 7 | PR-001–005, BE-005 |
| 8 | DB-011–012, PR-003 |
| 9 | P1-001–008, P1-002–006, FL-006, FL-008 |
| 10 | All remaining LOW items, API versioning |

---

## Approval Section

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Head | | | |
| Senior Architect | | | |
| DBA | | | |
| Security Lead | | | |
| DevOps Lead | | | |
| Compliance | | | |

---

**END OF DOCUMENT**

*This plan consolidates all audit findings. No code, database, or infrastructure changes have been executed. Implementation begins only after explicit approval per phase.*
