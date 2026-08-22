# MedClues ↔ PharmaSync — Connect Handoff

**Status:** MedClues connect flow is built (Dean → Add Pharmacy → Connect with PharmaSync).  
**This doc answers:** What do we send PharmaSync so they can connect?

Related:

- [PHARMASYNC_README.md](./PHARMASYNC_README.md) — full team contract & checklists  
- [PHARMASYNC_INTEGRATION_PLATFORM.md](./PHARMASYNC_INTEGRATION_PLATFORM.md) — architecture & APIs  
- [docs/enterprise/PHARMACY_WEBHOOKS.md](./docs/enterprise/PHARMACY_WEBHOOKS.md) — outbound webhook events  

---

## Quick answer

Give PharmaSync **partner credentials + MedClues base URL + API contract + hospital code**.  
They give you **their base URL, provision keys, and webhook URL** for your `.env`.

Do **not** share patient JWTs, database access, or Dean/admin logins.

---

## Traffic (both directions)

```
Patient app  ──JWT only──►  MedClues API  ◄──HMAC partner APIs──►  PharmaSync
                                 │
                                 └── signed webhooks ──────────────►
```

| Direction | Purpose |
|-----------|---------|
| **MedClues → PharmaSync** | Create pharmacy (provision), webhooks for Rx / orders / payment |
| **PharmaSync → MedClues** | Order status + bill callbacks on partner pharmacy APIs |

---

## Step 1 — Issue credentials (MedClues Super Admin)

1. Open **Enterprise Integrations / Manage Partners**.
2. Create partner **PharmaSync**, type **PHARMACY**.
3. Scopes: `pharmacy.*` (or pharmacy read/write scopes).
4. Start with **sandbox** keys; production later.
5. When they have a receiver URL, set partner **webhook URL** (HTTPS).

You will get (show once / store securely):

- API key → `pk_…`
- API secret → `sk_…` (HMAC)
- Webhook signing secret → for verifying MedClues → PharmaSync events

---

## Step 2 — What to provide to PharmaSync

Send them this package (secure channel for secrets):

| # | Item | What it is |
|---|------|------------|
| 1 | **API key** | `pk_…` |
| 2 | **API secret** | `sk_…` (HMAC signing) |
| 3 | **Webhook signing secret** | Verify outbound MedClues webhooks |
| 4 | **MedClues API base URL** | Deployed FastAPI root (e.g. `https://api.yourdomain.com`) |
| 5 | **Partner API prefix** | `/api/v1/partner/pharmacy` |
| 6 | **Auth headers** | `X-Api-Key`, `X-Timestamp`, `X-Signature` |
| 7 | **Hospital code** | Same as `PHARMASYNC_HOSPITAL_CODE` in MedClues `.env` (e.g. `medclues_hospital_main`) |
| 8 | **Docs** | This file + `PHARMASYNC_README.md` + `PHARMASYNC_INTEGRATION_PLATFORM.md` |

### Events they receive from MedClues

- `prescription.created`
- `prescription.updated`
- `order.placed`
- `order.cancelled`
- `payment.completed`

### APIs they call into MedClues

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/partner/pharmacy/prescriptions/{id}` | Optional pull of Rx |
| `GET` | `/api/v1/partner/pharmacy/orders` | List orders |
| `POST` | `/api/v1/partner/pharmacy/orders/{id}/status` | Status updates |
| `POST` | `/api/v1/partner/pharmacy/orders/{id}/bill` | Bill sync |

Auth on every partner call: API key + HMAC (`X-Api-Key`, `X-Timestamp`, `X-Signature`).

---

## Step 3 — What PharmaSync provides back (put in MedClues `.env`)

| Env var | Purpose |
|---------|---------|
| `PHARMASYNC_BASE_URL` | Their API root |
| `PHARMASYNC_PUBLIC_API_KEY` | Their public key for MedClues → PharmaSync |
| `PHARMASYNC_PRIVATE_SECRET_KEY` | Their private/HMAC secret |
| `PHARMASYNC_WEBHOOK_SIGNING_SECRET` | Signing for their side (if used) |
| `PHARMASYNC_WEBHOOK_URL` | Exact HTTPS path MedClues should POST webhooks to |
| `PHARMASYNC_HOSPITAL_CODE` | Shared hospital code (must match what you told them) |

Also confirm with them that this endpoint is live:

- `POST /api/integration/pharmacies` (Dean **Connect with PharmaSync**)

See placeholders in [`fastapi_back/.env.example`](./fastapi_back/.env.example).

---

## Step 4 — Connect a pharmacy (Dean)

1. Hospital Dean → **Pharmacies** → **Add Pharmacy**
2. Enter name, manager, email, phone, license, address
3. Click **Connect with PharmaSync**
4. MedClues calls PharmaSync provision API and stores `partner_pharmacy_ref` with status `connected`

---

## Copy/paste message to PharmaSync

```text
Subject: MedClues ↔ PharmaSync sandbox credentials

MedClues API base: <YOUR_MEDCLUES_API_URL>
Partner API: <YOUR_MEDCLUES_API_URL>/api/v1/partner/pharmacy

API key: pk_...
API secret: sk_...
Webhook signing secret: <whs_...>
Hospital code: medclues_hospital_main

Auth headers: X-Api-Key, X-Timestamp, X-Signature (HMAC)

Outbound events from MedClues:
  prescription.created, prescription.updated,
  order.placed, order.cancelled, payment.completed

Callbacks into MedClues:
  POST /api/v1/partner/pharmacy/orders/{id}/status
  POST /api/v1/partner/pharmacy/orders/{id}/bill

Docs attached / in repo:
  PHARMASYNC_CONNECT_HANDOFF.md
  PHARMASYNC_README.md
  PHARMASYNC_INTEGRATION_PLATFORM.md

Please return:
  - Your BASE_URL
  - Provision keys (public + private)
  - Exact webhook receiver URL
  - Confirmation that POST /api/integration/pharmacies is live
```

---

## Keys — who owns what

| Direction | Keys | Who issues |
|-----------|------|------------|
| MedClues → PharmaSync (provision + calling their APIs) | `PHARMASYNC_*` in MedClues `.env` | **PharmaSync team** |
| PharmaSync → MedClues (Rx/orders callbacks) | Partner `pk_` / `sk_` + webhook secret | **MedClues Super Admin** |

---

## Checklist

- [ ] Super Admin created PharmaSync partner (type `PHARMACY`, sandbox)
- [ ] Sent PharmaSync: base URL, keys, webhook secret, hospital code, docs
- [ ] Received: their `BASE_URL`, keys, webhook URL, provision path confirmed
- [ ] MedClues `.env` updated and API restarted
- [ ] Dean connected at least one pharmacy successfully
- [ ] Sandbox e2e: Rx → order → status/bill → patient sees update
- [ ] Production keys only after sandbox pass

---

## Do not share

- Patient JWTs or Flutter secrets  
- PostgreSQL / Neon connection strings  
- Dean / admin / reception passwords  
- Razorpay or other payment secrets  
