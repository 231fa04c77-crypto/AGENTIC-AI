# Final consistency pass (2026-07-23)

Closes remaining brand / support-contact / admin lifecycle mismatches after prior fix waves.

## Production surface

| Client | Role |
|--------|------|
| `fastapi_back/` | API |
| `flutter_mobile/` | Patient app |
| `admin/` | Ops (admin / dean / doctor / reception) |

`frontend/` and `mobile/` (Expo) are **legacy / non-production** (brand + contact aligned; no full feature parity).

## Closed in this pass

- Admin `lifecycleLabels.js`: canonical `FOLLOWUP_AVAILABLE` / `FOLLOWUP_USED` / `FOLLOWUP_EXPIRED` (legacy FOLLOWUP_* keys kept as aliases)
- Support email/phone unified to `medichain123@gmail.com` / `1800-123-4567` on web Contact/Footer/receipts and Expo Help
- Brand leftovers: `Joined MedClues`, Footer `medclues`, CSS comment
- README banners for non-production clients

## Follow-up: last pending cleanup (same day)

- Stale dual-API “open debt” language removed from `FINAL_INCONSISTENCY_FIX_PASS.md` / `ENTERPRISE_FINAL_PACK.md`
- Frontend + Expo `lifecycleLabels` aligned with canonical FOLLOWUP_* keys
- Dead Stripe payment handler / `stripe_logo` export / PayU-named return comments cleaned on patient web
- Ship status: [`SHIP_CHECKLIST_CLOSED.md`](./SHIP_CHECKLIST_CLOSED.md)

## Still gated (do not treat as open bugs)

- Store package rename (`com.medichain.*` → `com.medclues.app`)
- Firebase project id typo (`mediclues-e39db`)
- Full Expo / patient-web feature parity with Flutter
- Auth header / role hardening (documented intentional debt)
- Demo credential markdown under `docs/dev/` (keep out of public deploys)

## Env cheat sheet

```
SUPPORT_EMAIL=medichain123@gmail.com
SUPPORT_PHONE=1800-123-4567
MEDCLUES_APP_DEEP_LINK_SCHEME=medclues
MEDCLUES_APP_DEEP_LINK_ALIASES=mediclues,medichain
```
