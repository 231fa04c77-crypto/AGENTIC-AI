# Microservice boundaries (Phase 3)

MedClues remains a **modular monolith** by default. Split only when a boundary
has independent scale, failure, or team ownership needs.

## Keep in the API process

| Module | Why |
|--------|-----|
| Auth / appointments / queue / payments | Strong consistency + shared DB transactions |
| Partner webhooks (enqueue) | Same DB outbox as domain writes |
| Search (Postgres path) | Simple until OpenSearch QPS forces split |

## Extract when load forces it

| Boundary | Trigger | Suggested shape |
|----------|---------|-----------------|
| **Workers** | API CPU/RAM from SMS/FCM/archive/retries | Already: `python -m app.workers.runner` |
| **Realtime** | Socket.IO fan-out dominates | Separate Socket.IO + Redis adapter (or Ably) |
| **Search** | Catalog FTS p95 > budget | OpenSearch indexer + `/api/search` thin proxy |
| **Notifications** | Outbox backlog / provider rate limits | Notification microservice consuming outbox |
| **Lab / Pharmacy sync** | Partner traffic noisy-neighbor | Partner edge API + shared event bus |

## Do not split early

- Per-hospital microservices (ops cost without isolation benefit on Neon).
- Separate “booking service” until measured lock contention forces it.

## Config switches already supporting scale-out

- `REDIS_URL` — shared OTP / rate limit / Socket.IO
- `RUN_BACKGROUND_WORKERS_IN_API=false` + worker process
- `DATABASE_READ_URL` — search/report reads
- `OPENSEARCH_URL` — search backend swap without client changes

See also: [DR_SLO_RUNBOOK.md](./DR_SLO_RUNBOOK.md), [ENTERPRISE_SCALABILITY_AUDIT_2026-07-20.md](./ENTERPRISE_SCALABILITY_AUDIT_2026-07-20.md).
