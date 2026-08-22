# MEDCLUES — Admin / Staff Web Panel

React + Vite single-page app for all **staff-facing** roles of the MEDCLUES platform: **Super Admin**, **Dean**, **Doctor**, and **Receptionist**. The patient-facing client is the separate Flutter app ([../flutter_mobile/README.md](../flutter_mobile/README.md)); this panel talks to the same FastAPI backend ([../fastapi_back](../fastapi_back)).

| Resource | URL |
|----------|-----|
| Production API | `https://medclues.onrender.com` |
| Local API | `http://localhost:5000` (docs at `/docs`) |
| Monorepo overview | [../README.md](../README.md) |
| Mobile app | [../flutter_mobile/README.md](../flutter_mobile/README.md) |

---

## What's New

- **Receptionist panel** — a complete, hospital-scoped reception desk under `admin/src/pages/Reception/` (dedicated `receptionist` role). Covers dashboard, online bookings, walk-in registration, QR check-in, queue, follow-ups, payments, refund requests, no-shows, consultation summary, patients, reports and settings.
- **One receptionist per hospital** — Deans (and Super Admin) create/manage receptionists; every reception API call is scoped to the receptionist's `hospital_id`, so each desk only ever sees its own hospital's data.
- **Unified queue tokens** — online (app) and walk-in (desk) appointments for the same doctor/day now share **one continuous token sequence** (`MAX(token_number)+1`).
- **Patients page (records view)** — lists every patient of the hospital with:
  - **Type** = strictly **Online** (booked from the app) or **Walk-in** (booked at the reception desk), driven by the new `appointment_source` column — independent of payment method.
  - **Payment Type** (Online / Cash / Card / UPI / Pay at desk) and **Paid / Unpaid** status.
  - **Cancelled** bookings get a red badge and are pushed to the bottom of the list.
  - A **calendar date filter** — pick a date to see only that day's patients; clear to see everyone.
- **Flattened navigation** — dropdown menus removed across Doctor, Dean and Super Admin sidebars.
- **Redesigns** — Dean Doctors directory, Add Doctor form (Admin + Dean), Dean Hospital tie-ups with banner upload, Doctor Dashboard (with availability status buttons), Doctor Profile, Doctor Appointments, and the Doctor video consult room (in-call chat + booking symptoms/reports).

---

## Tech Stack

| Area | Choice |
|------|--------|
| Framework | React 18 + Vite 5 |
| Routing | `react-router-dom` v6 |
| Styling | Tailwind CSS 3 (custom `reception` brand color) |
| HTTP | Axios (role-aware auth interceptor) |
| State | React Context API (`AdminContext`, `DeanContext`, `ReceptionContext`, Doctor context) |
| Charts | `chart.js` + `react-chartjs-2` |
| Exports | `jspdf`, `jspdf-autotable`, `xlsx` |
| Realtime / video | `socket.io-client`, `agora-rtc-sdk-ng` |
| Notifications | `react-toastify` |

---

## Quick Start

```bash
cd admin
npm install
npm run dev          # Vite dev server (default http://localhost:5173/5174)
```

Build & preview:

```bash
npm run build        # production build → dist/
npm run preview      # serve the production build locally
npm run lint         # eslint
```

### Backend URL

The panel reads the API base from the app config / context (`backendUrl`). For local development run the FastAPI backend on `http://localhost:5000`; for production it points to `https://medclues.onrender.com`. CORS on the backend allows the `token`, `dean-token`, `doctor-token`, `rectoken` / `reception-token` and `Authorization` headers.

---

## Roles & Login

All staff log in from a single screen (`src/pages/Login.jsx`) and select their role. Tokens are stored per-role and attached by `src/services/authInterceptor.js`.

| Role | Scope | Entry pages |
|------|-------|-------------|
| **Super Admin** | Entire platform | `src/pages/Admin/*` |
| **Dean** | One hospital | `src/pages/Dean/*` |
| **Doctor** | Own patients/queue | `src/pages/Doctor/*` |
| **Receptionist** | One hospital (desk) | `src/pages/Reception/*` |

> Live staff credentials (including one receptionist per hospital) are documented in the monorepo [../README.md](../README.md). Do not commit real secrets.

---

## Receptionist Panel

Folder: `src/pages/Reception/` · Context: `src/context/ReceptionContext.jsx` · API prefix: `/api/reception`.

**Consolidated navigation** — to reduce front-desk UI load, the sidebar shows **6 grouped items** (`Dashboard · Check-In · Queue · Patients · Billing · Reports · Settings`). Each group lands on its primary page and exposes its sibling pages as a secondary tab bar (`ReceptionTabs` in `components.jsx`):

