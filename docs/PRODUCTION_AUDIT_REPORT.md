# MEDCLUES — Complete Production Testing Audit Report

**Audit date:** June 2026  
**Auditor roles:** Senior QA, Security Tester, Backend Engineer, Frontend Engineer, Mobile Tester, Database Engineer, Product Auditor  
**Scope:** FastAPI backend · PostgreSQL · Flutter mobile · Admin web (Super Admin / Dean / Doctor) · Patient flows · Auth · Payments · Appointments · Video · Emergency · Telegram · FCM · Health records · Cloudinary · Dark mode · i18n · Deep links  
**Method:** Static code inspection, architecture review, route/auth matrix, schema/migration review, configuration review. **No automated E2E or penetration tests were executed in this pass.**  
**Rule:** Report only — no code was modified during this audit.

---

## Executive Summary

MEDCLUES is a **feature-rich healthcare monorepo** with a FastAPI backend, React admin panel, Flutter patient app, Telegram bot, Razorpay payments, Agora video, and FCM notifications. Core patient journeys (login, browse doctors/hospitals, book, pay, records, emergency) are **implemented end-to-end**, but the platform is **not production-hardened** without addressing critical security, schema reproducibility, and release-configuration gaps.

### Top risks before go-live

| # | Risk | Impact |
|---|------|--------|
| 1 | `DEBUG` defaults to `true`; weak JWT fallback in dev mode | Auth bypass, weak tokens on misconfigured deploy |
| 2 | Unauthenticated `POST /api/appointments` (super booking) | Anyone can create appointments |
| 3 | Health records uploaded to Cloudinary with `access_mode="public"` | PHI exposure if URLs are discovered |
| 4 | JWT middleware does not enforce `role` claim (except Dean) | Cross-role API access with valid token |
| 5 | Render cold starts + mobile splash waits on API | App feels frozen on physical phones |
| 6 | Android release signed with debug keystore | Play Store blocker |
| 7 | Admin panel has no per-role route guards | Wrong dashboards / token confusion |
| 8 | Base PostgreSQL schema not in repo | Fresh DB bootstrap unreliable |
| 9 | Emergency SMS service is stub (always “success”) | False sense of emergency delivery |
| 10 | In-memory OTP / rate limits | Breaks under multi-worker deploy |

### Strengths

- Refresh token rotation with reuse detection (`token_service.py`, `auth_controller.py`)
- Razorpay signature verification + webhook HMAC
- Health record view/download via signed URLs + audit logging
- Flutter contextual permissions (not blocking cold start)
- Telegram link-code flow (no password in chat for new users)
- FCM token registration behind patient auth
- Audit log table + migration runner (`migrations/001`–`008`)
- en / te / hi localization in Flutter
- `/health` and `/ready` endpoints with DB probe

---

## Production Readiness Score

| Area | Score (0–100) | Notes |
|------|---------------|-------|
| Backend API & auth | **58** | Good foundations; critical unauthenticated routes; role middleware gaps |
| Database & migrations | **52** | Partial migrations; legacy schema external; FK gaps |
| Flutter mobile (Android) | **68** | Most flows built; perf + signing + FCM gaps |
| Flutter mobile (iOS) | **42** | Missing plist permissions, deep links, Google scheme mismatch |
| Admin web panel | **55** | Functional but no role guards; dark mode cosmetic; orphan pages |
| Security & compliance | **48** | Public PHI uploads, legacy social login, enumeration |
| Observability & health | **62** | `/ready` exists; no Redis; limited structured metrics |
| Performance & UX | **60** | Splash/video/tutorial stack on phones |
| **Overall production readiness** | **56 / 100** | **Not ready for full public production** without Critical/High fixes |

**Verdict:** Suitable for **controlled beta** (Android APK, known users) after Critical fixes. **Not ready** for App Store, Play Store, or open public launch without High+ security and schema work.

---

## Critical Issues

