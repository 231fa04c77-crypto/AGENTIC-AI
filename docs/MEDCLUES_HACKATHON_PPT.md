---
# MEDCLUES — HACKATHON PITCH DECK
# WnCC × Kaya AI IIT India Hackathon 2026
# 16:9 Widescreen Format · 10 Slides
---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                        SLIDE 1 — COVER                            -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# 🏥 MEDCLUES

## Intelligent Healthcare & Emergency Dispatch Ecosystem

> *From Booking to Bedside — One Platform, Real Results.*

| | |
|---|---|
| **Event** | WnCC × Kaya AI IIT India Hackathon 2026 |
| **Track** | Physical AI & Open Innovation |
| **Status** | 🟢 Production Deployed |

**What we shipped →** Native Android APK · Native iOS App · 3 React Web Portals · FastAPI Backend

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                   SLIDE 2 — PROBLEM & SOLUTION                    -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# The Problem

| ❌ Today | ✅ With MEDCLUES |
|----------|----------------|
| Patients call clinics to check slot availability | Real-time online slot booking with Razorpay payment |
| Reception desk uses paper tokens & spreadsheets | Live digital token queue synced to doctor's dashboard |
| No link between SOS dispatch and hospital triage | GPS alert → automatic emergency queue token in seconds |
| Doctors have zero visibility before patient arrives | Patient history, uploads & prescriptions visible before consultation |
| Admin has no live revenue or queue analytics | Real-time KPI dashboard with Chart.js + Socket.IO |

> ### *Healthcare is not broken at one point. It's broken at every handoff.*
> ### *MEDCLUES removes every handoff.*

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                   SLIDE 3 — WHAT WE BUILT                         -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# What We Actually Built & Deployed

```
┌──────────────────┬──────────────────┬─────────────────────────────────┐
│  Patient Web     │  Staff Admin Web  │    MEDCLUES Mobile App          │
│  React + Vite    │  React + Vite     │    Flutter — Android & iOS      │
│                  │                   │                                  │
│  Appointments    │  ├─ Super Admin   │  ✅ Native Android APK           │
│  Payments        │  ├─ Hospital Dean │  ✅ Native iOS App               │
│  Records         │  ├─ Doctor Portal │  ✅ Razorpay Payments            │
│  AI Chatbot      │  └─ Receptionist  │  ✅ Agora Video Consult          │
│  Emergency SOS   │                   │  ✅ Zero-Login SOS               │
└──────┬───────────┴──────────┬────────┴──────────────┬──────────────────┘
       │                      │                        │
       └──────────────────────┴────────────────────────┘
                                      │
              ┌───────────────────────▼────────────────────────┐
              │           FastAPI + PostgreSQL + JWT             │
              │      Socket.IO · WebSockets · asyncpg           │
              └──────┬─────────┬──────────┬──────────┬──────────┘
                     │         │          │          │
               Razorpay   Agora RTC  Cloudinary  Brevo SMTP
               Payments   Video      Records     OTP/Email
```

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--               SLIDE 4 — CORE FEATURES AT A GLANCE                 -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# Platform Capabilities — All Live in Production

| Module | Key Features | Tech |
|--------|-------------|------|
| **Patient App** | Book · Pay · Cancel · Video Join · SOS · Records · AI Chat | Flutter + Razorpay + Agora |
| **Receptionist** | Check-In · QR Scan · Walk-in · Token Queue · Billing · Refunds | React + Socket.IO |
| **Doctor** | Queue Control · Digital Prescription · Video Room · Patient History | React + Agora RTC |
| **Hospital Dean** | Doctors Mgmt · Receptionists · Appointments · Analytics | React + Chart.js |
| **Super Admin** | All Hospitals · Revenue · Labs · Blood Banks · Policy Config | React + Chart.js |
| **Emergency** | Zero-Login SOS · GPS · WhatsApp Alert · Hospital Routing | Flutter + FastAPI |
| **Scheduling** | Dynamic Slots · Leaves · Overrides · Capacity Limits | FastAPI + PostgreSQL |
| **Audit Trail** | Every action logged — check-in, prescription, refund, schedule edit | PostgreSQL audit_logs |

> **5 portals. 1 database. Real-time sync across all roles.**

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--              SLIDE 5 — EMERGENCY SCENARIO (LIVE DEMO)             -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# Live Scenario: Emergency at a Construction Site

## The Incident → The Response → The Resolution

```
⚠️  INCIDENT                    🚨  DISPATCH                    🏥  RESOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                                              
 Worker collapses →       Supervisor taps SOS →     Hospital receives alert  
 chest pain at site       (no login required)        via Socket.IO push       
                                ↓                           ↓                 
                          GPS captured                Emergency token          
                          WhatsApp alert sent         auto-generated           
                          to 2 contacts +             at top of queue          
                          nearby hospitals                  ↓                 
                                                      Doctor joins             
                                                      Agora video call         
                                                      with paramedic           
                                                            ↓                 
                                                      Prescription synced      
                                                      to patient app           
                                                      before discharge         
```

![Ambulance Dispatch](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/ambulancia.gif)

> **Total time from SOS tap to doctor video guidance: under 90 seconds.**

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                SLIDE 6 — QUEUE & LIFECYCLE INTELLIGENCE           -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# The Queue Intelligence Engine