| Sidebar group | Secondary tabs |
|---------------|----------------|
| Check-In | Online Bookings · Walk-In · QR Check-In |
| Queue | Live Queue · No-Shows |
| Patients | All Patients · Follow-Ups |
| Billing | Payments · Refund Requests |

All routes below remain individually addressable.

| Screen | Route | File | Purpose |
|--------|-------|------|---------|
| Dashboard | `/reception-dashboard` | `ReceptionDashboard.jsx` | Today's KPIs — online vs walk-in split, queue snapshot |
| Online Bookings | `/reception-online` | `OnlineBookings.jsx` | App bookings awaiting verification / token |
| Walk-In Registration | `/reception-walkin` | `WalkInRegistration.jsx` | Multi-step offline patient registration + booking |
| QR Check-In | `/reception-checkin` | `QRCheckIn.jsx` | Scan patient QR to mark arrival |
| Today's Operations | `/reception-queue` / `/reception-online` / `/reception-today` | `TodaysOperations.jsx` | Unified desk queue + online bookings |
| Patients | `/reception-patients` | `Patients.jsx` | All hospital patients — type, payment, paid, cancelled, date filter |
| Follow-Ups | `/reception-followups` | `FollowUps.jsx` | Eligible follow-up visits |
| Payments | `/reception-payments` | `Payments.jsx` | Collect / record payments |
| Refund Requests | `/reception-refunds` | `RefundRequests.jsx` | Raise/track refunds |
| No-Shows | `/reception-noshows` | `NoShows.jsx` | Mark and review no-shows |
| Consultation Summary | `/reception-summary/:appointmentId` | `ConsultationSummary.jsx` | Post-visit summary prep |
| Reports | `/reception-reports` | `Reports.jsx` | Desk reporting |
| Settings | `/reception-settings` | `Settings.jsx` | Desk preferences |
| Shared UI | — | `components.jsx` | `PageWrap`, `RcHeader`, `KpiTile`, `Avatar`, `Pill`, `Spinner`, formatters |

**Data isolation:** the backend derives `hospital_id` from the receptionist JWT; the panel never sends a hospital id, so a desk physically cannot read another hospital's records.

**Booking source (`appointment_source`):** every appointment is tagged `ONLINE` (app) or `WALK_IN` (reception). This powers the Patients "Type" column, the dashboard online/walk-in split, and the Online Bookings list — kept separate from payment status so an app booking paid at the desk still shows as **Online**.

### Receptionist management

| Manager | File |
|---------|------|
| Dean (own hospital) | `src/pages/Dean/ManageReceptionists.jsx` |
| Super Admin (all hospitals) | `src/pages/Admin/ManageReceptionists.jsx` |

Both support create, enable/disable, password reset and delete, scoped appropriately.

---

## Super Admin Panel

Platform-wide control. Sidebar uses the **admin** brand color. Context: `src/context/AdminContext.jsx`.

| Nav label | Route | File | What it does |
|-----------|-------|------|--------------|
| Dashboard | `/admin-dashboard` | `Admin/Dashboard.jsx` | Platform KPIs — hospitals, doctors, patients, appointments, revenue snapshot |
| Revenue Hub | `/revenue-analytics` | `Admin/RevenueAnalytics.jsx` | Revenue charts & breakdowns (Chart.js), export |
| Appointments | `/all-appointments` | `Admin/AllAppointments.jsx` | Every appointment across all hospitals, filterable |
| Doctors List | `/doctor-list` | `Admin/DoctorsList.jsx` | All doctors, availability toggle, search |
| Hospital Tie ups | `/hospital-tieups` | `Admin/HospitalTieUps.jsx` | Onboard/manage partner hospitals |
| Manage Deans | `/manage-deans` | `Admin/ManageDeans.jsx` | Create/manage hospital deans |
| Add Doctors | `/add-doctor` | `Admin/AddDoctor.jsx` | Add a doctor (shared `AddDoctorForm`) |
| Labs | `/manage-labs` | `Admin/ManageLabs.jsx` | Diagnostic labs directory |
| Blood Banks | `/manage-blood-banks` | `Admin/ManageBloodBanks.jsx` | Blood banks + availability |
| Users | `/manage-users` | `Admin/ManageUsers.jsx` | Patient accounts management |
| Reception Scan | `/reception-scan` | `Admin/ReceptionScan.jsx` | QR scan utility |
| Receptionists | `/manage-receptionists` | `Admin/ManageReceptionists.jsx` | Global receptionist management (all hospitals) |
| Refunds | `/refund-management` | `Admin/RefundManagement.jsx` | Approve/track refund requests |
| Admins | `/manage-admins` | `Admin/ManageAdmins.jsx` | Manage super-admin accounts |
| System Settings | `/system-settings` | `Admin/SystemSettings.jsx` | Platform configuration |
| SLO Health | `/slo-health` | `Admin/SloDashboard.jsx` | Ops SLO dashboard |
| Community Moderation | `/community-moderation` | `Admin/CommunityModeration.jsx` | Health community moderation |

