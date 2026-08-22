# MedClues — Product Checkpoint Report

**Date:** 31 July 2026  
**Scope:** Shipping trio — `fastapi_back` + `flutter_mobile` + `admin`  
**Overall readiness (shipping surface):** ~**78%**

This document is the single source for:
1. Stage checkpoints in every portal  
2. What is done and how far each area is  
3. Mandatory incompletes / missing items (why they matter)  
4. Best extra Flutter features to add next  
5. Rules, validations, and verifications for the whole system  

---

## 1. Executive snapshot

| Portal / area | Done (est.) | Status |
|---|---:|---|
| Reception portal | **88%** | Strongest desk lifecycle |
| Super Admin | **85%** | Broad ops; partner domains thin |
| FastAPI backend | **84%** | Core platform solid |
| Doctor portal | **83%** | Consult + VC strong |
| Flutter patient app | **82%** | Core journeys live; depth uneven |
| Dean portal | **80%** | Ops good; live PharmaSync blocked |
| Payments / Razorpay | **80%** | Primary path live |
| Video consult (P+D) | **78%** | Slot rules shipped; APK hardening left |
| AI assistant | **72%** | Built; often flag-off / keys |
| Emergency / ambulance | **70%** | SOS + dispatch present; SMS stub risk |
| PharmaSync / pharmacy | **65%** | MedClues side MVP; vendor provision missing |
| Labs / BB / insurance / HP | **55%** | Directories + HP; deep booking/claims thin |

**Active blockers for “production complete” pharmacy + VC:**
- PharmaSync missing `POST /api/integration/pharmacies` (Dean live connect + manager invite email)
- SMS provider unset → emergency/OTP SMS may stub-log only
- Video release APK hardening (permissions / FGS / Crashlytics) still open from VC audit
- Redis / workers / PgBouncer for multi-instance scale (ops, not feature)

---

## 2. What we shipped recently (this wave)

| Feature | Where | Checkpoint |
|---|---|---|
| VC join only in slot (−1 min … +5 min grace) | Backend + Flutter + Doctor room | Pass if early join blocked & late grace works |
| Leave-call confirm (patient) vs End consultation (doctor) | Flutter + Admin doctor room | Pass if Leave ≠ complete appointment |
| Soft warn at T−2; auto-end at slot_end + grace | Backend status + both clients | Pass if force-end stops rejoin |
| Poor-connection banner (Agora network quality) | Flutter + Doctor room | Pass after 2–3 poor samples |
| Lighter VC confirmation card + QR | Flutter booking confirmation | Pass: online ≠ full hospital receipt |
| 1-hour appointment / VC reminder | Scheduler + FCM + migration `055` | Pass: push ~50–70 min before slot |
| Agora A/V tuning (speech profile, 640×360, dual-stream) | Flutter Agora manager | Pass: stable call on mid-range Android |
| Live pharmacy catalog (Render inventory) | Flutter + FastAPI catalog orders | Pass: browse + COD/UPI home order |
| Dean pharmacy connect (local mode if no vendor URL) | Dean + provision service | Pass: pharmacy row + local `PHARM…` id |
| Schedule overrides / phone uniqueness / master catalog migrations | Backend | Pass: migrations apply clean |

---

## 3. Portal checkpoints (every stage)

Use these as QA scripts. Mark each row ☐ / ☑.

### 3.1 Flutter patient app

| Stage | Checkpoint | Done? |
|---|---|---|
| A1 | Splash → onboarding → permissions | Mostly |
| A2 | Signup / login (email OTP, Google) | Mostly |
| A3 | Home tiles: Hospitals, Doctors, Labs, BB, Pharmacy, Emergency, HP | Mostly |
| A4 | Book in-clinic: slots → patient → pay-at-clinic / Razorpay → full receipt | Yes |
| A5 | Book video: slots → pay → **VC card** (not hospital OPD receipt) | Yes (new) |
| A6 | Appointments list/detail: cancel, calendar, queue | Yes |
| A7 | Join Video only inside slot window; disabled + message outside | Yes (new) |
| A8 | Waiting room → doctor accept → Agora | Yes |
| A9 | Leave confirm; rejoin until grace; soft/force end banners | Yes (new) |
| A10 | Consultation summary / Rx view | Yes |
| A11 | Pharmacy catalog browse + cart + home COD/UPI | Yes (new) |
| A12 | Pharmacy from e-prescription (hospital-mapped pharmacy) | Partial |
| A13 | Paper Rx upload | **No** (stub) |
| A14 | Order reviews / rider live track polish | **No** (stub) |
| A15 | Records / community / AI chat | Partial–Yes |
| A16 | Emergency SOS + contacts | Partial (SMS may stub) |
| A17 | Health Protection browse / features | Partial |
| A18 | Labs / blood banks **book & pay** like appointments | Thin / missing |

