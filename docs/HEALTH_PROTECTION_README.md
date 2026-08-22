# Health Protection Module — MEDCLUES

AI-powered health insurance & protection experience for the MEDCLUES patient app.

> **Status:** Phased delivery (0→6). Implement one phase at a time; do not start the next until acceptance criteria pass.  
> **Isolation:** Additive only — does not replace Pharmacy, Medicine, Emergency, booking, or partner auth.

---

## Vision

Replace the home **Insurance / coming soon** stub with a premium **Health Protection** hub inspired by Apple Health + Google Health + Apollo + Practo, with MEDCLUES brand (navy + teal/emerald + white), glass-style cards, animated score, and clear CTAs.

**Not medical or insurance advice.** Label, eligibility, and AI outputs are educational / decision-support only.

---

## Locked decisions

| Topic | Choice |
|-------|--------|
| Database | **PostgreSQL** (asyncpg) — not MongoDB |
| Plan data | Curated catalog in Postgres + AI ranking |
| Partner TPA | Keep `/api/v1/partner/insurance/*` stubs for future integration |
| Maps | Existing hospitals + Google Maps **URL** launcher (no Maps SDK) |
| Uploads | Cloudinary + JWT (same as health records) |
| AI | Mistral / MediChain patterns already in backend |
| Auth | Patient JWT (`auth_user`) for all patient APIs |

---

## Architecture

```text
Flutter Home tile → Health Protection Hub → Feature screens
                         │
                         ▼
              FastAPI /api/health-protection/*
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    Postgres         Cloudinary      Mistral AI
  (plans, scores,    (policy PDFs,   (recommend,
   claims, family)    claim docs)     analyze, chat)
                         │
                         ▼ (future)
              /api/v1/partner/insurance/*
```

---

## Home screen

- Replace **Insurance** quick tile with **Health Protection**.
- Navigate to `/health-protection` (hub).
- No “Insurance coming soon” snackbar for this tile.

---

## Database (migrations)

| Migration | Phase | Purpose |
|-----------|-------|---------|
| `035_health_protection_core.sql` | 0–1 | Companies, plans, user policies, scores, emergency cards, renewals |
| `036_health_protection_features.sql` | 2–5 | Recommendations log, comparisons, eligibility, uploads, claims, family, expenses, risk, chat |
| Partner templates | existing `033` | Insurance partner metadata (unchanged) |

### Core tables

- `hp_insurance_companies` — id, name, logo_url, claim_ratio, rating
- `hp_insurance_plans` — company_id, name, monthly_premium, coverage_amount, cashless_hospitals_count, waiting_period_days, room_rent, maternity, critical_illness, ped_waiting_days, dental, vision, network_notes, pros, cons, features (jsonb)
- `hp_user_policies` — user_id, plan_id (nullable), company_name, policy_number, coverage_amount, premium, status, starts_at, expires_at, members_covered
- `hp_health_scores` — user_id, score, factors (jsonb), suggestions (jsonb), computed_at
- `hp_emergency_cards` — user_id, photo_url, blood_group, policy_number, company, coverage, emergency_contact_name, emergency_contact_phone, qr_payload
- `hp_family_members` — user_id, relation, name, coverage_amount, status, renewal_date, medical_history
- `hp_claims` — user_id, status, amounts, timeline (jsonb), expected_settlement
- `hp_claim_documents` — claim_id, doc_type, file_url, public_id
- `hp_policy_uploads` — user_id, file_url, summary (jsonb), plain_explanation
- `hp_expenses` — user_id, category, amount, spent_at, note, claim_id
- `hp_risk_scores` — user_id, level, score, inputs (jsonb), recommendations (jsonb)
- `hp_chat_messages` — user_id, role, content, created_at
- `hp_cashless_hospitals` — name, lat, lng, rating, open_now, emergency, insurer_tags (text[]), phone, address
- `hp_notifications_log` — user_id, type, payload, sent_at

---

## API catalog (`/api/health-protection`)

All require patient JWT unless noted. Swagger tag: **Health Protection**.

