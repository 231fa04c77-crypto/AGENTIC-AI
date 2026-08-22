# MedClues Microservices — Complete Plan

**Audience:** Product + engineering (how microservices work, how they map to our roles, what to do next)  
**Status of the app today:** **Modular monolith** (one FastAPI API, one PostgreSQL, optional Redis + workers)  
**Ready to go full microservices now?** **No — not required and not recommended yet**  
**Ready to prepare / scale out gradually?** **Yes**

Related docs:

- [MICROSERVICE_BOUNDARIES.md](./MICROSERVICE_BOUNDARIES.md) — short extract rules  
- [ARCHITECTURE_NOTES.md](./ARCHITECTURE_NOTES.md) — client/stack conventions  
- [ARCHITECTURE_README.md](../ARCHITECTURE_README.md) — plain-language system map  
- [ROUTES.md](./ROUTES.md) — API prefixes  

---

## 1. What is a microservice? (plain language)

### Monolith (what we have)

One backend application (`fastapi_back`) that:

- Serves **all** APIs (patients, doctors, dean, admin, reception, partners)
- Talks to **one** primary database (PostgreSQL / Neon)
- Optionally uses Redis, Socket.IO, and background workers

Like one hospital building where every department shares the same corridors and power supply.

### Microservices

Many small backends, each owning **one business area**, for example:

| Service example | Owns |
|-----------------|------|
| Auth / Identity | Login, JWT, roles, sessions |
| Appointment | Book, cancel, lifecycle |
| Queue | Tokens, live queue |
| Payments | Razorpay, invoices |
| Pharmacy / Lab partners | Partner APIs + webhooks |
| Notifications | SMS, FCM, email, WhatsApp |
| Search | Doctors / hospitals / catalog search |
| AI Assistant | Chat gateway + tools |

Clients (Flutter / Admin / Web) usually talk through an **API Gateway** (or BFF), not directly to 10 random URLs.

### Why companies adopt them

- Scale one hot area without scaling everything  
- Isolate failures (pharmacy partner outage ≠ booking down)  
- Different teams own different services  
- Deploy one service without redeploying all  

### Why they are expensive / risky early

- Network calls instead of a DB transaction  
- Distributed consistency (booking + payment + queue) is hard  
- More ops: deploy, monitor, logs, secrets, versioning  
- Debugging a user journey across many services is slower  

**Rule of thumb for MedClues:** stay modular monolith until a **measured** problem (CPU, QPS, noisy partners, team ownership) forces a split.

---

## 2. How microservices relate to *users and roles*

Microservices are **not** “one service per role.”  
Roles are **who is allowed to call what**. Services are **what business capability exists**.

### Our roles today

| Role | Client | Auth style | Typical capabilities |
|------|--------|------------|----------------------|
| **patient** | Flutter / patient web | JWT `role=patient` | Book, pay, pharmacy, labs, AI, community |
| **doctor** | Admin app | JWT `role=doctor` | Queue, consult, schedule, community |
| **receptionist** | Admin app | JWT `role=receptionist` + hospital | Today’s ops, check-in, queue |
| **dean** | Admin app | JWT `role=dean` + `hospital_id` | Hospital dashboard, pharmacies, community mod |
| **admin** / **super_admin** | Admin app | JWT + admin checks | Platform-wide management |
| **partner** (pharmacy / lab / emergency) | Partner systems | API key + HMAC (not JWT role) | Scoped partner APIs + webhooks |

Defined mainly in:

- `fastapi_back/app/services/token_service.py` — `VALID_ROLES`  
- `fastapi_back/app/middleware/auth.py` — patient/doctor/dean/reception/admin guards  
- `fastapi_back/app/middleware/partner_auth.py` — partner edge auth  

### Correct mapping: role → permission → services

```text
User (patient / doctor / dean / …)
    → Identity issues JWT (or partner API key)
    → Gateway / API checks role + hospital scope
    → Calls one or more domain services
```

