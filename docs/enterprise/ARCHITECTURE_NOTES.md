# Enterprise Architecture Notes (M10)

**Scope:** `flutter_mobile/`, `admin/`, `fastapi_back/`  
**Intent:** Document the current stack boundaries. No app rewrites; no BLoC migration.

---

## Flutter mobile — Riverpod

- State and DI use **Riverpod** (`flutter_riverpod`): `UncontrolledProviderScope` in `main.dart`, feature providers under `lib/providers/`, and `ConsumerWidget` / `ConsumerStatefulWidget` screens.
- Navigation is **go_router**; HTTP via shared API services injected through providers.
- **Do not migrate to BLoC.** Riverpod is the supported pattern for new and existing mobile work.

## Admin — React contexts

- Global UI/session helpers live in **`AppContext`** (`admin/src/context/AppContext.jsx`): currency, date helpers, sidebar/dark mode, backend URL env.
- Live updates use **`SocketContext`** (`admin/src/context/SocketContext.jsx`) for staff panels (reception toasts, admin live metrics).
- Prefer existing context + page-local state; avoid introducing a second global store without a clear need.

## FastAPI — service layer

- Routes/controllers stay thin; domain logic belongs in **`fastapi_back/app/services/`** (e.g. `appointment_lifecycle_service`, `slot_capacity_service`, `pharmacy_service`, `trust_score_service`).
- Controllers call services; services own DB rules, lifecycle transitions, and side effects (audit, webhooks, notifications).

## Shared status display (no payload change)

| Client | Module | Role |
|--------|--------|------|
| Admin | `admin/src/utils/lifecycleLabels.js` | `labelForLifecycle()` maps canonical / legacy lifecycle strings to display copy |
| Flutter | `lib/utils/appointment_status_utils.dart` | `resolveAppointmentStatus()` maps appointment + lifecycle to chip colors/labels |
| Flutter UI | `lib/widgets/common/appointment_status_chip.dart` | Renders chip; labels via l10n keys |

These helpers are **display-only**. They must stay aligned with server lifecycle enums (`BOOKED`, `CONFIRMED`, `READY_FOR_DOCTOR`, `IN_PROGRESS`, etc.) without changing API contracts.

## Admin API base URL

- Use **`getApiBaseUrl()`** from `admin/src/utils/apiBaseUrl.js` (`VITE_BACKEND_URL` with localhost fallback).
- Prefer this helper over hard-coded `:4000` / ad-hoc fallbacks when wiring admin API or socket clients.

## Explicit non-goals

- No Flutter BLoC / Cubit migration.
- No wholesale admin Redux/Zustand rewrite.
- No FastAPI controller→service mass refactor beyond incremental service extraction.
