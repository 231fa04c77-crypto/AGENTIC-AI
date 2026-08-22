# Step 2 — Persistent Payments (Completed)

## Changes (backward compatible)

| Change | Class | Frontend impact |
|--------|-------|-----------------|
| `payment_transactions` PostgreSQL table | Safe | None |
| Removed in-memory `_pending_orders`, `_checkout_tokens`, `_payment_history` | Safe | None |
| Atomic claim for booking (idempotent) | Safe | None |
| Restore pending order from Razorpay notes if DB row missing | Safe | None |
| `POST /api/payments/webhook` | Safe | New additive endpoint (Razorpay Dashboard only) |

All existing payment routes unchanged: `/create-order`, `/verify`, `/confirm-order`, `/checkout`, `/history`, etc.

## Database

Table auto-created on startup. Manual migration (optional):

```bash
psql $DATABASE_URL -f migrations/003_payment_transactions.sql
```

## Razorpay webhook setup

1. Razorpay Dashboard → **Webhooks** → Add endpoint  
   URL: `https://medclues.onrender.com/api/payments/webhook`
2. Events: `payment.captured`, `payment.failed`
3. Copy webhook secret → Render env: `RAZORPAY_WEBHOOK_SECRET=<secret>`

Webhook is optional for current app flow (client still calls `/verify` and `/confirm-order`). It improves reliability when the app closes before confirmation.

## Render env

```
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...   # optional but recommended
```

## Testing

1. Create appointment order → row in `payment_transactions` with `status=pending`
2. Complete test payment → `status=paid`, appointment booked
3. Retry verify/confirm on same order → idempotent “already processed”
4. `/api/payments/history` → returns DB records
5. Webhook with valid signature → same booking path as client verify
