# MEDCLUES Health Community — Architecture & Implementation Guide

**Status:** Phase 1–3 implemented  
**Product rule:** Knowledge platform for authenticated users — **not** social media.

---

## 1. Objective

Authenticated patients ask health questions. Verified doctors answer. Resolved threads become a searchable medical knowledge base. Discovery leads to ethical appointment booking — never ads.

## 2. Access control

| Actor | Access |
|-------|--------|
| Public / search engines | **None** |
| Patient (JWT) | Ask, search, follow-up, save, report, vote helpful, Plus, knowledge archive |
| Verified doctor (JWT) | Answer, resolve, recategorize, recommend consult/ER, community stats |
| Hospital Dean | Hospital-scoped moderation, warn users |
| Super Admin | Full moderation, AI logs, warn/suspend, archive job |

## 3. Architecture

```
Flutter Patient App ──JWT──► /api/user/community/*
Admin Doctor Panel  ──JWT──► /api/doctor/community/*
Dean Panel          ──JWT──► /api/dean/community/*
Super Admin         ──JWT──► /api/admin/community/*

        │
        ▼
  community_service
        ├── community_model (PostgreSQL + FTS)
        ├── community_moderation_service (rules + optional Gemini/OpenAI)
        ├── community_reputation_service
        ├── socket_service (community:{specialty})
        └── community_archive_worker (daily)
```

## 4. Phases

### Phase 1 — Done
- Schema, patient/doctor/admin APIs, Flutter hub, doctor feed, admin moderation
- 1 question/day, search-first, specialty routing, disclaimer, soft delete

### Phase 2 — Done
- AI moderation (rules + optional LLM) → safe / suspicious / dangerous
- Socket rooms: `join_community_room`, `community_new_question`, `community_new_answer`
- Community reputation (separate from booking trust_score)
- Doctor community stats
- Dean hospital moderation

### Phase 3 — Done
- Community Plus (5 questions/day; activate endpoint — wire payment later)
- Postgres full-text search (`search_vector` + `ts_rank`)
- Helpful votes on answers
- Knowledge archive (resolved/archived)
- Background archive worker (resolved older than 90 days)

## 5. Status machine

```
new → answered → follow_up → resolved → archived
pending_moderation | rejected (never public until published)
```

## 6. Env (optional LLM moderation)

```
GEMINI_API_KEY=...
# or
OPENAI_API_KEY=...
```

Without keys, rules-only moderation still runs.

## 7. Migrations

- `039_health_community.sql`
- `040_health_community_phase2_3.sql`

## 8. Safety

Every public answer surfaces the educational disclaimer. Doctors can recommend appointment or emergency care. Community is never a diagnosis channel.