**Flutter estimate: ~82%**

---

### 3.2 Super Admin (admin portal)

| Stage | Checkpoint | Done? |
|---|---|---|
| S1 | Admin login → dashboard KPIs | Yes |
| S2 | Hospital wizard / manage hospitals | Yes |
| S3 | Deans / doctors / users CRUD | Yes |
| S4 | Appointments / refunds | Yes |
| S5 | Enterprise Integrations: register PharmaSync `PHARMACY` partner + keys | Yes |
| S6 | Partner analytics / webhook deliveries / key rotate | Yes |
| S7 | Pharmacy master catalog | Yes |
| S8 | Hospital pharmacy counter (QR / status) | Yes |
| S9 | Labs / blood banks admin | Yes |
| S10 | Community moderation | Yes |
| S11 | SLO / system settings | Partial |
| S12 | Live partner domains (radiology, insurance, wearables…) | **Stub only** |

**Super Admin estimate: ~85%**

---

### 3.3 Dean portal

| Stage | Checkpoint | Done? |
|---|---|---|
| D1 | Dean login (hospital-scoped) | Yes |
| D2 | Dashboard / doctors add / availability | Yes |
| D3 | Appointments / patients overview | Yes |
| D4 | Receptionists manage | Yes |
| D5 | Pharmacies: add details | Yes |
| D6 | Connect with PharmaSync (active partner required) | Yes (local) / **blocked live** |
| D7 | Manager receives portal login email from PharmaSync | **No** (vendor must email) |
| D8 | Ambulances / ER dispatch | Partial–Yes |
| D9 | Community hospital tools | Partial |

**Dean estimate: ~80%**

---

### 3.4 Doctor portal

| Stage | Checkpoint | Done? |
|---|---|---|
| Doc1 | Login → availability / schedule | Yes |
| Doc2 | Day overrides / capacity | Yes (recent) |
| Doc3 | Queue → start consult → save notes/Rx → publish | Yes |
| Doc4 | Accept / reject / busy video call | Yes |
| Doc5 | Video room: A/V, chat, network quality, soft/force end | Yes (new) |
| Doc6 | End consultation (hard end) | Yes |
| Doc7 | Screen share | **No** (coming soon) |
| Doc8 | Patient history search | Yes |

**Doctor estimate: ~83%**

---

### 3.5 Reception portal

| Stage | Checkpoint | Done? |
|---|---|---|
| R1 | Login → today’s ops | Yes |
| R2 | QR / booking-id check-in | Yes |
| R3 | Walk-in registration | Yes |
| R4 | Queue advance / call next | Yes |
| R5 | Collect payment / refunds | Yes |
| R6 | No-show / grace / follow-up desk actions | Yes |
| R7 | ER dispatch assist | Partial |
| R8 | Deep reports vs Super Admin revenue | Partial |

**Reception estimate: ~88%**

---

### 3.6 FastAPI backend

| Stage | Checkpoint | Done? |
|---|---|---|
| B1 | Auth all roles (JWT) + partner HMAC | Yes |
| B2 | Slots / capacity / booking | Yes |
| B3 | Lifecycle / trust / no-show scheduler | Yes |
| B4 | Razorpay create/verify + webhooks | Yes |
| B5 | Agora tokens + call sessions | Yes |
| B6 | VC slot window + force-end on status | Yes (new) |
| B7 | 24h + 1h reminders | Yes (new) |
| B8 | User pharmacy + catalog-orders | Yes (new) |
| B9 | Partner pharmacy Rx/order/bill APIs | Yes |
| B10 | PharmaSync provision outbound | Local fallback; live 404 on vendor |
| B11 | Emergency / dispatch | Yes |
| B12 | AI gateway (flagged) | Yes when enabled |
| B13 | Production SMS (Twilio/MSG91) | **Often stub** |
| B14 | Multi-instance Redis/workers certified | **Ops incomplete** |