### Phase 0–1 — Hub, score, emergency card

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hub` | Score, active policy summary, family count, expiry, quick links |
| GET | `/score` | Health Protection Score + factors + suggestions |
| POST | `/score/recompute` | Recompute score from profile/policy/records signals |
| GET | `/policies` | User policies |
| POST | `/policies` | Add / link policy |
| PATCH | `/policies/{id}` | Update policy |
| GET | `/emergency-card` | Digital emergency card |
| PUT | `/emergency-card` | Upsert card fields |
| GET | `/emergency-card/pdf` | PDF download bytes |
| GET | `/plans` | Catalog (paginated) |
| GET | `/plans/{id}` | Plan detail |
| GET | `/companies` | Companies |

### Phase 2 — AI recommend, compare, eligibility

| Method | Path | Description |
|--------|------|-------------|
| POST | `/recommend` | Body: questionnaire → top 5 plans + AI why/pros/cons/score |
| POST | `/compare` | Body: plan_ids[] → comparison table + AI pick |
| POST | `/eligibility` | Body: age, income, student, state, employment → schemes |

### Phase 3 — Policy analyzer, claims

| Method | Path | Description |
|--------|------|-------------|
| POST | `/policy/analyze` | multipart file → AI summary |
| GET | `/policy/uploads` | Past analyses |
| GET | `/claims` | List claims |
| POST | `/claims` | Create draft claim |
| POST | `/claims/{id}/documents` | Upload bill/rx/discharge/report |
| POST | `/claims/{id}/submit` | Submit for review |
| GET | `/claims/{id}` | Detail + timeline |

### Phase 4 — Cashless + family

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cashless-hospitals` | Nearby (lat/lng/radius) + filters |
| GET | `/family` | Family members |
| POST | `/family` | Add member |
| PATCH | `/family/{id}` | Update |
| DELETE | `/family/{id}` | Remove |

### Phase 5 — Expenses, risk, chat

| Method | Path | Description |
|--------|------|-------------|
| GET | `/expenses` | List + monthly/yearly aggregates |
| POST | `/expenses` | Add expense |
| DELETE | `/expenses/{id}` | Delete |
| GET | `/expenses/charts` | Bar/pie series |
| POST | `/risk-score` | Compute medical risk |
| GET | `/risk-score` | Latest risk |
| POST | `/chat` | Insurance AI chatbot turn |
| GET | `/chat/history` | Recent messages |

### Phase 6 — Analytics + notifications hooks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/summary` | Spending, claim success, utilization, score trend |
| POST | `/renewal/remind` | Schedule / send renewal reminder (FCM/email best-effort) |

Partner stubs remain at `/api/v1/partner/insurance/{capabilities,health}` (Phase 3 templates).

---

## Flutter screen map

| Route | Screen | Phase |
|-------|--------|-------|
| `/health-protection` | Hub (score ring, policy, CTAs) | 1 |
| `/health-protection/recommend` | AI recommendation questionnaire + results | 2 |
| `/health-protection/compare` | Plan comparison | 2 |
| `/health-protection/eligibility` | Scheme eligibility | 2 |
| `/health-protection/analyze` | Policy upload & summary | 3 |
| `/health-protection/claims` | Claims list | 3 |
| `/health-protection/claims/new` | Claim wizard | 3 |
| `/health-protection/claims/:id` | Claim timeline | 3 |
| `/health-protection/cashless` | Cashless hospital finder | 4 |
| `/health-protection/family` | Family dashboard | 4 |
| `/health-protection/expenses` | Expense tracker + charts | 5 |
| `/health-protection/risk` | Medical risk score | 5 |
| `/health-protection/chat` | Insurance AI chat | 5 |
| `/health-protection/emergency-card` | Emergency card + share/PDF | 1 |
| `/health-protection/plans` | Browse catalog | 0–1 |

---

## Phase roadmap & acceptance

### Phase 0 — Foundation

**Ships:** README (this file), migrations, seed companies/plans, FastAPI router shell, Flutter routes + hub shell, home tile wired.

**Done when:**

- [ ] `HEALTH_PROTECTION_README.md` present
- [ ] Migrations apply / tables ensure on startup
- [ ] `GET /api/health-protection/plans` returns seeded plans (JWT)
- [ ] Home tile opens hub (no coming soon)
- [ ] Existing modules still work

### Phase 1 — Hub + Score + Emergency Card

**Ships:** Score engine (0–100), animated hub UI, emergency card (QR, share, PDF), renewal countdown.

**Score factors (weighted):** insurance active, emergency contacts, blood group, medical records, vaccination signal, annual checkup, family coverage, critical illness cover.

**Done when:**

- [ ] Hub shows score + policy summary + expiry days
- [ ] Recompute updates suggestions
- [ ] Emergency card editable + QR + share/PDF
- [ ] Swagger shows Health Protection tag

### Phase 2 — AI Recommendations + Comparison + Eligibility

**Done when:**

- [ ] Questionnaire → top 5 plans with AI score/why/pros/cons
- [ ] Compare ≥2 plans in a table
- [ ] Eligibility returns Ayushman/PMJAY/student/corporate/state results

