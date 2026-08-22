# Pharmacy Partner Webhooks

Outbound webhooks notify pharmacy ERP partners (e.g. PharmaSync) of MedClues pharmacy-domain events.

Delivery is asynchronous: each event is inserted into `webhook_deliveries`, signed, POSTed to the partner `webhook_url`, and retried on failure (`partner_webhook_service`).

## Events

| Event | When emitted |
|-------|----------------|
| `prescription.created` | Structured Rx items saved on a consultation |
| `prescription.updated` | Prescription items updated |
| `order.placed` | Patient (or refill) places a pharmacy order |
| `order.cancelled` | Patient cancels an order |
| `order.status.changed` | Partner updates order status via partner API |
| `payment.completed` | Pharmacy order payment succeeds |
| `availability.probe` | Patient availability/price probe (sync-style probe may also call partner URL directly) |

Registered in `partner_domain_registry` under domain slug `pharmacy`.

### `order.status.changed` payload (typical)

```json
{
  "event": "order.status.changed",
  "timestamp": 1710000000,
  "order_id": 123,
  "order_public_id": "PO-…",
  "previous_status": "accepted",
  "status": "preparing",
  "partner_order_ref": "ERP-991",
  "notes": "Started packing"
}
```

All pharmacy events include `"event": "<event_type>"` and `"timestamp": <unix_seconds>` merged into the body by `emit_pharmacy_event`.

## HTTP delivery

- **Method:** `POST`
- **URL:** partner `webhook_url` (or pharmacy-level override when provided at emit time)
- **Body:** JSON (`Content-Type: application/json`)

### Headers

| Header | Description |
|--------|-------------|
| `X-MedClues-Event` | Event type string (e.g. `order.status.changed`) |
| `X-MedClues-Signature` | HMAC-SHA256 of the **raw request body**, prefixed with `sha256=` |
| `X-MedClues-Timestamp` | Unix epoch seconds when the attempt was sent |
| `User-Agent` | `MedClues-Webhook/1.0` |

### Verifying HMAC

1. Read the partner webhook signing secret (issued with partner credentials).
2. Compute `HMAC-SHA256(secret, raw_body_bytes)` as hex.
3. Compare (constant-time) to the value after `sha256=` in `X-MedClues-Signature`.

Example (Python):

```python
import hmac, hashlib

def verify(secret: str, body: bytes, header: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header or "")
```

## Delivery status

Statuses on `webhook_deliveries`: `pending`, `delivered`, `failed`, `permanently_failed`. Failed deliveries back off and can be retried from the partner/admin dashboard (`POST /api/partner/dashboard/webhooks/{id}/retry`).
