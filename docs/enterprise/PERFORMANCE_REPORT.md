# PERFORMANCE_REPORT.md (M12)

## Changes / notes
- Slot occupancy no longer counts `FOLLOWUP_AVAILABLE` (reduces false capacity pressure)
- Admin partner analytics filter scoped (less over-fetch display noise)
- HTTP logging includes elapsed ms + request id for latency triage

## Residual
- Appointment list N+1 risk on some admin views — monitor with request logs
- Flutter large lists: pharmacy/medicine should use pagination where APIs support it
- Image loading: existing AvatarImage cache patterns — no change this pass

**Performance score (estimate):** 62/100