| ID | Issue | Location | Test / exploit scenario |
|----|-------|----------|-------------------------|
| C-01 | `DEBUG` defaults `true` (`config.py:34`); dev JWT fallback when unset | `fastapi_back/app/config/config.py` | Deploy without `DEBUG=false` → weak `JWT_SECRET` |
| C-02 | `POST /api/appointments` unauthenticated super booking | `fastapi_back/app/routes/super_appointment_routes.py` | curl without token creates bookings |
| C-03 | Health records `access_mode="public"` on Cloudinary upload | `fastapi_back/app/controllers/health_record_controller.py` | Direct URL access to medical files |
| C-04 | Android release uses **debug signing** | `flutter_mobile/android/app/build.gradle.kts` | Play Store rejection |
| C-05 | iOS missing Camera/Mic/Photos/Notification usage strings | `flutter_mobile/ios/Runner/Info.plist` | App Store rejection / crash on permission |
| C-06 | iOS Google `CFBundleURLSchemes` ≠ `REVERSED_CLIENT_ID` in `GoogleService-Info.plist` | `ios/Runner/Info.plist`, `GoogleService-Info.plist` | Google Sign-In broken on iOS |
| C-07 | Emergency SMS always returns success (stub) | `fastapi_back/app/services/sms_service.py` | User believes SMS sent; it was not |
| C-08 | `database_schema.sql` missing; `scripts/apply_schema.py` broken | `fastapi_back/scripts/apply_schema.py` | Cannot reproduce DB from scratch |
| C-09 | Production Render deploy may fail: `JWT_SECRET` &lt; 32 chars (documented blocker) | Render env | Entire API down / stale deployment |

---

## High-Priority Issues

| ID | Issue | Location |
|----|-------|----------|
| H-01 | JWT middleware never checks `role` for patient/doctor/admin | `fastapi_back/app/middleware/auth.py` |
| H-02 | `SOCIAL_LOGIN_ALLOW_LEGACY=true` allows email-only social login | `config.py`, `user_controller.py` |
| H-03 | `GET /api/hospital-tieup/public/all` calls admin hospital list without auth | `hospital_routes.py` |
| H-04 | `GET /api/user/appointment/verify/{id}` — enumerable appointment PII | `user_routes.py` |
| H-05 | Unauthenticated AI chat endpoints (cost/abuse) | `ai_routes.py` |
| H-06 | WebSocket `/payment-updates` — no auth, subscribe by `appointmentId` | `fastapi_back/main.py` |
| H-07 | Production CORS allows any `localhost:*` via regex | `main.py:171-177` |
| H-08 | Password-reset OTP in process memory (not Redis) | `password_reset_storage.py` |
| H-09 | Admin plain `ADMIN_PASSWORD` env comparison | `admin_controller.py` |
| H-10 | Doctor can mark any health record “viewed” without patient link check | `health_record_controller.py`, `doctor_routes.py` |
| H-11 | `POST /api/emergency/send-alert` unauthenticated (rate-limited only) | `emergency_routes.py` |
| H-12 | `GET /api/verify-brevo` unauthenticated email probe | `otp_routes.py` |
| H-13 | Admin: no role-based route guards | `admin/src/App.jsx` |
| H-14 | Admin: access tokens in `sessionStorage` (XSS risk) | `AdminContext.jsx`, `DoctorContext.jsx`, `DeanContext.jsx` |
| H-15 | Admin: sidebar logout skips server revoke | `admin/src/components/Sidebar.jsx` |
| H-16 | Flutter: signup skips FCM `_afterAuth()` | `flutter_mobile/lib/providers/auth_provider.dart` |
| H-17 | Flutter: FCM background handler missing `Firebase.initializeApp()` | `push_notification_service.dart` |
| H-18 | Flutter: `medichain://payment` in manifest but not handled | `AndroidManifest.xml`, `app_deep_link_service.dart` |
| H-19 | Flutter: `usesCleartextTraffic="true"` globally | `AndroidManifest.xml` |
| H-20 | Payment ↔ appointment dual state without DB FK | `payment_transaction_model.py`, `appointment_model.py` |
| H-21 | Lab cancel does not verify booking ownership | `lab_controller.py`, `lab_routes.py` |
| H-22 | Telegram legacy `/login email password` in bot | `telegram_bot_controller.py` |

