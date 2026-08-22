# Remaining debt — resolution pass (updated)

**Date:** 2026-07-20  
**Final consistency plan todos:** all addressed (see below).

| Item | Resolution |
|------|------------|
| Package identity | **Gated** — [`STORE_PACKAGE_RENAME_STATUS.md`](./STORE_PACKAGE_RENAME_STATUS.md); IDs unchanged until Firebase + store approval |
| Dual API mounts | **Removed** after client audit — [`DUAL_API_REMOVED.md`](./DUAL_API_REMOVED.md) |
| Partner path versions | Emergency on **both** `/api/partner/emergency` and `/api/v1/partner/emergency` (intentional) |
| Legacy deep-link accept | **Kept** for old installs; emit remains `mediclues://` only |
| Prod 037 | **Confirmed** on Neon + Render — [`OPS_PROD_037_CONFIRMED.md`](./OPS_PROD_037_CONFIRMED.md) |
| l10n | HP feature screens + TE/HI message keys filled; hub/compare/recommend/emergency wired |

## Still intentionally deferred

- `com.medichain.*` applicationId / bundle until explicit store approval string
- `medichain://` accept-only scheme
