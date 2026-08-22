# PRODUCTION_READINESS.md

See [ENTERPRISE_FINAL_PACK.md](./ENTERPRISE_FINAL_PACK.md) sections 12 and 20.

**Full scalability & readiness audit (2026-07-20):** [ENTERPRISE_SCALABILITY_AUDIT_2026-07-20.md](./ENTERPRISE_SCALABILITY_AUDIT_2026-07-20.md)  
**Enterprise Architecture Review (modular monolith evolution):** [ENTERPRISE_ARCHITECTURE_REVIEW_2026-07-20.md](./ENTERPRISE_ARCHITECTURE_REVIEW_2026-07-20.md)  
Ops / DR / SLO: [DR_SLO_RUNBOOK.md](./DR_SLO_RUNBOOK.md)  
Redis integration: [REDIS_INTEGRATION_REPORT.md](./REDIS_INTEGRATION_REPORT.md)  
Microservice boundaries: [MICROSERVICE_BOUNDARIES.md](./MICROSERVICE_BOUNDARIES.md)  
Prometheus SLO rules: [prometheus/slo_rules.yml](./prometheus/slo_rules.yml)  
Load harnesses: `fastapi_back/scripts/load/`  
Local Redis: root `docker-compose.yml`

Current deploy model: FastAPI on Render, Admin on Vercel, Flutter APK → `https://medclues.onrender.com`.

Must-run before claiming production-ready pharmacy/medical paths:
1. `032_pharmacy_phase2.sql`
2. `037_medical_knowledge_align.sql`
3. `041_search_trgm_outbox.sql` / `042_appointments_archive.sql` (auto via migration runner)

**Certification (see audit):** Not certified for multi-instance / large concurrent scale until Redis + worker fleet are provisioned in prod and load harnesses pass on staging. Phase 1–2 code foundations are in-repo.
