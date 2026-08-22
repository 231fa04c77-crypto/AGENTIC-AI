# MEDCLUES Video Call — Complete Audit & Implementation Plan

**Date:** 2026-06-08  
**Issue:** Patient taps **Join Video Call** on Android APK → app closes instantly (returns to home screen)  
**Scope:** Flutter patient app · FastAPI backend · Admin doctor panel · Agora RTC · FCM  
**Status:** Audit only — **no code changes applied**

> **Note:** Your prompt mentions MySQL; this repo uses **PostgreSQL** (`fastapi_back/app/config/db.py`). All DB recommendations below target PostgreSQL.

---

## Executive Summary

The instant return to the home screen is almost certainly a **native Android process crash** (not a Flutter exception). Flutter’s `try/catch` in `VideoConsultScreen` would show an error screen, not kill the app.

**Most likely root causes (in order):**

| Rank | Cause | Why it matches “instant home screen” |
|------|--------|--------------------------------------|
| 1 | Camera/mic permission denied but Agora still initializes | `ensureVideoConsult()` return value is **ignored**; `joinChannel` with `publishMicrophoneTrack: true` can crash natively |
| 2 | Missing Android 12+ audio permissions (`BLUETOOTH_CONNECT`, `MODIFY_AUDIO_SETTINGS`) | Agora audio routing native crash on physical devices |
| 3 | `agora-special-full` native module excluded in Gradle | Incomplete Agora native SDK; device-specific JNI crashes |
| 4 | `dispose()` calls `leaveChannel()` / `release()` without `await` during activity teardown | Race crash when user backs out quickly |
| 5 | Agora keys only on local `.env`, not on Render production | Usually shows error UI, not crash — unless partial/invalid `appId` reaches native layer |

**Current architecture:** Patient taps Join → direct POST `/api/user/appointments/{id}/agora-token` → `createAgoraRtcEngine()` → `joinChannel`. **No call request, no doctor ringing, no waiting room state machine.**

---

# TASK 1 — ROOT CAUSE ANALYSIS (Current Codebase)

## 1. AndroidManifest.xml Permissions

**File:** `flutter_mobile/android/app/src/main/AndroidManifest.xml`

| Permission | Present | Required for Agora | Severity if missing |
|------------|---------|-------------------|---------------------|
| `INTERNET` | ✅ | Yes | Critical |
| `CAMERA` | ✅ | Yes | Critical |
| `RECORD_AUDIO` | ✅ | Yes | Critical |
| `MODIFY_AUDIO_SETTINGS` | ❌ | Recommended (speaker/earpiece routing) | **High** |
| `ACCESS_NETWORK_STATE` | ❌ | Recommended (network change handling) | Medium |
| `BLUETOOTH` / `BLUETOOTH_CONNECT` | ❌ | Required Android 12+ for BT headsets | **High** |
| `FOREGROUND_SERVICE` | ❌ | Required for ongoing call notification (Android 9+) | Medium |
| `FOREGROUND_SERVICE_CAMERA` | ❌ | Android 14+ camera FGS | Medium |
| `FOREGROUND_SERVICE_MICROPHONE` | ❌ | Android 14+ mic FGS | Medium |
| `WAKE_LOCK` | ❌ | Keep screen on during call | Low |

**Also missing:**
- `<uses-feature android:name="android.hardware.camera" android:required="false" />` — avoids Play Store filtering; not a crash cause.
- No dedicated **foreground service** declaration for in-call experience.

**Root cause:** Manifest is **minimal**. Physical phones with Bluetooth audio or strict Android 12–14 enforcement can crash inside Agora native audio stack.

**Recommended fix:** Add Agora-documented permissions; declare optional camera/mic features; add FGS type for calls when implementing ringing/background.

---

## 2. Runtime Permission Handling

**File:** `flutter_mobile/lib/services/app_permissions_service.dart`  
**Consumer:** `flutter_mobile/lib/screens/consultation/video_consult_screen.dart`

| Check | Status | Severity |
|-------|--------|----------|
| Camera requested before call | ⚠️ Partial | **Critical** |
| Microphone requested before call | ⚠️ Partial | **Critical** |
| **Result enforced** (block join if denied) | ❌ **No** | **Critical** |
| Permanently denied → open Settings | ❌ Not used for video | High |
| Pre-request on onboarding | ❌ Camera/mic not in onboarding | Medium |

