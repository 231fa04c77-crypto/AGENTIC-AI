# MedClues — Application Architecture

**Verdict: MedClues is a modular monolith** (not a microservices mesh).

One FastAPI backend owns clinical and operational domains, one primary PostgreSQL database is the source of truth, and multiple client apps talk to that single API. Optional Redis, worker processes, and partner systems attach at the edges — they do **not** split MedClues into independent services per hospital or per feature.

---

## 1. Architecture style (plain language)

| Style | Is MedClues this? | Why |
|-------|-------------------|-----|
| **Modular monolith** | **Yes — primary design** | One deployable API (`fastapi_back`), modules separated by folders (routes → controllers → services → models), shared DB |
| **Microservices** | **No** | No separate booking-service / queue-service / payment-service with their own DBs and network calls between them |
| **Distributed monolith** | **Avoided** | We do not fake microservices with chatty HTTP between tiny apps sharing one DB |
| **SOA / ESB** | **No** | Partners integrate via REST + signed webhooks, not a central enterprise bus |
| **Serverless-only** | **No** | Long-running FastAPI + optional worker process |

**Rule of thumb:**  
If you open `fastapi_back/app/`, you see **modules inside one application**. That is a modular monolith.

---

## 2. High-level system map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENTS (many UIs)                                │
├────────────────┬────────────────┬──────────────────┬─────────────────────┤
│ flutter_mobile │     admin/     │    frontend/     │  mobile/ (legacy)   │
│ Flutter patient│ React staff    │ React patient web│ Expo (secondary)    │
│ + emergency    │ Admin/Dean/    │                  │                     │
│                │ Doctor/Recep   │                  │                     │
└───────┬────────┴───────┬────────┴────────┬─────────┴──────────┬──────────┘
        │                │                 │                    │
        └────────────────┴─────────────────┴────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     MODULAR MONOLITH API      │
                    │      fastapi_back :5000       │
                    │  Auth · Appointments · Queue  │
                    │  Pharmacy · Lab · Community   │
                    │  Payments · Partners · AI     │
                    └──────────────┬───────────────┘
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
    PostgreSQL (Neon)           Redis (optional)     Workers (optional)
    Source of truth             Cache / OTP / RL     Outbox · archive
    Transactions                Socket.IO adapter    Same codebase
           │
           └──── Cloudinary · Razorpay · Agora · SMS/WhatsApp · PharmaSync
```

---

## 3. Why this is a modular monolith

### One backend, many modules

Inside `fastapi_back/app/`:

| Layer | Responsibility |
|-------|----------------|
| `routes/` | HTTP endpoints (thin) |
| `controllers/` | Request/response orchestration |
| `services/` | Domain logic (booking, queue, pharmacy, community, cache…) |
| `models/` | PostgreSQL access |
| `middleware/` | Auth, rate limit, metrics |
| `workers/` | Same repo; can run in API or separate process |

Domains (appointments, queue, pharmacy, lab, community, emergency, payments) live as **packages/modules**, not as separate deployable services.

### One database of record

- **PostgreSQL** stores users, appointments, slots, payments, partners, community, outbox, etc.
- **Redis** (when `REDIS_URL` is set) is cache / OTP / rate limit / Socket.IO / soft slot holds — **not** the clinical source of truth.
- **Enterprise AI Assistant** (`AI_ASSISTANT_ENABLED`) is an extractable gateway module: intent → RAG → tools → internal APIs only. See [docs/enterprise/ENTERPRISE_AI_ASSISTANT.md](./docs/enterprise/ENTERPRISE_AI_ASSISTANT.md).

### Many clients, one API contract

| Client | Role |
|--------|------|
| `flutter_mobile/` | Primary patient app |
| `admin/` | Super Admin, Dean, Doctor, Reception |
| `frontend/` | Patient web |
| `mobile/` | Older Expo client (secondary) |

All authenticated traffic goes to **the same FastAPI**. Patients never call PharmaSync or payment providers directly for clinical APIs.

---

## 4. What it is *not*

### Not microservices

You will **not** find:

- Separate repos/services for “Appointment Service”, “Queue Service”, “Notification Service” with independent release cycles and databases  
- Service mesh / sidecar networking between MedClues domains  
- Per-hospital microservices  

Partners (PharmaSync, labs, emergency) are **external systems**, integrated through partner APIs and webhooks — that is **integration**, not MedClues becoming microservices.

### Not a “big ball of mud” (goal)

Modules are intentionally separated (services layer, domain routes, partner domain registry). New features should land in the right module rather than dumping logic into `main.py`.

---

## 5. Scale-out pattern (still modular monolith)

MedClues scales like a **modular monolith that can run multiple copies**, not by carving domains into microservices first.

```
                 Load balancer
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   FastAPI #1     FastAPI #2     FastAPI #N
        │              │              │
        └──────────────┼──────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
         PostgreSQL           Redis
         (shared)        (shared OTP/cache/WS)
                       │
                       ▼
              Worker process(es)
         python -m app.workers.runner
