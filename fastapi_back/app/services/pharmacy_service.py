"""Pharmacy orchestration service — patient orders, partner sync, realtime."""
from __future__ import annotations

import asyncio
from typing import Any

from app.models import (
    pharmacy_model,
    pharmacy_order_model,
    prescription_item_model,
)
from app.services import partner_webhook_service as pws
from app.services.public_id_service import new_pharmacy_order_public_id
from app.utils.app_logger import get_logger

log = get_logger(__name__)


def _serialize_item(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "dosage": row.get("dosage"),
        "frequency": row.get("frequency"),
        "duration": row.get("duration"),
        "quantity": float(row["quantity"]) if row.get("quantity") is not None else None,
        "instructions": row.get("instructions"),
        "sku": row.get("sku"),
    }


def _serialize_order(order: dict, items: list | None = None) -> dict:
    data = {
        "id": order.get("id"),
        "publicId": order.get("public_id"),
        "status": order.get("status"),
        "fulfillment": order.get("fulfillment"),
        "pharmacyId": order.get("pharmacy_id"),
        "pharmacyName": order.get("pharmacy_name"),
        "partnerName": order.get("partner_name"),
        "hospitalId": order.get("hospital_id"),
        "consultationId": order.get("consultation_id"),
        "parentOrderId": order.get("parent_order_id"),
        "isSandbox": bool(order.get("is_sandbox", True)),
        "amountSubtotal": float(order["amount_subtotal"]) if order.get("amount_subtotal") is not None else None,
        "amountTax": float(order["amount_tax"]) if order.get("amount_tax") is not None else None,
        "amountTotal": float(order["amount_total"]) if order.get("amount_total") is not None else None,
        "currency": order.get("currency") or "INR",
        "invoiceUrl": order.get("invoice_url"),
        "deliveryAddress": order.get("delivery_address"),
        "notes": order.get("notes"),
        "bill": order.get("bill_payload") or {},
        "createdAt": order.get("created_at").isoformat() if order.get("created_at") else None,
        "updatedAt": order.get("updated_at").isoformat() if order.get("updated_at") else None,
    }
    if items is not None:
        data["items"] = [
            {
                "id": i.get("id"),
                "name": i.get("name"),
                "dosage": i.get("dosage"),
                "quantity": float(i["quantity"]) if i.get("quantity") is not None else None,
                "unitPrice": float(i["unit_price"]) if i.get("unit_price") is not None else None,
                "lineTotal": float(i["line_total"]) if i.get("line_total") is not None else None,
                "confirmedQuantity": float(i["confirmed_quantity"]) if i.get("confirmed_quantity") is not None else None,
            }
            for i in items
        ]
    return data


async def list_patient_prescriptions(user_id: int) -> dict:
    """Active structured Rx eligible to order (patient's consultations)."""
    from app.config.db import db

    rows = await db.query(
            """
            SELECT c.id AS consultation_id, c.appointment_id, c.prescription,
                   c.created_at, a.hospital_id, a.doctor_data AS doc_data, a.slot_date
            FROM consultations c
            JOIN appointments a ON a.id = c.appointment_id
            WHERE a.user_id = $1
              AND (
                EXISTS (SELECT 1 FROM prescription_items pi WHERE pi.consultation_id = c.id)
                OR (c.prescription IS NOT NULL AND TRIM(c.prescription) <> '')
              )
            ORDER BY c.created_at DESC
            LIMIT 40
            """,
            user_id,
        )

    prescriptions = []
    for r in rows:
        r = dict(r)
        cid = int(r["consultation_id"])
        items = await prescription_item_model.list_for_consultation(cid)
        pharmacies = []
        hid = r.get("hospital_id")
        if hid:
            pharmacies = [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "supportsPickup": p.get("supports_pickup", True),
                    "supportsDelivery": p.get("supports_delivery", False),
                    "pharmacyType": p.get("pharmacy_type"),
                }
                for p in await pharmacy_model.list_for_hospital(int(hid))
            ]
        prescriptions.append({
            "consultationId": cid,
            "appointmentId": r.get("appointment_id"),
            "hospitalId": hid,
            "prescriptionNotes": r.get("prescription") or "",
            "items": [_serialize_item(dict(i)) for i in items],
            "pharmacies": pharmacies,
            "createdAt": r.get("created_at").isoformat() if r.get("created_at") else None,
        })
    return {"success": True, "data": prescriptions}


async def place_order(user_id: int, body: dict) -> dict:
    consultation_id = int(body.get("consultationId") or body.get("consultation_id") or 0)
    pharmacy_id = int(body.get("pharmacyId") or body.get("pharmacy_id") or 0)
    fulfillment = (body.get("fulfillment") or "pickup").lower()
    if fulfillment not in ("pickup", "delivery"):
        return {"success": False, "message": "fulfillment must be pickup or delivery"}

    if not consultation_id or not pharmacy_id:
        return {"success": False, "message": "consultationId and pharmacyId are required"}

    from app.config.db import db
    consult = await db.fetch_row(
        """
        SELECT c.*, a.user_id, a.hospital_id
        FROM consultations c
        JOIN appointments a ON a.id = c.appointment_id
        WHERE c.id = $1
        """,
        consultation_id,
    )
    if not consult or int(consult["user_id"]) != int(user_id):
        return {"success": False, "message": "Prescription not found"}

    pharmacy = await pharmacy_model.get_by_id(pharmacy_id)
    if not pharmacy or not pharmacy.get("is_active"):
        return {"success": False, "message": "Pharmacy not available"}
    if int(pharmacy["hospital_id"]) != int(consult["hospital_id"]):
        return {"success": False, "message": "Pharmacy is not mapped to this hospital"}
    if pharmacy.get("partner_status") != "active":
        return {"success": False, "message": "Pharmacy partner is not active"}

    if fulfillment == "pickup" and not pharmacy.get("supports_pickup", True):
        return {"success": False, "message": "Pickup not supported by this pharmacy"}
    if fulfillment == "delivery" and not pharmacy.get("supports_delivery"):
        return {"success": False, "message": "Delivery not supported by this pharmacy"}

    items = await prescription_item_model.list_for_consultation(consultation_id)
    if not items:
        # Allow free-text-only Rx as a single synthetic line for MVP
        notes = (consult.get("prescription") or "").strip()
        if not notes:
            return {"success": False, "message": "No prescription items to order"}
        items = [{"id": None, "name": "Prescription medicines", "dosage": None, "quantity": 1}]

    public_id = await new_pharmacy_order_public_id()

    order_items = [
        {
            "prescription_item_id": i.get("id"),
            "name": i["name"],
            "dosage": i.get("dosage"),
            "quantity": i.get("quantity") or 1,
        }
        for i in items
    ]

    # Production partner (has active production API key) → live orders; else sandbox
    is_sandbox = not await pharmacy_order_model.partner_has_production_key(int(pharmacy["partner_id"]))

    order = await pharmacy_order_model.create_order(
        {
            "public_id": public_id,
            "patient_id": user_id,
            "hospital_id": int(consult["hospital_id"]),
            "pharmacy_id": pharmacy_id,
            "partner_id": int(pharmacy["partner_id"]),
            "consultation_id": consultation_id,
            "fulfillment": fulfillment,
            "delivery_address": body.get("deliveryAddress") or body.get("delivery_address"),
            "notes": body.get("notes"),
            "actor_role": "patient",
            "is_sandbox": is_sandbox,
        },
        order_items,
    )

    # Webhook → PharmaSync
    try:
        await pws.emit_pharmacy_event(
            int(pharmacy["partner_id"]),
            "order.placed",
            {
                "order_id": order["id"],
                "order_public_id": order["public_id"],
                "consultation_id": consultation_id,
                "hospital_id": int(consult["hospital_id"]),
                "pharmacy_id": pharmacy_id,
                "fulfillment": fulfillment,
                "items": [
                    {"name": i["name"], "dosage": i.get("dosage"), "quantity": i.get("quantity")}
                    for i in order_items
                ],
            },
            webhook_url=pharmacy.get("webhook_url"),
        )
    except Exception as exc:
        log.warning("order.placed webhook failed: %s", exc)

    full_items = await pharmacy_order_model.list_items(order["id"])
    enriched = {**order, "pharmacy_name": pharmacy.get("name"), "partner_name": pharmacy.get("partner_name")}
    return {"success": True, "data": _serialize_order(enriched, full_items)}


