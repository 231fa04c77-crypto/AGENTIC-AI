# Inconsistency fix wave (2026-07-23)

Scope locked: **primary** = FastAPI + Flutter + Admin; **in-tree** frontend + Expo also patched for P0/P1 (not archived).

## Done in this wave

| Area | Change |
|------|--------|
| P0 payments | Removed Stripe / dead PayU verify / fixed AI slot URL on patient web |
| Brand | MediChain+ → MedClues on web + Expo display; support email/phone unified to `SUPPORT_EMAIL` / `1800-123-4567` |
| Deep links | Primary emit `medclues://`; accept `mediclues` + `medichain` |
| Lifecycle labels | Shared maps in admin / frontend / Expo; admin detail modal uses lifecycle |
| Docs | README, admin README, ROUTES, API_CONTRACT, DEPRECATIONS aligned with dual-API removal |

## Still gated / deferred

- Store package rename `com.medichain.*` → `com.medclues.app`
- Firebase project id typo `mediclues-e39db` (external)
- Expo / patient web full feature parity with Flutter
- Credential markdown under `docs/dev/` (do not ship secrets)
- Auth header / role hardening (documented intentional debt)

## Env cheat sheet

```
SUPPORT_EMAIL=medichain123@gmail.com
SUPPORT_PHONE=1800-123-4567
MEDCLUES_APP_DEEP_LINK_SCHEME=medclues
MEDCLUES_APP_DEEP_LINK_ALIASES=mediclues,medichain
```