**Backend estimate: ~84%**

---

### 3.7 PharmaSync / pharmacy end-to-end

| Stage | Checkpoint | Done? |
|---|---|---|
| P1 | Super Admin registers partner + scopes | Yes |
| P2 | Env keys on MedClues (`PHARMASYNC_*`) | Local yes; Render = env only |
| P3 | Vendor `POST /api/integration/pharmacies` | **Missing (404)** |
| P4 | Dean connect → real `pharmacyId` from ERP | Blocked |
| P5 | Vendor creates manager user + emails password | Missing (by design on MedClues) |
| P6 | Structured Rx webhook → PharmaSync inbox | MedClues can emit; ERP must consume |
| P7 | Patient catalog order → MedClues order row | Yes |
| P8 | Status / bill callbacks → patient app | Partial / depends on ERP |
| P9 | Inventory decrement after payment | PharmaSync side |

**Pharmacy integration estimate: ~65%**

---

### 3.8 Video consult (combined)

| Stage | Checkpoint | Done? |
|---|---|---|
| V1 | Book VC fee correctly | Yes |
| V2 | Join window server + client | Yes |
| V3 | Soft warn + auto-end | Yes |
| V4 | Network quality UX | Yes |
| V5 | 1h reminder | Yes |
| V6 | Doctor screen share | No |
| V7 | Release APK Agora/permissions audit closed | Open |
| V8 | Recording / consent | Out of scope (default off) |

**VC estimate: ~78%**

---

## 4. Incomplete & missing — **mandatory**, level-wise

### Level L0 — Must fix before claiming “pharmacy live”

| Missing | Why mandatory |
|---|---|
| PharmaSync `POST /api/integration/pharmacies` | Without it, Dean connect cannot create a real ERP pharmacy; only local fake IDs |
| Manager credential email from PharmaSync | MedClues does not own PharmaSync passwords; ERP must create account + mail login |
| Correct Render `PHARMASYNC_*` + restart | Keys in chat/local `.env` do not auto-apply to production |
| At least 1 active `PHARMACY` partner | Dean UI blocks connect without it |

### Level L1 — Must fix before claiming “VC production-ready”

| Missing | Why mandatory |
|---|---|
| Close VC APK audit (camera/mic FGS, release Agora deps) | Calls crash or fail permissions on real devices |
| Deploy VC backend (`vc_slot_window`, force-end, reminders) | Local-only code ≠ production patients |
| Migration `055` applied on prod DB | 1h reminders won’t track without column |
| Agora + FCM env verified on prod | Tokens / pushes fail silently otherwise |

### Level L2 — Must fix before “hospital go-live” for a real hospital

| Missing | Why mandatory |
|---|---|
| SMS provider (Twilio/MSG91) | OTP / SOS / reminders to phone numbers otherwise stub |
| Razorpay webhook secret + live keys | Payments can mark unpaid or spoofed without verify |
| `ADVANCE_PAYMENT_ENFORCED` / lifecycle flags correct for prod | DEBUG-friendly flags leave money/queue holes |
| Reception desk trained + QR flow tested | OPD without check-in breaks queue truth |
| Dean pharmacy mapped + pickup hours correct | Rx orders have nowhere to land |

### Level L3 — Must fix before “scale / multi-hospital SaaS”

| Missing | Why mandatory |
|---|---|
| Redis + background workers in prod | Schedulers/reminders/webhooks unreliable on multi-instance |
| Partner domain products beyond stubs | Insurance/radiology marketed but not real APIs |
| Lab full book→pay→result in Flutter | Directory-only is not a complete care loop |
| Pen-test / PII review on public BK routes | Healthcare compliance risk |
| Structured error monitoring (Sentry/Crashlytics) | Cannot operate blind |

### Level L4 — Important but not launch-blocking for core OPD

| Missing | Why it matters |
|---|---|
| Paper Rx upload | Many patients still bring paper slips |
| Doctor screen share | Useful for reports; not required for talk-consult |
| Order reviews / rider ETA polish | Trust & retention for home delivery |
| Voice search medicines | Convenience |
| AI assistant enabled in prod with monitoring | Differentiation; not core booking |

---

## 5. How much we did — by product pillar

