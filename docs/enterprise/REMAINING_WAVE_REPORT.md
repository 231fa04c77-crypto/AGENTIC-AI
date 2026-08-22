# Remaining wave report (R0–R5)

**Date:** 2026-07-20  
**Scope:** Post–M0–M14 inconsistency cleanup

## Completed

| Milestone | Outcome |
|-----------|---------|
| **R0** | `MIGRATION_VERIFY_CHECKLIST.md`, `DEPRECATIONS.md` |
| **R1** | Admin/Dean use `labelForAppointment` + `paymentLabelForAppointment` (no unpaid→CASH) |
| **R2** | Drawer: Pharmacy / Medicines / Health Protection; notification patientLabel; MedClues comments |
| **R3** | Partner **Revoke API Key** UI; unused App.jsx imports removed |
| **R4** | Deep-link `mediclues://` primary + `medichain://` alias kept; MedClues Bot log strings |
| **R5** | Pharmacy ARB keys wired; this report |

## Primary teal (theme note)

Flutter primary brand teal remains `AppColors.medcluesTeal` (`#009F93`). Logo cyan (`logoTeal`) is accent-only — no full theme rewrite this wave.

## Still deferred

- Package / applicationId rename off `medichain` (gated)
- Dual API mounts — **removed** (see `DUAL_API_REMOVED.md`)
- Drop `medichain://` entirely after release window
- Full Telugu pharmacy/HP coverage
