# Final remaining-inconsistencies fix pass (2026-07-20)

## Fixed in this pass

| Item | Change |
|------|--------|
| Dual deep-link emit | Payment HTML emits **only** `mediclues://` |
| READY_FOR_DOCTOR | Now a real `lifecycle_status` + transitions; token/ready dual-writes lifecycle |
| Payment JSON | Additive camelCase aliases (`orderId`, `razorpayKey`, …) |
| Theme | Flutter primary / seed → `medcluesTeal` |
| Bot env | `MEDCLUES_BOT_*` preferred; `MEDICHAIN_BOT_*` still works |
| Doctor queue routes | `/queue-management` → redirect `/doctor-in-queue` |
| Migrations | Auto-runner already applies all `*.sql` including 032/037 on boot |

## Intentionally not changed (would break stores / clients)

| Item | Why |
|------|-----|
| Package `com.medichain.*` / `medichain_mobile` | Store listing / signing identity |
| Admin aToken partner bypass | Required for ops analytics |
| Full Telugu HP corpus | Incremental; pharmacy keys done |
| Doctor max vs hospital capacity merge | Two knobs still exist; occupancy excludes follow-ups |

## Completed since this pass (no longer open debt)

| Item | Status |
|------|--------|
| Dual API mounts | **Removed** — see [`DUAL_API_REMOVED.md`](./DUAL_API_REMOVED.md) and [`DEPRECATIONS.md`](./DEPRECATIONS.md) |
| Deep-link primary scheme | Emit `medclues://` with legacy aliases `mediclues` / `medichain` |

## Ops

Apply/verify Neon via `docs/enterprise/MIGRATION_VERIFY_CHECKLIST.md` if auto-migrate has not run on production yet.
