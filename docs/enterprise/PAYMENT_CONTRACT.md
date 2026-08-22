# Payment contract — MedClues / Razorpay

**Brand / merchant name on checkout:** `MedClues` (booking checkout HTML and Razorpay `name`). Pharmacy checkout uses `MedClues Pharmacy` in the Flutter SDK flow.

**Deep links (M1):** checkout cancel/fail tries `mediclues://payment?...` first, then `medichain://payment?...` as legacy alias. No change required if already present in `payments_controller`.

## Dual field naming

Clients must accept **snake_case and camelCase** for order/session fields so booking and pharmacy responses both parse.

### Booking — `POST /api/payments` (and related)

Primary response shape is **snake_case**:

| Field | snake_case | camelCase (also accepted by clients) |
|-------|------------|--------------------------------------|
| Razorpay order id | `order_id` | `orderId` |
| Amount (paise) | `amount` | `amount` |
| Currency | `currency` | `currency` |
| Razorpay key | `razorpay_key` | `razorpayKey` |
| Checkout token | `checkout_token` | `checkoutToken` |
| Pending appointment id | `appointment_id` | `appointmentId` |

Flutter: `PaymentService.createAppointmentOrder` and `PaymentHistoryItem.fromJson` read both forms.

### Pharmacy — `POST /api/user/pharmacy/orders/{id}/pay`

Primary response `data` shape is **camelCase**:

| Field | camelCase | snake_case (also accepted by clients) |
|-------|-----------|--------------------------------------|
| Pharmacy order id | `orderId` | `order_id` |
| Razorpay order id | `razorpayOrderId` | `razorpay_order_id` |
| Razorpay key | `razorpayKey` | `razorpay_key` |
| Amount (paise) | `amountPaise` | `amount_paise` |
| Checkout token | `checkoutToken` | `checkout_token` |

Flutter: `pharmacy_screen.dart` `_payOrder` reads both forms.

### Verify payloads

Prefer snake_case request bodies (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`). Pharmacy verify route also accepts camelCase aliases where implemented server-side.

## Notes

- Do not commit Razorpay secrets; use env (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`).
- In-clinic bookings may pay at reception **or** via Razorpay when the app offers “Pay online” on the booking flow (same checkout path as video consult).
