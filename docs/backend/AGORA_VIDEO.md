# Agora video consultation

## Backend `.env` (required for tokens)

```env
AGORA_APP_ID=<same App ID as flutter_mobile/.env>
AGORA_APP_CERTIFICATE=<Primary certificate from Agora Console>
```

Restart FastAPI after changing these values.

## Channel & UIDs

- Channel name: `medi_appt_{appointmentId}`
- Patient UID: `user_id % 1_000_000_000` (low range)
- Doctor UID: `1_000_000_000 + doctor_id` (high range — avoids UID_CONFLICT when ids match)

Both sides join the **same channel** with role-specific RTC tokens from the backend.

## API endpoints

| Role    | Method | Path |
|---------|--------|------|
| Patient | POST   | `/api/user/appointments/{id}/agora-token` |
| Doctor  | POST   | `/api/doctor/appointments/{id}/agora-token` |

Doctor token also marks appointment/doctor as `in-consult` and consultation as `ongoing`.

## Web portals

### Patient (`frontend`)

1. Book an **online** appointment and complete payment.
2. Open **My Appointments** → **Join video call** (paid online visits).
3. Route: `/video-consult/:appointmentId` → `VideoConsultRoom` (Agora Web SDK).

### Doctor (`admin`)

1. Open **Appointments** or **Queue Management** for today's online patients.
2. Click **Video call** / **Video**.
3. Route: `/doctor-video/:appointmentId` → `VideoConsultRoom`.

## Flutter mobile

`VideoConsultScreen` uses `agora_rtc_engine` with the patient token endpoint (same channel).

## Install

```bash
# Backend uses vendored Agora AccessToken2 (007) in app/services/agora_token/
# Legacy pip package agora-token-builder (006) is NOT used — Web SDK 4.x needs 007 tokens.

# Web (doctor + patient portals)
cd admin && npm install agora-rtc-sdk-ng
cd frontend && npm install agora-rtc-sdk-ng
```

## Testing

1. Set `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` in `fastapi_back/.env`.
2. Create a paid online appointment.
3. Open patient web `/video-consult/{id}` and doctor web `/doctor-video/{id}` in two browsers (allow camera/mic).
4. Or use Flutter patient app + doctor web portal together.