**Code path:**
```dart
await AppPermissionsService.ensureVideoConsult(); // return value IGNORED
final engine = createAgoraRtcEngine();
await engine.initialize(...);
await engine.joinChannel(..., publishMicrophoneTrack: true, ...);
```

**Root cause:** If user denies camera or microphone (or taps “Don’t ask again”), Agora still runs. Native layer may throw **uncaught SecurityException** → process death → home screen.

**Recommended fix:**
1. Check `ensureVideoConsult()` result; if false, show dialog and `return` before `createAgoraRtcEngine()`.
2. On `permanentlyDenied`, call `openAppSettings()`.
3. Optionally pre-prompt on appointment detail before navigation.

---

## 3. Agora Initialization (Flutter)

**File:** `flutter_mobile/lib/screens/consultation/video_consult_screen.dart`  
**Package:** `agora_rtc_engine: ^6.5.0` (resolved `6.5.4`)

| Check | Status | Notes |
|-------|--------|-------|
| App ID from server token response | ✅ | `creds.appId` from API |
| Empty appId/token/channel guard | ✅ | Dart `Exception` before init |
| Engine create → initialize → register handler → enableVideo → join | ✅ | Standard order |
| `startPreview()` error handling | ✅ | try/catch, disables camera publish |
| `joinChannel` mic publish when mic denied | ❌ | Still `publishMicrophoneTrack: true` | **Critical** |
| `onError` handler | ⚠️ | Sets UI error only; doesn’t prevent native crash |
| Engine release on dispose | ⚠️ | Sync calls without await | **High** |

**UID / channel validation:**
- Channel: `medi_appt_{appointmentId}` (backend `agora_service.channel_for_appointment`)
- Patient UID: `user_id % 2147483647` (backend)
- Flutter uses server-provided `uid` — **correct**

**Root cause (client):** Initialization proceeds even when permissions fail; native Agora is less forgiving than Flutter exceptions.

---

## 4. Token Generation Flow (Backend)

**Files:**
- `fastapi_back/app/controllers/consultation_controller.py`
- `fastapi_back/app/services/agora_service.py`
- `fastapi_back/app/routes/user_routes.py` → `POST /api/user/appointments/{appointmentId}/agora-token`
- `docs/backend/AGORA_VIDEO.md`

| Check | Status | Severity |
|-------|--------|----------|
| Agora App ID + Certificate validation (32 hex chars) | ✅ | — |
| Token builder AccessToken2 (007) | ✅ | Vendored `RtcTokenBuilder2` |
| Appointment ownership check | ✅ | `ensure_consultation_for_appointment` |
| Online visit mode check | ✅ | `mode in ('online','video')` |
| Consultation auto-created on first join | ✅ | `_ensure_consultation_record` |
| Token expiry | ✅ | 3600s default |
| **Payment completed gate** | ❌ | Online Razorpay appointments can get token without payment verify | Medium |
| **Call request / doctor accept** | ❌ | Direct join — no session state | High (product) |
| Render production env vars | ⚠️ | `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` must be set on Render, not only local `.env` | **High** |

**API response shape (success):**
```json
{
  "success": true,
  "appId": "...",
  "channel": "medi_appt_123",
  "token": "...",
  "uid": 456,
  "consultationId": 1,
  "role": "patient"
}
```

**Flutter parsing:** `consultation_service.dart` → `assertSuccess` only fails if `success == false`. Malformed success would throw in Dart (error UI), not native crash.

**Root cause (server):** Unlikely to cause **instant** APK crash if keys are wrong — typically returns `success: false` message. Crash is still primarily **client native**.

---

## 5. Flutter Navigation

**Files:**
- `flutter_mobile/lib/screens/appointments/appointment_detail_screen.dart` — `context.push('/video-consult/${a.id}')`
- `flutter_mobile/lib/routes/app_router.dart` — route outside `ShellRoute` (full-screen) ✅
- Auth guard: authenticated users can access `/video-consult/:id` ✅

