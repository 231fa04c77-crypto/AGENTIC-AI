# Ship checklist — closed (2026-07-23)

Production surface: **FastAPI + Flutter + Admin**. Legacy `frontend/` and Expo `mobile/` are non-production.

## Closed (no open P0/P1 consistency debt)

| Wave | Closed |
|------|--------|
| API ↔ Flutter | Support phone from config, Telegram `medcluesBot`, payment deep links, lifecycle chips, dead payment constants |
| Final consistency | Support email/phone unify, admin FOLLOWUP canonical, brand leftovers, README non-prod banners |
| Last pending | Stale dual-API docs marked removed; web/Expo FOLLOWUP_* aligned; dead Stripe props/asset export cleaned |
| Admin dead APIs | `POST /api/admin/send-email` + `GET /api/admin/patient-by-appointment/{id}` wired to FastAPI |

## Still gated (intentional — not ship blockers for current IDs)

- Store package rename `com.medichain.*` → `com.medclues.app`
- Firebase project id typo `mediclues-e39db`
- Full Expo / patient-web feature parity with Flutter
- Auth header / role hardening
- Demo credentials under `docs/dev/` (keep out of public deploys)

## Canonical support

```
SUPPORT_EMAIL=medichain123@gmail.com
SUPPORT_PHONE=1800-123-4567
MEDCLUES_APP_DEEP_LINK_SCHEME=medclues
```

## Auto appointment expire / miss (Render)

Past slots auto-close only when the no-show scheduler is on:

```
AUTO_NO_SHOW_JOB=true
RUN_BACKGROUND_WORKERS_IN_API=true
```

- Code default: **on** when `DEBUG=false`, **off** when `DEBUG=true` (unless env overrides).
- Flow: slot ended (+30 min IST) → `MISSED` (tomorrow reschedule offer) → offer deadline passed → `CANCELLED` / `CLOSED`.
- After deploy, Render logs should show: `No-show / auto-expire scheduler STARTED`.

See also: [`FINAL_CONSISTENCY_PASS_2026-07-23.md`](./FINAL_CONSISTENCY_PASS_2026-07-23.md), [`DUAL_API_REMOVED.md`](./DUAL_API_REMOVED.md).
