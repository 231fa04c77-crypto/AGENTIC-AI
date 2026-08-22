# ROUTES.md — MedClues Enterprise

## Flutter (`flutter_mobile`) — key paths
See `lib/routes/route_names.dart`. Shell tabs: `/dashboard`, `/appointments`, `/records`, `/profile`.  
Dead redirects: `/address` → personal-info; `/payment-history` & `/payment-methods` → `/payments`.

## Admin (`admin/src/App.jsx`)
| Path | Page |
|------|------|
| `/reception-online` | TodaysOperations tab `bookings` |
| `/reception-queue` | TodaysOperations (desk queue) |
| `/reception-walkin` | WalkInRegistration |
| `/reception-checkin` | QRCheckIn |
| `/reception-today` | TodaysOperations |
| `/doctor-appointments` | DoctorAppointments (`?tab=today` supported) |
| `/doctor-in-queue` | DoctorInQueue (live desk) |
| `/queue-management` | Redirect → `/doctor-in-queue` |
| `/doctor-patients` | PatientsSearch |
| `/slo-health` | SloDashboard |
| `/community-moderation` | CommunityModeration |

## FastAPI prefixes
Canonical mounts only (legacy duals removed — see [`DEPRECATIONS.md`](./DEPRECATIONS.md) / [`DUAL_API_REMOVED.md`](./DUAL_API_REMOVED.md)):

`/api/user/*`, `/api/appointments`, `/api/auth/*`, `/api/payments/*`, `/api/reception/*`, `/api/dean/*`, `/api/v1/partner/pharmacy/*`, `/api/v1/partner/lab/*`, `/api/partner/emergency/*` + `/api/v1/partner/emergency/*` (intentional dual), `/api/user/pharmacy/*`, `/api/dean/pharmacies`, `/api/admin/partners`, `/api/medicine/*`, `/api/health-protection/*`, `/api/ai/*`

Health records: **`/api/user/health-records/*` only** (legacy `/api/health-records/*` removed).