| Check | Status |
|-------|--------|
| Route registered | ✅ |
| Full-screen (not inside bottom nav shell) | ✅ |
| Auth redirect blocks unauthenticated | ✅ |
| Onboarding tour redirect during call | ⚠️ Possible conflict if tour active | Low |
| Global `FlutterError` / `runZonedGuarded` | ❌ Not implemented | Medium |
| `PlatformDispatcher.onError` | ❌ Not implemented | Medium |

**Root cause:** Navigation is fine. Crash happens **after** route opens (during Agora init).

---

## 6. Release APK / ProGuard / Native SDK

**Files:**
- `flutter_mobile/android/app/build.gradle.kts`
- `flutter_mobile/android/build.gradle.kts`
- `flutter_mobile/android/app/proguard-rules.pro`

| Check | Status | Severity |
|-------|--------|----------|
| `minifyEnabled` / `shrinkResources` | ❌ Not explicitly enabled | Low (ProGuard likely inactive) |
| ProGuard rules for Agora | ✅ `-keep class io.agora.**` | — |
| **`agora-special-full` excluded** | ⚠️ **Yes** (both app + root gradle) | **High** |
| `pickFirst` for `libaosl.so`, `libc++_shared.so` | ✅ | — |
| Release signing | ⚠️ Uses debug signing | Low (not crash) |
| `compileSdk` / `targetSdk` 36 | ✅ | — |
| `minSdk` | Flutter default (typically 21+) | Agora needs ≥21 |

**Comment in `android/build.gradle.kts`:**
> Excludes `agora-special-full` due to manifest namespace clash with `iris-rtc`.

**Root cause:** Excluding `agora-special-full` may leave **incomplete native libraries** on some ARM devices → JNI crash at `createAgoraRtcEngine()` or `joinChannel`.

**Recommended fix:**
1. Reconcile Agora dependency conflict properly (namespace merge tools / Agora-supported Gradle config) instead of excluding full SDK.
2. Test release APK on physical device with `adb logcat | grep -E "FATAL|agora|AndroidRuntime"`.
3. If minify enabled later, expand ProGuard keeps for `io.agora.iris`, `io.agora.rtc2`.

---

## 7. Crash Handling & Observability

| Area | Status | Severity |
|------|--------|----------|
| try/catch around `_start()` | ✅ | — |
| User-friendly error UI | ✅ | — |
| Native crash logging | ❌ | **Critical** for diagnosis |
| Firebase Crashlytics | ❌ | High |
| Permission denial UI | ❌ | **Critical** |
| Pre-flight token API error | ✅ | — |

**Recommended immediate diagnostic (no code change to app logic):**
```bash
adb logcat -c
# Reproduce crash on phone
adb logcat -d | grep -E "FATAL EXCEPTION|agora|RtcEngine|SecurityException|medichain"
```

---

## Task 1 — Issue Register (All Findings)

| ID | Issue | File Path | Severity | Root Cause | Recommended Fix |
|----|-------|-----------|----------|------------|-----------------|
| VC-01 | Permission result ignored before Agora init | `video_consult_screen.dart`, `app_permissions_service.dart` | **Critical** | `ensureVideoConsult()` return not checked | Gate join; show settings dialog if denied |
| VC-02 | Mic published when permission denied | `video_consult_screen.dart` L186-191 | **Critical** | `publishMicrophoneTrack: true` always | Set false if mic denied; block join if mic required |
| VC-03 | Missing `MODIFY_AUDIO_SETTINGS` | `AndroidManifest.xml` | **High** | Not declared | Add permission |
| VC-04 | Missing `BLUETOOTH_CONNECT` (API 31+) | `AndroidManifest.xml` | **High** | Not declared | Add with `maxSdkVersion` where needed |
| VC-05 | `agora-special-full` excluded | `android/build.gradle.kts`, `android/app/build.gradle.kts` | **High** | Manifest clash workaround | Fix dependency merge; don't strip native libs |
| VC-06 | Unsafe engine dispose | `video_consult_screen.dart` dispose() | **High** | Sync leave/release | Await in async dispose pattern |
| VC-07 | No foreground service during call | `AndroidManifest.xml` | Medium | Not implemented | FGS + notification for Android 14 |
| VC-08 | Agora keys may be missing on Render | Render env / `agora_service.py` | **High** | Production `.env` not synced | Set `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` on Render |
| VC-09 | Direct join — no doctor readiness | `consultation_controller.py` | Medium (product) | No call session FSM | Implement call request flow (Task 2) |
| VC-10 | No FCM incoming call for doctor | `fcm_service.py` | High (product) | No video call push type | Task 4 architecture |
| VC-11 | No Crashlytics | `main.dart` | Medium | No native crash capture | Add Firebase Crashlytics |
| VC-12 | No payment gate on token | `consultation_controller.py` | Medium | Token issued for online mode only | Verify `payment_status = paid` |
| VC-13 | Doctor chat local-only | `DoctorVideoConsultRoom.jsx` | Low | Not wired to backend | WebSocket / Firestore later |
| VC-14 | Database: no `call_sessions` table | `consultation_model.py` | High (product) | Status only on `consultations` | New schema Task 2 |

