# MEDCLUES Enterprise Scalability Audit & Production Readiness Report

**Date:** 2026-07-20  
**Scope:** Full-stack (FastAPI, PostgreSQL, Socket.IO, Flutter, Admin React, patient web)  
**Method:** Code/architecture evidence + capacity modeling. Million-user load was **not** executed in this workspace; runnable harnesses live under `fastapi_back/scripts/load/`.  
**Related:** [SECURITY_REPORT.md](./SECURITY_REPORT.md), [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md), [ARCHITECTURE_NOTES.md](./ARCHITECTURE_NOTES.md), [PAYMENT_CONTRACT.md](./PAYMENT_CONTRACT.md), [PHARMACY_WEBHOOKS.md](./PHARMACY_WEBHOOKS.md)

---

## 1. Executive Summary & Certification

### Verdict

**NOT CERTIFIED** for hundreds of thousands of concurrent users, multi-instance high availability, or million-user registered scale.

**CERTIFIED (with caveats)** for single-region, **single API process**, mid-scale multi-hospital operations (roughly tens to low hundreds of concurrent staff + patients), provided Phase 1 critical fixes land before any marketing claim of “enterprise scale.”

### Why

The product has a coherent multi-tenant healthcare domain (auth, hospitals, appointments, payments, pharmacy webhooks, community) and several enterprise-minded pieces (payment claim locking, partner HMAC webhooks, indexes, ownership helpers). It is still architected as a **monolithic FastAPI process** with **in-memory OTP, rate limits, and Socket.IO**, a **DB pool of 10**, and **non-transactional slot `FOR UPDATE`**. Those fail under a second replica or a booking stampede.

### Scorecard

| Dimension | Score | Summary |
|-----------|------:|---------|
| Overall Architecture | **55**/100 | Routes → services growing; fat controllers; workers inside API |
| Scalability | **35**/100 | No Redis; pool 10; process-local realtime/auth state |
| Security | **58**/100 | JWT/CORS/ownership solid; traceback leak; weak dispatch secret; unauth WS |
| Performance | **50**/100 | Good indexes; unbounded lists; poll stampede; sync I/O on event loop |
| Database | **62**/100 | Migrations/indexes strong; booking lock broken; token race |
| API | **55**/100 | Auth present; pagination/caching/idempotency incomplete |
| Mobile App (Flutter) | **52**/100 | Riverpod + builders; fetch-all + HTTP poll; no offline/Socket.IO |
| React Apps (Admin + Web) | **48**/100 | Sockets underused; full catalog loads; no route code-splitting |
| Reliability | **45**/100 | Webhook backoff good; workers not HA-safe; weak observability |
| Maintainability | **60**/100 | Enterprise docs pack; duplication and fat controllers remain |

**Weighted readiness for “smooth experience at very large concurrent load”:** **~48/100** — do not claim production readiness for large concurrent scale until Phase 1 + Phase 2 and measured load tests pass.

---

## 2. Current Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Flutter app │  │ Admin React │  │ Patient web │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              ┌───────────────────┐
              │ FastAPI (single)  │  ← workers, OTP, rate limits, Socket.IO in-process
              │ Render deploy     │
              └─────────┬─────────┘
                        ▼
              ┌───────────────────┐
              │ PostgreSQL (Neon) │  pool max_size=10
              └───────────────────┘
                        │
              Cloudinary / Razorpay / PharmaSync / Agora / Brevo (external)
