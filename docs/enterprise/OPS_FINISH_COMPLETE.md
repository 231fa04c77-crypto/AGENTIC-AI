# Enterprise ops finish — complete (local)

**Date:** 2026-07-20  
**Script:** `python scripts/finish_enterprise_ops.py`

## Verified locally

| Check | Result |
|-------|--------|
| `REDIS_URL` in `fastapi_back/.env` | Set (`redis://localhost:6379/0`) |
| Redis | Connected (Windows Redis service; RESP2 / `protocol=2`) |
| Migration `045_hot_path_indexes` | Applied |
| PharmaSync env keys | Present (live connect still vendor-owned) |
| `/health` | 200 |
| `/health/deep` | redis=ok |
| `/api/search` | 200 |
| Burst 20 concurrent search | 0 × 5xx |

## Compose profiles (ready; need Docker Desktop)

```bash
docker compose up -d redis
docker compose --profile obs up -d          # Prometheus :9090, Grafana :3001
docker compose --profile workers up -d worker
docker compose --profile pool up -d pgbouncer  # local PG only; Neon uses cloud pooler
```

Grafana provisioning: `docs/enterprise/grafana/provisioning/`  
PgBouncer sample: `docs/enterprise/pgbouncer/pgbouncer.ini`

## Intentionally external (cannot finish in-repo)

| Item | Owner |
|------|--------|
| Production HA Redis + workers | Deploy |
| Staging k6 certification | Ops + `fastapi_back/scripts/load/` |
| Prometheus/Grafana in cloud | Deploy (local profile ready) |
| PharmaSync live webhook path + integration POST | PharmaSync team |
| Formal pen-test / vault | Security |

## Redis note (Windows)

Microsoft Archive Redis 3.0.504 does not support RESP3 `HELLO`. Clients use `protocol=2` in:

- `app/services/redis_client.py`
- OTP / password-reset / partner rate-limit clients

Production should use Redis 7+ (Docker image `redis:7-alpine` or managed Redis).