---

## Medium-Priority Issues

| ID | Issue | Location |
|----|-------|----------|
| M-01 | In-memory rate limits (not shared across workers) | `rate_limit.py`, `auth_controller.py` |
| M-02 | Many controllers return `str(e)` to clients | Multiple controllers |
| M-03 | `GET /ready` exposes `debug: settings.DEBUG` | `health_routes.py` |
| M-04 | No migration for `doctor_slots`, `telegram_*`, `appointment_reminder_sent`, `user_fcm_tokens` | Various models / `main.py` lifespan only |
| M-05 | FK hardening (`007`) skipped if orphan rows exist | `schema_hardening.py` |
| M-06 | Missing indexes: `appointments.slot_id`, `payment_transactions.appointment_id` | DB |
| M-07 | Health record partial upload failures swallowed silently | `health_record_controller.py` |
| M-08 | Flutter splash blocks on video + auth API (perceived freeze) | `splash_screen.dart` |
| M-09 | Onboarding tour: 6 route jumps + blur spotlight (GPU jank) | `onboarding_manager.dart`, `onboarding_spotlight.dart` |
| M-10 | `google_fonts` runtime fetch (~90 files) | Flutter codebase |
| M-11 | Release APK ~85 MB (video + Agora + Firebase) | `README.md`, assets |
| M-12 | No client-side 10 MB file size check on record upload | `records_screen.dart` |
| M-13 | Admin dark mode shell-only; pages hardcoded light colors | `index.css`, all `pages/` |
| M-14 | Admin dashboards infinite spinner on API failure | `Dashboard.jsx`, `DeanDashboard.jsx`, `DoctorDashboard.jsx` |
| M-15 | Dean context no session invalidation on auth errors | `DeanContext.jsx` |
| M-16 | `SystemSettings.jsx` mock save (no API) | `admin/src/pages/Admin/SystemSettings.jsx` |
| M-17 | `API_BASE_URL_WEB=http://localhost:5000` in bundled config | `assets/config.env` |
| M-18 | `mount /uploads` static without auth | `main.py` |
| M-19 | User enumeration on forgot-password messages | `auth_controller.py`, `user_controller.py` |
| M-20 | Legacy plaintext password verification paths | `user_controller.py`, `doctor_controller.py`, `dean_controller.py` |

---

## Low-Priority Issues

| ID | Issue | Location |
|----|-------|----------|
| L-01 | Splash “Tap to continue” not localized | `splash_screen.dart` |
| L-02 | `AppConfig.splashDurationMs` unused | `app_config.dart` |
| L-03 | Duplicate Revenue link in admin sidebar | `Sidebar.jsx` |
| L-04 | Orphan admin pages (no routes): `DeanPortals.jsx`, `SuperAppointments.jsx`, `SpecialtyHelpline.jsx` | `admin/src/pages/Admin/` |
| L-05 | Dead imports in `App.jsx`: `LiveTips`, `AnimatedQuotes`, `BackgroundFX` | `admin/src/App.jsx` |
| L-06 | Video consult chat local-only (not connected) | `DoctorVideoConsultRoom.jsx` |
| L-07 | Razorpay test card numbers in checkout HTML | `payments_controller.py` |
| L-08 | No `shrinkResources` / `minifyEnabled` on Android | `build.gradle.kts` |
| L-09 | `uvicorn` `reload=True` when run via `python main.py` | `main.py` |
| L-10 | Emergency testing strings hardcoded English | `emergency_active_screen.dart` |

---

## Cleanup Only (No functional bug, but adds debt)

