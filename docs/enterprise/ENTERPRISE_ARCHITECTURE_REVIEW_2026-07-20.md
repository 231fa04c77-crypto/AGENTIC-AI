# MEDCLUES Enterprise Architecture Review

**Date:** 2026-07-20  
**Architecture decision:** **Keep Modular Monolith** (primary). Microservices only as future extraction if justified.  
**Non-regression:** All recommendations are **additive**, config-flagged where possible, **backward compatible**, and phased for zero-downtime.  
**This is an evolution review — not a rewrite.**

| Related docs |
|--------------|
| [ARCHITECTURE_README.md](../ARCHITECTURE_README.md) |
| [ENTERPRISE_SCALABILITY_AUDIT_2026-07-20.md](./ENTERPRISE_SCALABILITY_AUDIT_2026-07-20.md) |
| [REDIS_INTEGRATION_REPORT.md](./REDIS_INTEGRATION_REPORT.md) |
| [MICROSERVICE_BOUNDARIES.md](./MICROSERVICE_BOUNDARIES.md) |
| [DR_SLO_RUNBOOK.md](./DR_SLO_RUNBOOK.md) |
| [SECURITY_REPORT.md](./SECURITY_REPORT.md) · [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) |

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Current style? | **Modular monolith** — one FastAPI app, module packages, one PostgreSQL SoT |
| Redesign to microservices now? | **No** — unjustified cost/risk; preserve features |
| Enterprise-ready today? | **Partially** — code foundations for Redis/workers/locks/cache exist; **prod Redis + worker fleet + measured k6** still required for large concurrent claims |
| Safe path? | Incremental Phase 1 → 2 → 3 with rollback; never break Flutter/Admin/patient web UX |

```
Clients (Flutter / Admin React / Patient Web)
        │
        ▼
┌─────────────────────────────────────┐
│     MODULAR MONOLITH (FastAPI)      │
│  routes → controllers → services    │
│  models → PostgreSQL (SoT)          │
└──────────────┬──────────────────────┘
     ┌─────────┼─────────┐
     ▼         ▼         ▼
  Redis*    Workers*   Partners
  (opt)     (opt)      (APIs/webhooks)
```

\* Optional via env (`REDIS_URL`, `RUN_BACKGROUND_WORKERS_IN_API=false`). App runs without them (degraded multi-instance).

---

## 1. Overall Architecture Score

| Dimension | Pre-remediation (audit AM) | **Post Phase 1–3 code (now)** | Target after Phase 1 ops |
|-----------|---------------------------:|-----------------------------:|-------------------------:|
| Overall Architecture | 55 | **72**/100 | 78 |
| Security | 58 | **72**/100 | 80 |
| Scalability | 35 | **62**/100 | 75 |
| Performance | 50 | **65**/100 | 78 |
| Maintainability | 60 | **68**/100 | 75 |
| Database | 62 | **75**/100 | 82 |
| Reliability / Observability | 45 | **60**/100 | 78 |
| Partner integrations | 55 | **70**/100 | 78 |
| Mobile (Flutter) | 52 | **62**/100 | 72 |
| React (Admin/Web) | 48 | **60**/100 | 70 |

**Weighted enterprise readiness (smooth large concurrent load):** **~68/100** (was ~48).  

**Certification:** Still **NOT certified** for 100k concurrent / multi-region HA until:

1. `REDIS_URL` + HA Redis in production  
2. Separate worker processes in production  
3. Staging k6 from `fastapi_back/scripts/load/` passes agreed tiers  
4. Neon pool / PgBouncer sized for multi-instance  

**Certified (caveated):** Single-region modular monolith, mid-scale multi-hospital, with Redis enabled and Phase 1 correctness fixes live.

---

## 2. Security Score — **72/100**

### Strengths (preserve)

| Control | Status |
|---------|--------|
| JWT access + refresh (PG `refresh_tokens`) | Live |
| RBAC (patient / doctor / dean / reception / admin / partner) | Live |
| Hospital isolation (dean cancel ownership checks) | Hardened |
| Partner API key + HMAC | Live |
| Signed webhooks + retry outbox | Live |
| CORS allowlist (prod) | Live |
| Upload MIME/size limits | Live |
| Rate limits (Redis when configured) | Live |
| OTP / password-reset in Redis | Live |
| Access-token blacklist on logout | Additive |
| Dispatch JWT uses real secret (no insecure prod default) | Fixed |
| 500 responses hide tracebacks unless DEBUG | Fixed |