```

| Knob | Effect |
|------|--------|
| Multiple API instances | Horizontal scale of the **same** monolith |
| `REDIS_URL` | Shared OTP, rate limits, Socket.IO across instances |
| `RUN_BACKGROUND_WORKERS_IN_API=false` | Move SMS/archive/webhook retries off the API process |
| `DATABASE_READ_URL` | Optional read replica for heavy SELECTs |
| `OPENSEARCH_URL` | Optional search backend behind the same `/api/search` |

These are **deployment/process boundaries**, not domain microservices.

---

## 6. Module map (backend)

| Module area | Examples |
|-------------|---------|
| Identity & access | Auth, JWT, refresh tokens, OTP, roles |
| Clinical ops | Doctors, hospitals, slots, appointments, queue, reception |
| Care delivery | Consultation, prescription, EMR-related records |
| Commerce | Payments (Razorpay), refunds |
| Ecosystem | Pharmacy (PharmaSync), lab partners, emergency partners |
| Knowledge | Health Community Q&A, medicine info (openFDA) |
| Platform | Admin settings, audits, metrics, partner catalog |

Each area is a **module inside the monolith**, usually with matching routes + services + models.

---

## 7. Data & consistency

| Concern | Where it lives |
|---------|----------------|
| Appointments, slots, queue tokens | PostgreSQL transactions / locks |
| Payments | PostgreSQL + provider webhooks |
| Directory caches (doctors, hospitals…) | Redis cache-aside (invalidate on write) |
| Notifications / webhook retries | PostgreSQL outbox + workers |
| Realtime fan-out | Socket.IO (+ Redis adapter when multi-instance) |

**Consistency rule:** money and clinical state → Postgres. Redis may speed reads or hold temporary locks; it must not become the ledger.

---

## 8. When to extract a real microservice (later)

Only when load or ownership forces it (see [docs/enterprise/MICROSERVICE_BOUNDARIES.md](./docs/enterprise/MICROSERVICE_BOUNDARIES.md)):

| Candidate | Trigger |
|-----------|---------|
| Notification worker service | Outbox backlog / provider rate limits dominate API CPU |
| Dedicated realtime gateway | Socket.IO fan-out overwhelms API nodes |
| Search indexer | Catalog search p95 exceeds budget even with Postgres/OpenSearch |
| Partner edge API | Noisy-neighbor partner traffic |

Until then, **stay modular monolith** — cheaper to operate, easier transactions, one Neon database.

---

## 9. Related docs

| Doc | Topic |
|-----|--------|
| [README.md](./README.md) | Product overview & getting started |
| [docs/enterprise/ENTERPRISE_ARCHITECTURE_REVIEW_2026-07-20.md](./docs/enterprise/ENTERPRISE_ARCHITECTURE_REVIEW_2026-07-20.md) | Full enterprise review, scores, roadmap (keep modular monolith) |
| [docs/enterprise/ARCHITECTURE_NOTES.md](./docs/enterprise/ARCHITECTURE_NOTES.md) | Flutter Riverpod / Admin context / service layer notes |
| [docs/enterprise/MICROSERVICE_BOUNDARIES.md](./docs/enterprise/MICROSERVICE_BOUNDARIES.md) | When (not) to split |
| [docs/enterprise/REDIS_INTEGRATION_REPORT.md](./docs/enterprise/REDIS_INTEGRATION_REPORT.md) | Redis as optimization layer |
| [PHARMASYNC_CONNECT_HANDOFF.md](./PHARMASYNC_CONNECT_HANDOFF.md) | External pharmacy partner (not a MedClues microservice) |

---

## 10. One-line summary

> **MedClues = modular monolith API + multiple clients + PostgreSQL source of truth + optional Redis/workers for scale — not a microservices architecture.**
