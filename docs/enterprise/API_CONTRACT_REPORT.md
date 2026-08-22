# API contract report — MedClues (M9)

Snapshot of additive API shaping for enterprise clients.

## Dual mounts — removed (2026-07-20)

Legacy dual mounts were **deleted** after client audit. See [`DUAL_API_REMOVED.md`](./DUAL_API_REMOVED.md) and [`DEPRECATIONS.md`](./DEPRECATIONS.md).

| Concern | Canonical (use this) | Removed |
|---------|----------------------|---------|
| Health records | `/api/user/health-records/*` | `/api/health-records/*` |
| Forgot password | `/api/auth/forgot-password` | `/api/user/forgot-password` |
| Reset password | `/api/auth/reset-password` | `/api/user/reset-password` |
| Razorpay verify | `/api/user/verify-razorpay` | `/api/user/verifyRazorpay` |

## Intentional dual (kept)

| Path A | Path B |
|--------|--------|
| `/api/partner/emergency` | `/api/v1/partner/emergency` |

Prefer v1 for new partners.

## Naming preference

- **Prefer camelCase** on JSON responses for new/enterprise fields (`lifecycleStatus`, `publicId`, `tokenNumber`, `paidAtBooking`, `accessToken`, `refreshToken`, `expiresAt`, `userId`).
- **Keep snake_case aliases** where historically emitted so existing clients keep working (`refresh_token`, `expires_in`, payment order fields).

### Payments (see also `PAYMENT_CONTRACT.md`)

| Surface | Primary shape | Also accept / emit |
|---------|---------------|--------------------|
| Booking `POST /api/payments` | snake_case (`order_id`, `razorpay_key`, `checkout_token`, …) | camelCase aliases for clients |
| Pharmacy pay | camelCase (`orderId`, `razorpayOrderId`, `checkoutToken`, …) | snake_case aliases |

Clients must read both forms.

## Admin appointment list

`admin_controller.appointments_admin` uses shared `format_appointment_for_frontend`, which includes (when present):

- `lifecycleStatus`
- `publicId`
- `tokenNumber`
- `paidAtBooking`

plus existing booking fields (`_id` / `id`, `docId`, `userId`, payment flags, etc.).

## Deep links

- **Primary emit:** `medclues://` (`MEDCLUES_APP_DEEP_LINK_SCHEME`, default `medclues`)
- **Apps still accept:** `mediclues://`, `medichain://` (legacy)
- Package / applicationId still `com.medichain.*` until store rename (see `STORE_PACKAGE_RENAME_STATUS.md`)