```

**Deploy model today:** FastAPI on Render → Neon Postgres; Admin on Vercel; Flutter → API base URL. No Redis, no separate worker fleet, no Socket.IO Redis adapter, no documented read replicas.

**Strengths:** Clear domain modules; service extraction for pharmacy, lifecycle, community, partners; SQL migrations through 040; request-id logging.

**Weaknesses:** Stateless API claim is false (in-memory state); horizontal scale without sticky sessions + shared store loses OTP, rate limits, and realtime events.

---

## 3. Module-by-Module Findings

Each issue uses: Severity · Root Cause · Business Impact · Technical Impact · Solution · Est. Improvement · Risk if Unfixed · Priority.

### 3.1 Authentication & Authorization

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| A1 | OTP store is process-local | Critical | `otp_storage.py` in-memory dict | Login/OTP fails across instances / restarts | Split-brain OTP | Redis (or DB) OTP with TTL | Enables multi-instance auth | Broken HA login | P0 |
| A2 | Rate limits process-local | High | `rate_limit.py`, partner_auth in-memory | Brute-force protection weak behind LB | Per-process counters | Redis sliding window | Consistent abuse control | Abuse / lockout bypass | P0 |
| A3 | Sync bcrypt on event loop | High | Controllers call `bcrypt.checkpw` sync | Login latency spikes under load | Event-loop blocking | `run_in_executor` or async hash lib | +30–50% login throughput | Cascading timeouts | P1 |
| A4 | Ownership helpers exist | — | `utils/ownership.py` | Strong patient binding | Good pattern | Keep / extend to all mutators | — | — | Keep |

### 3.2 Super Admin / Hospital Admin / Departments / Doctors

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| H1 | Admin loads all appointments/users/doctors | Critical | `AdminContext` / unbounded model queries | Dashboards freeze as data grows | Memory + slow API | Server pagination + filters | 10× list latency drop | Ops UI unusable | P0 |
| H2 | Dean cancel missing hospital check | High | `dean_controller.cancel_appointment` | Cross-hospital cancel risk | Isolation gap | Assert `appt.hospital_id` | Security correctness | Trust / compliance | P0 |
| H3 | Doctor catalog unbounded | High | `get_all_doctors()` | Mobile/web boot slow | Full table scan to client | Cursor/limit APIs | Faster cold start | Client OOM | P1 |

### 3.3 Reception, Patient, Appointment Booking, Dynamic Scheduling

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| B1 | Slot `FOR UPDATE` not held in transaction | Critical | `get_slot_by_id_for_update` uses `db.fetch_row` (releases conn) | Double-bookings under concurrency | Race on capacity | Single `acquire` + transaction like payments | Correct booking under storm | Lost slots / angry patients | P0 |
| B2 | Capacity check then book on separate conns | High | Booking path in `user_controller` | Overbooking possible | Non-atomic check | Atomic UPDATE … WHERE status='available' RETURNING + capacity in same TX | Deterministic slots | Revenue/ops disputes | P0 |
| B3 | Reception polls 8–15s | Medium | TodaysOperations / QueueManager intervals | Delayed desk UX under load | API stampede | Socket rooms per hospital/doctor | −80% poll traffic | API saturation | P1 |

### 3.4 Queue Management & QR Check-in

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| Q1 | Token = max+1 without lock | High | `queue_service.assign_token_number` | Duplicate tokens | Race | `SERIAL` / advisory lock / `UPDATE … RETURNING` | Correct ordering | Chaos at check-in | P0 |
| Q2 | No dedicated queue Socket emit | Medium | Queue is REST-only | Staff/patients refresh heavily | Poll load | Emit `queue_updated` to doctor/hospital rooms | Lower latency + load | Missed “your turn” | P1 |
| Q3 | Queue lists not paginated | Medium | Full day appointments in Python | Large hospitals slow | CPU/memory | Limit + indexed filters | Faster queue API | Desk lag | P2 |

### 3.5 Video Consultation

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| V1 | Client polls status/chat 1–2s | Medium | Flutter video screens | Battery + API load during calls | Stampede | Socket/SSE for status; keep Agora for media | Large API reduction | API melt during peak clinics | P1 |
| V2 | Agora token ownership gated | — | `consultation_controller` + session gate | Good access control | Solid | Keep | — | — | Keep |

### 3.6 Consultation, Prescription, EMR

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| E1 | Uploads sync Cloudinary, no size/MIME cap | High | Controllers read full body then upload | DoS via large uploads; slow requests | Event-loop block | Size limit middleware; executor; MIME allowlist | Safer + faster API | Outages / cost spikes | P0 |
| E2 | Local `/uploads` still mounted | Low | `main.py` static mount | Ambiguous storage story | Dual paths | Deprecate local; Cloudinary-only | Cleaner ops | Orphan files | P2 |

### 3.7 Pharmacy Integration

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| P1 | Webhook retry without SKIP LOCKED | High | Worker `LIMIT 20` multi-instance unsafe | Duplicate partner deliveries | Race | `FOR UPDATE SKIP LOCKED` claim | Idempotent multi-worker | Partner confusion | P1 |
| P2 | Signing + backoff + persistence | — | `partner_webhook_service` + migration 025 | Strong foundation | Good | Keep; add DLQ metrics | — | — | Keep |
| P3 | PharmaSync connect path present | — | Migration 038 + provision service | Hospital–pharmacy link | Good | Harden secrets rotation | — | — | Keep |

### 3.8 Laboratory Integration

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| L1 | CRUD/directory only; no LIS/HL7 | Medium | Lab models are booking forms | Not enterprise lab sync | No result ingest | Partner lab webhook contract (Phase 3) | Real integration | Manual workflows | P3 |

### 3.9 Payments

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| Pay1 | Claim uses transactional FOR UPDATE | — | `payment_transaction_model` | Idempotent fulfillment | Correct pattern | Replicate for slots/queue | — | — | Keep |
| Pay2 | Payment WS unauthenticated | High | `/payment-updates` no JWT | Info leak / noise | Unauth subscribe | JWT + appointment ownership | Secure realtime | Privacy risk | P0 |
| Pay3 | Duplicate callbacks designed for | — | Claim lock | Safe under Razorpay retries | Good | Cover with load harness | — | — | Keep |

### 3.10 Reports & Analytics

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| R1 | Aggregations often in Python over full lists | Medium | Dean/admin controllers | Slow dashboards | CPU/memory | SQL aggregates + date bounds | 5–20× faster dash | Ops blind | P2 |
| R2 | No analytics cache | Medium | No Redis | Repeated heavy queries | DB load | Redis TTL for dash KPIs | Lower DB QPS | Neon cost/latency | P2 |

### 3.11 Notifications

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| N1 | SMS is stub (log only) | High | `sms_service.py` | Production SMS never sent | False sense of delivery | Wire provider + retry queue | Real SMS | Missed reminders | P1 |
| N2 | Email/FCM fire-and-forget | Medium | `create_task` without DLQ | Silent drop on crash | No retry | Outbox table + worker | Reliable notify | Missed appointments | P1 |
| N3 | WhatsApp mostly deep-links | Medium | No WA Business API | Incomplete channel | UX only | Optional WA API Phase 3 | Broader reach | Ops friction | P3 |

### 3.12 WebSockets / Realtime

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| W1 | No Redis Socket.IO adapter | Critical | `socket_service.py` in-process | Multi-instance misses events | Sticky-only | `socketio.AsyncRedisManager` | True HA realtime | Broken desks after scale-out | P0 |
| W2 | Room joins unauthenticated | High | `join_*_room` without JWT | Eavesdrop on rooms | Auth gap | Auth on connect + join ACL | Secure rooms | PHI exposure | P0 |
| W3 | Global emits for some events | Medium | Broadcast helpers | Unnecessary fan-out | Bandwidth | Room-scoped only | Lower WS cost | Noise | P2 |
| W4 | Payment WS in-memory map | High | `websocket_service.py` | Same HA failure | Process-local | Unify on Socket.IO + Redis | Consistent realtime | Lost payment UX | P1 |

### 3.13 API Gateway / Enterprise Integrations / Medical Community

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| I1 | Partner HMAC + scopes + RPM | — | `partner_auth` | Solid B2B surface | RPM still in-memory | Redis RPM | Multi-instance partners | — | P1 |
| I2 | Community FTS + quotas | — | Migrations 039–040 | Good Phase 2/3 feature | Limit 20 no offset | Add cursor pagination | Scale feed | Slow hub | P2 |
| I3 | Community sockets specialty rooms | Medium | Same Redis gap | Works on 1 instance | HA break | Redis adapter | Live Q&A at scale | Missed doctor alerts | P1 |

### 3.14 Search

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| S1 | Doctors/hospitals no FTS | High | ILIKE / full fetch | Slow search at catalog growth | Seq scans | `pg_trgm` + GIN or OpenSearch | Sub-100ms search | Abandon booking funnel | P1 |
| S2 | Patient search LIMIT 20 ILIKE | Medium | `user_model.search_users` | OK small; weak large | No trgm | trgm index | Faster reception search | Missed patients | P2 |
| S3 | Community FTS exists | — | Migration 040 | Good | Keep; add pagination | — | — | Keep |

### 3.15 File / Image Uploads

See E1/E2. Cloudinary signed delivery for private PDFs is a strength (`cloudinary_delivery.py`).

### 3.16 Dashboards / Mobile APIs / Admin APIs

| # | Issue | Sev | Root Cause | Business | Technical | Solution | Est. Improve | Risk | Pri |
|---|--------|-----|------------|----------|-----------|----------|--------------|------|-----|
| D1 | Flutter fetch-all doctors/hospitals | Critical | Providers + `fetchAll` | App memory/network blow-up | Client “pagination” only | Server page/cursor APIs | Scale catalogs | Crash on large networks | P0 |
| D2 | Flutter no Socket.IO; queue poll 8s | High | No `socket_io_client` | Live queue lag + stampede | HTTP storm | Socket + poll fallback | −70% queue API | API overload | P1 |
| D3 | No connectivity/offline stack | Medium | `connectivity_plus` unused | Poor offline UX | Failed calls only | Banner + queue writes | Trust | Support load | P2 |
| D4 | Admin/patient web no code-splitting | High | Static imports in App.jsx | Slow first paint | Large bundles | `React.lazy` + chunks | Faster TTI | Abandoned sessions | P1 |
| D5 | Context value object rebuilt every render | Medium | Nested providers | Extra re-renders | CPU | Split contexts / query lib | Smoother UI | Jank | P2 |
| D6 | EmergencyTrack socket dep missing | Medium | Patient web | Dead feature | Broken import path | Add dep + route or remove | Clarity | Confusion | P2 |

---

## 4. Database Deep Dive

### What is good

- Migrations and indexes for appointments, payments, pharmacy, partners, community FTS (`006`, `014`, `025`, `031`–`040`).
- Payment fulfillment uses real transactional `FOR UPDATE`.
- asyncpg pool with Neon-aware `statement_cache_size=0`.

### Critical / High gaps

| Topic | Finding | Action |
|-------|---------|--------|
| Pooling | `max_size=10` in `db.py` | Raise via config; put PgBouncer in front; size for workers + API |
| Transactions | Slot `FOR UPDATE` via `fetch_row` is a no-op lock | Hold connection in `async with pool.acquire()` + `transaction()` |
| Queue | Token race | Sequence or locked update |
| N+1 / unbounded | `get_all_appointments`, doctor lists, dean aggregations | Mandatory `LIMIT`/`cursor` on list APIs |
| Partitioning | Not present | Phase 3: partition appointments by month/hospital |
| Archiving | Community archive job only | Extend to closed appointments / audit |
| Read replicas | Not used | Route read-heavy dashboards to replica |
| VACUUM / growth | Rely on Neon defaults | Monitor bloat; archive old rows |
| Backup/restore | Neon snapshots assumed; no runbook in-repo | Document RPO/RTO + restore drill |
| Deadlocks | Unlikely until booking TX fixed; then test | Booking + payment storm harness |

---

## 5. API Layer Review

| Concern | Status | Notes |
|---------|--------|-------|
| AuthN/Z | Partial | JWT solid; some WS and dean mutators weak |
| Validation | Good | Pydantic on many routes |
| Pagination | Weak | Many list endpoints unbounded |
| Filtering/sorting | Partial | Some admin filters; inconsistent |
| Rate limiting | Process-local | Redis required for multi-instance |
| Caching | Almost none | Only openFDA in-memory TTL |
| Compression | Rely on reverse proxy | Enable gzip at CDN/LB |
| Versioning | Minimal | Prefer `/api/v1` for breaking changes |
| Idempotency | Payments good; booking/queue weak | Idempotency-Key for book/pay |
| Error handling | Risky | 500 returns traceback to clients |
| Logging | Good start | Request id + elapsed ms |
| Retry | Clients weak | Add Dio/axios backoff |

---

## 6. WebSocket Review

| Concern | Status |
|---------|--------|
| Connection limits | Not enforced app-side |
| Reconnect | Admin caps at 5 attempts — too low for desks |
| Heartbeat | Library defaults |
| Rooms | Present; joins unauthenticated |
| Memory | In-process maps grow with connections |
| Broadcast | Mix of room + global |
| Redis adapter | **Missing** |
| Horizontal scale | **Not ready** |
| Offline users | No durable push for missed events (FCM partial) |

---

## 7. FastAPI Review

| Concern | Status |
|---------|--------|
| DI | FastAPI `Depends` used |
| Async | Many paths async; sync bcrypt/Cloudinary block loop |
| DB sessions | Per-query acquire/release; no TX helper for booking |
| Background tasks | `create_task` in lifespan; not cancelled on shutdown |
| Middleware | Logging + rate limit |
| Response models | Inconsistent |
| Exception handling | Leaks internals |
| Bottlenecks | Pool 10, unbounded queries, sync I/O, poll fan-in |

---

## 8. Security Matrix

| Control | Score | Notes |
|---------|------:|-------|
| JWT | 75 | Prod min length validated in config |
| Refresh tokens | 70 | Rate-limited in-memory |
| Role permissions | 65 | Mostly route-level |
| Hospital isolation | 60 | Dean cancel gap |
| Patient isolation | 75 | Ownership helpers |
| Doctor isolation | 70 | Appointment-scoped video tokens |
| SQL injection | 85 | Parameterized asyncpg |
| XSS | 70 | React escaping; CSP recommended |
| CSRF | 65 | Token-based APIs; cookie CSRF less relevant |
| SSRF | 70 | Watch partner webhook URLs |
| Brute force | 40 | In-memory limits only |
| Password policies | 60 | Present but uneven |
| API keys (partners) | 80 | HMAC + scopes; encrypt secrets |
| Secrets management | 45 | Env files; dispatch default secret; rotate chat-pasted keys |
| Audit logs | 55 | Partial coverage |
| Encryption | 70 | TLS + Cloudinary signed; DB secrets for partners |
| Sensitive errors | 20 | Traceback in JSON 500s — **Critical** |

---

## 9. Load & Stress Observations (Modeled)

**Not measured at 50k–1M in this environment.** Estimates assume current single instance, pool=10, no Redis.

| Scenario | Expected behavior today | Gate to pass |
|----------|-------------------------|--------------|
| 1,000 concurrent users | Likely saturates pool; elevated p95; some 5xx/timeouts | Phase 1 pool + pagination |
| 5,000 concurrent | Severe queuing; OTP/rate limit irrelevant if single process | Phase 1+2 + multi-instance |
| 10,000 concurrent | Failure mode: pool exhaustion, WS memory, event-loop block | Horizontal API + Redis + PgBouncer |
| 50,000–100,000 concurrent | Not viable on current architecture | Full Phase 2 + CDN + workers |
| 500,000–1M registered | Storage/indexes OK if paginated; concurrency still fails | Partition + search + archive |
| **Booking storm 10k same slot** | High risk of double-book / capacity race (B1) | Transactional booking harness green |
| **Queue 100 doctors / 50k apts** | Token duplicates (Q1); poll meltdown | Sequence + sockets |
| **Pharmacy thousands Rx** | Webhooks OK single worker; multi-instance duplicate risk | SKIP LOCKED |
| **Payment thousands + dup callbacks** | Claim lock should hold | Harness green |

Run harnesses: see `fastapi_back/scripts/load/README.md`.

---

## 10. Caching Opportunities

| Cache | Priority | Candidate |
|-------|----------|-----------|
| Redis OTP / sessions / rate limits | P0 | Shared auth |
| Doctor/hospital directory | P1 | TTL 1–5 min |
| Slot availability windows | P1 | Invalidate on book |
| Dashboard KPIs | P2 | TTL 30–60s |
| Config / feature flags | P2 | Process + Redis |
| Search results | P2 | Short TTL |
| Community feed | P2 | Per-specialty TTL |

---

## 11. Monitoring Recommendations

| Layer | Tooling |
|-------|---------|
| Metrics | Prometheus + Grafana (API latency, pool wait, WS connections, webhook lag) |
| Logs | Structured JSON → centralized (Loki/Cloud) with `X-Request-ID` |
| Errors | Sentry (API + Flutter + Admin) |
| APM | OpenTelemetry traces on booking/payment paths |
| Health | `/health` deep check: DB, Redis (when added), queue depth |
| DB | Neon metrics + `pg_stat_statements` |
| WS | Connection count, room size, emit errors |
| Workers | Heartbeat gauges; DLQ alerts |

---

## 12. Failure-Mode Matrix

| Failure | Current behavior | Desired |
|---------|------------------|---------|
| DB slow | Timeouts cascade; pool blocks | Circuit breaker + degrade reads |
| Redis down | N/A today | Fail open rate-limit carefully; OTP fallback DB |
| Payment GW down | User sees error; claim safe | Clear UX + retry + reconcile job |
| Pharmacy API down | Retry worker backs off | DLQ + admin alert |
| Lab API | N/A (no external) | — |
| Network disconnect | Clients poll/fail | Offline banner + retry |
| API crash | OTP/WS/state lost; workers die | Stateless API + Redis + external workers |
| Worker crash | Retries resume if DB pending | Separate process + SKIP LOCKED |
| WS disconnect | Admin may stop after 5 reconnects | Infinite reconnect + resync snapshot |

---

## 13. Infrastructure, HA, DR

### Target topology (Phase 2+)

```
Clients → CDN → LB → N× API (stateless) → PgBouncer → Postgres primary
                  ↘ Redis (OTP, RL, Socket.IO, cache)
                  ↘ Worker fleet (webhooks, reminders, archive)
                  ↘ Read replica for dashboards/search
