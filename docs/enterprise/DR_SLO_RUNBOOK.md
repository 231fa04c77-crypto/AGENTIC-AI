# MEDCLUES — Disaster Recovery, SLO & Ops Runbook

**Updated:** 2026-07-20

## Target SLOs (staging → promote to prod after k6)

| SLO | Target | Measurement |
|-----|--------|-------------|
| API availability | 99.5% monthly | `/health` + `/ready` probes |
| Booking p95 | < 500ms (excl. payment redirect) | `/metrics` + k6 `booking_storm.js` |
| Queue live p95 | < 800ms | k6 `queue_fanout.js` |
| Payment webhook idempotency | 100% single fulfill | `payment_callback_dup.js` |
| RPO | ≤ 15 minutes | Neon PITR / snapshot interval |
| RTO | ≤ 1 hour | Restore drill to staging |

## Local / staging scale stack

```bash
# Redis
docker compose up -d redis

# Point API .env
REDIS_URL=redis://localhost:6379/0
DB_POOL_MAX=20
RUN_BACKGROUND_WORKERS_IN_API=false

# Terminal A — API
cd fastapi_back && python -m uvicorn main:app --host 0.0.0.0 --port 5000

# Terminal B — workers
cd fastapi_back && python -m app.workers.runner
```

Optional: `docker compose --profile workers up -d worker` (requires `Dockerfile.worker` build + `DATABASE_URL` in `.env`).

## Health endpoints

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness |
| `GET /ready` | Postgres ready |
| `GET /health/deep` | DB + Redis + worker mode |
| `GET /metrics` | Prometheus scrape |

## Disaster recovery

1. **Postgres (Neon):** enable PITR; document branch restore; quarterly restore to staging.
2. **Redis:** ephemeral — OTP/rate limits rebuild; Socket.IO reconnects.
3. **Object storage:** Cloudinary — retain signed assets; no local `/uploads` for PHI.
4. **Secrets:** rotate `JWT_SECRET`, partner HMAC, Razorpay, PharmaSync keys after any leak.
5. **Workers:** if API crash loses in-flight `create_task` email/FCM, outbox + webhook_deliveries retry.

### Restore drill checklist

- [ ] Create Neon branch from PITR timestamp  
- [ ] Point staging `DATABASE_URL` at branch  
- [ ] Run migrations verify script  
- [ ] Smoke: login, book, pay webhook, pharmacy list  
- [ ] Record wall-clock RTO  

## Archive policy

- Completed/cancelled appointments older than `APPOINTMENT_ARCHIVE_DAYS` (default 365) move to `appointments_archive` via `appointment_archive_worker`.
- Adjust days/batch via env; never archive active lifecycle statuses.

## Load tests

See `fastapi_back/scripts/load/README.md`. Run against staging only.

## On-call signals

- Spike in `medclues_http_request_duration_seconds` p95  
- `/ready` or `/health/deep` 503  
- `webhook_deliveries` permanently_failed growth  
- `notification_outbox` permanently_failed growth  