### Phase 3 — Policy Analyzer + Claims

**Done when:**

- [ ] Upload PDF/image → structured summary + plain explanation
- [ ] Claim wizard: docs → preview → submit → timeline statuses

### Phase 4 — Cashless + Family

**Done when:**

- [ ] Nearby cashless list with distance, call, directions, book appointment deep link
- [ ] Family CRUD with coverage/status/renewal

### Phase 5 — Expenses + Risk + Chat

**Done when:**

- [ ] Expenses CRUD + monthly/yearly + bar/pie data
- [ ] Risk Low/Medium/High with recommendations
- [ ] Chat answers insurance FAQs (grounded on user policy + catalog when possible)

### Phase 6 — Polish + Notifications + Analytics

**Done when:**

- [ ] Analytics summary endpoint
- [ ] Renewal reminder best-effort FCM/email
- [ ] Unit tests for score, recommend validation, claims status
- [ ] Shimmer/empty/error states; dark-mode friendly colors
- [ ] No regressions on Medicine/Pharmacy/Emergency

---

## Security

- JWT on all patient endpoints
- API keys (AI, Cloudinary) stay on server
- File upload size/type validation; store Cloudinary URLs only
- Do not log full policy PDF contents
- Partner insurance APIs remain partner-HMAC scoped (separate from patient JWT)

---

## Notifications (Phase 6)

| Event | Channel |
|-------|---------|
| Policy renewal (N days) | FCM + optional email |
| Claim status change | FCM + in-app |
| Health score drop | FCM (optional) |
| Family renewal | FCM |

Reuse `fcm_service` / notification tables; new `type` keys only.

---

## Analytics (Phase 6)

- Monthly / yearly health spending
- Claim success rate
- Coverage utilization (claims vs sum insured)
- Protection score trend (from `hp_health_scores` history if retained)

---

## Performance

- Paginate plans/claims/expenses
- Cache plan catalog in-process ~15 min
- Shimmer on hub and lists
- Lazy-load feature screens via go_router
- Offline: show last cached hub snapshot when available (Phase 6)

---

## How to run / test

```bash
# Backend
cd fastapi_back
# Ensure DATABASE_URL + MISTRAL_API_KEY (optional for AI) + Cloudinary
uvicorn main:app --reload --port 5000
# Swagger: http://localhost:5000/docs → Health Protection

# Tests
python -m pytest tests/test_health_protection.py -q

# Flutter
cd flutter_mobile
flutter run -d chrome
# Home → Health Protection
```

### Manual smoke (Phase 1+)

1. Login → Home → Health Protection  
2. Confirm score ring and policy card  
3. Open Emergency Card → save → share  
4. Phase 2+: Recommend → Compare  
5. Phase 3+: Upload sample policy image → create claim  

---

## Out of scope / future

- Live insurer premium APIs without a signed partner
- Embedded Google Maps SDK
- MongoDB collections (prompt legacy — not used)
- Replacing partner pharmacy / medicine modules
- Guaranteeing claim approval or insurance purchase inside MEDCLUES

---

## Feature → phase index (original 13)

| # | Feature | Phase |
|---|---------|-------|
| 1 | AI Insurance Recommendation | 2 |
| 2 | Health Protection Score | 1 |
| 3 | Policy Analyzer | 3 |
| 4 | Claim Assistant | 3 |
| 5 | Cashless Hospital Finder | 4 |
| 6 | Emergency Insurance Card | 1 |
| 7 | Family Dashboard | 4 |
| 8 | Expense Tracker | 5 |
| 9 | AI Chatbot | 5 |
| 10 | Renewal Reminder | 1 (UI) + 6 (notify) |
| 11 | Insurance Eligibility | 2 |
| 12 | Policy Comparison | 2 |
| 13 | Medical Risk Score | 5 |

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-19 | Roadmap README created |
| 2026-07-19 | Phases 0–6 implemented: FastAPI `/api/health-protection/*`, Flutter hub + all feature screens, migrations `035`/`036`, unit tests |

### Implementation status

| Phase | Status |
|-------|--------|
| 0 Foundation | Done |
| 1 Hub + Score + Emergency Card | Done |
| 2 AI Recommend + Compare + Eligibility | Done |
| 3 Policy Analyzer + Claims | Done |
| 4 Cashless + Family | Done |
| 5 Expenses + Risk + Chat | Done |
| 6 Analytics + Renewal reminders + Tests | Done |

Polish iterations can continue phase-by-phase without rewriting the module.