Example journeys:

| User action | Roles | Domains involved (today: folders; later: services) |
|-------------|-------|-----------------------------------------------------|
| Book appointment | patient | Auth → Appointment → Slot lock → Payment → Notification |
| Call next token | doctor / reception | Auth → Queue → Appointment lifecycle → Socket realtime |
| Map hospital pharmacy | dean | Auth → Hospital → Pharmacy partner |
| Upload lab result | partner (lab) | Partner auth → Lab → Notification → Patient read |
| Ask AI to book | patient | AI → (tools) Appointment / Search / Pharmacy |

**Important:** Splitting microservices does **not** mean:

- “Patient microservice”  
- “Doctor microservice”  
- “Dean microservice”  

That would duplicate data and explode coupling. Instead we keep **shared Identity**, and **domain services** that all roles call with different permissions.

### Hospital isolation (dean / reception)

Dean and reception are scoped by `hospital_id`.  
In a future split, **hospital_id must travel in JWT claims** and every hospital-scoped service must enforce it — same as today in the monolith.

### Partners as a natural “edge” service

Partners already use a **different auth model** (API key + HMAC).  
That makes **Partner Edge** one of the best *first* extract candidates — not because of roles, but because of traffic isolation and auth shape.

---

## 3. How this suits *our* application

MedClues is a **healthcare platform** with strong consistency needs:

- Slot capacity / locks  
- Appointment lifecycle  
- Payments  
- Live queue  

Those pieces should stay **together** for a long time (same DB transactions).

What *does* suit gradual service extraction:

| Area | Why it fits microservices later |
|------|----------------------------------|
| Background workers | Already separable process |
| Notifications | Outbox pattern exists |
| Realtime (Socket.IO) | Fan-out can dominate API |
| Search | Can move to OpenSearch |
| Partner pharmacy/lab | Noisy neighbor risk |
| AI assistant | Already a package boundary (`app/services/ai/`) |

What does **not** suit early microservices:

| Anti-pattern | Why avoid |
|--------------|-----------|
| One Neon DB per microservice | Cross-booking joins and transactions break |
| Per-hospital microservice | Huge ops cost, little gain on shared Neon |
| Booking service alone (too early) | Lock + payment + queue still tightly linked |
| Role-based services | Wrong boundary; duplicates identity |

---

## 4. Are we ready for microservices?

### Honest scorecard

| Question | Answer |
|----------|--------|
| Are we a microservice mesh today? | **No** — modular monolith |
| Can we pretend we “finished microservices”? | **No** |
| Is the codebase *preparing* for them? | **Yes** — folders, workers, Redis, outbox, partner auth, AI package |
| Should we split everything now? | **No** |
| What should we do instead? | Scale & extract **edges** when metrics force it |

### Already in good shape (preparation)

- Domain folders: `routes` / `controllers` / `services` / `models` / `workers`  
- Optional Redis (`REDIS_URL`) for OTP, rate limits, Socket.IO, locks  
- Workers: `python -m app.workers.runner` + `Dockerfile.worker` + compose profile  
- `RUN_BACKGROUND_WORKERS_IN_API=false` for scale-out  
- Notification outbox + webhook retry workers  
- Partner auth separated from JWT roles  
- AI assistant as extractable package  
- Search can swap to OpenSearch via config  
- Optional `DATABASE_READ_URL` for read scale  
- Docker Compose: Redis, worker, Prometheus/Grafana, PgBouncer  

### Not ready / still tightly coupled

- Single FastAPI process owns almost all HTTP + Socket.IO  
- Auth ↔ appointments ↔ queue ↔ payments share DB transactions  
- Lifecycle enums shared across Flutter + Admin (must stay contracted)  
- In-process Redis/Socket fallbacks can hide multi-instance bugs  
- No API Gateway / service mesh / per-service CI deploy yet  
- React website AI chatbot still on a legacy path (product consistency, not MS blocking)  