## Appointment ID ≠ Queue Token  *(This distinction matters)*

```
Patient Books & Pays          Reception Check-In              Doctor Dashboard
───────────────────           ──────────────────              ─────────────────

  APT20260709-0012      →      QR Scan / Booking ID    →       Token 12 — Called
  Permanent Receipt            Verify → Check In               Token 13 — Waiting
  PDF + Email sent             Token assigned                  Token 14 — Walk-in
                               Walk-ins absorbed               Token 15 — Waiting
```

### 14-State Lifecycle (Backend Enforced)
```
BOOKED → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED → FOLLOWUP_AVAILABLE → CLOSED

Also: CANCELLED · NO_SHOW · RESCHEDULED_ONCE · EXPIRED · REFUND_PENDING · REFUNDED
```

| Policy | Behaviour |
|--------|-----------|
| **Single active booking** | Cannot book while IN_PROGRESS or FOLLOWUP_AVAILABLE |
| **Trust Score** | No-shows reduce score → advance payment enforced automatically |
| **Paid No-Show** | One grace reschedule; second miss → EXPIRED |
| **Slot capacity** | Row-level DB lock prevents double-booking |

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                SLIDE 7 — TECH STACK                               -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# Technology Stack

```
Backend          │  FastAPI · Uvicorn · SQLAlchemy · asyncpg · PostgreSQL (Neon)
Auth             │  JWT + bcrypt · Firebase Auth · Google OAuth
Real-Time        │  Socket.IO (live queue) · WebSocket (payment polling)
Mobile           │  Flutter 3.3+ · Riverpod · go_router · Dio
Patient Web      │  React 18 · Vite 7 · Tailwind CSS · Framer Motion
Admin Web        │  React 18 · Vite 5 · Chart.js · Tailwind CSS
Video            │  Agora RTC (Web SDK + Flutter plugin)
Payments         │  Razorpay SDK (Web + Flutter)
Storage          │  Cloudinary (PDF · X-Ray · Prescriptions · Doctor Images)
Email / OTP      │  Brevo SMTP
Notifications    │  Telegram Bot (aiogram)
AI Chat          │  Gemini API · Mistral API
Maps / GPS       │  Google Geolocation · Maps SDK
```

> **Every integration is live. Not mocked. Not demo-mode.**

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                SLIDE 8 — UX PHILOSOPHY                            -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# Designed for Real Humans Under Real Pressure

## 4 UX Principles That Define MEDCLUES

### ① Zero-Login Emergency Access
> SOS button lives on the **splash screen**, before authentication.
> Any bystander triggers GPS dispatch in **1 tap** — no account, no friction.

### ② Single-Screen Reception Operations
> Receptionist never navigates away. One page. Two tabs.
> **Check-In** — scan QR, register walk-in, collect payment, generate token.
> **Today's Queue** — live board: Waiting → Called → In Consultation → Done.

### ③ Instant Prescription Delivery
> Doctor marks consultation complete → prescription auto-syncs to patient app.
> No PDF email. No waiting. Available in seconds.

### ④ Offline-First Emergency Logging
> No internet? No problem.
> Emergency events stored locally on Flutter app (last 50 cases).
> Auto-sync resumes when connectivity returns.

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                SLIDE 9 — FUTURE SCOPE                             -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# Future Scope — Where We Go Next

## 🔬 Physical AI Integration (Kaya AI Track Alignment)

| Feature | Description | Impact |
|---------|-------------|--------|
| **Smart Wearables** | Biometric vests & helmets auto-trigger SOS on fall/cardiac anomaly | Zero human delay in critical incidents |
| **Computer Vision** | CCTV + vision model detects missing PPE, falls, zone violations | Preventive dispatch before injury worsens |
| **AI Pre-Triage** | Reviews patient history before consultation starts, flags critical conditions | Doctor walks in prepared |

## 🌐 Partner Emergency Platform

> IRCTC · Uber · Rapido · FASTag · Metro · Airports · Corporate Campuses
> Partners use their own UI. MEDCLUES handles the entire emergency response via API.

## 🏥 MediChain Hospital Hierarchy (In Progress)
> Dynamic departments · HOD roles · Multi-department doctors · Hospital working calendars · Role-based receptionist permissions

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!--                SLIDE 10 — CLOSE + LIVE LINKS                      -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

---

# We Didn't Build a Prototype. We Built a Product.

> ## *"Healthcare efficiency shouldn't stop at the hospital gate.*
> ## *With MEDCLUES, we built a living, breathing system*
> ## *where every scan, every token, every prescription*
> ## *moves in real time — because when systems speak,*
> ## *lives are saved."*

---

## 🔗 Live Deployments

| | |
|---|---|
| 🌐 **Patient Web** | `https://medclues.com` |
| 🖥️ **Admin / Doctor / Reception** | `https://admin.medclues.com` |
| ⚙️ **API Swagger Docs** | `https://medclues-backend.onrender.com/docs` |
| 📱 **Android APK** | `https://medclues.com/downloads/android/app-release.apk` |
| 🍎 **iOS TestFlight** | `https://testflight.apple.com/join/medclues` |
| 💻 **GitHub** | `https://github.com/Hanuman/medclues` |

---

> 🏆 WnCC × Kaya AI IIT India Hackathon 2026 · Prize Pool ₹3,50,000 · Grand Finale August 14, Bengaluru
