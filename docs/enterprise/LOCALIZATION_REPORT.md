# Localization Report (M11)

**Date:** 2026-07-20  
**Scope:** Appointment status chip strings (light pass)

## Languages
- **en** (`app_en.arb`) — source of truth  
- **te** (`app_te.arb`) — stubs for new/aligned status keys (English copy until Telugu translations land)  
- **hi** — unchanged in this pass

## Status keys (chips)

| Key | EN | Wired in chip |
|-----|----|---------------|
| `statusBooked` | Booked | yes (existing) |
| `statusConfirmed` | Confirmed | yes (was hardcoded) |
| `statusReadyForDoctor` | Ready for doctor | yes (was hardcoded) |
| `statusInProgress` | In progress | yes (was `statusInConsultation`) |

## Notes
- `appointment_status_utils.dart` still resolves status **keys**; `appointment_status_chip.dart` maps keys → `context.l10n`.
- Remaining chip fallbacks (`nextToConsult`, `noShow`, refund labels) are still English literals — out of this light pass.
- After ARB edits, run `flutter gen-l10n` in `flutter_mobile/`.
