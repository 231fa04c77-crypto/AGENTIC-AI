"""Pharmacy orders — patient medicine orders fulfilled via partner pharmacy ERP."""
from __future__ import annotations

import json
from typing import Any, Optional

from app.config.db import db

VALID_STATUSES = {
    "placed",
    "accepted",
    "stock_unavailable",
    "billed",
    "paid",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
}

# Allowed transitions (from → set of to)
TRANSITIONS = {
    # Catalog/retail OTC may bill immediately without partner accept step.
    "placed": {"accepted", "billed", "stock_unavailable", "cancelled"},
    "accepted": {"billed", "stock_unavailable", "cancelled"},
    "stock_unavailable": {"cancelled", "accepted"},
    "billed": {"paid", "cancelled"},
    "paid": {"ready", "out_for_delivery", "cancelled"},
    "ready": {"out_for_delivery", "delivered", "cancelled"},
    "out_for_delivery": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": set(),
}


async def create_order(data: dict, items: list[dict]) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO pharmacy_orders (
            public_id, patient_id, hospital_id, pharmacy_id, partner_id,
            consultation_id, status, fulfillment, currency,
            delivery_address, notes, is_sandbox, parent_order_id,
            refill_of_consultation_id
        ) VALUES ($1,$2,$3,$4,$5,$6,'placed',$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
        """,
        data["public_id"],
        data["patient_id"],
        data["hospital_id"],
        data["pharmacy_id"],
        data["partner_id"],
        data.get("consultation_id"),
        data.get("fulfillment", "pickup"),
        data.get("currency", "INR"),
        data.get("delivery_address"),
        data.get("notes"),
        bool(data.get("is_sandbox", True)),
        data.get("parent_order_id"),
        data.get("refill_of_consultation_id"),
    )
    order = dict(row)
    for item in items:
        await db.execute(
            """
            INSERT INTO pharmacy_order_items (
                order_id, prescription_item_id, name, dosage, quantity,
                unit_price, line_total
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            """,
            order["id"],
            item.get("prescription_item_id"),
            item["name"],
            item.get("dosage"),
            item.get("quantity"),
            item.get("unit_price"),
            item.get("line_total"),
        )
    await db.execute(
        """
        INSERT INTO pharmacy_order_status_history (order_id, from_status, to_status, actor_role, notes)
        VALUES ($1, NULL, 'placed', $2, $3)
        """,
        order["id"],
        data.get("actor_role", "patient"),
        "Order placed",
    )
    return order


async def list_for_patient(patient_id: int, limit: int = 50) -> list:
    return await db.query(
        """
        SELECT o.*, ph.name AS pharmacy_name, p.name AS partner_name
        FROM pharmacy_orders o
        JOIN pharmacies ph ON ph.id = o.pharmacy_id
        JOIN partners p ON p.id = o.partner_id
        WHERE o.patient_id = $1
        ORDER BY o.created_at DESC
        LIMIT $2
        """,
        patient_id, limit,
    )


async def get_for_patient(order_id: int, patient_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT o.*, ph.name AS pharmacy_name, p.name AS partner_name
        FROM pharmacy_orders o
        JOIN pharmacies ph ON ph.id = o.pharmacy_id
        JOIN partners p ON p.id = o.partner_id
        WHERE o.id = $1 AND o.patient_id = $2
        """,
        order_id, patient_id,
    )
    return dict(row) if row else None


async def get_by_id(order_id: int) -> Optional[dict]:
    row = await db.fetch_row("SELECT * FROM pharmacy_orders WHERE id = $1", order_id)
    return dict(row) if row else None


async def get_by_public_id(public_id: str) -> Optional[dict]:
    row = await db.fetch_row(
        "SELECT * FROM pharmacy_orders WHERE public_id = $1", public_id
    )
    return dict(row) if row else None


async def list_recent_all(limit: int = 50) -> list:
    return await db.query(
        """
        SELECT o.*, ph.name AS pharmacy_name, u.name AS patient_name, u.phone AS patient_phone
        FROM pharmacy_orders o
        LEFT JOIN pharmacies ph ON ph.id = o.pharmacy_id
        LEFT JOIN users u ON u.id = o.patient_id
        ORDER BY o.created_at DESC
        LIMIT $1
        """,
        limit,
    )


async def get_active_orders(limit: int = 200) -> list:
    """Non-terminal pharmacy orders for coordination monitoring."""
    return await db.query(
        """
        SELECT o.*, ph.name AS pharmacy_name, u.name AS patient_name
        FROM pharmacy_orders o
        LEFT JOIN pharmacies ph ON ph.id = o.pharmacy_id
        LEFT JOIN users u ON u.id = o.patient_id
        WHERE o.status NOT IN ('delivered', 'cancelled')
        ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
        LIMIT $1
        """,
        int(limit),
    )


async def list_for_partner(partner_id: int, status: str | None = None, limit: int = 50) -> list:
    if status:
        return await db.query(
            """
            SELECT o.*, ph.name AS pharmacy_name
            FROM pharmacy_orders o
            JOIN pharmacies ph ON ph.id = o.pharmacy_id
            WHERE o.partner_id = $1 AND o.status = $2
            ORDER BY o.created_at DESC
            LIMIT $3
            """,
            partner_id, status, limit,
        )
    return await db.query(
        """
        SELECT o.*, ph.name AS pharmacy_name
        FROM pharmacy_orders o
        JOIN pharmacies ph ON ph.id = o.pharmacy_id
        WHERE o.partner_id = $1
        ORDER BY o.created_at DESC
        LIMIT $2
        """,
        partner_id, limit,
    )


async def get_for_partner(order_id: int, partner_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT o.*, ph.name AS pharmacy_name
        FROM pharmacy_orders o
        JOIN pharmacies ph ON ph.id = o.pharmacy_id
        WHERE o.id = $1 AND o.partner_id = $2
        """,
        order_id, partner_id,
    )
    return dict(row) if row else None


async def list_items(order_id: int) -> list:
    return await db.query(
        "SELECT * FROM pharmacy_order_items WHERE order_id = $1 ORDER BY id",
        order_id,
    )


async def update_status(
    order_id: int,
    to_status: str,
    actor_role: str = "partner",
    notes: str | None = None,
    extra: dict | None = None,
) -> Optional[dict]:
    order = await get_by_id(order_id)
    if not order:
        return None
    from_status = order["status"]
    allowed = TRANSITIONS.get(from_status, set())
    if to_status not in allowed and to_status != from_status:
        raise ValueError(f"Invalid transition {from_status} → {to_status}")

    fields = ["status = $1", "updated_at = NOW()"]
    values: list[Any] = [to_status]
    idx = 2
    if extra:
        for key, col in [
            ("partner_order_ref", "partner_order_ref"),
            ("partner_request_id", "partner_request_id"),
            ("amount_subtotal", "amount_subtotal"),
            ("amount_tax", "amount_tax"),
            ("amount_total", "amount_total"),
            ("invoice_url", "invoice_url"),
            ("cancel_reason", "cancel_reason"),
            ("payment_transaction_id", "payment_transaction_id"),
        ]:
            if key in extra and extra[key] is not None:
                fields.append(f"{col} = ${idx}")
                values.append(extra[key])
                idx += 1
        if "bill_payload" in extra and extra["bill_payload"] is not None:
            fields.append(f"bill_payload = ${idx}::jsonb")
            values.append(json.dumps(extra["bill_payload"]))
            idx += 1
        if to_status == "cancelled":
            fields.append("cancelled_at = NOW()")

    values.append(order_id)
    sql = f"UPDATE pharmacy_orders SET {', '.join(fields)} WHERE id = ${idx} RETURNING *"
    row = await db.fetch_row(sql, *values)
    await db.execute(
        """
        INSERT INTO pharmacy_order_status_history
            (order_id, from_status, to_status, actor_role, notes)
        VALUES ($1, $2, $3, $4, $5)
        """,
        order_id, from_status, to_status, actor_role, notes,
    )
    return dict(row) if row else None


async def partner_has_production_key(partner_id: int) -> bool:
    row = await db.fetch_row(
        """
        SELECT 1 FROM partner_api_keys
        WHERE partner_id = $1
          AND environment = 'production'
          AND revoked_at IS NULL
        LIMIT 1
        """,
        partner_id,
    )
    return row is not None


async def list_recent_for_partner_admin(partner_id: int, limit: int = 50) -> list:
    return await db.query(
        """
        SELECT o.id, o.public_id, o.status, o.is_sandbox, o.amount_total,
               o.created_at, o.updated_at, ph.name AS pharmacy_name,
               (
                 SELECT wd.status FROM webhook_deliveries wd
                 WHERE wd.partner_id = o.partner_id
                   AND wd.event_type = 'order.placed'
                   AND (wd.payload->>'order_id')::text = o.id::text
                 ORDER BY wd.created_at DESC
                 LIMIT 1
               ) AS last_order_placed_webhook_status
        FROM pharmacy_orders o
        JOIN pharmacies ph ON ph.id = o.pharmacy_id
        WHERE o.partner_id = $1
        ORDER BY o.created_at DESC
        LIMIT $2
        """,
        partner_id, limit,
    )


async def apply_bill(order_id: int, bill: dict) -> Optional[dict]:
    items = bill.get("items") or []
    for item in items:
        item_id = item.get("order_item_id") or item.get("id")
        if not item_id:
            continue
        await db.execute(
            """
            UPDATE pharmacy_order_items
            SET unit_price = COALESCE($2, unit_price),
                confirmed_quantity = COALESCE($3, confirmed_quantity),
                line_total = COALESCE($4, line_total),
                quantity = COALESCE($5, quantity)
            WHERE id = $1 AND order_id = $6
            """,
            int(item_id),
            item.get("unit_price"),
            item.get("confirmed_quantity"),
            item.get("line_total"),
            item.get("quantity"),
            order_id,
        )
    extra = {
        "amount_subtotal": bill.get("amount_subtotal") or bill.get("subtotal"),
        "amount_tax": bill.get("amount_tax") or bill.get("tax"),
        "amount_total": bill.get("amount_total") or bill.get("total"),
        "invoice_url": bill.get("invoice_url"),
        "partner_order_ref": bill.get("partner_order_ref"),
        "bill_payload": bill,
    }
    return await update_status(order_id, "billed", actor_role="partner", notes="Bill received", extra=extra)