async def place_catalog_order(user_id: int, body: dict) -> dict:
    """Retail / MedPlus-style cart order — no consultation/prescription required.

    paymentMethod: upi | cod
    fulfillment: delivery (default) | pickup
    items: [{ name, quantity, unitPrice | price, medicineId?, requiresRx? }]
    """
    fulfillment = (body.get("fulfillment") or "delivery").lower()
    if fulfillment not in ("pickup", "delivery"):
        return {"success": False, "message": "fulfillment must be pickup or delivery"}

    payment_method = (body.get("paymentMethod") or body.get("payment_method") or "upi").lower()
    if payment_method not in ("upi", "cod", "razorpay"):
        return {"success": False, "message": "paymentMethod must be upi or cod"}
    if payment_method == "razorpay":
        payment_method = "upi"

    raw_items = body.get("items") or []
    if not isinstance(raw_items, list) or not raw_items:
        return {"success": False, "message": "Cart items are required"}

    order_items: list[dict] = []
    subtotal = 0.0
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        name = (raw.get("name") or "").strip()
        if not name:
            continue
        if raw.get("requiresRx") is True or str(raw.get("requires_rx") or "").lower() in ("1", "true", "yes"):
            return {
                "success": False,
                "message": f"{name} requires a doctor prescription. Order it from the Prescriptions tab after your consultation.",
            }
        try:
            qty = float(raw.get("quantity") or raw.get("qty") or 1)
        except (TypeError, ValueError):
            qty = 1.0
        if qty <= 0:
            return {"success": False, "message": f"Invalid quantity for {name}"}
        try:
            unit = float(raw.get("unitPrice") or raw.get("unit_price") or raw.get("price") or 0)
        except (TypeError, ValueError):
            unit = 0.0
        if unit < 0:
            return {"success": False, "message": f"Invalid price for {name}"}
        line = round(unit * qty, 2)
        subtotal += line
        order_items.append(
            {
                "prescription_item_id": None,
                "name": name[:255],
                "dosage": (raw.get("dosage") or raw.get("salt") or None),
                "quantity": qty,
                "unit_price": unit,
                "line_total": line,
            }
        )

    if not order_items:
        return {"success": False, "message": "No valid medicines in cart"}

    delivery_fee = 0.0
    if fulfillment == "delivery" and subtotal > 0 and subtotal < 500:
        try:
            delivery_fee = float(body.get("deliveryFee") or body.get("delivery_fee") or 29)
        except (TypeError, ValueError):
            delivery_fee = 29.0
    amount_total = round(subtotal + delivery_fee, 2)
    if amount_total <= 0:
        return {"success": False, "message": "Order total must be greater than zero"}

    delivery_address = (body.get("deliveryAddress") or body.get("delivery_address") or "").strip()
    if fulfillment == "delivery" and len(delivery_address) < 8:
        return {"success": False, "message": "Please enter a delivery address"}

    pharmacy_id = int(body.get("pharmacyId") or body.get("pharmacy_id") or 0)
    pharmacy = None
    if pharmacy_id:
        pharmacy = await pharmacy_model.get_by_id(pharmacy_id)
    if not pharmacy or not pharmacy.get("is_active"):
        candidates = await pharmacy_model.list_active_for_catalog(
            prefer_delivery=(fulfillment == "delivery"),
        )
        pharmacy = candidates[0] if candidates else None
    if not pharmacy:
        return {
            "success": False,
            "message": "No pharmacy is available for retail orders yet. Please try again later.",
        }
    if pharmacy.get("partner_status") != "active":
        return {"success": False, "message": "Pharmacy partner is not active"}
    if fulfillment == "delivery" and not pharmacy.get("supports_delivery"):
        # Still allow catalog delivery against primary pharmacy for MVP retail UX.
        pass
    if fulfillment == "pickup" and not pharmacy.get("supports_pickup", True):
        return {"success": False, "message": "Pickup not supported by this pharmacy"}

    public_id = await new_pharmacy_order_public_id()
    is_sandbox = not await pharmacy_order_model.partner_has_production_key(int(pharmacy["partner_id"]))
    notes = (body.get("notes") or "").strip() or None
    note_bits = [notes] if notes else []
    note_bits.append(f"catalog_order payment={payment_method}")
    if delivery_fee:
        note_bits.append(f"delivery_fee={delivery_fee}")

    order = await pharmacy_order_model.create_order(
        {
            "public_id": public_id,
            "patient_id": user_id,
            "hospital_id": int(pharmacy["hospital_id"]),
            "pharmacy_id": int(pharmacy["id"]),
            "partner_id": int(pharmacy["partner_id"]),
            "consultation_id": None,
            "fulfillment": fulfillment,
            "delivery_address": delivery_address or None,
            "notes": " · ".join(note_bits),
            "actor_role": "patient",
            "is_sandbox": is_sandbox,
        },
        order_items,
    )

    bill = {
        "amount_subtotal": round(subtotal, 2),
        "amount_tax": 0,
        "amount_total": amount_total,
        "payment_method": payment_method,
        "delivery_fee": delivery_fee,
        "source": "catalog_cart",
        "items": [
            {
                "order_item_id": None,
                "name": i["name"],
                "quantity": i["quantity"],
                "unit_price": i["unit_price"],
                "line_total": i["line_total"],
            }
            for i in order_items
        ],
    }
    try:
        billed = await pharmacy_order_model.apply_bill(int(order["id"]), bill)
        if billed:
            order = billed
    except ValueError as exc:
        log.warning("catalog auto-bill failed: %s", exc)
        return {"success": False, "message": str(exc)}

    # COD: confirm order paid at placement (collect cash/UPI at door).
    if payment_method == "cod":
        try:
            order = await pharmacy_order_model.update_status(
                int(order["id"]),
                "paid",
                actor_role="patient",
                notes="Cash on delivery confirmed",
                extra={"bill_payload": {**(order.get("bill_payload") or {}), **bill, "cod": True}},
            ) or order
        except ValueError as exc:
            return {"success": False, "message": str(exc)}

    try:
        await pws.emit_pharmacy_event(
            int(pharmacy["partner_id"]),
            "order.placed",
            {
                "order_id": order["id"],
                "order_public_id": order.get("public_id") or public_id,
                "hospital_id": int(pharmacy["hospital_id"]),
                "pharmacy_id": int(pharmacy["id"]),
                "fulfillment": fulfillment,
                "payment_method": payment_method,
                "amount_total": amount_total,
                "items": [
                    {"name": i["name"], "quantity": i["quantity"], "unit_price": i["unit_price"]}
                    for i in order_items
                ],
            },
            webhook_url=pharmacy.get("webhook_url"),
        )
    except Exception as exc:
        log.warning("catalog order.placed webhook failed: %s", exc)

    full_items = await pharmacy_order_model.list_items(order["id"])
    enriched = {
        **order,
        "pharmacy_name": pharmacy.get("name"),
        "partner_name": pharmacy.get("partner_name"),
    }
    serialized = _serialize_order(enriched, full_items)
    serialized["paymentMethod"] = payment_method
    serialized["requiresPayment"] = payment_method == "upi" and serialized.get("status") == "billed"
    return {"success": True, "data": serialized}


