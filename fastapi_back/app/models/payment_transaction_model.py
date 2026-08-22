import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.config.db import db


async def ensure_payment_transactions_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id                  BIGSERIAL PRIMARY KEY,
            external_id         UUID NOT NULL DEFAULT gen_random_uuid(),
            razorpay_order_id   VARCHAR(64) NOT NULL,
            razorpay_payment_id VARCHAR(64),
            checkout_token      VARCHAR(64),
            user_id             INTEGER,
            doctor_id           VARCHAR(64),
            appointment_id      VARCHAR(64),
            status              VARCHAR(32) NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
            amount_paise        INTEGER NOT NULL,
            currency            VARCHAR(8) NOT NULL DEFAULT 'INR',
            doctor_name         TEXT,
            customer_name       TEXT,
            customer_email      TEXT,
            customer_phone      TEXT,
            booking_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
            error_message       TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            paid_at             TIMESTAMPTZ,
            CONSTRAINT uq_payment_razorpay_order UNIQUE (razorpay_order_id)
        )
        """
    )
    await db.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_checkout_token
            ON payment_transactions (checkout_token)
            WHERE checkout_token IS NOT NULL
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_payment_user_status
            ON payment_transactions (user_id, status, created_at DESC)
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_payment_status_created
            ON payment_transactions (status, created_at DESC)
        """
    )


def _parse_metadata(raw: Any) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return dict(raw)


def row_to_dict(row) -> Optional[dict]:
    if not row:
        return None
    data = dict(row)
    data["booking_metadata"] = _parse_metadata(data.get("booking_metadata"))
    return data


def row_to_pending(row: dict) -> dict:
    meta = row.get("booking_metadata") or {}
    slot_id = meta.get("slot_id")
    if slot_id is not None and str(slot_id).isdigit():
        slot_id = int(slot_id)
    return {
        "user_id": row.get("user_id"),
        "doctor_id": str(meta.get("doctor_id") or row.get("doctor_id") or ""),
        "doctor_name": row.get("doctor_name") or meta.get("doctor_name") or "Doctor",
        "customer_name": row.get("customer_name") or meta.get("customer_name") or "",
        "customer_email": row.get("customer_email") or meta.get("customer_email") or "",
        "customer_phone": row.get("customer_phone") or meta.get("customer_phone") or "",
        "appointment_date": meta.get("appointment_date") or "",
        "appointment_time": meta.get("appointment_time") or "",
        "visit_type": meta.get("visit_type") or "online",
        "mode": meta.get("mode") or "online",
        "slot_id": slot_id,
        "slot_type": meta.get("slot_type"),
        "notes": meta.get("notes") or meta.get("booking_notes") or "",
        "symptoms": meta.get("symptoms") or [],
        "actual_patient": meta.get("actual_patient") or {"isSelf": True},
        "amount_paise": int(row.get("amount_paise") or 0),
        "appointment_id": row.get("appointment_id") or f"pending_{row.get('razorpay_order_id')}",
        "simple": bool(meta.get("simple")),
        "kind": meta.get("kind"),
        "pharmacy_order_id": meta.get("pharmacy_order_id"),
    }


def row_to_payment_record(row: dict) -> dict:
    return {
        "id": str(row.get("external_id") or row.get("id")),
        "publicId": row.get("public_id"),
        "user_id": row.get("user_id"),
        "order_id": row.get("razorpay_order_id"),
        "payment_id": row.get("razorpay_payment_id"),
        "appointment_id": row.get("appointment_id"),
        "doctor_name": row.get("doctor_name"),
        "amount_paise": row.get("amount_paise"),
        "amount_inr": round((row.get("amount_paise") or 0) / 100, 2),
        "status": row.get("status"),
        "error": row.get("error_message"),
        "created_at": (
            row["created_at"].isoformat()
            if hasattr(row.get("created_at"), "isoformat")
            else str(row.get("created_at") or "")
        ),
    }


async def create_pending(
    *,
    razorpay_order_id: str,
    amount_paise: int,
    checkout_token: str,
    currency: str = "INR",
    user_id: Optional[int] = None,
    doctor_id: Optional[str] = None,
    doctor_name: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_phone: Optional[str] = None,
    appointment_id: Optional[str] = None,
    booking_metadata: Optional[dict] = None,
) -> dict:
    from app.services import public_id_service

    meta = booking_metadata or {}
    public_id = await public_id_service.new_payment_public_id()
    row = await db.fetch_row(
        """
        INSERT INTO payment_transactions (
            razorpay_order_id, checkout_token, user_id, doctor_id, appointment_id,
            amount_paise, currency, doctor_name, customer_name, customer_email,
            customer_phone, booking_metadata, status, public_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'pending', $13)
        RETURNING *
        """,
        razorpay_order_id,
        checkout_token,
        user_id,
        doctor_id,
        appointment_id,
        amount_paise,
        currency or "INR",
        doctor_name,
        customer_name,
        customer_email,
        customer_phone,
        json.dumps(meta),
        public_id,
    )
    return row_to_dict(row)


async def get_by_order_id(razorpay_order_id: str) -> Optional[dict]:
    row = await db.fetch_row(
        "SELECT * FROM payment_transactions WHERE razorpay_order_id = $1 LIMIT 1",
        razorpay_order_id,
    )
    return row_to_dict(row)


