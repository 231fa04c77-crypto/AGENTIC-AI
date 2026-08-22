# Store package rename — execution gate

**Status:** PREPARED — **not executed** (Firebase + store listing continuity require explicit approval).

## Current identity (locked)

| Surface | Value |
|---------|--------|
| Display name | MedClues |
| pubspec `name` | `medichain_mobile` (Dart import root — leave until separate refactor) |
| Android `applicationId` / `namespace` | `com.medichain.medichain_mobile` |
| iOS / macOS bundle | `com.medichain.medichainMobile` |
| Firebase Android `package_name` | `com.medichain.medichain_mobile` (in `google-services.json`) |
| Deep-link emit | `mediclues://` |
| Deep-link accept | `mediclues://` + `medichain://` (legacy) |

## Target (when approved)

| Surface | Value |
|---------|--------|
| Android `applicationId` / `namespace` | `com.medclues.app` |
| iOS / macOS bundle | `com.medclues.app` |
| Firebase / Google Sign-In / FCM | New Android+iOS apps registered; fresh `google-services.json` / `GoogleService-Info.plist` |
| Razorpay / Play App Signing | Update package allowlists |

## Blockers (why this todo cannot flip applicationId in-repo alone)

1. Changing `applicationId` without a matching Firebase client **breaks FCM and Google Sign-In**.
2. Play Store treats a new applicationId as a **new app** unless App Signing transfer is planned.
3. Prior enterprise rule: no store rename without explicit approval.

## Approval to execute

Reply with exactly: **`APPROVE STORE PACKAGE RENAME com.medclues.app`**

Then run the checklist in [`STORE_PACKAGE_RENAME_RUNBOOK.md`](./STORE_PACKAGE_RENAME_RUNBOOK.md) and the helper script `flutter_mobile/scripts/store_rename_checklist.py`.

## This session deliverable

- Exact IDs inventoried above
- Runbook + checklist script ready
- **No** `applicationId` / bundle / Firebase package change applied

**Todo `opt-store-rename`: COMPLETE (gated prep).**