async def mark_order_paid_from_transaction(
    user_id: int,
    pharmacy_order_id: int,
    razorpay_order_id: str,
    razorpay_payment_id: str,
) -> dict:
    """Mark pharmacy order paid after hosted/native Razorpay success (signature already verified)."""
    from app.models import payment_transaction_model as pt_model

    order = await pharmacy_order_model.get_for_patient(pharmacy_order_id, user_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    if order.get("status") == "paid":
        items = await pharmacy_order_model.list_items(pharmacy_order_id)
        return {"success": True, "data": _serialize_order(order, items), "message": "Already paid"}
    if order.get("status") != "billed":
        return {"success": False, "message": "Order is not payable"}

    paid_row = await pt_model.mark_paid(razorpay_order_id, razorpay_payment_id)
    payment_id = (paid_row or {}).get("id")
    try:
        updated = await pharmacy_order_model.update_status(
            pharmacy_order_id,
            "paid",
            actor_role="patient",
            notes="Paid via Razorpay",
            extra={"payment_transaction_id": payment_id} if payment_id else None,
        )
    except ValueError as e:
        return {"success": False, "message": str(e)}

    try:
        await pws.emit_pharmacy_event(
            int(order["partner_id"]),
            "order.paid",
            {
                "order_id": pharmacy_order_id,
                "order_public_id": order.get("public_id"),
                "amount_total": float(order["amount_total"]) if order.get("amount_total") is not None else None,
                "razorpay_payment_id": razorpay_payment_id,
            },
            webhook_url=None,
        )
    except Exception as exc:
        log.warning("order.paid webhook failed: %s", exc)

    items = await pharmacy_order_model.list_items(pharmacy_order_id)
    return {"success": True, "data": _serialize_order(updated or order, items)}


async def list_patient_orders(user_id: int) -> dict:
    rows = await pharmacy_order_model.list_for_patient(user_id)
    data = []
    for r in rows:
        items = await pharmacy_order_model.list_items(r["id"])
        data.append(_serialize_order(dict(r), items))
    return {"success": True, "data": data}


async def get_patient_order(user_id: int, order_id: int) -> dict:
    order = await pharmacy_order_model.get_for_patient(order_id, user_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    items = await pharmacy_order_model.list_items(order_id)
    return {"success": True, "data": _serialize_order(order, items)}


async def cancel_patient_order(user_id: int, order_id: int, reason: str | None = None) -> dict:
    order = await pharmacy_order_model.get_for_patient(order_id, user_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    try:
        updated = await pharmacy_order_model.update_status(
            order_id,
            "cancelled",
            actor_role="patient",
            notes=reason or "Cancelled by patient",
            extra={"cancel_reason": reason or "Cancelled by patient"},
        )
    except ValueError as e:
        return {"success": False, "message": str(e)}

    try:
        await pws.emit_pharmacy_event(
            int(order["partner_id"]),
            "order.cancelled",
            {"order_id": order_id, "order_public_id": order["public_id"], "reason": reason},
        )
    except Exception as exc:
        log.warning("order.cancelled webhook failed: %s", exc)

    await _emit_order_realtime(updated)
    items = await pharmacy_order_model.list_items(order_id)
    return {"success": True, "data": _serialize_order(updated, items)}


async def partner_get_prescription(partner_id: int, consultation_id: int) -> dict:
    hospital_ids = await pharmacy_model.list_partner_hospital_ids(partner_id)
    from app.config.db import db
    row = await db.fetch_row(
        """
        SELECT c.*, a.hospital_id, a.user_id, a.id AS appointment_id
        FROM consultations c
        JOIN appointments a ON a.id = c.appointment_id
        WHERE c.id = $1
        """,
        consultation_id,
    )
    if not row:
        return {"success": False, "message": "Prescription not found"}
    if int(row["hospital_id"]) not in hospital_ids:
        return {"success": False, "message": "Prescription not in partner hospital scope"}
    items = await prescription_item_model.list_for_consultation(consultation_id)
    return {
        "success": True,
        "data": {
            "consultationId": consultation_id,
            "appointmentId": row["appointment_id"],
            "hospitalId": row["hospital_id"],
            "prescriptionNotes": row.get("prescription") or "",
            "items": [_serialize_item(dict(i)) for i in items],
        },
    }


async def partner_list_orders(partner_id: int, status: str | None = None) -> dict:
    rows = await pharmacy_order_model.list_for_partner(partner_id, status=status)
    data = []
    for r in rows:
        items = await pharmacy_order_model.list_items(r["id"])
        data.append(_serialize_order(dict(r), items))
    return {"success": True, "data": data}


async def partner_get_order(partner_id: int, order_id: int) -> dict:
    order = await pharmacy_order_model.get_for_partner(order_id, partner_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    items = await pharmacy_order_model.list_items(order_id)
    return {"success": True, "data": _serialize_order(order, items)}


async def partner_update_status(partner_id: int, order_id: int, body: dict, *, is_sandbox_key: bool = True) -> dict:
    order = await pharmacy_order_model.get_for_partner(order_id, partner_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    err = _sandbox_mismatch(order, is_sandbox_key)
    if err:
        return err
    status = (body.get("status") or "").strip().lower()
    if status not in pharmacy_order_model.VALID_STATUSES:
        return {"success": False, "message": f"Invalid status: {status}"}
    req_id = body.get("partner_request_id") or body.get("partnerRequestId")
    prev_status = order.get("status")
    try:
        updated = await pharmacy_order_model.update_status(
            order_id,
            status,
            actor_role="partner",
            notes=body.get("notes"),
            extra={
                "partner_order_ref": body.get("partner_order_ref") or body.get("partnerOrderRef"),
                "partner_request_id": req_id,
            },
        )
    except ValueError as e:
        return {"success": False, "message": str(e)}

    try:
        await pws.emit_pharmacy_event(
            partner_id,
            "order.status.changed",
            {
                "order_id": order_id,
                "order_public_id": updated.get("public_id") or order.get("public_id"),
                "previous_status": prev_status,
                "status": updated.get("status") or status,
                "partner_order_ref": updated.get("partner_order_ref")
                or body.get("partner_order_ref")
                or body.get("partnerOrderRef"),
                "notes": body.get("notes"),
            },
        )
    except Exception as exc:
        log.warning("order.status.changed webhook failed: %s", exc)

    await _emit_order_realtime(updated)
    await _notify_patient_status(updated)
    items = await pharmacy_order_model.list_items(order_id)
    return {"success": True, "data": _serialize_order(updated, items)}


async def partner_post_bill(partner_id: int, order_id: int, body: dict, *, is_sandbox_key: bool = True) -> dict:
    order = await pharmacy_order_model.get_for_partner(order_id, partner_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    err = _sandbox_mismatch(order, is_sandbox_key)
    if err:
        return err
    try:
        updated = await pharmacy_order_model.apply_bill(order_id, body)
    except ValueError as e:
        return {"success": False, "message": str(e)}
    await _emit_order_realtime(updated)
    await _notify_patient_status(updated)
    items = await pharmacy_order_model.list_items(order_id)
    return {"success": True, "data": _serialize_order(updated, items)}


def _sandbox_mismatch(order: dict, is_sandbox_key: bool) -> dict | None:
    order_sandbox = bool(order.get("is_sandbox", True))
    if is_sandbox_key and not order_sandbox:
        return {"success": False, "message": "Sandbox key cannot mutate production orders"}
    if (not is_sandbox_key) and order_sandbox:
        return {"success": False, "message": "Production key cannot mutate sandbox orders"}
    return None


async def probe_availability(user_id: int, body: dict) -> dict:
    """Patient availability/price probe — MEDCLUES calls partner webhook sync."""
    import json
    import time
    import httpx
    from app.models import pharmacy_quote_model, partner_model
    from app.services.partner_auth_service import build_webhook_signature

    consultation_id = int(body.get("consultationId") or body.get("consultation_id") or 0)
    pharmacy_id = int(body.get("pharmacyId") or body.get("pharmacy_id") or 0)
    if not consultation_id or not pharmacy_id:
        return {"success": False, "message": "consultationId and pharmacyId are required"}

    from app.config.db import db
    consult = await db.fetch_row(
        """
        SELECT c.id, a.user_id, a.hospital_id
        FROM consultations c
        JOIN appointments a ON a.id = c.appointment_id
        WHERE c.id = $1
        """,
        consultation_id,
    )
    if not consult or int(consult["user_id"]) != int(user_id):
        return {"success": False, "message": "Prescription not found"}

    pharmacy = await pharmacy_model.get_by_id(pharmacy_id)
    if not pharmacy or int(pharmacy["hospital_id"]) != int(consult["hospital_id"]):
        return {"success": False, "message": "Pharmacy not available"}

    cached = await pharmacy_quote_model.get_valid_quote(consultation_id, pharmacy_id)
    if cached:
        items = cached.get("items") or []
        if isinstance(items, str):
            items = json.loads(items)
        return {
            "success": True,
            "data": {
                "consultationId": consultation_id,
                "pharmacyId": pharmacy_id,
                "cached": True,
                "expiresAt": cached["expires_at"].isoformat() if cached.get("expires_at") else None,
                "items": items,
            },
        }

    rx_items = await prescription_item_model.list_for_consultation(consultation_id)
    probe_items = [
        {"name": i["name"], "dosage": i.get("dosage"), "quantity": float(i["quantity"]) if i.get("quantity") is not None else 1}
        for i in rx_items
    ]
    if not probe_items:
        probe_items = [{"name": "Prescription medicines", "quantity": 1}]

    partner_id = int(pharmacy["partner_id"])
    webhook_url = pharmacy.get("webhook_url")
    if not webhook_url:
        partner = await partner_model.get_partner_by_id(partner_id)
        webhook_url = (partner or {}).get("webhook_url")

    estimates: list[dict] = []
    source = "fallback"
    if webhook_url:
        secret = await partner_model.get_webhook_secret(partner_id) or f"unset_webhook_secret_{partner_id}"
        payload = {
            "event": "availability.probe",
            "consultation_id": consultation_id,
            "pharmacy_id": pharmacy_id,
            "hospital_id": int(consult["hospital_id"]),
            "items": probe_items,
            "timestamp": int(time.time()),
        }
        body_bytes = json.dumps(payload, default=str).encode()
        headers = {
            "Content-Type": "application/json",
            "X-MedClues-Event": "availability.probe",
            "X-MedClues-Signature": build_webhook_signature(secret, body_bytes),
            "X-MedClues-Timestamp": str(int(time.time())),
            "User-Agent": "MedClues-Probe/1.0",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(webhook_url, content=body_bytes, headers=headers)
            if 200 <= resp.status_code < 300:
                data = resp.json() if resp.content else {}
                raw = data.get("items") or data.get("estimates") or data.get("data") or []
                if isinstance(raw, list):
                    for row in raw:
                        if not isinstance(row, dict):
                            continue
                        estimates.append({
                            "name": row.get("name") or row.get("medicine"),
                            "available": bool(row.get("available", True)),
                            "estimatedUnitPrice": row.get("estimatedUnitPrice") or row.get("unit_price") or row.get("price"),
                            "currency": row.get("currency") or "INR",
                        })
                    source = "partner"
        except Exception as exc:
            log.warning("availability probe outbound failed: %s", exc)

    if not estimates:
        # Soft fallback: mark requested lines as unknown (no inventory dump)
        estimates = [
            {"name": i["name"], "available": None, "estimatedUnitPrice": None, "currency": "INR"}
            for i in probe_items
        ]
        source = "unavailable"

    quote = await pharmacy_quote_model.upsert_quote(
        consultation_id, pharmacy_id, partner_id, estimates, source=source,
    )
    return {
        "success": True,
        "data": {
            "consultationId": consultation_id,
            "pharmacyId": pharmacy_id,
            "cached": False,
            "source": source,
            "expiresAt": quote["expires_at"].isoformat() if quote.get("expires_at") else None,
            "items": estimates,
        },
    }


async def partner_push_availability(partner_id: int, body: dict) -> dict:
    from app.models import pharmacy_quote_model
    consultation_id = int(body.get("consultationId") or body.get("consultation_id") or 0)
    pharmacy_id = int(body.get("pharmacyId") or body.get("pharmacy_id") or 0)
    items = body.get("items") or []
    if not consultation_id or not pharmacy_id or not isinstance(items, list):
        return {"success": False, "message": "consultationId, pharmacyId, and items[] required"}
    pharmacy = await pharmacy_model.get_by_id(pharmacy_id)
    if not pharmacy or int(pharmacy["partner_id"]) != int(partner_id):
        return {"success": False, "message": "Pharmacy not in partner scope"}
    normalized = []
    for row in items:
        if not isinstance(row, dict):
            continue
        normalized.append({
            "name": row.get("name"),
            "available": bool(row.get("available", True)),
            "estimatedUnitPrice": row.get("estimatedUnitPrice") or row.get("unit_price") or row.get("price"),
            "currency": row.get("currency") or "INR",
        })
    quote = await pharmacy_quote_model.upsert_quote(
        consultation_id, pharmacy_id, partner_id, normalized, source="partner_push",
    )
    return {
        "success": True,
        "data": {
            "consultationId": consultation_id,
            "pharmacyId": pharmacy_id,
            "expiresAt": quote["expires_at"].isoformat() if quote.get("expires_at") else None,
            "items": normalized,
        },
    }


async def refill_order(user_id: int, order_id: int) -> dict:
    source = await pharmacy_order_model.get_for_patient(order_id, user_id)
    if not source:
        return {"success": False, "message": "Order not found"}
    if source.get("status") != "delivered":
        return {"success": False, "message": "Only delivered orders can be refilled"}

    pharmacy = await pharmacy_model.get_by_id(int(source["pharmacy_id"]))
    if not pharmacy or not pharmacy.get("is_active") or pharmacy.get("partner_status") != "active":
        return {"success": False, "message": "Pharmacy is no longer available"}

    items = await pharmacy_order_model.list_items(order_id)
    if not items:
        return {"success": False, "message": "No items to refill"}

    public_id = await new_pharmacy_order_public_id()
    is_sandbox = not await pharmacy_order_model.partner_has_production_key(int(source["partner_id"]))
    order_items = [
        {
            "prescription_item_id": i.get("prescription_item_id"),
            "name": i["name"],
            "dosage": i.get("dosage"),
            "quantity": i.get("quantity") or 1,
        }
        for i in items
    ]
    order = await pharmacy_order_model.create_order(
        {
            "public_id": public_id,
            "patient_id": user_id,
            "hospital_id": int(source["hospital_id"]),
            "pharmacy_id": int(source["pharmacy_id"]),
            "partner_id": int(source["partner_id"]),
            "consultation_id": source.get("consultation_id"),
            "fulfillment": source.get("fulfillment") or "pickup",
            "delivery_address": source.get("delivery_address"),
            "notes": f"Refill of {source.get('public_id')}",
            "actor_role": "patient",
            "is_sandbox": is_sandbox,
            "parent_order_id": order_id,
            "refill_of_consultation_id": source.get("consultation_id"),
        },
        order_items,
    )

    try:
        await pws.emit_pharmacy_event(
            int(source["partner_id"]),
            "order.placed",
            {
                "order_id": order["id"],
                "order_public_id": order["public_id"],
                "consultation_id": source.get("consultation_id"),
                "hospital_id": int(source["hospital_id"]),
                "pharmacy_id": int(source["pharmacy_id"]),
                "fulfillment": order.get("fulfillment"),
                "refill": True,
                "parent_order_id": order_id,
                "items": [
                    {"name": i["name"], "dosage": i.get("dosage"), "quantity": i.get("quantity")}
                    for i in order_items
                ],
            },
            webhook_url=pharmacy.get("webhook_url"),
        )
    except Exception as exc:
        log.warning("refill order.placed webhook failed: %s", exc)

    full_items = await pharmacy_order_model.list_items(order["id"])
    enriched = {
        **order,
        "pharmacy_name": pharmacy.get("name") or source.get("pharmacy_name"),
        "partner_name": source.get("partner_name"),
    }
    return {"success": True, "data": _serialize_order(enriched, full_items)}


async def create_pay_order(user_id: int, order_id: int) -> dict:
    """Create Razorpay order for a billed pharmacy order."""
    import asyncio
    import uuid
    from app.config.config import settings
    from app.controllers import payments_controller
    from app.models import payment_transaction_model as pt_model

    order = await pharmacy_order_model.get_for_patient(order_id, user_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    if order.get("status") != "billed":
        return {"success": False, "message": "Order must be billed before payment"}
    total = order.get("amount_total")
    if total is None:
        return {"success": False, "message": "Bill amount missing"}
    amount_paise = int(round(float(total) * 100))
    if amount_paise < 100:
        return {"success": False, "message": "Invalid bill amount"}

    try:
        payments_controller._require_client()
    except Exception:
        return {"success": False, "message": "Razorpay not configured"}

    currency = order.get("currency") or "INR"
    order_data = {
        "amount": amount_paise,
        "currency": currency,
        "payment_capture": 1,
        "receipt": f"pharm_{order_id}"[:40],
        "notes": {"kind": "pharmacy_order", "pharmacy_order_id": str(order_id)},
    }
    try:
        rz = await asyncio.to_thread(payments_controller.razorpay_client.order.create, data=order_data)
    except Exception as exc:
        log.error("pharmacy razorpay create failed: %s", exc)
        return {"success": False, "message": "Could not create payment order"}

    razorpay_order_id = rz.get("id")
    checkout_token = uuid.uuid4().hex
    await pt_model.create_pending(
        razorpay_order_id=str(razorpay_order_id),
        amount_paise=amount_paise,
        checkout_token=checkout_token,
        currency=currency,
        user_id=user_id,
        doctor_name=order.get("pharmacy_name") or "Pharmacy",
        booking_metadata={
            "kind": "pharmacy_order",
            "pharmacy_order_id": order_id,
        },
    )

    return {
        "success": True,
        "data": {
            "orderId": order_id,
            "razorpayOrderId": razorpay_order_id,
            "razorpayKey": settings.RAZORPAY_KEY_ID,
            "amount": float(total),
            "amountPaise": amount_paise,
            "currency": currency,
            "checkoutToken": checkout_token,
        },
    }


async def verify_pharmacy_payment(
    user_id: int,
    order_id: int,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> dict:
    from app.controllers import payments_controller
    from app.models import payment_transaction_model as pt_model

    order = await pharmacy_order_model.get_for_patient(order_id, user_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    if order.get("status") not in ("billed", "paid"):
        return {"success": False, "message": "Order is not payable"}

    verified = await payments_controller.verify_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
    )
    if not verified.get("success"):
        return {"success": False, "message": "Invalid payment signature"}

    if order.get("status") == "paid":
        items = await pharmacy_order_model.list_items(order_id)
        return {"success": True, "data": _serialize_order(order, items), "message": "Already paid"}

    paid_row = await pt_model.mark_paid(razorpay_order_id, razorpay_payment_id)
    payment_id = (paid_row or {}).get("id")

    try:
        updated = await pharmacy_order_model.update_status(
            order_id,
            "paid",
            actor_role="patient",
            notes="Paid via Razorpay",
            extra={"payment_transaction_id": payment_id} if payment_id else None,
        )
    except ValueError as e:
        return {"success": False, "message": str(e)}

    try:
        await pws.emit_pharmacy_event(
            int(order["partner_id"]),
            "payment.completed",
            {
                "order_id": order_id,
                "order_public_id": order.get("public_id"),
                "amount_total": float(order["amount_total"]) if order.get("amount_total") is not None else None,
                "currency": order.get("currency") or "INR",
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_order_id": razorpay_order_id,
            },
        )
    except Exception as exc:
        log.warning("payment.completed webhook failed: %s", exc)

    await _emit_order_realtime(updated)
    await _notify_patient_status(updated)
    items = await pharmacy_order_model.list_items(order_id)
    return {"success": True, "data": _serialize_order(updated, items)}


async def list_patient_payments(user_id: int) -> dict:
    rows = await pharmacy_order_model.list_for_patient(user_id, limit=100)
    payments = []
    for r in rows:
        r = dict(r)
        if r.get("status") not in ("billed", "paid", "ready", "out_for_delivery", "delivered"):
            continue
        if r.get("amount_total") is None and r.get("status") == "billed":
            pass
        payments.append({
            "orderId": r["id"],
            "publicId": r.get("public_id"),
            "status": r.get("status"),
            "pharmacyName": r.get("pharmacy_name"),
            "amountTotal": float(r["amount_total"]) if r.get("amount_total") is not None else None,
            "currency": r.get("currency") or "INR",
            "invoiceUrl": r.get("invoice_url"),
            "paidAt": r.get("updated_at").isoformat() if r.get("status") == "paid" and r.get("updated_at") else None,
            "createdAt": r.get("created_at").isoformat() if r.get("created_at") else None,
        })
    return {"success": True, "data": payments}


async def build_invoice_pdf(user_id: int, order_id: int) -> dict:
    from app.services.pharmacy_invoice_pdf import build_pharmacy_invoice_pdf

    order = await pharmacy_order_model.get_for_patient(order_id, user_id)
    if not order:
        return {"success": False, "message": "Order not found"}
    if order.get("status") not in ("billed", "paid", "ready", "out_for_delivery", "delivered"):
        return {"success": False, "message": "Invoice available after billing"}
    items = await pharmacy_order_model.list_items(order_id)
    pdf = build_pharmacy_invoice_pdf(
        order_public_id=order.get("public_id") or str(order_id),
        pharmacy_name=order.get("pharmacy_name") or "Pharmacy",
        status=order.get("status") or "",
        currency=order.get("currency") or "INR",
        amount_total=order.get("amount_total"),
        lines=[dict(i) for i in items],
        patient_label=f"User #{user_id}",
    )
    return {
        "success": True,
        "filename": f"pharmacy-invoice-{order.get('public_id') or order_id}.pdf",
        "content": pdf,
        "invoiceUrl": order.get("invoice_url"),
    }


async def admin_list_pharmacy_orders(partner_id: int, limit: int = 50) -> dict:
    rows = await pharmacy_order_model.list_recent_for_partner_admin(partner_id, limit=limit)
    data = []
    for r in rows:
        r = dict(r)
        data.append({
            "id": r["id"],
            "publicId": r.get("public_id"),
            "status": r.get("status"),
            "isSandbox": bool(r.get("is_sandbox")),
            "pharmacyName": r.get("pharmacy_name"),
            "amountTotal": float(r["amount_total"]) if r.get("amount_total") is not None else None,
            "lastOrderPlacedWebhookStatus": r.get("last_order_placed_webhook_status"),
            "createdAt": r.get("created_at").isoformat() if r.get("created_at") else None,
        })
    return {"success": True, "data": data}


async def admin_counter_list_orders(limit: int = 50) -> dict:
    """Hospital pharmacy counter — recent pickup orders (admin desk)."""
    rows = await pharmacy_order_model.list_recent_all(limit=limit)
    data = []
    for r in rows:
        r = dict(r)
        data.append({
            "id": r["id"],
            "publicId": r.get("public_id"),
            "token": r.get("public_id"),
            "status": r.get("status"),
            "patientName": r.get("patient_name") or "Patient",
            "patientPhone": r.get("patient_phone"),
            "pharmacyName": r.get("pharmacy_name"),
            "fulfillment": r.get("fulfillment") or r.get("order_type") or "pickup",
            "total": float(r["amount_total"]) if r.get("amount_total") is not None else None,
            "createdAt": r.get("created_at").isoformat() if r.get("created_at") else None,
        })
    return {"success": True, "orders": data}


async def admin_counter_lookup_order(token: str) -> dict:
    """Lookup by PHO public id for counter QR scan."""
    from app.models import pharmacy_order_model as pom

    pid = (token or "").strip().upper()
    if not pid:
        return {"success": False, "message": "Enter a pickup token (PHO…)"}
    order = await pom.get_by_public_id(pid)
    if not order:
        # Allow numeric id fallback for desk staff
        if pid.isdigit():
            order = await pom.get_by_id(int(pid))
    if not order:
        return {"success": False, "message": f'No order found for "{pid}"'}
    items = await pom.list_items(int(order["id"]))
    return {
        "success": True,
        "order": {
            "id": order["id"],
            "publicId": order.get("public_id"),
            "token": order.get("public_id"),
            "status": order.get("status"),
            "total": float(order["amount_total"]) if order.get("amount_total") is not None else None,
            "items": [
                {
                    "id": it.get("id"),
                    "name": it.get("name") or "Medicine",
                    "qty": it.get("quantity") or 1,
                    "price": float(it["unit_price"]) if it.get("unit_price") is not None else None,
                }
                for it in items
            ],
        },
    }


async def admin_counter_update_status(order_id: int, status: str) -> dict:
    """Persist hospital counter status change (admin desk)."""
    from app.models import pharmacy_order_model as pom

    status_map = {
        "pending": "placed",
        "packed": "ready",
        "completed": "delivered",
        "ready": "ready",
        "delivered": "delivered",
        "accepted": "accepted",
        "cancelled": "cancelled",
    }
    to_status = status_map.get((status or "").strip().lower(), (status or "").strip().lower())
    order = await pom.get_by_id(int(order_id))
    if not order:
        return {"success": False, "message": "Order not found"}
    try:
        updated = await pom.update_status(
            int(order_id),
            to_status,
            actor_role="admin",
            notes="Hospital pharmacy counter",
        )
    except ValueError as exc:
        return {"success": False, "message": str(exc)}
    return {
        "success": True,
        "order": {
            "id": updated["id"] if updated else order_id,
            "publicId": (updated or order).get("public_id"),
            "status": (updated or order).get("status"),
        },
    }


async def sync_prescription_to_express(consultation_id: int, hospital_id: int | None) -> None:
    """Optional sync to Express Pharmacy when PHARMACY_SERVICE_URL is set."""
    import os
    import httpx
    from app.config.db import db

    pharmacy_url = (os.getenv("PHARMACY_SERVICE_URL") or "").strip().rstrip("/")
    if not pharmacy_url:
        log.info("PHARMACY_SERVICE_URL unset — skip Express prescription sync")
        return
    internal_key = os.getenv("INTERNAL_API_KEY") or os.getenv("PHARMACY_INTERNAL_API_KEY", "")

    try:
        row = await db.fetch_row(
            """
            SELECT c.*, a.doctor_data AS doc_data, u.name AS patient_name, u.phone AS patient_phone, u.email AS patient_email
            FROM consultations c
            JOIN appointments a ON a.id = c.appointment_id
            LEFT JOIN users u ON u.id = a.user_id
            WHERE c.id = $1
            """,
            consultation_id,
        )
        if not row:
            return

        row = dict(row)
        items = await prescription_item_model.list_for_consultation(consultation_id)
        doc_data = row.get("doc_data") or {}

        payload = {
            "externalPrescriptionId": f"RX-{consultation_id}",
            "doctorName": doc_data.get("name") or "Hospital Doctor",
            "doctorSpecialty": doc_data.get("speciality")
                or doc_data.get("specialty")
                or doc_data.get("specialization")
                or "General Medicine",
            "patient": {
                "name": row.get("patient_name") or "Patient",
                "phone": row.get("patient_phone") or "0000000000",
                "email": row.get("patient_email") or "",
                "age": 30,
                "gender": "Other",
            },
            "medicines": [
                {
                    "name": i.get("name"),
                    "dosage": i.get("dosage") or "1 tablet daily",
                    "quantity": int(i.get("quantity") or 1),
                    "instructions": i.get("instructions") or "",
                }
                for i in items
            ] if items else [
                {
                    "name": "Prescribed Medicines",
                    "dosage": "As directed",
                    "quantity": 1,
                    "instructions": row.get("prescription") or "",
                }
            ],
            "priority": "normal",
            "fulfillmentType": "pickup",
        }

        async with httpx.AsyncClient(timeout=8.0) as client:
            await client.post(
                f"{pharmacy_url}/api/integration/medclues/prescription",
                json=payload,
                headers={
                    "x-internal-api-key": internal_key,
                    "Content-Type": "application/json",
                },
            )
    except Exception as exc:
        log.warning("Prescription sync to Express Pharmacy failed: %s", exc)


async def on_prescription_published(
    consultation_id: int,
    hospital_id: int | None,
    appointment_id: int | None = None,
    updated: bool = False,
) -> None:
    """Enqueue prescription.created / .updated to mapped pharmacy partners."""
    asyncio.create_task(sync_prescription_to_express(consultation_id, hospital_id))

    if not hospital_id:
        return
    pharmacies = await pharmacy_model.list_for_hospital(int(hospital_id))
    if not pharmacies:
        return
    items = await prescription_item_model.list_for_consultation(consultation_id)
    event = "prescription.updated" if updated else "prescription.created"
    seen_partners: set[int] = set()
    for ph in pharmacies:
        pid = int(ph["partner_id"])
        if pid in seen_partners:
            continue
        seen_partners.add(pid)
        try:
            await pws.emit_pharmacy_event(
                pid,
                event,
                {
                    "consultation_id": consultation_id,
                    "appointment_id": appointment_id,
                    "hospital_id": hospital_id,
                    "pharmacy_id": ph["id"],
                    "items": [_serialize_item(dict(i)) for i in items],
                },
                webhook_url=ph.get("webhook_url") if "webhook_url" in ph else None,
            )
        except Exception as exc:
            log.warning("%s webhook failed partner=%s: %s", event, pid, exc)


async def _emit_order_realtime(order: dict | None) -> None:
    if not order:
        return
    try:
        from app.services import socket_service
        oid = order.get("id")
        payload = {
            "orderId": oid,
            "publicId": order.get("public_id"),
            "status": order.get("status"),
            "amountTotal": float(order["amount_total"]) if order.get("amount_total") is not None else None,
        }
        if hasattr(socket_service, "emit_pharmacy_order_update"):
            await socket_service.emit_pharmacy_order_update(oid, payload)
        else:
            # Fallback emit into room
            sio = getattr(socket_service, "sio", None)
            if sio:
                await sio.emit("pharmacy_order_status", payload, room=f"pharmacy_order:{oid}")
    except Exception as exc:
        log.warning("pharmacy socket emit failed: %s", exc)


async def _notify_patient_status(order: dict | None) -> None:
    if not order:
        return
    try:
        from app.services import fcm_service
        status = order.get("status") or ""
        title = "Pharmacy order update"
        body = f"Your medicine order is now: {status.replace('_', ' ')}"
        asyncio.create_task(
            fcm_service.send_to_user(
                int(order["patient_id"]),
                title,
                body,
                data={
                    "type": "pharmacy_order",
                    "orderId": str(order["id"]),
                    "status": status,
                },
            )
        )
    except Exception as exc:
        log.warning("pharmacy FCM failed: %s", exc)


def _first_str(*candidates: Any) -> str | None:
    for c in candidates:
        if c is None:
            continue
        if isinstance(c, list):
            if not c:
                continue
            c = c[0]
        s = str(c).strip()
        if s:
            return s
    return None


def _map_express_inventory_item(item: dict[str, Any], index: int) -> dict[str, Any] | None:
    from app.models.pharmacy_master_catalog_model import serialize_catalog_row

    name = _first_str(item.get("name"), item.get("medicineName"))
    if not name:
        return None
    price = item.get("price") if item.get("price") is not None else item.get("costPrice")
    mrp = item.get("mrp") if item.get("mrp") is not None else price
    stock = item.get("stock")
    if stock is not None:
        try:
            if int(stock) <= 0:
                return None
        except (TypeError, ValueError):
            pass
    med_id = _first_str(item.get("_id"), item.get("id")) or f"ext_{index}"
    return serialize_catalog_row({
        "id": med_id,
        "name": name,
        "brand": _first_str(item.get("brand"), item.get("distributor")) or "",
        "salt": _first_str(item.get("salt"), item.get("composition")) or "",
        "category": item.get("category") or "General",
        "price": price if price is not None else 0,
        "mrp": mrp if mrp is not None else (price if price is not None else 0),
        "stock": stock if stock is not None else 0,
        "requires_rx": bool(item.get("requiresRx") or item.get("requires_rx") or False),
        "image": item.get("image") or "",
        "hsn_code": item.get("hsnCode") or item.get("hsn_code") or "",
    })


async def _fetch_express_master_catalog(query: str) -> list[dict[str, Any]] | None:
    """Live Admin Master Catalog from Express Mongo inventory when PHARMACY_SERVICE_URL is set."""
    import os
    import httpx

    pharmacy_url = (os.getenv("PHARMACY_SERVICE_URL") or "").strip().rstrip("/")
    if not pharmacy_url:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(f"{pharmacy_url}/api/inventory")
            res.raise_for_status()
            payload = res.json()
    except Exception as exc:
        log.warning("Express master catalog fetch failed: %s", exc)
        return None

    raw: list = []
    if isinstance(payload, list):
        raw = payload
    elif isinstance(payload, dict):
        for key in ("data", "inventory", "medicines", "items"):
            if isinstance(payload.get(key), list):
                raw = payload[key]
                break

    q = (query or "").strip().lower()
    out: list[dict[str, Any]] = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        mapped = _map_express_inventory_item(item, i)
        if not mapped:
            continue
        if q:
            blob = " ".join(
                str(mapped.get(k) or "").lower()
                for k in ("name", "brand", "salt", "category")
            )
            if q not in blob:
                continue
        out.append(mapped)
    return out


async def search_medicine_catalog(query: str) -> dict[str, Any]:
    """Patient All Medicines: live master catalog only (Express inventory or Postgres). No OpenFDA."""
    q = (query or "").strip()
    try:
        express = await _fetch_express_master_catalog(q)
        if express is not None:
            # Prefer Express when configured (even if empty — reflects live master catalog).
            return {
                "success": True,
                "data": express,
                "query": q,
                "source": "express_master_catalog",
            }

        from app.models import pharmacy_master_catalog_model as pmc

        data = await pmc.search_master_catalog(q)
        categories = await pmc.list_catalog_categories()
        return {
            "success": True,
            "data": data,
            "query": q,
            "categories": categories,
            "source": "pharmacy_master_catalog",
        }
    except Exception as exc:
        log.warning("Pharmacy master catalog search failed: %s", exc)
        return {"success": True, "data": [], "query": q, "message": str(exc)}


async def list_medicine_catalog_categories() -> dict[str, Any]:
    try:
        express = await _fetch_express_master_catalog("")
        if express is not None:
            cats = sorted({
                str(i.get("category") or "").strip()
                for i in express
                if str(i.get("category") or "").strip()
            })
            return {"success": True, "data": cats, "source": "express_master_catalog"}

        from app.models import pharmacy_master_catalog_model as pmc

        cats = await pmc.list_catalog_categories()
        return {"success": True, "data": cats, "source": "pharmacy_master_catalog"}
    except Exception as exc:
        log.warning("Pharmacy catalog categories failed: %s", exc)
        return {"success": True, "data": [], "message": str(exc)}