### Remaining gaps (additive fixes only)

| Gap | Risk | Phase | Break existing? |
|-----|------|-------|-----------------|
| Enforce blacklist check in all auth middleware paths | Medium | 1 | No |
| Secrets via vault / platform secret store (not only `.env`) | Medium | 1–2 | No |
| Circuit breakers on partner HTTP | Medium | 2 | No |
| Field-level encryption for highly sensitive EMR blobs (if required by policy) | Low–Med | 3 | No if additive columns |
| Formal penetration test + dependency SCA in CI | High value | 1 | No |

### Principles (unchanged)

- Hospital / patient isolation enforced in services, not only UI  
- Partners never get DB access — APIs + signed webhooks only  
- AI must never get raw DB credentials (see §9)

---

## 3. Scalability Score — **62/100**

### Verified support

| Capability | Status |
|------------|--------|
| Multiple FastAPI instances | Code-ready when Redis set (OTP/RL/Socket.IO/cache) |
| Redis | Optional; docker-compose + cache/OTP/RL/slot hold shipped |
| Worker scaling | `python -m app.workers.runner` + `RUN_BACKGROUND_WORKERS_IN_API=false` |
| Read replica readiness | `DATABASE_READ_URL` for search/heavy reads |
| Socket.IO scaling | Redis adapter when `REDIS_URL` set |
| Appointment archive / partition helper | Migrations 042–044 |
| CDN / object storage | Cloudinary (existing) |

### Bottlenecks remaining

| Bottleneck | Mitigation | Phase |
|------------|------------|-------|
| Neon connection saturation under stampede | PgBouncer / pool sizing; keep `DB_POOL_*` modest per instance | 1 |
| Fat admin dashboard SQL on cold cache | Already Redis-cached 5m; keep invalidation | 1 |
| Community feed growth | Cursor pagination (additive query params) | 2 |
| Million-row appointments hot path | Archive worker + optional partition convert offline | 1–2 |
| Realtime payment WS process-local | Prefer Socket.IO rooms or Redis pub/sub bridge | 2 |

### Performance targets (recommended SLOs)

| Metric | Target | Notes |
|--------|--------|-------|
| General API p95 | **&lt; 200 ms** | Cached directory &lt; 50 ms |
| Auth login p95 | **&lt; 150 ms** | bcrypt already off event loop |
| Booking p95 | **&lt; 300 ms** | PG claim + Redis hold |
| Search p95 | **&lt; 150 ms** | Cache + trgm / OpenSearch |
| AI first token / full reply | **&lt; 2 s** perceived | Async tools; never block booking |
| Availability | **99.9%** | Needs multi-instance + Redis HA + health |
| Concurrent users | **100k+ aspirational** | Requires measured capacity plan — not claimed today |

---

## 4. Performance Score — **65/100**

### Wins already in codebase (do not regress)

- Transactional slot claim (`FOR UPDATE` / `SKIP LOCKED`)  
- Queue token advisory lock  
- Pagination caps on hot lists  
- Redis cache-aside (doctors, hospitals, specialties, dashboards, search, community)  
- Write-path cache invalidation  
- Flutter Dio retry / offline banner / socket hooks  
- Admin `React.lazy`  
- Prometheus middleware + `/metrics` + `/health/deep`  

### Next safe gains

| Item | Affect existing? | Effort | Risk | Rollback |
|------|------------------|--------|------|----------|
| Ensure `REDIS_URL` in prod | No | Low | Low | Unset env |
| Dean/reception dashboard cache | No | Low | Low | Disable cache keys |
| Medicine autocomplete → Redis | No | Low | Low | Fallback memory |
| Flutter list virtualization audit | No (UX same) | Med | Low | Revert PR |
| Gzip / CDN for static admin | No | Low | Low | Disable CDN |
| Query `EXPLAIN` on top 10 slow routes | No | Med | Low | N/A |

---

## 5. Maintainability Score — **68/100**

### Module ownership map (modular monolith)