**Verdict:**  
**Everything is ready for a *modular monolith + selective extraction* strategy.**  
**Everything is *not* ready (and not needed) for a full microservices rewrite.**

---

## 5. Target architecture (evolution, not big-bang)

### Phase 0 — Now (keep)

```text
Flutter / Admin / Web
        │
        ▼
   FastAPI (modular monolith)  ←── JWT roles + partner HMAC
        │
   ┌────┼────┐
   ▼    ▼    ▼
 Postgres  Redis  Workers (optional process)
```

### Phase 1 — Scale without microservices

1. Always run Redis in production (no in-memory OTP/locks on multi-instance).  
2. Run workers as a separate process (`RUN_BACKGROUND_WORKERS_IN_API=false`).  
3. Horizontal scale API replicas behind a load balancer.  
4. Use Socket.IO Redis adapter for multi-instance realtime.  
5. Turn on metrics / SLO dashboards (Prometheus/Grafana already sketched).  
6. Optional read replica for heavy search/reports.  

### Phase 2 — First real extracts (strangler pattern)

Extract **one** boundary at a time when a trigger fires:

| Order | Extract | Trigger | Auth still |
|------:|---------|---------|------------|
| 1 | **Workers / Notifications** | Outbox backlog, SMS/FCM rate limits | Internal service token + outbox consumer |
| 2 | **Realtime gateway** | Socket fan-out CPU/RAM | Same JWT; rooms by hospital/user |
| 3 | **Partner Edge** | Partner QPS / noisy webhooks | Existing partner HMAC |
| 4 | **Search** | FTS p95 over budget | JWT; thin proxy in API |
| 5 | **AI Assistant** | LLM latency / cost isolation | JWT; tools call back into core API |

Keep in the **core API** for a long time:

- Auth / Identity  
- Appointments + lifecycle  
- Queue + slot locks  
- Payments  

### Phase 3 — Optional later

Only if product/team size justifies it:

- Pharmacy domain service (behind events)  
- Lab domain service  
- Community service  
- Dedicated Identity service (still one JWT issuer)

### Explicit non-goals

- Do not rewrite Flutter to “call 12 URLs” without a gateway.  
- Do not create patient/doctor/dean microservices.  
- Do not split one Neon into many write DBs early.  
- Do not microservices for fashion — only for measured pain.

---

## 6. How roles work after a split (design rule)

### Identity remains central

1. **Identity / Auth** issues JWT with:

   - `sub` (user id)  
   - `role` (`patient` | `doctor` | `dean` | `receptionist` | `admin` …)  
   - `hospital_id` when required (dean / reception)  

2. Every domain service validates JWT (shared secret/JWKS) and applies:

   - Role allow-list per endpoint  
   - Hospital scope checks  
   - Patient “own data only” checks  

3. Partners never use patient JWT; they use **Partner Edge** credentials with scoped APIs.

### Permission matrix (conceptual)

| Capability | patient | doctor | reception | dean | admin | partner |
|------------|:-------:|:------:|:---------:|:----:|:-----:|:-------:|
| Book appointment | Y | | | | Y* | |
| Manage queue | | Y | Y | Y | Y* | |
| Hospital pharmacy map | | | | Y | Y | |
| Partner result upload | | | | | | Y |
| Platform analytics | | | | limited | Y | |
| AI assistant | Y | Y | Y | Y | Y | |

\*admin as platform override where product allows.

This matrix lives in **policy**, not in “one service per role.”

---

## 7. Complete action plan (what to do)

### A. This week / this month (no microservices)

| # | Action | Owner hint | Done when |
|---|--------|------------|-----------|
| A1 | Confirm production: `REDIS_URL` set, multi-instance safe | Ops | OTP/locks/socket work across 2 API replicas |
| A2 | Run workers separately in staging/prod | Ops | `workers` profile or VM running `app.workers.runner` |
| A3 | Document role → route map from `ROUTES.md` + auth middleware | Eng | One table reviewers can audit |
| A4 | Keep API contracts stable (Flutter + Admin lifecycle labels aligned) | Eng | No silent enum drift |
| A5 | Run migration knowledge/ops as needed; keep monolith modular | Eng | New features stay in service layer |