---

## Most Probable Crash Sequence (Your APK)

```
Tap "Video Consult"
  → push /video-consult/:id
  → VideoConsultScreen._start()
  → permission dialog (user denies OR already denied)
  → ensureVideoConsult() returns false  ← IGNORED
  → createAgoraRtcEngine().initialize(appId)
  → joinChannel(publishMicrophoneTrack: true)
  → Native SecurityException / Agora JNI error
  → Process killed
  → Android home screen
```

**Secondary path:** Release build loads incomplete Agora `.so` after `agora-special-full` exclusion → SIGSEGV in native code at engine init.

---

# TASK 2 — PRODUCTION VIDEO CALL ARCHITECTURE (Redesign)

## Target State Machine

```
                    ┌─────────────┐
     Patient tap    │  requested  │◄── Patient "Start Consultation"
    ───────────────►│             │
                    └──────┬──────┘
                           │ FCM → Doctor
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ accepted │ │ rejected │ │   busy   │
        └────┬─────┘ └──────────┘ └──────────┘
             │              │            │
             ▼              ▼            ▼
        Agora join     Patient notified  Patient notified
        both sides     + retry CTA       + callback CTA
             │
             ▼
        ┌──────────┐
        │ ongoing  │  (started_at set when both in channel)
        └────┬─────┘
             ▼
        ┌──────────┐
        │ completed│  → summary screen
        └──────────┘
```

## New API Endpoints (Proposed)

| Method | Path | Actor | Purpose |
|--------|------|-------|---------|
| POST | `/api/user/appointments/{id}/call/request` | Patient | Create session, status=`requested`, notify doctor |
| GET | `/api/user/appointments/{id}/call/status` | Patient | Poll/WebSocket: requested/accepted/rejected/busy/ongoing |
| POST | `/api/user/appointments/{id}/call/cancel` | Patient | Cancel ringing |
| POST | `/api/doctor/appointments/{id}/call/accept` | Doctor | status=`accepted`, mint Agora token |
| POST | `/api/doctor/appointments/{id}/call/reject` | Doctor | status=`rejected` |
| POST | `/api/doctor/appointments/{id}/call/busy` | Doctor | status=`busy` |
| POST | `/api/user/appointments/{id}/agora-token` | Patient | **Only when** status=`accepted` |
| POST | `/api/doctor/appointments/{id}/agora-token` | Doctor | Same gate |
| POST | `/api/.../call/end` | Either | End + summary |

## Real-Time Options

| Option | Pros | Cons |
|--------|------|------|
| FCM data + polling (2s) | Simple, matches current code | Not true real-time |
| WebSocket `/ws/call/{sessionId}` | Low latency | Infra on Render |
| Firebase Realtime DB / Firestore | Fast status sync | Extra cost |
| Agora RTM | Same vendor | Extra SDK |

**Recommendation:** Phase 1 = FCM + 2s polling (reuse `fetchVideoCallStatus` pattern). Phase 2 = WebSocket on FastAPI.

---

# TASK 3 — MEDCLUES PREMIUM EXPERIENCE

## 1. Smart Waiting Room (Patient)

**Screen:** `VideoWaitingRoomScreen` (new)  
**Before:** Agora join  
**Shows:**
- Doctor name, specialty, appointment time
- Status chip: Requesting → Ringing → Doctor joining
- ETA placeholder (avg consult time from history)
- Cancel request button

## 2. Queue Management