| Module | Owns | Public surface | Must not |
|--------|------|----------------|----------|
| Auth | JWT, OTP, refresh, RBAC helpers | `/api/auth`, `/api/otp`, login routes | Touch appointment tables for login |
| Hospitals / Doctors | Directory, profiles, schedules | `/api/hospital*`, `/api/doctor*`, specialty | Bypass slot service for booking |
| Appointments / Scheduling | Book, cancel, lifecycle | `/api/user/book*`, appointment routes | Cache booked rows as SoT |
| Queue | Tokens, snapshots, socket emits | Doctor/reception queue APIs | Allocate tokens without advisory lock |
| Reception | Walk-in, check-in, desk ops | `/api/reception/*` | Cross-hospital data |
| Consultation / Rx / EMR | Clinical write paths | Doctor consultation routes | Expose EMR to partners wholesale |
| Pharmacy | Orders, PharmaSync provision | Partner + user + dean pharmacy | Share DB with PharmaSync |
| Laboratory | Bookings + partner FHIR-lite | `/api/lab`, `/api/v1/partner/lab` | Cache results/reports |
| Emergency | Cases, dispatch, partners | Emergency + partner emergency | Skip audit |
| Payments | Razorpay, webhooks, WS | `/api/payments*` | Dual-write money outside PG |
| Community | Q&A, moderation | `/api/user|doctor|admin|dean/community` | Diagnose as medical advice |
| AI | Chat / tools (future RAG) | `/api/ai*` | Direct SQL |
| Search | Unified search | `/api/search` | Return other patients to public |
| Partners | Keys, scopes, catalog | `/api/admin/partners*`, domain stubs | Issue prod keys casually |
| Notifications | Outbox + channels | Internal services | Block HTTP request thread |
| Admin / Settings / Audit | Platform config, logs | `/api/admin/*` | Skip audit on money/clinical changes |
| Analytics / Dashboards | Aggregates | dashboard/charts routes | Bypass hospital scope for dean |

**Communication rule:** Controllers → **Services** → Models. Prefer services over cross-module raw SQL. Incremental extraction only — no mass rewrite.

---

## 6. Database Assessment — **75/100**

| Area | Assessment | Action |
|------|------------|--------|
| Indexes / migrations | Strong (through 044+) | Keep runner; never hand-edit prod schema |
| Transactions | Booking/payment/queue hardened | Preserve |
| Pool | `DB_POOL_MIN/MAX` configurable | Size per instance; PgBouncer in front of Neon |
| Read replica | `DATABASE_READ_URL` ready | Wire search/reports only |
| Partitioning | Archive helper; hot table unpartitioned (Neon-friendly) | Offline convert if archive grows huge |
| Integrity | FKs / ownership checks | Continue; no destructive drops |
| Backup / RPO | Neon PITR + [DR_SLO_RUNBOOK](./DR_SLO_RUNBOOK.md) | Quarterly restore drill |
| Deadlocks | Reduced by advisory locks + claim TX | Monitor `pg_stat_activity` |

**Do not:** Split one Neon DB per microservice. **Do:** archive cold appointments; index for filters; EXPLAIN slow queries.

---

## 7. Redis Integration Plan

**Principle:** PostgreSQL = SoT. Redis = optimization. Feature flag = presence of `REDIS_URL`.

Full matrix: [REDIS_INTEGRATION_REPORT.md](./REDIS_INTEGRATION_REPORT.md).

| Use | Structure | TTL | Invalidation | DB load ↓ | API gain | Status |
|-----|-----------|-----|--------------|-----------|----------|--------|
| Doctor/hospital/specialty/config | String JSON | 10m–24h | Write delete | High | High | **Shipped** |
| Dashboards | String JSON | 5m | Prefix delete | Very high | Very high | **Shipped** |
| Search suggestions | String JSON | 30m | Directory writes | High | High | **Shipped** |
| Community popular/categories | String JSON | 15m–1h | Publish | Med | Med | **Shipped** |
| Queue snapshot | String JSON | 15s | TTL | Med | High under poll | **Shipped** |
| OTP / pwd reset | String | 5–10m | Consume | N/A | HA | **Shipped** |
| Rate limit | ZSET | ~60s | Auto | N/A | Abuse control | **Shipped** |
| Slot hold | SET NX | 5m | Release/book | N/A | Race safety | **Shipped** |
| Socket.IO adapter | Pub/Sub | — | — | N/A | Multi-instance WS | **Shipped** |
| Session blacklist | String | ~7d | Logout | N/A | Logout force | **Shipped** |
| Refresh tokens | — | — | — | — | — | **Keep in PG** (audit) |
| Notification durable queue | — | — | — | — | — | **Keep PG outbox** |
| Conversation AI context | String/Hash | 30m | End session | Low | AI UX | Phase 2 |
| Redis Streams notify fan-out | Stream | — | Consumer ack | Med | Throughput | Phase 3 if needed |