```

### Recommendations

- **Horizontal:** Stateless API + Redis adapter + sticky only as temporary.
- **Vertical:** Raise pool and CPU only after fixing event-loop blockers.
- **CDN:** Cloudinary already CDN-like; put Admin/Flutter web assets on CDN.
- **DR:** Document Neon PITR; quarterly restore drill; RPO ≤ 15m, RTO ≤ 1h target.
- **Secrets:** No default JWT secrets; rotate anything pasted in chat; vault/SSM in cloud.

---

## 14. Code Quality (Maintainability)

- Duplication across role controllers (login, upload, list patterns).
- SOLID improving via services; controllers still orchestrate too much.
- Naming generally clear; asyncpg models are SQL-centric (acceptable).
- Test coverage: enterprise smoke exists; load/chaos tests missing until harnesses.
- Docs pack is a maintainability strength.

---

## 15. Prioritized Roadmap

### Phase 1 – Critical before serious production concurrency (1–3 weeks)

1. Transactional slot booking (`acquire` + `FOR UPDATE` + mark booked in one TX).  
2. Queue token assignment via sequence / locked update.  
3. Configurable DB pool + PgBouncer guidance; stop returning traceback in 500s.  
4. Remove/override dispatch default `SECRET_KEY`; auth Socket.IO joins + payment WS.  
5. Hospital ownership check on dean cancel.  
6. Upload size/MIME limits; move Cloudinary off event loop.  
7. Server-side pagination on appointments, doctors, hospitals, admin users.  

**Exit criteria:** Booking storm harness shows single winner per slot; no traceback in prod responses; list APIs never return unbounded tables.

### Phase 2 – Performance & scalability (3–8 weeks)

1. Redis: OTP, rate limits, Socket.IO adapter, directory/slot cache.  
2. Extract background workers from API process; webhook `SKIP LOCKED`.  
3. Flutter Socket.IO (or SSE) for queue/consult; Dio retry + connectivity.  
4. Admin/patient web: `React.lazy`, shrink context, prefer sockets over poll.  
5. `pg_trgm`/FTS for doctor/hospital/patient search.  
6. Wire real SMS + notification outbox.  
7. Observability: Prometheus, Sentry, structured logs.  
8. Read replica for heavy reads.  

**Exit criteria:** 2+ API instances behind LB with correct OTP/WS; measured p95 targets on staging at 1k–5k concurrent.

### Phase 3 – Enterprise enhancements (code complete 2026-07-20)

1. Appointment **archive** monthly partition helper (`044` + `ensure_appointments_archive_partition`); hot table unpartitioned (Neon).  
2. Unified `/api/search` — Postgres FTS/ILIKE; optional `OPENSEARCH_*` + `DATABASE_READ_URL`.  
3. Lab partner **live** — `/api/v1/partner/lab/*` + FHIR-lite results (`043`).  
4. Microservice boundaries doc — modular monolith + extract triggers.  
5. Chaos probes (`CHAOS_ENABLED`) + `/api/ops/slo` + admin **SLO & Health** + Prometheus rules.  
6. WhatsApp Business API — delivered in Phase 2 (`whatsapp_service.py`).

**Exit criteria (ops):** Documented capacity from k6; HA/DR drills; Redis + workers in prod.

---

## 16. Certification Statement

MEDCLUES **is not** capable today of delivering a smooth, reliable, enterprise-grade experience for **very large numbers of concurrent users** across every module.

It **can** serve mid-scale multi-hospital operations on a **single API instance** with Neon, **after Phase 1 critical correctness and security fixes**, and with honest limits on concurrent booking, queue fan-out, and realtime.

**Re-certification path:** Complete Phase 1 + Phase 2, run `fastapi_back/scripts/load/` against staging at agreed concurrency tiers, fix regressions, then update this document with measured scores.

### Remediation progress (2026-07-20 evening)

Phase 1 + Phase 2 foundations applied (see [`CHANGES_2026-07-20.md`](../CHANGES_2026-07-20.md) §6–7): transactional booking, queue locks, pool config, security hardenings, Redis-ready OTP/RL/Socket.IO, separate worker process (`python -m app.workers.runner`), SMS providers, notification outbox, trgm search indexes, Flutter sockets + paging hooks, Admin/web `React.lazy` code-splitting.

**Phase 3 code** applied (see [`CHANGES_2026-07-20.md`](../CHANGES_2026-07-20.md) §8): search API, lab partner live, archive partition helper, chaos/SLO, microservice boundaries.

Remaining for full million-user certification: provision Redis + worker fleet in prod, measured k6 at agreed tiers, optional OpenSearch cluster, optional archive PARTITION CONVERT offline.

---

## Appendix A – Evidence Anchors

| Area | Path |
|------|------|
| Pool max 10 | `fastapi_back/app/config/db.py` |
| Slot FOR UPDATE no-op | `fastapi_back/app/models/doctor_slot_model.py` |
| Payment TX lock (good) | `fastapi_back/app/models/payment_transaction_model.py` |
| Queue token race | `fastapi_back/app/services/queue_service.py` |
| Traceback in 500 | `fastapi_back/main.py` |
| Dispatch secret default | `fastapi_back/app/routes/dispatch_routes.py` |
| Socket.IO no Redis | `fastapi_back/app/services/socket_service.py` |
| OTP in-memory | `fastapi_back/app/utils/otp_storage.py` |
| Rate limit in-memory | `fastapi_back/app/middleware/rate_limit.py` |
| SMS stub | `fastapi_back/app/services/sms_service.py` |
| Flutter fetch-all | `flutter_mobile/lib/services/doctor_service.dart` |
| Admin poll/socket | `admin/src/components/QueueManager.jsx`, `SocketContext.jsx` |

## Appendix B – Load Harness

See [fastapi_back/scripts/load/README.md](../../fastapi_back/scripts/load/README.md).