```text
Booking & queue        ████████████████░░  ~85%
Video consult          ███████████████░░░  ~78%
Payments               ████████████████░░  ~80%
Pharmacy (MedClues)    ████████████░░░░░░  ~65%
Pharmacy (vendor ERP)  ██████░░░░░░░░░░░░  ~30%  ← their provision API
Emergency              ██████████████░░░░  ~70%
Labs / BB              ██████████░░░░░░░░  ~50%
Health Protection      ███████████░░░░░░░  ~55%
AI Assistant           ██████████████░░░░  ~72% (flagged)
Admin / Dean / Doctor  ████████████████░░  ~80–85%
Reception              █████████████████░  ~88%
```

---

## 6. Best **extra** features for the Flutter app

Prioritized for impact vs effort (post-mandatory):

### Tier A — high value, fits MedClues

1. **Video Consult home tile** (replace/near More) — surfaces the product you just built  
2. **Pre-call device check** (camera/mic/network) before waiting room  
3. **Join countdown** on appointment cards (“Opens in 12m”) with live tick  
4. **Pharmacy order timeline** (placed → billed → packed → out for delivery → done)  
5. **Paper Rx photo upload** → attach to catalog/home order  
6. **Family profiles polish** (dependents) already partially there — make booking default clearer  
7. **Offline / poor-network mode** for appointments list cache  
8. **In-app VC rules** (short Terms sheet: join window, leave vs end, emergency disclaimer)

### Tier B — strong differentiators

9. **AI symptom → doctor/speciality suggest** (confirm before navigate)  
10. **Post-consult “order medicines” deep link** from summary with Rx prefilled  
11. **Lab package booking** with home collection slot (parity with OPD booking)  
12. **Health records vault** (upload reports, share with doctor for next VC)  
13. **Smart reminders** (24h + 1h + 15m for VC only)  
14. **Trust score / fee transparency** UI when advance pay required  

### Tier C — nice to have

15. Voice medicine search  
16. Medicine reminders / refill nudges  
17. Dark mode consistency across pharmacy + home  
18. Multilingual expansion beyond current l10n  
19. Wearables / vitals (only when partner domain is real)  
20. Doctor reviews / ratings (needs moderation)

---

## 7. Rules, validations & verifications (system-wide)

### 7.1 Identity & auth

| Rule | Enforcement |
|---|---|
| Every clinical API is role-scoped (user/doctor/dean/reception/admin) | JWT middleware |
| Patients never call PharmaSync directly | Flutter → MedClues only |
| Partners use API key + HMAC + timestamp window | Partner auth |
| Dean never sees `sk_` / webhook secrets | Super Admin only |
| Client cannot override `userId` on bookings | Ownership helpers |
| Phone OTP / email OTP expire and consume once | OTP storage |

**Add / harden:** enforce `PHONE_VERIFICATION_REQUIRED` in prod if SMS is live; rotate partner keys after leak; reject DEBUG mock payments in prod.

### 7.2 Booking & slots

| Rule | Enforcement |
|---|---|
| Online vs offline slot modes separate | Slot service |
| Capacity / double-book protection | Slot capacity service |
| VC slots = 15 minutes | `VC_SLOT_MINUTES` |
| Join only in `[start−1m, end+5m]` | `vc_slot_window` |
| Soft warn T−2; force-end after grace | Status poll + end path |
| Cancelled / completed appointments cannot join | Controllers |

**Add / harden:** refuse join if `forceEnd` even with old Agora token; never fail-open join on malformed slots in **prod** (today fail-open for legacy).

### 7.3 Video consult product policy

1. Join only in window (with grace).  
2. 1h reminder sent when scheduler + FCM healthy.  
3. Unlimited rejoin until doctor End or auto-end after grace.  
4. Patient **Leave** ≠ End consultation.  
5. Only booked patient + assigned doctor in channel.  
6. No unauthorized recording.  
7. Not for life-threatening emergencies (show disclaimer).  
8. VC fee at booking; refunds follow cancel policy.

### 7.4 Pharmacy

| Rule | Enforcement |
|---|---|
| Hospital Rx path needs mapped pharmacy | Dean pharmacies |
| Catalog/home order can fulfill via active catalog pharmacy | `list_active_for_catalog` |
| Partner callbacks signed | Webhook signature |
| Payment before stock decrement (ERP rule) | PharmaSync side |

**Add / harden:** sandbox vs production key enforcement; dead-letter UI for failed webhooks; never email PharmaSync passwords from MedClues unless ERP returns temp password by contract.

### 7.5 Payments