**Affect existing functionality?** No when Redis down (fallback).  
**Backward compatible?** Yes.  
**Rollback:** Unset `REDIS_URL`.

---

## 8. Background Worker Architecture

### Current (preserve)

```
API request → write notification_outbox / webhook_deliveries (PG)
                    │
                    ▼
         worker loop (in API or app.workers.runner)
         FOR UPDATE SKIP LOCKED → SMS/email/FCM/WhatsApp/webhook
```

Jobs today: webhook retry, notification outbox, community archive, appointment archive, reminders, no-show.

### Target worker layout (same codebase, separate process)

| Worker group | Jobs | Blocking API? |
|--------------|------|---------------|
| `notify` | Email, SMS, WhatsApp, FCM, retries | Never |
| `ops` | Webhook retry, archive, reminders, no-show | Never |
| `ai` (future) | RAG ingest, moderation, embeddings | Never |
| `reports` (future) | PDF/analytics exports | Never |

### Rules

- Workers **never** block HTTP handlers  
- Durable state in **Postgres outbox** (not only Redis lists)  
- Scale workers independently: `replicas` of `Dockerfile.worker`  
- Config: `RUN_BACKGROUND_WORKERS_IN_API=false` in prod multi-instance  

| Metric | Value |
|--------|-------|
| Affect existing? | No |
| Backward compatible? | Yes |
| Effort | Low–Med |
| Risk | Low |
| Rollback | Set workers back in API |
| Perf gain | Lower API p95 / CPU under notify storms |

---

## 9. AI Medical Assistant Architecture (Phase 2 design)

### Non-negotiables

- **Never** connect AI to PostgreSQL directly  
- Only **internal secure APIs** + Tool Calling  
- **RAG** for FAQs / community knowledge / help docs  
- **RBAC:** tools filtered by role (patient ≠ admin)  
- **Disclaimer:** never diagnose; never replace clinicians  
- Additive routes under `/api/ai/*`; feature flag `AI_ASSISTANT_ENABLED`

```
User → Flutter/Admin → FastAPI AI gateway (auth + RBAC)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         LLM provider    RAG store      Tool runner
         (Gemini/etc)   (embeddings)   (internal HTTP only)
                              │
                              ▼
                    Existing MedClues APIs
              book / search / pharmacy / labs / tickets
```

### Allowed tools (examples)

| Tool | Role | Maps to existing |
|------|------|------------------|
| `search_doctors` | Patient | Doctor list/search |
| `search_hospitals` | Patient | Hospital list |
| `book_appointment` | Patient | Existing book API + slot hold |
| `cancel_appointment` | Patient | Existing cancel |
| `track_pharmacy_order` | Patient | User pharmacy APIs |
| `search_labs` | Patient | Lab list |
| `search_community` | Patient | Community search |
| `platform_faq` | All | RAG only |
| `create_support_ticket` | Patient | Future/help — additive |

### Forbidden

- Clinical diagnosis / prescription generation as medical advice  
- Raw SQL / model-layer access  
- Bypassing payment or hospital isolation  

| Metric | Value |
|--------|-------|
| Affect existing? | No if flagged off |
| Backward compatible? | Yes |
| Effort | High (product) |
| Risk | Med (prompt/safety) |
| Rollback | Flag off + remove route mount |
| Perf | Async; target &lt; 2s UX |

---

## 10. Partner Integration Review — **70/100**

