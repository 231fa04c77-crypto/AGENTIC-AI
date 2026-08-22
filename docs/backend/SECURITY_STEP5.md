# Step 5 — API Quality & Ops (Completed)

## Health endpoints (new)

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /health` | Liveness — process up | 200 |
| `GET /ready` | Readiness — PostgreSQL check | 200 or 503 |

Configure Render/uptime monitors on `/health` and `/ready`.

## Structured logging

- Startup/shutdown uses `app_logger` (no raw prints in lifespan)
- `RequestLoggingMiddleware` logs `METHOD path status duration_ms`
- Skips `/health` and `/ready` to reduce noise

## Pydantic validation (additive)

Validated at route layer; controllers unchanged.

| Route | Schema |
|-------|--------|
| `POST /api/user/login` | `LoginRequest` |
| `POST /api/user/register` | `RegisterRequest` |
| `POST /api/send-otp` | `OtpSendRequest` |
| `POST /api/verify-otp` | `OtpVerifyRequest` |
| `POST /api/emergency/send-alert` | `EmergencyAlertRequest` |
| `POST /api/payments/create-order` | `CreateOrderRequest` |

Invalid body → **400** with `{"success": false, "message": "...", "detail": [...]}`  
Existing clients sending valid payloads are unaffected.

## Pagination (optional query params)

| Endpoint | Params | Default behavior |
|----------|--------|------------------|
| `GET /api/user/appointments` | `limit`, `offset` | No limit — full list (unchanged) |
| `GET /api/user/health-records` | `limit`, `offset` | No limit — full list |
| `GET /api/payments/history` | `limit`, `offset` | Max 50 (unchanged) |

When `limit` is sent, response includes additive `pagination` block:

```json
{
  "success": true,
  "appointments": [...],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "returned": 20,
    "hasMore": true
  }
}
```

Clients that ignore unknown fields keep working.

## Testing

```bash
curl http://localhost:5000/health
curl http://localhost:5000/ready
curl "http://localhost:5000/api/user/appointments?limit=10" -H "Authorization: Bearer <token>"
```
