# MEDCLUES ↔ PharmaSync — Team README

**Status:** Approved to proceed (APK-ready architecture)  
**Connect handoff (what to send PharmaSync):** [PHARMASYNC_CONNECT_HANDOFF.md](./PHARMASYNC_CONNECT_HANDOFF.md)  
**Master architecture:** [PHARMASYNC_INTEGRATION_PLATFORM.md](./PHARMASYNC_INTEGRATION_PLATFORM.md)  
**Related:** [EMERGENCY_PARTNER_PLATFORM.md](./EMERGENCY_PARTNER_PLATFORM.md)

This README is the short team handoff: whether the plan is good, the fixed API contract, who builds what, and **exact steps after the build**.

---

## 1. Is the plan good?

**Yes.** It is the right design for a production Flutter APK.

| Criterion | Verdict |
|-----------|---------|
| Clear ownership (MEDCLUES clinical / PharmaSync pharmacy) | Correct |
| No shared databases | Correct |
| Reuse existing partner platform (keys, webhooks, retries) | Correct |
| Structured prescriptions before ordering | Required |
| Dean maps pharmacies; Super Admin owns API credentials | Correct |
| Phased delivery (0 → 1 → 2) | Correct for APK quality |

Abhilash’s PharmaSync upgrade prompt is **compatible** with one fixed rule (next section).

---

## 2. Fixed contract (both teams)

```
Patient APK  ──JWT only──►  MEDCLUES Backend  ◄──HMAC Partner APIs──►  PharmaSync ERP
                                 │
                                 └── Webhooks (signed) ──────────────►
```

| Rule | Detail |
|------|--------|
| Patient app (APK) | Talks **only** to MEDCLUES |
| PharmaSync | Never exposes patient “Get My Prescriptions / Orders” APIs to the APK |
| Clinical source of truth | MEDCLUES |
| Inventory / packing / POS / delivery ops | PharmaSync |
| Partner credentials | Issued by MEDCLUES Super Admin |
| Hospital ↔ pharmacy mapping | MEDCLUES Dean only |

### Traffic

**MEDCLUES → PharmaSync**

- Webhooks: `prescription.created`, `prescription.updated`, `order.placed`, `order.cancelled`, `payment.completed`
- Pull (optional): `GET /api/v1/partner/pharmacy/prescriptions/{id}`

**PharmaSync → MEDCLUES**

- `POST /api/v1/partner/pharmacy/orders/{id}/status`
- `POST /api/v1/partner/pharmacy/orders/{id}/bill`

Auth: API key + HMAC (`X-Api-Key`, `X-Timestamp`, `X-Signature`).

### Payment (Phase 1)

1. PharmaSync generates the bill.  
2. MEDCLUES shows the bill in the patient app.  
3. Pay at pharmacy POS **or** via MEDCLUES Razorpay.  
4. MEDCLUES emits `payment.completed`.  
5. PharmaSync reduces inventory only under its own fulfillment rules.

---

## 3. Who builds what

### MEDCLUES (this repo)

| Phase | Work |
|-------|------|
| **0** | Harden Enterprise Integrations: `auth_admin`, HMAC, `allowed_apis`, API logs, partner type `PHARMACY`, Integrations UI |
| **1** | Structured `prescription_items`, Dean pharmacy mapping, `pharmacy_orders`, patient + partner APIs, Flutter Pharmacy tab, Socket.IO + FCM |
| **2** | Refills, invoice PDF, pricing probe, sandbox enforcement, failed-sync tooling |

### PharmaSync (Abhilash — separate repo)

Keep existing POS, inventory, billing, distributors, analytics.

Add:

- **Hospital Integrations** module (store MEDCLUES keys, verify webhook signatures, sync/error logs)  
- **Prescription Queue** (inbox → packing → pickup / delivery)  
- Stock verify / reserve / bill / status callbacks to MEDCLUES  
- Multi-hospital isolation, multi-branch, delivery roles as needed  

Adjust his original prompt: **Patient APIs stay on MEDCLUES.** PharmaSync notifies MEDCLUES; the APK never calls PharmaSync directly.

---

## 4. After building — what to do (checklist)

### A. MEDCLUES side (you)

1. Apply migration `031_enterprise_pharmacy.sql` (when added) on Neon.  
2. Restart FastAPI; smoke-test:
   - `/api/v1/partner/pharmacy/*`
   - `/api/user/pharmacy/*`
3. Super Admin → **Enterprise Integrations**:
   - Register partner **PharmaSync**
   - Type: `PHARMACY`
   - Issue **sandbox** API key
   - Set webhook URL, IP allowlist, scopes (`pharmacy.*`)
4. Send Abhilash **once**:
   - `api_key`
   - `api_secret`
   - Webhook signing secret
   - Sandbox base URL
   - Event list
5. Dean → map pharmacy partner to the hospital (pickup / delivery / hours / priority).  
6. Doctor publishes a **structured** Rx on a test appointment.  
7. Confirm webhook row in Super Admin / `webhook_deliveries`.  
8. Flutter: build release APK → Pharmacy tab → place order → verify status updates.  
9. Regression: emergency Partner Hub + appointments still work.

### B. PharmaSync side (Abhilash)

1. Implement Hospital Integrations (credentials + signature verify + logs).  
2. Expose HTTPS webhook receiver for MEDCLUES events.  
3. Prescription Queue + verify/reserve + bill + status/bill callbacks.  
4. Sandbox e2e with your hospital mapping.  
5. Production: production keys, lock IP allowlist, monitor sync logs.

### C. Joint go-live

- [ ] Sandbox e2e: Rx → order → bill → ready → delivered  
- [ ] Patient only sees **own** orders  
- [ ] Hospital A Rx never appears under Hospital B  
- [ ] Failed webhook retry works both ways  
- [ ] APK release notes + support runbook  

---

## 5. Share with Abhilash

Send him these two files:

1. **This README** — contract + ownership + checklists  
2. **[PHARMASYNC_INTEGRATION_PLATFORM.md](./PHARMASYNC_INTEGRATION_PLATFORM.md)** — full architecture, APIs, webhooks, schema, phases  

Plus (after Phase 0 credentials exist): sandbox base URL and one-time secrets.

---

## 6. Proceed order

1. Implement **Phase 0** in MEDCLUES.  
2. Implement **Phase 1** through Flutter Pharmacy APK.  
3. Abhilash builds Hospital Integrations against the published contract in parallel.  
4. Run checklist **A → B → C** before production keys.

---

## Status

| Item | Status |
|------|--------|
| Architecture plan | Approved |
| Master doc | `PHARMASYNC_INTEGRATION_PLATFORM.md` |
| This handoff README | Ready to share |
| Phase 0 / 1 code | Implemented (MVP) — run migration 031, register PharmaSync, Dean map, test APK Pharmacy tab |
