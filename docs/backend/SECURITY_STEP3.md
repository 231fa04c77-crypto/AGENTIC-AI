# Step 3 — Emergency Hardening (Completed)

## Backend (backward compatible)

| Change | Impact |
|--------|--------|
| `emergency_events` table + audit logging | None on clients |
| Rate limit `POST /api/emergency/send-alert` (10/hr/IP) | 429 if abused |
| Rate limit `POST /api/emergency/log-event` (30/hr/IP) | New additive endpoint |
| Rate limit OTP send (5/hr/IP) | Abuse protection |
| Phone normalization on send-alert | Stricter validation |
| `contact_type` OR `type` on add contact | Web `type` field now works |

`/api/emergency/send-alert` remains **unauthenticated** (web emergency flow). Optional Bearer token attaches `user_id` to audit log when present.

## Flutter

| Change | Impact |
|--------|--------|
| `testingMode` — false in release, true in debug | Real 108/100/101 calls in release APK |
| Override: `--dart-define=EMERGENCY_TESTING=true` | Test release builds safely |
| Emergency contacts sync when logged in | Settings load/save ↔ backend |
| SOS logs to `POST /api/emergency/log-event` | Fire-and-forget audit |

## Razorpay / Render

No new env vars required.

## Testing

1. **Debug build** — emergency calls still blocked with testing banner
2. **Release APK** — ambulance button dials `tel:108`
3. Logged-in user opens Emergency Settings → contacts load from API
4. Save contacts → synced to `/api/user/emergency-contacts/*`
5. Activate SOS → row in `emergency_events` with `event_type=sos_activated`
6. Spam send-alert → 429 after 10 requests/hour/IP