| Partner | Pattern | Status | Gaps |
|---------|---------|--------|------|
| PharmaSync | Provision HMAC + Rx/order webhooks + partner pharmacy APIs | Connect flow live | Confirm live provision path + webhook URL with vendor |
| Laboratory | FHIR-lite partner routes + events | Live (Phase 3) | Real LIS vendors still onboard |
| Razorpay | Webhook + ownership | Live | Keep idempotent claim locks |
| Emergency partners | HMAC + cases | Live | Continue sandbox first |
| SMS / Email / WhatsApp | Providers via services + outbox | Live | Monitor provider SLAs |
| Cloudinary / Agora | SDK/API | Live | Timeouts already recommended |

### Shared requirements (all partners)

| Requirement | Status / action |
|-------------|-----------------|
| Secure APIs (TLS) | Required |
| Signed webhooks | Live |
| Retry + backoff | Live (`SKIP LOCKED`) |
| Idempotency keys on mutating partner calls | Enforce/document Phase 1–2 |
| Timeouts on outbound HTTP | Audit remaining callers Phase 1 |
| Circuit breaker | Phase 2 additive wrapper |
| Never share DB | Enforced by design |

Handoff: [PHARMASYNC_CONNECT_HANDOFF.md](../PHARMASYNC_CONNECT_HANDOFF.md)

---

## 11. Monitoring & Observability Plan

| Pillar | Now | Next (Phase 1) |
|--------|-----|----------------|
| Metrics | `/metrics` Prometheus middleware | Grafana dashboards |
| Health | `/health`, `/health/deep`, `/api/ops/slo` | Alert on Redis/DB down |
| Logs | Request-id structured logs | Central log drain (e.g. Loki/ELK) |
| Tracing | Partial | OpenTelemetry → Tempo/Jaeger (additive) |
| Redis | Ping + cache hit in SLO | Redis Insight + eviction alerts |
| Workers | Process logs | Queue depth gauges from outbox counts |
| AI (future) | — | Latency, tool error rate, refusal rate |
| Alerts | SLO rules file | Wire Prometheus Alertmanager |

Rules file: [prometheus/slo_rules.yml](./prometheus/slo_rules.yml)

| Affect existing? | No |
| Rollback | Disable scrape / alerts |

---

## 12. Future Microservice Readiness (do **not** extract now)

| Future service | Extract when | Complexity | Benefit |
|----------------|--------------|------------|---------|
| Notification Service | Outbox backlog / provider CPU dominates API | Med | Isolate send volume |
| AI Service | Heavy RAG/GPU / separate team | Med–High | Independent scale |
| Search Service | Catalog QPS blows PG even with OpenSearch proxy | Med | Specialized index ops |
| Realtime Gateway | Socket fan-out dominates RAM/CPU | Med | Isolate WS |
| Community Service | Rarely — only if independent product line | High | Usually not worth it |
| Analytics Service | Heavy OLAP reports | Med | Protect OLTP |

**Migration approach if ever needed:** strangler — keep modular monolith; extract **one** boundary behind same URL via gateway; dual-write outbox first; feature flag; rollback = route back to monolith.

See [MICROSERVICE_BOUNDARIES.md](./MICROSERVICE_BOUNDARIES.md).

---

## 13. Risks & Bottlenecks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claiming “100k concurrent” without k6 | High (business) | Measure; publish honest capacity |
| Prod without Redis + multi-instance | High | Enable Redis before second replica |
| Neon pool exhaustion | High | PgBouncer + per-instance pool limits |
| Fat controllers still mixed with services | Med | Incremental service moves only |
| Partner provision endpoint not live | Med | Vendor checklist |
| AI hallucination / diagnosis | High if enabled carelessly | Tools + RBAC + disclaimers + flag |
| Schema rewrite temptation | High | Forbid destructive migrations |

---

## 14. Priority Improvements

### P0 — enable what you already built (ops)

1. Set production `REDIS_URL` (HA)  
2. Run workers separately  
3. Confirm pool + PgBouncer  
4. Run k6 harnesses on staging  
5. Wire Grafana to `/metrics`  

### P1 — safe code/ops polish

6. Auth middleware blacklist check  
7. Idempotency headers on partner mutating APIs  
8. Dean/reception dashboard cache  
9. Community cursor pagination  
10. Outbound HTTP timeout audit + circuit breaker wrapper  

### P2 — product enhancements (flags)

11. AI Medical Assistant (RAG + tools)  
12. OpenSearch cluster if search SLA misses  
13. Advanced analytics export worker  
14. Formal pen-test  