async def get_by_checkout_token(checkout_token: str) -> Optional[dict]:
    row = await db.fetch_row(
        "SELECT * FROM payment_transactions WHERE checkout_token = $1 LIMIT 1",
        checkout_token,
    )
    return row_to_dict(row)


async def get_paid_by_order_id(razorpay_order_id: str) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT * FROM payment_transactions
        WHERE razorpay_order_id = $1 AND status = 'paid'
        LIMIT 1
        """,
        razorpay_order_id,
    )
    return row_to_dict(row)


async def claim_for_fulfillment(razorpay_order_id: str) -> dict:
    """Atomically claim a pending order for appointment booking."""
    if not db.pool:
        await db.connect()
    async with db.pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT * FROM payment_transactions
                WHERE razorpay_order_id = $1
                FOR UPDATE
                """,
                razorpay_order_id,
            )
            if not row:
                return {"kind": "missing"}
            data = row_to_dict(row)
            if data["status"] == "paid":
                return {"kind": "paid", "row": data}
            if data["status"] == "processing":
                return {"kind": "processing", "row": data}
            if data["status"] == "failed":
                return {"kind": "failed", "row": data}
            updated = await conn.fetchrow(
                """
                UPDATE payment_transactions
                SET status = 'processing', updated_at = NOW()
                WHERE razorpay_order_id = $1 AND status = 'pending'
                RETURNING *
                """,
                razorpay_order_id,
            )
            if updated:
                return {"kind": "claimed", "row": row_to_dict(updated)}
            return {"kind": "processing", "row": data}


async def release_claim(razorpay_order_id: str) -> None:
    await db.execute(
        """
        UPDATE payment_transactions
        SET status = 'pending', updated_at = NOW()
        WHERE razorpay_order_id = $1 AND status = 'processing'
        """,
        razorpay_order_id,
    )


async def mark_paid(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    appointment_id: Optional[str] = None,
) -> Optional[dict]:
    row = await db.fetch_row(
        """
        UPDATE payment_transactions
        SET status = 'paid',
            razorpay_payment_id = $2,
            appointment_id = COALESCE($3, appointment_id),
            paid_at = NOW(),
            updated_at = NOW(),
            error_message = NULL
        WHERE razorpay_order_id = $1
        RETURNING *
        """,
        razorpay_order_id,
        razorpay_payment_id,
        appointment_id,
    )
    return row_to_dict(row)


async def mark_failed(
    razorpay_order_id: str,
    error_message: str,
    *,
    user_id: Optional[int] = None,
    appointment_id: Optional[str] = None,
) -> Optional[dict]:
    row = await db.fetch_row(
        """
        UPDATE payment_transactions
        SET status = 'failed',
            error_message = $2,
            appointment_id = COALESCE($3, appointment_id),
            user_id = COALESCE($4, user_id),
            updated_at = NOW()
        WHERE razorpay_order_id = $1
          AND status IN ('pending', 'processing')
        RETURNING *
        """,
        razorpay_order_id,
        (error_message or "Payment failed")[:500],
        appointment_id,
        user_id,
    )
    return row_to_dict(row)


async def list_for_user(user_id: int, limit: int = 50) -> list[dict]:
    rows = await db.query(
        """
        SELECT * FROM payment_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )
    return [row_to_dict(r) for r in rows]


async def upsert_from_razorpay_notes(
    *,
    razorpay_order_id: str,
    amount_paise: int,
    notes: dict,
    doctor_name: str = "Doctor",
) -> Optional[dict]:
    """Restore a pending row from Razorpay order notes when DB row is missing."""
    user_id = int(notes.get("user_id") or 0) or None
    doctor_id = notes.get("doctor_id")
    if not user_id or not doctor_id:
        return None
    slot_id = notes.get("slot_id") or ""
    symptoms_raw = notes.get("symptoms") or "[]"
    symptoms: list = []
    try:
        parsed = json.loads(symptoms_raw) if isinstance(symptoms_raw, str) else symptoms_raw
        if isinstance(parsed, list):
            symptoms = parsed
    except Exception:
        symptoms = []
    meta = {
        "doctor_id": str(doctor_id),
        "appointment_date": notes.get("appointment_date") or "",
        "appointment_time": notes.get("appointment_time") or "",
        "visit_type": notes.get("visit_type") or "online",
        "mode": notes.get("mode") or "online",
        "slot_id": int(slot_id) if str(slot_id).isdigit() else slot_id or None,
        "slot_type": notes.get("slot_type"),
        "notes": notes.get("booking_notes") or "",
        "symptoms": symptoms,
    }
    from app.services import public_id_service

    checkout_token = uuid.uuid4().hex
    public_id = await public_id_service.new_payment_public_id()
    try:
        row = await db.fetch_row(
            """
            INSERT INTO payment_transactions (
                razorpay_order_id, checkout_token, user_id, doctor_id,
                appointment_id, amount_paise, doctor_name, booking_metadata, status, public_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'pending', $9)
            ON CONFLICT (razorpay_order_id) DO NOTHING
            RETURNING *
            """,
            razorpay_order_id,
            checkout_token,
            user_id,
            str(doctor_id),
            f"pending_{razorpay_order_id}",
            amount_paise,
            doctor_name,
            json.dumps(meta),
            public_id,
        )
        if row:
            return row_to_dict(row)
        return await get_by_order_id(razorpay_order_id)
    except Exception:
        return await get_by_order_id(razorpay_order_id)
