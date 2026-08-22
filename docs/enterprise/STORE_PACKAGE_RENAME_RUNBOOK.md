# Store package rename runbook (GATED)

**Status:** Prepared — execution blocked until explicit approval  
(see [`STORE_PACKAGE_RENAME_STATUS.md`](./STORE_PACKAGE_RENAME_STATUS.md)).

## Why gated

Current identity:

| Surface | Value |
|---------|--------|
| Display name | MedClues |
| pubspec `name` | `medichain_mobile` |
| Android `applicationId` / `namespace` | `com.medichain.medichain_mobile` |
| iOS bundle | `com.medichain.medichainMobile` |
| Firebase Android package | `com.medichain.medichain_mobile` |

Changing `applicationId` / bundle ID creates a **new store listing** unless Google Play App Signing + transfer / Apple bundle continuity is planned. Firebase clients must be re-registered first.

## When approved — checklist

1. Choose new id: `com.medclues.app`
2. Create Firebase Android + iOS apps with that id; download new config files
3. Update `android/app/build.gradle.kts` `applicationId` + `namespace`
4. Update iOS/macOS `PRODUCT_BUNDLE_IDENTIFIER`
5. Replace `google-services.json` / `GoogleService-Info.plist`
6. Update Razorpay / Google Sign-In / deep-link dashboards
7. Keep `medichain` URL scheme as accept-only for one release
8. Submit store update; do not remove old package until installs migrate
9. Verify with `python flutter_mobile/scripts/store_rename_checklist.py`

## This wave

- **No package rename performed**
- Display branding and deep-link emit already MedClues / `mediclues://`
- Prep artifacts: status doc + checklist script