### P3 — only if metrics demand

15. Dedicated notification / realtime / AI process or service  

---

## 15. Detailed Implementation Roadmap

### Phase 1 — Safe, non-breaking (1–3 weeks)

| Work | Affect existing? | BC? | Effort | Risk | Rollback | Est. gain |
|------|------------------|-----|--------|------|----------|-----------|
| Prod Redis + workers | No | Yes | Low | Low | Env revert | Multi-instance ready |
| Monitoring dashboards | No | Yes | Low | Low | Disable | MTTD ↓ |
| DB EXPLAIN top routes + indexes | No* | Yes | Med | Low | Drop new index | p95 ↓ 10–30% |
| Blacklist enforce + partner idempotency docs | No | Yes | Low | Low | Flag | Security ↑ |
| PgBouncer | No | Yes | Med | Low | Direct Neon | Conn stability |

\* Additive indexes only.

### Phase 2 — Optional enhancements (3–8 weeks)

| Work | Affect existing? | BC? | Effort | Risk | Rollback | Est. gain |
|------|------------------|-----|--------|------|----------|-----------|
| AI Assistant behind flag | No if off | Yes | High | Med | Flag off | New capability |
| OpenSearch optional | No | Yes | Med | Low | Unset URL | Search p95 |
| Circuit breakers | No | Yes | Med | Low | Disable wrapper | Partner resilience |
| Community/analytics UX | Additive | Yes | Med | Low | Hide UI | Engagement |
| Flutter perf pass | UX same | Yes | Med | Low | Revert | Jank ↓ |

### Phase 3 — Future evolution (only if justified)

| Work | Affect existing? | BC? | Effort | Risk | Rollback | Est. gain |
|------|------------------|-----|--------|------|----------|-----------|
| Dedicated notify/realtime/AI process | Ops only | Yes | High | Med | Merge back to monolith process | Isolate load |
| Selective microservice | High if rushed | Strangler | High | High | Route to monolith | Only if measured |

---

## Critical non-regression checklist

- [x] Modular monolith retained  
- [x] No rewrite of working booking/queue/payment/pharmacy flows  
- [x] APIs remain backward compatible  
- [x] Flutter / Admin / patient web UX unchanged by architecture review  
- [x] Redis/workers/AI described as **additive**  
- [x] PostgreSQL remains SoT  
- [x] Partners stay API/webhook only  
- [x] Every phase has rollback  
- [x] Destructive schema changes rejected  

---

## Final architecture statement

> **MEDCLUES remains a Modular Monolith.**  
> Strengthen it with Redis (optimization), workers (async), observability, partner hardening, and an optional AI gateway — without removing features or forcing microservices.  
> Evolve with **small, reversible phases**. Claim large-scale only after **measured** load tests.

**Local finish (2026-07-20):** `REDIS_URL` enabled, Redis connected, migration 045 applied, API smoke green — see [OPS_FINISH_COMPLETE.md](./OPS_FINISH_COMPLETE.md).

**Next staging/prod step:** HA Redis + separate workers, run `fastapi_back/scripts/load/` (k6), then promote — before any marketing claim of 100k concurrent users.

### Implementation progress (same day — code)

| Review item | Status |
|-------------|--------|
| JWT blacklist enforcement | Done (`auth.py`) |
| Circuit breaker + partner timeouts | Done (PharmaSync provision + shared helpers) |
| Partner `Idempotency-Key` | Done (pharmacy + lab mutating routes) |
| Dean/reception dashboard cache | Done |
| Medicine autocomplete Redis | Done |
| Community cursor/offset | Done (additive query params) |
| AI Assistant (flagged) | Done `/api/ai/assistant/chat` (`AI_ASSISTANT_ENABLED`) |
| Hot-path indexes | Migration `045` |
| Prometheus/Grafana local | `docker compose --profile obs` |
| Local Redis + finish script | Done — [OPS_FINISH_COMPLETE.md](./OPS_FINISH_COMPLETE.md) |
| Migration 045 applied | Done (Neon) |
| `/health/deep` redis | ok (local verify 2026-07-20) |

Still ops-only (not automatable in-repo): provision HA Redis in production, PgBouncer sizing on Neon, pen-test, measured k6 on staging, PharmaSync live webhook path confirmation.