### B. When metrics say “extract”

| # | Trigger | Action |
|---|---------|--------|
| B1 | Notification backlog / provider timeouts | Extract notification consumer first |
| B2 | Socket.IO CPU high | Realtime process + Redis adapter |
| B3 | Partner webhook storms | Partner Edge service + rate limits |
| B4 | Search p95 high | OpenSearch + indexer |
| B5 | AI latency/cost noisy | AI service; tools still call core API |

### C. Engineering checklist before *any* extract

- [ ] Clear API contract (OpenAPI) for that boundary  
- [ ] Auth model decided (JWT vs internal service token vs partner HMAC)  
- [ ] Observability: metrics, logs, trace id across call  
- [ ] Failure mode: core API still works if edge is down (degrade gracefully)  
- [ ] Data ownership: who writes which tables (avoid dual-writers)  
- [ ] Rollback plan (feature flag / strangler switch)  
- [ ] Load test the hot path before and after  

### D. Suggested extract order (MedClues-specific)

```text
1) Workers / Notifications
2) Realtime
3) Partner Edge (pharmacy / lab / emergency)
4) Search
5) AI Assistant
─── pause ───
Core stays: Auth + Appointments + Queue + Payments
```

---

## 8. Mapping current folders → future services

| Today (`fastapi_back`) | Future service candidate | Priority |
|------------------------|--------------------------|----------|
| `middleware/auth.py`, `token_service` | Identity (keep in core long) | Core |
| appointment / lifecycle / slot / queue | Care Ops Core | Core |
| `payments_*` | Care Ops Core (or Payments later) | Core |
| `notification_outbox_worker`, SMS/FCM/WhatsApp | Notifications | Extract early |
| `socket_service` | Realtime | Extract when needed |
| `partner_*`, webhooks | Partner Edge | Extract when needed |
| `search_*` | Search | Extract when needed |
| `services/ai/*` | AI Assistant | Extract when needed |
| `community_*` | Community | Later |
| pharmacy/lab domain beyond partners | Pharmacy/Lab | Later |

---

## 9. Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Split booking from payments too early | Double book / paid without slot | Keep in one transactional core |
| Split without Redis | Wrong OTP/locks under load | Redis required for multi-instance |
| Role-based services | Duplicated users, inconsistent auth | Shared Identity + domain services |
| Dual DB writes | Data drift | Single writer per aggregate + events |
| No gateway | Clients break on every extract | Keep stable public URLs; proxy internally |

---

## 10. One-page recommendation

1. **Do not** rewrite MedClues into microservices right now.  
2. **Do** treat the app as a **modular monolith** with clear domains and roles.  
3. **Roles** stay on JWT / partner credentials; they authorize calls into **domains**, they are not the service split.  
4. **Scale first:** Redis + separate workers + API replicas + metrics.  
5. **Extract next** only when load/failure/team ownership forces it — starting with notifications, realtime, partner edge, search, AI.  
6. **Never** split Auth + Appointments + Queue + Payments until you have a hard consistency reason and a solid event design.

---

## 11. Glossary

| Term | Meaning |
|------|---------|
| Modular monolith | One deployable, many clean modules |
| Microservice | Separately deployable domain with own process |
| Strangler pattern | Route traffic gradually from monolith to new service |
| BFF / Gateway | Front door that keeps client URLs stable |
| Outbox | DB table of events to send later (reliable notifications/webhooks) |
| Bounded context | A domain with clear ownership (appointments vs pharmacy) |

---

*Document generated for the MedClues / PMS FNL workspace. Aligns with existing enterprise docs; prefer updating this file when extract decisions change.*