| Rule | Enforcement |
|---|---|
| Verify Razorpay signature before confirm | Payments controller |
| Webhook signature in prod | Must set webhook secret |
| Ownership of payment rows | `load_payment_for_user` |
| Mock pay only when `DEBUG && RAZORPAY_MOCK` | Config |

**Add / harden:** idempotent verify; reconcile orphan paid-unbooked orders nightly.

### 7.6 Queue / reception / lifecycle

| Rule | Enforcement |
|---|---|
| Lifecycle transitions audited | Lifecycle service |
| Missed → tomorrow offer → EOD cancel | No-show scheduler |
| Trust score can force advance pay | Config flags |

**Add / harden:** ensure prod flags match hospital policy; don’t leave `ADVANCE_PAYMENT_ENFORCED=false` in production.

### 7.7 Emergency

| Rule | Enforcement |
|---|---|
| SOS may be unauthenticated but rate-limited | Emergency routes |
| Hospital accept/dispatch scoped | Dean/reception auth |

**Add / harden:** real SMS; abuse monitoring; geo accuracy disclosure.

### 7.8 AI

| Rule | Enforcement |
|---|---|
| Mutating tools need explicit confirm | AI gateway |
| No diagnose/prescribe as medical advice | Product policy |
| Flag default off until keys + monitoring | `AI_ASSISTANT_ENABLED` |

### 7.9 Data & privacy

| Rule | Verification |
|---|---|
| Public booking QR / summary links are non-PII-safe | Manual + pen-test |
| Logs must not print full secrets / tokens | Code review |
| Migrations tracked in `schema_migrations` | Migration runner |
| `.env` never committed | Git hygiene |

### 7.10 Cross-portal verification matrix

| Event | Patient sees | Doctor | Reception | Dean | Super Admin | PharmaSync |
|---|---|---|---|---|---|---|
| Book VC | VC card + Join gated | — | Optional | — | — | — |
| Doctor accepts call | Waiting → room | Room opens | — | — | — | — |
| Soft/force end | Banner / leave | Banner / end | — | — | — | — |
| Structured Rx published | Pharmacy can order | Rx saved | — | Mapped pharmacy | Webhook log | Inbox (if live) |
| Catalog COD order | Order list | — | Counter optional | Pharmacy list | Orders/webhooks | Fulfill (if live) |
| Payment captured | Receipt / paid | — | Collect/refund | — | Refunds | `payment.completed` |

---

## 8. Recommended next 30 days (ordered)

1. **Vendor:** ship provision API + manager invite email → re-enable `PHARMASYNC_BASE_URL` on Render.  
2. **Deploy:** push MedClues code (VC + pharmacy + reminders) + run migrations `053–055`.  
3. **SMS + Razorpay prod secrets** on Render.  
4. **Flutter:** Video Consult home tile + join countdown + paper Rx upload.  
5. **Close VC APK audit P0/P1.**  
6. **E2E dry run:** book VC → call → Rx → pharmacy order → status callback.  
7. **Lab booking parity** (if hospital sells packages).  
8. Enable AI behind monitoring only after golden tests.

---

## 9. How to use this doc

- **Daily standup:** tick Section 3 checkpoints for the portal under test.  
- **Release gate:** L0 + L1 must be green before marketing “pharmacy live” / “video live”.  
- **Partner handoff:** paste Section 4 L0 + Section 7.4 to PharmaSync.  
- **Product backlog:** pull Tier A/B from Section 6 into issues.

---

## 10. Related docs in repo

- [`docs/PHARMASYNC_CONNECT_HANDOFF.md`](./PHARMASYNC_CONNECT_HANDOFF.md)  
- [`docs/PHARMASYNC_README.md`](./PHARMASYNC_README.md)  
- [`docs/VIDEO_CALL_AUDIT_REPORT.md`](./VIDEO_CALL_AUDIT_REPORT.md)  
- [`docs/enterprise/PRODUCTION_READINESS.md`](./enterprise/PRODUCTION_READINESS.md)  
- [`docs/enterprise/PHARMACY_WEBHOOKS.md`](./enterprise/PHARMACY_WEBHOOKS.md)  
- [`docs/HEALTH_PROTECTION_README.md`](./HEALTH_PROTECTION_README.md)  

---

*Generated for internal planning. Percentages are engineering estimates from codebase + recent delivery, not formal QA sign-off.*
