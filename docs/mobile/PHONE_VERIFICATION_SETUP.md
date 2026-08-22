# Verification & Integrations — Setup

This covers: **email verification (required)**, **phone verification (optional)**,
**Google social-login hardening**, and the **push / video** server config.

---

## 1. Email verification — REQUIRED at onboarding step 8
At "Complete your profile" (step 8) the user must verify their email with a
6-digit OTP before they can finish onboarding.

- App calls `POST /api/user/email/send-verification` → backend emails a code.
- User enters the code → `POST /api/user/email/verify` → backend marks
  `users.email_verified = true`.
- Migration `023_email_verified.sql` adds the column (auto-applied on startup);
  exposed in the profile API as `emailVerified`.
- **Google sign-in users are auto-verified** (provider already verified the email),
  so they skip this step.

**Server requirement:** working email delivery (Brevo or Gmail SMTP) — the same
config already used for password-reset OTPs. In `DEBUG` mode, if email fails the
API returns `dev_otp` so you can still test.

---

## 2. Phone verification — OPTIONAL (signup)
Phone OTP at signup is now **optional** (a "Verify phone via OTP" button; users
can skip it). Backend still verifies and trusts the token when sent.

- Set `FIREBASE_PROJECT_ID=mediclues-e39db` on the server.
- To make it mandatory later: set `PHONE_VERIFICATION_REQUIRED=true`.
- Firebase Console: enable **Phone** sign-in, add **SHA-1 + SHA-256**, optionally
  Play Integrity, and add **test phone numbers** for development (where your test
  token / fictional number goes).

---

## 3. Google social-login hardening
The app now sends the **Firebase ID token** with social login, so the backend
verifies it server-side (project `mediclues-e39db`) — no service account needed.

To turn off the relaxed legacy mode on Render:
```
FIREBASE_PROJECT_ID=mediclues-e39db
SOCIAL_LOGIN_ALLOW_LEGACY=false
```
(After deploying the new APK so all clients send the token.)

---

## 4. Push notifications (code is ready — needs server creds)
Set on Render so FCM can send:
```
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase-service-account.json
```
Upload the Firebase **service account JSON** (Project Settings → Service accounts
→ Generate new private key) as a Render *Secret File* at that path. Without it,
the server logs "push disabled" and notifications are skipped.

---

## 5. Video consultation (Agora — code is ready, needs keys)
Set on Render:
```
AGORA_APP_ID=<your-agora-app-id>
AGORA_APP_CERTIFICATE=<your-agora-app-certificate>
```
Until set, the app shows "Video calling is not available on the server yet"
(`/api/config/integrations` reports availability).

---

## Build the APK
```
flutter build apk --release --dart-define=API_BASE_URL=https://medclues.onrender.com --dart-define=TELEGRAM_BOT_USERNAME=medcluesBot
```
