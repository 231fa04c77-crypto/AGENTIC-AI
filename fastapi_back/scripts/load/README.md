# MEDCLUES Load & Stress Harnesses

Evidence-based scripts for staging. They do **not** replace production capacity certification — run against a dedicated staging stack with realistic data.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed (`k6 version`)
- Staging base URL and test credentials / tokens
- A known `slotId` (booking), `appointmentId` (queue/payment), partner webhook secret (pharmacy)

```powershell
$env:BASE_URL = "https://your-staging-api.example.com"
$env:AUTH_TOKEN = "<patient JWT>"
$env:SLOT_ID = "12345"
$env:APPOINTMENT_ID = "67890"
$env:RAZORPAY_ORDER_ID = "order_xxx"   # for payment duplicate test
$env:PARTNER_WEBHOOK_URL = "$env:BASE_URL/api/partner/..."  # adjust to your route
```

## Scenarios

| Script | Purpose | Pass criteria |
|--------|---------|---------------|
| `booking_storm.js` | N concurrent book attempts on same slot | Exactly one HTTP 200 success (or one booked); others conflict/4xx |
| `queue_fanout.js` | Many clients polling queue status | Error rate &lt; 1%; p95 under budget you set |
| `payment_callback_dup.js` | Duplicate payment fulfillment callbacks | Idempotent — single fulfilled state |
| `pharmacy_webhook_retry.js` | Burst of partner-style POSTs | 2xx or controlled 429; no 5xx storm |

## Run examples

```powershell
cd "fastapi_back/scripts/load"

k6 run -e BASE_URL=$env:BASE_URL -e AUTH_TOKEN=$env:AUTH_TOKEN -e SLOT_ID=$env:SLOT_ID booking_storm.js

k6 run -e BASE_URL=$env:BASE_URL -e AUTH_TOKEN=$env:AUTH_TOKEN -e DOCTOR_ID=42 queue_fanout.js

k6 run -e BASE_URL=$env:BASE_URL -e AUTH_TOKEN=$env:AUTH_TOKEN -e RAZORPAY_ORDER_ID=$env:RAZORPAY_ORDER_ID payment_callback_dup.js

k6 run -e BASE_URL=$env:BASE_URL pharmacy_webhook_retry.js
```

## Interpreting results

- **p50 / p95 / p99** — booking and queue should stay within your SLO (suggest p95 &lt; 500ms after Phase 1).
- **http_req_failed** — investigate 5xx and pool timeouts first (`db.py` pool size).
- **Booking storm** — if more than one VU gets success for the same slot, Phase 1 transactional booking is still broken.
- **Scale tiers** — raise `VUs` gradually: 100 → 1k → 5k. Do not jump to 50k without Phase 2 (Redis, multi-instance, PgBouncer).

## Safety

- Never point these at production without explicit ops approval.
- Prefer synthetic users and slots that can be reset.
- Payment/pharmacy scripts may need route/HMAC adjustments to match your staging contracts — see comments in each file.
