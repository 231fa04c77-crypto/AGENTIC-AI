"""Lab partner domain — FHIR-lite / HL7 JSON order + result sync."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from app.config.db import db
from app.utils.app_logger import get_logger

log = get_logger(__name__)

VALID_STATUSES = {
    "BOOKED",
    "SAMPLE_COLLECTED",
    "IN_PROGRESS",
    "RESULT_READY",
    "CANCELLED",
    "FAILED",
}

TRANSITIONS = {
    "BOOKED": {"SAMPLE_COLLECTED", "IN_PROGRESS", "CANCELLED"},
    "SAMPLE_COLLECTED": {"IN_PROGRESS", "CANCELLED"},
    "IN_PROGRESS": {"RESULT_READY", "FAILED", "CANCELLED"},
    "RESULT_READY": set(),
    "CANCELLED": set(),
    "FAILED": {"IN_PROGRESS"},
}


def _row(r) -> dict:
    if not r:
        return {}
    d = dict(r)
    # camelCase for partners
    return {
        "id": d.get("id"),
        "userId": d.get("user_id"),
        "labName": d.get("lab_name"),
        "testName": d.get("test_name"),
        "fullName": d.get("full_name"),
        "phone": d.get("phone"),
        "email": d.get("email"),
        "preferredDate": str(d.get("preferred_date") or ""),
        "notes": d.get("notes"),
        "status": d.get("status"),
        "lifecycleStatus": d.get("lifecycle_status") or "BOOKED",
        "partnerOrderRef": d.get("partner_order_ref"),
        "resultReadyAt": d.get("result_ready_at").isoformat() if d.get("result_ready_at") else None,
        "hasResult": bool(d.get("result_payload")),
        "cancelled": bool(d.get("cancelled")),
        "createdAt": d.get("created_at").isoformat() if d.get("created_at") else None,
    }


async def partner_list_orders(partner_id: int, status: Optional[str] = None) -> dict:
    if status:
        rows = await db.query(
            """
            SELECT * FROM lab_bookings
            WHERE (partner_id = $1 OR partner_id IS NULL)
              AND UPPER(COALESCE(lifecycle_status, status, 'BOOKED')) = UPPER($2)
              AND COALESCE(cancelled, false) = false
            ORDER BY created_at DESC
            LIMIT 100
            """,
            int(partner_id),
            status,
        )
    else:
        rows = await db.query(
            """
            SELECT * FROM lab_bookings
            WHERE partner_id = $1 OR partner_id IS NULL
            ORDER BY created_at DESC
            LIMIT 100
            """,
            int(partner_id),
        )
    return {"success": True, "orders": [_row(r) for r in rows]}


async def partner_get_order(partner_id: int, order_id: int) -> dict:
    row = await db.fetch_row("SELECT * FROM lab_bookings WHERE id = $1", int(order_id))
    if not row:
        return {"success": False, "message": "Order not found"}
    # claim unassigned orders to this partner on first read
    if row.get("partner_id") is None:
        await db.execute(
            "UPDATE lab_bookings SET partner_id = $1, updated_at = NOW() WHERE id = $2 AND partner_id IS NULL",
            int(partner_id),
            int(order_id),
        )
        row = await db.fetch_row("SELECT * FROM lab_bookings WHERE id = $1", int(order_id))
    elif int(row.get("partner_id") or 0) != int(partner_id):
        return {"success": False, "message": "Order not found for partner"}
    payload = _row(row)
    if row.get("result_payload"):
        rp = row["result_payload"]
        payload["result"] = json.loads(rp) if isinstance(rp, str) else rp
    return {"success": True, "order": payload}


async def partner_update_status(
    partner_id: int, order_id: int, body: dict, *, is_sandbox_key: bool = True
) -> dict:
    row = await db.fetch_row("SELECT * FROM lab_bookings WHERE id = $1", int(order_id))
    if not row:
        return {"success": False, "message": "Order not found"}
    if row.get("partner_id") is not None and int(row["partner_id"]) != int(partner_id):
        return {"success": False, "message": "Order not found for partner"}

    new_status = (body.get("status") or body.get("lifecycleStatus") or "").upper().strip()
    if new_status not in VALID_STATUSES:
        return {"success": False, "message": f"Invalid status. Allowed: {sorted(VALID_STATUSES)}"}

    current = (row.get("lifecycle_status") or "BOOKED").upper()
    allowed = TRANSITIONS.get(current, set())
    if new_status != current and new_status not in allowed:
        return {
            "success": False,
            "message": f"Illegal transition {current} → {new_status}",
        }

    ref = body.get("partnerOrderRef") or body.get("partner_order_ref") or row.get("partner_order_ref")
    await db.execute(
        """
        UPDATE lab_bookings
        SET lifecycle_status = $1,
            status = LOWER($1),
            partner_id = COALESCE(partner_id, $2),
            partner_order_ref = COALESCE($3, partner_order_ref),
            cancelled = CASE WHEN $1 = 'CANCELLED' THEN true ELSE cancelled END,
            updated_at = NOW()
        WHERE id = $4
        """,
        new_status,
        int(partner_id),
        ref,
        int(order_id),
    )
    await db.execute(
        """
        INSERT INTO lab_result_events (lab_booking_id, partner_id, event_type, payload)
        VALUES ($1, $2, $3, $4::jsonb)
        """,
        int(order_id),
        int(partner_id),
        f"status.{new_status.lower()}",
        json.dumps(body or {}),
    )
    try:
        from app.services import partner_webhook_service as pws

        await pws.emit_event(
            int(partner_id),
            "lab.order.status.changed",
            {"orderId": order_id, "status": new_status, "sandbox": is_sandbox_key},
        )
    except Exception as exc:
        log.warning("lab status webhook skipped: %s", exc)

    return await partner_get_order(partner_id, order_id)


async def partner_post_results(
    partner_id: int, order_id: int, body: dict, *, is_sandbox_key: bool = True
) -> dict:
    """Accept FHIR-lite DiagnosticReport-shaped JSON."""
    row = await db.fetch_row("SELECT * FROM lab_bookings WHERE id = $1", int(order_id))
    if not row:
        return {"success": False, "message": "Order not found"}
    if row.get("partner_id") is not None and int(row["partner_id"]) != int(partner_id):
        return {"success": False, "message": "Order not found for partner"}

    # Normalize FHIR-lite
    resource = body.get("resource") or body
    report = {
        "resourceType": resource.get("resourceType") or "DiagnosticReport",
        "status": resource.get("status") or "final",
        "code": resource.get("code") or {"text": row.get("test_name")},
        "subject": resource.get("subject") or {"display": row.get("full_name")},
        "effectiveDateTime": resource.get("effectiveDateTime")
        or datetime.now(timezone.utc).isoformat(),
        "result": resource.get("result") or resource.get("observations") or [],
        "conclusion": resource.get("conclusion") or body.get("conclusion"),
        "presentedForm": resource.get("presentedForm") or body.get("files") or [],
        "raw": body,
    }

    await db.execute(
        """
        UPDATE lab_bookings
        SET result_payload = $1::jsonb,
            result_ready_at = NOW(),
            lifecycle_status = 'RESULT_READY',
            status = 'result_ready',
            partner_id = COALESCE(partner_id, $2),
            updated_at = NOW()
        WHERE id = $3
        """,
        json.dumps(report),
        int(partner_id),
        int(order_id),
    )
    await db.execute(
        """
        INSERT INTO lab_result_events (lab_booking_id, partner_id, event_type, payload)
        VALUES ($1, $2, 'result.ready', $3::jsonb)
        """,
        int(order_id),
        int(partner_id),
        json.dumps(report),
    )
    try:
        from app.services import partner_webhook_service as pws

        await pws.emit_event(
            int(partner_id),
            "lab.result.ready",
            {"orderId": order_id, "sandbox": is_sandbox_key},
        )
    except Exception as exc:
        log.warning("lab result webhook skipped: %s", exc)

    return await partner_get_order(partner_id, order_id)
