# Schema source of truth

- **Canonical:** `fastapi_back/migrations/*.sql` (apply in order).
- **`medclues_schema_before.sql`:** stale pre-migration dump — **not** canonical; do not use for new environments.
- **Runtime `ensure_*` helpers:** transitional only; prefer migrations when adding columns/tables.

## Dual `/api/appointments` routers (intentional)

- **Public BK lookup:** `app/routes/appointment_routes.py` — `GET /api/appointments/{booking_id}?sig=` (HMAC required; unauthenticated bare BK → 401).
- **Super Admin CRUD:** `app/routes/super_appointment_routes.py` — same `/api/appointments` prefix with `auth_admin`.
- Do not merge these routers; OpenAPI tags and auth differ. Reception check-in uses `/api/reception/check-in`, not the public BK GET.

## Deferred brand / package debt (documented only)

- Flutter Android `applicationId` is still `com.medichain.medichain_mobile` (see `flutter_mobile/android/app/build.gradle.kts`).
- FastAPI deep-link intents use `MEDCLUES_ANDROID_PACKAGE` (default matches that applicationId) in `app/utils/mobile_links.py`.
- Firebase project id `mediclues-e39db` is historical — do not invent a new id without a rename sprint.
- Full package / Firebase rename is out of scope for API consistency work.

See also `docs/backend/DB_AUDIT_REPORT.md`.