| Item | Location |
|------|----------|
| Legacy Expo/React Native app `mobile/` still in repo | `mobile/` |
| Duplicate `ambulancia.lottie` / `.gif` at repo root | `ambulancia.lottie`, `ambulancia.gif` |
| `__pycache__` / `.pyc` tracked or present in working tree | `fastapi_back/` |
| Credential markdown files in repo | `all_doctors_credentials.md`, `all_deans_credentials.md` |
| Duplicate `admin\src\context\AdminContext.jsx` path variants (Windows) | git status |
| Old `VideoConsultRoom.jsx` vs `DoctorVideoConsultRoom.jsx` | `admin/src/components/` |
| `frontend/` separate marketing site — unclear if production-used | `frontend/` |

---

## Health Check Audit

| Service | Endpoint / mechanism | Status | Notes |
|---------|---------------------|--------|-------|
| **Backend liveness** | `GET /health` | ✅ Present | No DB check; always `ok` |
| **Backend readiness** | `GET /ready` | ✅ Present | `SELECT 1`; returns 503 if DB down |
| **PostgreSQL** | asyncpg pool in `db.py` | ✅ Used | Connection required at startup |
| **Redis / cache** | — | ❌ Not used | OTP, rate limits, sessions all in-memory |
| **Cloudinary** | Upload + `cloudinary_delivery.py` | ⚠️ Partial | No dedicated health probe; failures at upload time |
| **Firebase / FCM** | `fcm_service.py` | ⚠️ Optional | Disabled if `FIREBASE_CREDENTIALS_PATH` missing |
| **Telegram bot** | `telegram_polling.py` | ⚠️ Config-gated | `TELEGRAM_BOT_ENABLED=false` in `.env.example` |
| **Razorpay** | Order create + webhook | ⚠️ No health endpoint | Verify via test order in staging |
| **Brevo email** | `email_service.py` | ⚠️ No health endpoint | `GET /api/verify-brevo` exists but unauthenticated (security issue) |
| **Agora** | Token mint in doctor controller | ⚠️ No health endpoint | Test via video consult flow |
| **Render deploy** | Production | ❌ Blocker reported | `JWT_SECRET` must be ≥32 chars |

### Recommended health additions (not implemented)

```
GET /health/integrations  → Cloudinary ping, FCM init, Telegram getMe, Razorpay key validate
GET /health/deep          → DB migrations version, scheduler status, bot polling status
```

---

## Animation & Performance Audit

| Area | Implementation | Severity | Notes |
|------|----------------|----------|-------|
| **Splash video** | `opening.mp4` full-screen decode + play before handoff | **High (UX)** | Blocks navigation until video ends AND auth completes |
| **Splash fallback** | Logo + 1800ms delay on video failure | Medium | Acceptable |
| **main() blocking** | Firebase + secure storage before `runApp` | Medium | 1–3s white screen on mid-range Android |
| **Onboarding spotlight** | `BackdropFilter` blur + pulse animations | **High (UX)** | Jank on low-end GPUs |
| **Tour navigation** | 6 `context.go()` route changes | **High (UX)** | Each screen reloads providers/API |
| **Onboarding loading** | Full-screen `CircularProgressIndicator` overlay | Medium | Blocks UI during API fetch |
| **Page transitions** | `AnimatedTheme` 300ms in `main.dart` | Low | Fine |
| **Healthcare motion** | Stagger animations on dashboard | Low | Acceptable |
| **Lottie assets** | `ambulancia.lottie`, `success_checkmark.lottie` | Low | Verify sizes; duplicate at repo root |
| **Google Fonts** | Runtime download across ~90 Dart files | Medium | Offline/latency risk |
| **APK size** | ~85 MB release | Medium | Video + Agora + Firebase + images |
| **Render API cold start** | 30–60s possible on free tier | **High (UX)** | Splash/auth hang |

### Physical phone “stuck” root cause chain

```
App icon → Firebase init → Splash video → wait for auth API (Render) → Dashboard
                ↓                                    ↓
         1–3 seconds                          5–60+ seconds on cold start
                ↓
         New user → onboarding API → 6-screen tour with blur → more API calls
```

---

## Unnecessary Files Audit