Reuse existing `tokenNumber` / `queuePosition` on appointments; extend for video queue:
- `video_queue_position`
- `patients_ahead`
- Live updates via polling endpoint

## 3. Doctor Availability

Already partial in `doctors.status` (`online`, `in-consult`, `offline`).  
**Wire to UI badges** on waiting room + doctor list.

## 4. Call Controls (Patient + Doctor)

| Control | Patient (Flutter) | Doctor (Admin) | Status |
|---------|-------------------|----------------|--------|
| Mute | ✅ | ✅ | Done |
| Video off | ✅ | ✅ | Done |
| Speaker | ❌ | ⚠️ partial | Add `setEnableSpeakerphone` |
| Camera switch | ❌ | ❌ | `switchCamera()` |
| Chat | ❌ | Local only | Backend channel needed |
| Share prescription | ❌ | Doctor only (notes field) | Wire to health records |

## 5. Consultation Summary

**Screen:** `ConsultationSummaryScreen` (new)  
**Data from:** `consultations` table (`duration`, `notes`, `prescription`, `ended_at`)  
**Shown after:** `end_video_call` success

---

# TASK 4 — DOCTOR RINGING NOTIFICATION (FCM)

## Architecture

```
Patient: POST /call/request
    ↓
FastAPI: INSERT call_sessions, status=requested
    ↓
FCM data message → doctor device(s)
    type: "incoming_video_consult"
    appointmentId, patientName, sessionId
    ↓
Doctor app (foreground): full-screen overlay
Doctor app (background): high-priority notification + fullScreenIntent
Doctor app (killed): FCM → flutter_local_notifications + action buttons
```

## FCM Payload (Data-only for Android)

```json
{
  "type": "incoming_video_consult",
  "appointmentId": "123",
  "sessionId": "456",
  "patientName": "Ravi Kumar",
  "channel": "medi_appt_123",
  "priority": "high"
}
```

## Flutter Doctor App Gap

Current doctor UI is **React admin web**, not Flutter. Options:
1. **Web:** Service Worker + Web Push (limited on iOS)
2. **Admin PWA** with notification permission
3. **Separate doctor Flutter app** (best for true ringing)
4. **Phase 1:** Doctor stays on web; FCM to **patient only** for status; doctor sees queue in dashboard polling

**Recommendation:** Short term — ringing via **admin web notification + sound** when tab open; FCM to doctor mobile when doctor Flutter app exists. Long term — doctor Flutter app with `fullScreenIntent` notification.

## Android 14 Requirements for Incoming Call UI

- `USE_FULL_SCREEN_INTENT` permission
- High-importance notification channel
- `ForegroundService` with type `phoneCall` or `camera|microphone`

---

# TASK 5 — FINAL DELIVERABLE

## 1. Current Issues Report

See **Task 1 Issue Register** (VC-01 through VC-14).

## 2. Crash Root Cause Analysis

**Primary:** Native crash from Agora initializing/joining without guaranteed camera+microphone permissions (VC-01, VC-02).  
**Secondary:** Incomplete Agora native SDK from Gradle exclusion (VC-05).  
**Tertiary:** Missing Bluetooth/audio manifest permissions on physical Android 12+ devices (VC-03, VC-04).

**Not the cause:** Navigation, route auth, or token JSON parsing (those show Flutter error UI).

## 3. File-by-File Fixes Required (After Approval)

| Priority | File | Change |
|----------|------|--------|
| P0 | `video_consult_screen.dart` | Enforce permissions; async safe engine teardown; speaker toggle |
| P0 | `app_permissions_service.dart` | `ensureVideoConsultOrThrow()` with permanent deny handling |
| P0 | `AndroidManifest.xml` | Add MODIFY_AUDIO_SETTINGS, BLUETOOTH_CONNECT, ACCESS_NETWORK_STATE, FGS |
| P0 | `android/build.gradle.kts` | Resolve Agora dependency without excluding `agora-special-full` |
| P1 | `main.dart` | `FlutterError.onError`, Crashlytics |
| P1 | Render dashboard | Set Agora env vars |
| P1 | `consultation_controller.py` | Payment-paid gate; call session FSM |
| P2 | New screens | Waiting room, summary |
| P2 | `fcm_service.py` | `incoming_video_consult` push type |
| P2 | Admin doctor panel | Accept/Reject ringing UI |

