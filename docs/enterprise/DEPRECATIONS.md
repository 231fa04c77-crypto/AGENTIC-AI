# API deprecations

Legacy dual mounts listed below were **removed** after a client audit (2026-07-20). See [`DUAL_API_REMOVED.md`](./DUAL_API_REMOVED.md).

| Removed | Canonical |
|---------|-----------|
| `GET/POST /api/health-records/*` | `/api/user/health-records/*` |
| `POST /api/user/forgot-password` | `POST /api/auth/forgot-password` |
| `POST /api/user/reset-password` | `POST /api/auth/reset-password` |
| `POST /api/user/verifyRazorpay` | `POST /api/user/verify-razorpay` |

## Intentional dual (kept)

| Path A | Path B | Notes |
|--------|--------|--------|
| `/api/partner/emergency` | `/api/v1/partner/emergency` | Same handlers; prefer v1 for new partners |

## Deep links

- **Primary (emitted by payment HTML / Telegram):** `medclues://`
- Apps may still **accept** legacy `mediclues://` and `medichain://` for old installs
- Package / applicationId still `com.medichain.*` — store rename gated (see `STORE_PACKAGE_RENAME_STATUS.md`)
