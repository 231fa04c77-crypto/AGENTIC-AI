# Dual API mounts — removed after client audit

**Date:** 2026-07-20

## Audit

| Legacy path | Clients found | Action |
|-------------|---------------|--------|
| `/api/health-records/*` | None in flutter/admin/frontend | **Deleted** router + unmounted |
| `/api/user/forgot-password` | frontend, `mobile/services` | Clients → `/api/auth/forgot-password`; route **removed** |
| `/api/user/reset-password` | frontend | Clients → `/api/auth/reset-password`; route **removed** |
| `/api/user/verifyRazorpay` | frontend Appointment/MyAppointments; flutter config unused | Clients → `/api/user/verify-razorpay`; camelCase alias **removed** |

## Canonical (kept)

- `/api/user/health-records/*`
- `/api/auth/forgot-password`, `/api/auth/verify-otp`, `/api/auth/reset-password`
- `/api/user/verify-razorpay`
- Partner emergency on both `/api/partner/emergency` and `/api/v1/partner/emergency` (intentional dual for integrations)

## Still deferred (not dual mounts)

- Store package `com.medichain.*` (gated)
- `medichain://` accept-only deep link