## 4. Database Changes Required

**New table: `call_sessions`** (PostgreSQL)

```sql
CREATE TABLE call_sessions (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id),
  consultation_id INTEGER REFERENCES consultations(id),
  patient_user_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'requested',
  -- requested | ringing | accepted | rejected | busy | ongoing | completed | missed | cancelled
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  reject_reason VARCHAR(50),
  agora_channel VARCHAR(100),
  patient_uid INTEGER,
  doctor_uid INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_sessions_appointment ON call_sessions(appointment_id);
CREATE INDEX idx_call_sessions_doctor_status ON call_sessions(doctor_id, status);
```

**Extend `consultations`:**
- `call_session_id` FK
- `call_summary_sent` boolean

## 5. API Endpoints Required

Listed in Task 2 table.

## 6. FCM Implementation Plan

| Step | Action |
|------|--------|
| 1 | Add `incoming_video_consult` template in `fcm_service.py` |
| 2 | Store doctor FCM tokens (already have `user_fcm_token`; add `doctor_fcm_tokens`) |
| 3 | On `/call/request`, push to doctor token(s) |
| 4 | Patient status updates via existing polling or new `/call/status` |
| 5 | Android: high-priority channel + full-screen intent (doctor app) |
| 6 | Handle `onMessageOpenedApp` → navigate to accept screen |

## 7. Agora Implementation Plan

| Step | Action |
|------|--------|
| 1 | Verify 32-char hex `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` on **Render** |
| 2 | Fix Gradle native SDK packaging |
| 3 | Gate `agora-token` endpoint behind `call_sessions.status = accepted` |
| 4 | Patient + doctor join same `medi_appt_{id}` channel |
| 5 | Keep token TTL 1h; refresh token if call > 45 min |
| 6 | Add Agora channel event webhook (optional) for audit |

## 8. Call Status Workflow

See Task 2 state machine.

## 9. Security Considerations

- Token endpoint must verify appointment belongs to user/doctor
- Rate-limit `/call/request` (prevent FCM spam)
- Agora tokens short-lived; never log full token
- Channel names unpredictable enough (`medi_appt_{id}` is OK for authenticated users)
- Require paid appointment before `call/request`
- HIPAA-style: no PHI in FCM notification body (use data-only + generic title)

## 10. Scalability Considerations

- `call_sessions` indexed by doctor_id + status
- FCM multicast for multi-device doctors
- Render WebSocket sticky sessions if using WS
- Agora handles media scaling; backend only signals
- Archive completed sessions for analytics

## 11. Production Deployment Checklist

- [ ] Set `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` on Render (32 hex each)
- [ ] Restart Render service after env change
- [ ] Test `GET /health` and token endpoint from phone network
- [ ] Grant camera + microphone on test device
- [ ] Capture `adb logcat` during crash (baseline)
- [ ] Apply VC-01–VC-06 fixes
- [ ] Build release APK: `flutter build apk --release`
- [ ] Test on 2 physical Android devices (12+ and 14+)
- [ ] Doctor joins from admin web; patient from APK
- [ ] Verify call timer sync (`sync_call_timer`)
- [ ] Verify end call resets doctor status to `online`
- [ ] Add Crashlytics before next production release

---

## Immediate Action (Before Redesign)

**To confirm root cause on your phone today:**

1. Connect USB debugging
2. Run logcat, reproduce crash
3. Check app Settings → Permissions → **Camera + Microphone = Allowed**
4. If crash stops after granting permissions → **VC-01 confirmed**
5. Verify Render has Agora keys: `curl https://medclues.onrender.com/health` (check agora flag if exposed)

---

## Approval Gate

No code has been modified for this audit.  
**Approve Phase 0 (crash fix)** before Phase 1 (call request + ringing) implementation.

| Phase | Scope | Effort |
|-------|--------|--------|
| **Phase 0** | Permissions + manifest + Gradle + dispose fix | 1–2 days |
| **Phase 1** | `call_sessions` + request/accept/reject API | 3–5 days |
| **Phase 2** | Waiting room + FCM ringing + doctor UI | 5–8 days |
| **Phase 3** | Premium summary, chat, queue polish | 5+ days |

---

*End of report.*