---

## Dean Panel

Scoped to a **single hospital**. Sidebar uses the **dean** brand color. Context: `src/context/DeanContext.jsx`.

| Nav label | Route | File | What it does |
|-----------|-------|------|--------------|
| Dashboard | `/dean-dashboard` | `Dean/DeanDashboard.jsx` | Hospital KPIs + hospital photo hero banner |
| Appointments | `/dean-appointments` | `Dean/DeanAppointments.jsx` | Hospital appointments |
| Doctors List | `/dean-doctors` | `Dean/DeanDoctors.jsx` | Redesigned directory; KPIs, search/filter, click for doctor detail modal |
| Patients | `/dean-patients` | `Dean/DeanPatients.jsx` | Hospital patients |
| Add Doctors | `/dean-add-doctor` | `Dean/DeanAddDoctor.jsx` | Add a doctor (shared `AddDoctorForm`) |
| Hospital Tie ups | `/dean-hospital` | `Dean/DeanHospital.jsx` | Hospital profile + **background/banner image upload** (Cloudinary) |
| Receptionists | `/dean-receptionists` | `Dean/ManageReceptionists.jsx` | Create/enable/disable/reset/delete receptionists for this hospital |

---

## Doctor Panel

Clinical operations. Sidebar uses the **doctor** brand color. Context: `src/context/DoctorContext.jsx`.

| Nav label | Route | File | What it does |
|-----------|-------|------|--------------|
| Dashboard | `/doctor-dashboard` | `Doctor/DoctorDashboard.jsx` | Today's queue + **availability status** (Available / In-clinic / Emergency / Offline) + schedule card |
| Appointments | `/doctor-appointments` | `Doctor/DoctorAppointments.jsx` | Redesigned appointment list/detail |
| Video Call | `/doctor-video-calls` | `Doctor/DoctorVideoCalls.jsx` | Pending/active video consults; incoming-call modal |
| Profile | `/doctor-profile` | `Doctor/DoctorProfile.jsx` | Redesigned profile + schedule (op hours, available days) |
| In Queue | `/doctor-in-queue` | `Doctor/DoctorInQueue.jsx` | Live token queue control |
| — (legacy) | `/queue-management` | redirect → `/doctor-in-queue` | Kept for old bookmarks |
| — (consult room) | `/doctor-video/:appointmentId` | `Doctor/DoctorVideoConsult.jsx` | Agora room with **in-call chat**, booking **symptoms** + **reports**, prescription/diagnosis/notes/advice/follow-up, correct video aspect fit |

Password recovery: `/doctor-forgot-password` (`src/pages/DoctorForgotPassword.jsx`).

---

## Shared UI

Reusable MedClues design-system components in `src/components/mc/`:

| Component | Role |
|-----------|------|
| `AdminPageLayout` | Page shell |
| `PageHero` | Hero banner header |
| `KpiCard` | Metric tiles |
| `FilterToolbar` | Search/filter bar |
| `McCard` | Generic card |
| `StatusPill` | Status badges |
| `LiveClock` | Live time display |

Plus app-level chrome: `Navbar.jsx`, `Sidebar.jsx` (role-aware, flattened — no dropdowns), `ScrollToTop.jsx`, `BackgroundFX.jsx`, `AnimatedQuotes.jsx`, `LiveTips.jsx`, `IncomingVideoCallModal.jsx`. Dashboard supports light/dark mode; all login/auth screens are forced light.

---

## Project Structure

```
admin/
├── src/
│   ├── main.jsx                 # App bootstrap + context providers
│   ├── App.jsx                  # Routes for all roles
│   ├── index.css                # Tailwind entry
│   ├── components/
│   │   ├── Navbar.jsx, Sidebar.jsx
│   │   ├── AddDoctorForm.jsx
│   │   └── mc/                  # MedClues design system
│   ├── context/                 # AdminContext, DeanContext, ReceptionContext
│   ├── services/                # authApi, authInterceptor
│   └── pages/                   # Admin / Dean / Doctor / Reception
├── tailwind.config.js           # includes custom `reception` color
├── vite.config.js
└── package.json
```

---

## Notes

- Do not commit the build output (`dist/`) or any credential files.
- After adding new Tailwind colors/classes, restart the Vite dev server so they recompile.
- The backend must be running (local or Render) for the panel to load data.