| Category | Items | Recommendation |
|----------|-------|----------------|
| **Legacy mobile (Expo)** | Entire `mobile/` directory | Archive or remove from production branch |
| **Duplicate assets** | `ambulancia.gif`, `ambulancia.lottie` at repo root | Keep one copy under `flutter_mobile/assets/` |
| **Orphan admin pages** | `DeanPortals.jsx`, `SuperAppointments.jsx`, `SpecialtyHelpline.jsx` | Wire routes or delete |
| **Dead admin imports** | `LiveTips`, `AnimatedQuotes`, `BackgroundFX` in `App.jsx` | Remove imports |
| **Credentials in repo** | `all_doctors_credentials.md`, `all_deans_credentials.md` | **Remove from git**; use secrets manager |
| **Python bytecode** | `__pycache__/*.pyc` | Add to `.gitignore`; never commit |
| **Unused Flutter config** | `AppConfig.splashDurationMs` | Remove or use |
| **Legacy permissions screen** | `permissions_setup_screen.dart` not in router redirect | Document or remove |
| **Duplicate contexts** | `admin\src\context\` vs `admin/src/context/` (Windows duplicates) | Normalize paths in git |
| **Marketing frontend** | `frontend/` | Clarify if production; separate deploy |

---

## Security Issues (Consolidated)

| Category | Finding | Severity |
|----------|---------|----------|
| **Secrets in repo** | Credential markdown files | Critical |
| **JWT** | Weak dev fallback; role not enforced | Critical / High |
| **PHI** | Public Cloudinary upload mode | Critical |
| **Auth bypass** | Unauthenticated booking, AI, appointment verify | Critical / High |
| **Session** | Admin tokens in sessionStorage | High |
| **Social login** | Legacy email-only path | High |
| **CORS** | Localhost regex in production | High |
| **Rate limiting** | In-memory; many endpoints unlimited | Medium |
| **Input validation** | Inconsistent Pydantic coverage | Medium |
| **Error leakage** | `str(e)` in API responses | Medium |
| **Audit** | `audit_logs` table exists; not all sensitive actions logged | Medium |
| **Telegram** | Password login in chat | High |
| **Emergency** | Unauthenticated alert endpoint | High |
| **File upload** | No virus scanning; type by extension | Medium |
| **SQL injection** | asyncpg parameterized queries used — **low risk** if maintained | Low |
| **XSS** | Admin React — depends on escaping user content in tables | Medium (review per page) |

---

## Backend Issues (Detailed)

### Authentication & sessions
- Dual password-reset flows (`/api/auth/*` and `/api/user/*`)
- Refresh token rotation: **good**
- Cookie `secure=not DEBUG`, `samesite=lax`: **good**
- `auth_dean` only role-checked middleware

### Payments
- Razorpay HMAC verify: **good**
- `claim_for_fulfillment` with `FOR UPDATE`: **good**
- Web checkout token flow: acceptable with signature
- WebSocket payment updates: **unauthenticated**

### Appointments & slots
- `doctor_slots` table with unique window index: **good**
- Legacy `slots_booked` JSON: race-prone fallback
- Super appointment route: **no auth**

### Video consultation
- Agora server-side token: **good**
- Consultation status updates: verify doctor owns appointment (review controller)

### Telegram
- Link-code flow: **good**
- Polling in lifespan: **good**
- Bot disabled by default in `.env.example`

### FCM
- Token CRUD behind `auth_user`: **good**
- 24h reminder scheduler: **good** (runs every 30 min)

### Emergency
- Event logging table: **good**
- SMS stub: **critical functional gap**

---

## Flutter Issues (Detailed)

### Test matrix (static — manual retest required)

| Flow | Built | Production risk |
|------|-------|-----------------|
| Splash | ✅ | Video + API wait |
| Login / signup | ✅ | Signup FCM gap |
| Google login | ✅ Android / ❌ iOS | Scheme mismatch |
| Onboarding 8-step | ✅ | Performance |
| Dashboard | ✅ | API + fonts |
| Doctors / hospitals | ✅ | Image loading |
| Book + Razorpay | ✅ Android/iOS | Web fragile |
| Appointments cancel/calendar | ✅ | — |
| Records open | ✅ | Server proxy |
| Video consult | ✅ | Agora + permissions |
| Emergency SOS | ✅ | Real `tel:` in release |
| Telegram connect/disconnect | ✅ | Backend route needed |
| FCM notifications | ⚠️ | Background handler |
| Deep links | ⚠️ Android only | iOS missing |
| Dark mode | ⚠️ | Onboarding gaps |
| en / te / hi | ✅ | Some hardcoded strings |

---

## Web / Admin Issues (Detailed)

### Super Admin
- Dashboard, hospitals, deans, labs, blood banks, users, revenue, appointments: **implemented**
- `SystemSettings`: **mock only**
- `deleteAllAppointments`: destructive — needs audit trail UI
- No `.env.example` in `admin/`

### Dean
- Dashboard, doctors, appointments, patients, hospital: **implemented**
- Navbar shows “User” instead of dean name
- No revenue page despite context method

### Doctor
- Dashboard, appointments, video calls, profile, queue: **implemented**
- Queue management **not in sidebar**
- Video room: good loading/error; chat not live

### Patient web
- Primary patient UX is **Flutter**, not admin
- `frontend/` appears to be marketing/landing — separate from admin

---

## Database Issues (Detailed)

### Schema reproducibility
- Core tables (`users`, `doctors`, `appointments`, …) assumed from legacy Node migration
- `scripts/apply_schema.py` references missing `database_schema.sql`

### Tables created only at runtime
- `doctor_slots`, `telegram_user_links`, `telegram_link_codes`, `appointment_reminder_sent`, `user_fcm_tokens`, `deans` (partial)

### Referential integrity gaps
- `appointments.doctor_id` → no FK
- `appointments.slot_id` → no FK
- `payment_transactions.appointment_id` → VARCHAR, no FK
- `consultations.appointment_id` → no FK

### Data consistency risks
- Payment row `paid` but appointment `payment_status` unpaid (partial failure path)
- `emb_*` doctor IDs vs integer `doctors.id`
- Orphan FCM tokens if user deleted without cascade

### Indexes missing
- `appointments.slot_id`, `appointments.booking_id` (partial unique only in lifespan)
- `payment_transactions.appointment_id`, `razorpay_payment_id`

---

## Role-Wise Issues

### Super Admin
| Issue | Severity |
|-------|----------|
| Can access doctor/dean URLs if token leaked | High |
| `deleteAllAppointments` without strong UI guard | High |
| System settings non-functional | Medium |
| Revenue dashboard spinner on API fail | Medium |

### Dean
| Issue | Severity |
|-------|----------|
| No route isolation from admin/doctor | High |
| Session not cleared on auth error | High |
| Missing loading states on lists | Medium |
| Navbar name wrong | Low |

### Doctor
| Issue | Severity |
|-------|----------|
| Can mark any record viewed | High |
| Video consult appointment-not-found edge case | Medium |
| Queue page hidden from nav | Low |

### Patient
| Issue | Severity |
|-------|----------|
| Appointment verify by ID without auth | High |
| Public hospital admin endpoint | High |
| Signup → no FCM until re-login | High |
| Onboarding perf on phone | Medium |
| Records upload size not validated client-side | Medium |

### Guest / Emergency user
| Issue | Severity |
|-------|----------|
| Emergency from splash without login: **by design** | OK |
| `send-alert` abusable (rate limit only) | High |
| SMS not actually sent | Critical |

---

## File-Wise Fix Plan

| Priority | File(s) | Action |
|----------|---------|--------|
| P0 | `fastapi_back/app/config/config.py`, Render env | `DEBUG=false`, `JWT_SECRET` ≥32 chars |
| P0 | `fastapi_back/app/routes/super_appointment_routes.py` | Add `auth_user` or admin auth |
| P0 | `health_record_controller.py` | Cloudinary `access_mode` private + signed delivery |
| P0 | `flutter_mobile/android/app/build.gradle.kts` | Release keystore |
| P0 | `flutter_mobile/ios/Runner/Info.plist` | Permission strings + URL schemes |
| P1 | `fastapi_back/app/middleware/auth.py` | Enforce `role` per dependency |
| P1 | `fastapi_back/main.py` | Remove localhost CORS regex when `DEBUG=false` |
| P1 | `user_controller.py` | `SOCIAL_LOGIN_ALLOW_LEGACY=false` |
| P1 | `hospital_routes.py`, `user_routes.py`, `ai_routes.py` | Auth-gate or remove public PII |
| P1 | `admin/src/App.jsx` | `ProtectedRoute` per role |
| P1 | `admin/src/components/Sidebar.jsx` | Use `logoutWithApi()` |
| P1 | `auth_provider.dart` | `_afterAuth()` after signup |
| P1 | `push_notification_service.dart` | `Firebase.initializeApp()` in background handler |
| P2 | `password_reset_storage.py`, `rate_limit.py` | Redis backing store |
| P2 | `migrations/009_*.sql` | `doctor_slots`, telegram, reminders, FCM |
| P2 | `database_schema.sql` | Export full baseline schema |
| P2 | `splash_screen.dart` | Skip video after 2s / tap-to-skip; don’t block on API |
| P2 | `onboarding_spotlight.dart` | Reduce blur; single-screen tour option |
| P3 | Orphan admin pages | Wire or delete |
| P3 | `mobile/` legacy | Archive |
| P3 | Credential `.md` files | Remove from repository |

---

## Step-by-Step Implementation Plan

### Phase 0 — Unblock production API (Day 1)
1. Set on Render: `DEBUG=false`, `JWT_SECRET` (64+ random), `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`
2. Verify `GET https://medclues.onrender.com/ready` returns 200
3. Redeploy and smoke-test login from Flutter APK

### Phase 1 — Critical security (Days 2–5)
1. Auth-gate `POST /api/appointments` and sensitive GET routes
2. Switch health record uploads to private Cloudinary + signed URLs only
3. Enforce JWT `role` in middleware
4. Disable `SOCIAL_LOGIN_ALLOW_LEGACY` after client sends `idToken`
5. Remove credential files from git history
6. Configure Android release signing

### Phase 2 — Database hardening (Days 5–8)
1. Export and commit `database_schema.sql` baseline
2. Add migrations `009+` for runtime-only tables
3. Run orphan cleanup script; apply FK migration `007`
4. Add missing indexes on `appointments` and `payment_transactions`

### Phase 3 — Mobile release (Days 8–12)
1. Fix iOS plist (permissions, Google URL scheme, deep links)
2. FCM background handler + signup `_afterAuth()`
3. Splash: parallel auth + optional skip video
4. Onboarding: lighter tour or defer to Help → Replay
5. Build signed APK/AAB; internal testing track

### Phase 4 — Admin panel (Days 12–15)
1. Role-based routes and token isolation on login
2. Fix logout + Dean session handling
3. Error states on dashboards (no infinite spinners)
4. Wire or remove orphan pages
5. `admin/.env.example` + production build docs

### Phase 5 — QA regression (Days 15–20)
1. Run role matrix below on staging
2. Payment E2E: create → pay → verify → appointment
3. Video consult E2E with two devices
4. Telegram link + FCM reminder 24h (test appointment)
5. Emergency flow on release build (with `EMERGENCY_TESTING=true` for dial tests)
6. Load test: auth, booking, AI endpoints

### Phase 6 — Observability & polish (Days 20+)
1. Redis for OTP/rate limits
2. Integration health endpoint
3. Structured logging (replace `print`)
4. Real SMS provider or fail-closed emergency API
5. App Store / Play Store submission

---

## Manual Test Checklist (Per Role)

### AUTH (all platforms)
- [ ] Signup → login → logout
- [ ] Google login (Android + iOS after fix)
- [ ] Refresh token rotation
- [ ] Expired token → refresh → retry
- [ ] Forgot password both flows
- [ ] Wrong role token on wrong endpoint → 403
- [ ] Brute force login (rate limit)

### Super Admin
- [ ] Login → dashboard loads with error state on API fail
- [ ] CRUD hospitals, deans, labs, blood banks
- [ ] View all appointments
- [ ] Revenue analytics
- [ ] Cannot open `/doctor-dashboard` without doctor token

### Dean
- [ ] Login → hospital-scoped data only
- [ ] Add doctor, list appointments, patients
- [ ] Logout clears session server-side

### Doctor
- [ ] Slots, appointments, queue
- [ ] Video consult token + room
- [ ] View patient records (authorized only)

### Patient (Flutter)
- [ ] Book → pay → receipt
- [ ] Cancel / calendar
- [ ] Upload + open PDF/DOC report
- [ ] Emergency SOS + live location share
- [ ] Telegram connect/disconnect
- [ ] Push notification tap → appointment
- [ ] Deep link `mediclues://dashboard`
- [ ] Dark mode + language switch

---

## Final Production Readiness Checklist

| # | Item | Status |
|---|------|--------|
| 1 | `DEBUG=false` on production | ❌ |
| 2 | Strong `JWT_SECRET` on Render | ❌ (reported blocker) |
| 3 | CORS production allowlist only | ❌ |
| 4 | All sensitive routes authenticated | ❌ |
| 5 | Health records private in Cloudinary | ❌ |
| 6 | JWT role enforcement | ❌ |
| 7 | Base DB schema in repo | ❌ |
| 8 | Migrations complete for all tables | ❌ |
| 9 | Android release signing | ❌ |
| 10 | iOS plist + Google + deep links | ❌ |
| 11 | FCM background + signup registration | ❌ |
| 12 | Admin role route guards | ❌ |
| 13 | Admin secure logout | ❌ |
| 14 | Emergency SMS real or fail-closed | ❌ |
| 15 | Redis for OTP/rate limits (multi-instance) | ❌ |
| 16 | `/ready` returns 200 on production | ⚠️ Verify |
| 17 | Razorpay live keys + webhook | ⚠️ Verify |
| 18 | Telegram bot enabled on production | ⚠️ Verify |
| 19 | FCM credentials on production | ⚠️ Verify |
| 20 | Signed APK tested on physical device | ⚠️ Partial |
| 21 | Security scan / penetration test | ❌ Not done |
| 22 | Load test | ❌ Not done |
| 23 | HIPAA/PHI legal review | ❌ Out of scope |

---

## Appendix A — Key API Routes Requiring Auth Review

| Method | Path | Auth today | Should be |
|--------|------|------------|-----------|
| POST | `/api/appointments` | None | Admin or internal |
| GET | `/api/hospital-tieup/public/all` | None | Public subset or auth |
| GET | `/api/user/appointment/verify/{id}` | None | Auth or signed token |
| POST | `/api/ai/chat` | None | Auth + rate limit |
| GET | `/api/verify-brevo` | None | Admin only |
| WS | `/payment-updates` | None | Auth or signed channel |
| POST | `/api/emergency/send-alert` | Optional | Auth or CAPTCHA |

---

## Appendix B — Environment Variables (Production Minimum)

```env
DEBUG=false
JWT_SECRET=<64+ random characters>
REFRESH_TOKEN_SECRET=<optional separate>
DATABASE_URL=<neon postgres>
CORS_ALLOWED_ORIGINS=https://medclues.onrender.com,https://<admin-host>
GOOGLE_CLIENT_ID=<web client id>
SOCIAL_LOGIN_ALLOW_LEGACY=false
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
FIREBASE_CREDENTIALS_PATH=...
TELEGRAM_BOT_ENABLED=true
TELEGRAM_BOT_TOKEN=...
BREVO_API_KEY=...
EMAIL_LOGO_URL=...
MEDCLUES_APP_DEEP_LINK_SCHEME=mediclues
```

---

## Appendix C — Document Control

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | June 2026 | Automated static audit | Initial full production audit |

---

**End of report.**  
No source code was modified. Implement fixes in the order of Phase 0 → Phase 6 above. Re-run this audit after Critical and High items are resolved to target **≥80/100** production readiness.
