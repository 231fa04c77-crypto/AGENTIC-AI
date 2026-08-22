import asyncio
import json
import uuid
from datetime import datetime, timezone

import razorpay
from app.config.config import settings
from app.controllers import user_controller
from app.models import appointment_model, doctor_model, payment_transaction_model as pt_model
from app.utils.app_logger import get_logger
from app.utils.ownership import load_payment_for_user, row_owned_by, unauthorized

log = get_logger(__name__)

razorpay_client = (
    razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET
    else None
)


def is_razorpay_test_mode() -> bool:
    key = (settings.RAZORPAY_KEY_ID or "").strip()
    return key.startswith("rzp_test_")


def razorpay_mock_enabled() -> bool:
    """Mock checkout is DEBUG-only so production never silently skips payment."""
    return bool(settings.DEBUG and settings.RAZORPAY_MOCK)


def _is_mock_order_id(order_id: str | None) -> bool:
    return bool(order_id and str(order_id).startswith("order_mock_"))


def _require_client():
    if razorpay_mock_enabled():
        return
    if not razorpay_client:
        raise RuntimeError("Razorpay not configured")


def _normalize_symptoms_list(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass
        return [text]
    return []


def _booking_symptoms(pending: dict) -> list[str]:
    symptoms = _normalize_symptoms_list(pending.get("symptoms"))
    notes = (pending.get("notes") or "").strip()
    if notes:
        note_entry = f"Note: {notes}"
        if note_entry not in symptoms and notes not in symptoms:
            symptoms.append(note_entry)
    return symptoms


def _with_camel_aliases(payload: dict) -> dict:
    """Additive camelCase mirrors for payment payloads (keep snake_case)."""
    if not isinstance(payload, dict):
        return payload
    out = dict(payload)
    pairs = (
        ("order_id", "orderId"),
        ("razorpay_key", "razorpayKey"),
        ("razorpay_order_id", "razorpayOrderId"),
        ("razorpay_payment_id", "razorpayPaymentId"),
        ("checkout_token", "checkoutToken"),
        ("appointment_id", "appointmentId"),
        ("doctor_name", "doctorName"),
        ("amount_paise", "amountPaise"),
        ("order_status", "orderStatus"),
    )
    for snake, camel in pairs:
        if snake in out and camel not in out:
            out[camel] = out[snake]
    return out


def get_razorpay_key():
    if razorpay_mock_enabled():
        return {
            "success": True,
            "key_id": "rzp_test_mock",
            "test_mode": True,
            "mock": True,
        }
    if not settings.RAZORPAY_KEY_ID:
        return {"success": False, "message": "Razorpay not configured"}
    return {
        "success": True,
        "key_id": settings.RAZORPAY_KEY_ID,
        "test_mode": is_razorpay_test_mode(),
    }


def _js_str(value: str) -> str:
    return json.dumps(value or "")


def _amount_to_paise(amount_raw) -> int:
    """Appointment create-order amounts are always paise (Flutter sends fee×100)."""
    return max(0, int(round(float(amount_raw or 0))))


def _appointment_inr_to_paise(amount_inr) -> int:
    """`appointments.amount` is stored in INR (rupees) — convert once to paise."""
    return max(0, int(round(float(amount_inr or 0) * 100)))


async def create_order_for_existing_appointment(appointment_id: int):
    """Pay an already-booked appointment. DB amount is INR → Razorpay paise."""
    try:
        from app.models import appointment_model
        if appointment_id is None:
            return {"success": False, "message": "appointmentId required"}
        _require_client()
        appointment = await appointment_model.get_appointment_by_id(int(appointment_id))
        if not appointment or appointment.get("cancelled"):
            return {"success": False, "message": "Invalid appointment"}

        amount_paise = _appointment_inr_to_paise(appointment.get("amount"))
        if amount_paise < 100:
            return {"success": False, "message": "Minimum amount is ₹1"}

        order_data = {
            "amount": amount_paise,
            "currency": settings.CURRENCY or "INR",
            "receipt": str(appointment["id"]),
            "notes": {"appointmentId": str(appointment["id"])},
            "payment_capture": 1,
        }
        checkout_token = uuid.uuid4().hex
        if razorpay_mock_enabled():
            order_id = f"order_mock_{uuid.uuid4().hex[:12]}"
            order = {
                "id": order_id,
                "amount": amount_paise,
                "currency": order_data["currency"],
                "key_id": settings.RAZORPAY_KEY_ID or "rzp_test_mock",
            }
        else:
            order = await asyncio.to_thread(razorpay_client.order.create, data=order_data)
            order_id = order["id"]
            order["key_id"] = settings.RAZORPAY_KEY_ID

        await pt_model.create_pending(
            razorpay_order_id=order_id,
            amount_paise=amount_paise,
            checkout_token=checkout_token,
            currency=order_data["currency"],
            doctor_name=(appointment.get("docData") or {}).get("name") or "Doctor",
            appointment_id=str(appointment["id"]),
            user_id=appointment.get("user_id") or appointment.get("userId"),
            booking_metadata={"existing_appointment": True, "appointment_id": str(appointment["id"])},
        )

        return {"success": True, "order": order, "order_id": order_id}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def create_order(amount_paise: float, currency: str = "INR", receipt: str | None = None):
    """Generic Razorpay order. `amount_paise` is always paise (same contract as create-appointment-order)."""
    try:
        _require_client()
        amount_paise_i = _amount_to_paise(amount_paise)
        if amount_paise_i < 100:
            return {"success": False, "message": "Minimum amount is ₹1 (100 paise)"}

        order_data = {
            "amount": amount_paise_i,
            "currency": currency or (settings.CURRENCY or "INR"),
            "payment_capture": 1,
        }
        if receipt:
            order_data["receipt"] = receipt

        # Razorpay SDK is blocking (uses requests) — run off the event loop.
        order = await asyncio.to_thread(razorpay_client.order.create, data=order_data)
        order_id = order.get("id")
        checkout_token = uuid.uuid4().hex
        await pt_model.create_pending(
            razorpay_order_id=order_id,
            amount_paise=amount_paise_i,
            checkout_token=checkout_token,
            currency=order.get("currency", currency),
            doctor_name="MedClues Payment",
            booking_metadata={"simple": True},
        )

        return _with_camel_aliases({
            "success": True,
            "order_id": order_id,
            "amount": order.get("amount"),
            "currency": order.get("currency", currency),
            "razorpay_key": settings.RAZORPAY_KEY_ID,
            "checkout_token": checkout_token,
        })
    except Exception as e:
        return {"success": False, "message": str(e)}


async def create_appointment_order(user_id: int, body: dict):
    try:
        doctor_id = body.get("doctor_id")
        if not doctor_id:
            return {"success": False, "message": "doctor_id is required"}

        amount_paise = _amount_to_paise(body.get("amount", 0))
        if amount_paise < 100:
            return {"success": False, "message": "Minimum amount is ₹1"}

        actual_patient = body.get("actualPatient") or body.get("actual_patient") or {"isSelf": True}

        # Same active-appointment policy as pay-on-visit — before Razorpay opens.
        from app.services.appointment_lifecycle_service import (
            AppointmentPolicyError,
            assert_can_book,
        )

        try:
            await assert_can_book(user_id, actual_patient=actual_patient)
        except AppointmentPolicyError as exc:
            return {
                "success": False,
                "message": exc.message,
                "code": getattr(exc, "code", None) or "POLICY_VIOLATION",
            }

        doc = await doctor_model.get_doctor_by_id(doctor_id)
        doctor_name = (doc or {}).get("name") or "Doctor"

        from app.models import user_model
        user = await user_model.get_user_by_id(user_id) or {}

        receipt = f"mc_{user_id}_{uuid.uuid4().hex[:10]}"
        symptoms = _normalize_symptoms_list(body.get("symptoms"))
        booking_notes = str(body.get("notes") or "")[:200]
        mode = "online" if str(body.get("mode") or "").lower() == "online" else "offline"
        visit_type = "online" if mode == "online" else "in-clinic"

        use_mock = razorpay_mock_enabled()
        if not use_mock:
            try:
                _require_client()
                order = await asyncio.to_thread(
                    razorpay_client.order.create,
                    data={
                        "amount": amount_paise,
                        "currency": body.get("currency", "INR"),
                        "payment_capture": 1,
                        "receipt": receipt,
                        "notes": {
                            "doctor_id": str(doctor_id),
                            "user_id": str(user_id),
                            "appointment_date": str(body.get("appointment_date") or ""),
                            "appointment_time": str(body.get("appointment_time") or ""),
                            "slot_id": str(body.get("slot_id") or body.get("slotId") or ""),
                            "slot_type": str(body.get("slot_type") or body.get("slotType") or ""),
                            "mode": mode,
                            "visit_type": visit_type,
                            "booking_notes": booking_notes,
                            "symptoms": json.dumps(symptoms)[:500],
                        },
                    },
                )
            except Exception as e:
                # Dead/mismatched keys: fall back to mock only in local DEBUG.
                if settings.DEBUG and "authentication" in str(e).lower():
                    log.warning(
                        "Razorpay Authentication failed — using local mock payment (DEBUG). "
                        "Replace RAZORPAY_KEY_ID/SECRET or set RAZORPAY_MOCK=true."
                    )
                    use_mock = True
                    order = {
                        "id": f"order_mock_{uuid.uuid4().hex[:16]}",
                        "amount": amount_paise,
                        "currency": body.get("currency", "INR"),
                    }
                else:
                    raise
        else:
            order = {
                "id": f"order_mock_{uuid.uuid4().hex[:16]}",
                "amount": amount_paise,
                "currency": body.get("currency", "INR"),
            }

        order_id = order.get("id")
        appointment_id = f"pending_{order_id}"
        checkout_token = uuid.uuid4().hex

        await pt_model.create_pending(
            razorpay_order_id=order_id,
            amount_paise=amount_paise,
            checkout_token=checkout_token,
            currency=body.get("currency", "INR"),
            user_id=user_id,
            doctor_id=str(doctor_id),
            doctor_name=doctor_name,
            customer_name=(user.get("name") or "").strip(),
            customer_email=(user.get("email") or "").strip(),
            customer_phone=(user.get("phone") or "").strip(),
            appointment_id=appointment_id,
            booking_metadata={
                "doctor_id": str(doctor_id),
                "appointment_date": body.get("appointment_date"),
                "appointment_time": body.get("appointment_time"),
                "visit_type": visit_type,
                "mode": mode,
                "slot_id": body.get("slot_id") or body.get("slotId"),
                "slot_type": body.get("slot_type") or body.get("slotType"),
                "notes": body.get("notes") or "",
                "symptoms": symptoms,
                "actual_patient": actual_patient,
                "mock": use_mock,
            },
        )

        return _with_camel_aliases({
            "success": True,
            "order_id": order_id,
            "amount": order.get("amount"),
            "currency": order.get("currency", "INR"),
            "razorpay_key": "rzp_test_mock" if use_mock else settings.RAZORPAY_KEY_ID,
            "doctor_name": doctor_name,
            "appointment_id": appointment_id,
            "checkout_token": checkout_token,
            "mock": use_mock,
        })
    except Exception as e:
        msg = str(e)
        if "authentication" in msg.lower():
            msg = (
                f"{msg}. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET "
                "are a matching test or live pair."
            )
        return {"success": False, "message": msg}


async def _resolve_pending_order(order_id: str) -> dict | None:
    row = await pt_model.get_by_order_id(order_id)
    if row:
        return pt_model.row_to_pending(row)

    try:
        _require_client()
        order = await asyncio.to_thread(razorpay_client.order.fetch, order_id)
        notes = order.get("notes") or {}
        user_id = int(notes.get("user_id") or 0)
        doctor_id = notes.get("doctor_id")
        if not user_id or not doctor_id:
            return None
        doc = await doctor_model.get_doctor_by_id(doctor_id)
        restored = await pt_model.upsert_from_razorpay_notes(
            razorpay_order_id=order_id,
            amount_paise=int(order.get("amount") or 0),
            notes=notes,
            doctor_name=(doc or {}).get("name") or "Doctor",
        )
        if restored:
            return pt_model.row_to_pending(restored)
    except Exception as e:
        log.warning("Could not restore pending order %s: %s", order_id, e)
    return None


async def verify_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
):
    try:
        # Local DEBUG mock orders never hit Razorpay.
        if settings.DEBUG and _is_mock_order_id(razorpay_order_id):
            if (
                razorpay_signature == "mock_signature"
                or str(razorpay_payment_id or "").startswith("pay_mock_")
            ):
                return {"success": True, "mock": True}
            return {"success": False, "message": "Invalid mock payment signature"}

        _require_client()
        params = {
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        }
        razorpay_client.utility.verify_payment_signature(params)
        return {"success": True}
    except Exception:
        return {"success": False, "message": "Invalid payment signature"}


async def _refund_payment_best_effort(razorpay_payment_id: str, *, reason: str = "") -> bool:
    """Best-effort full refund when booking cannot proceed after capture."""
    if not razorpay_payment_id or str(razorpay_payment_id).startswith("pay_mock_"):
        return False
    if not razorpay_client:
        return False
    try:
        await asyncio.to_thread(
            razorpay_client.payment.refund,
            razorpay_payment_id,
            {"speed": "normal", "notes": {"reason": (reason or "booking_failed")[:40]}},
        )
        log.info(
            "razorpay_refund_ok payment_id=%s reason=%s",
            razorpay_payment_id,
            reason,
        )
        return True
    except Exception as exc:
        log.error(
            "razorpay_refund_failed payment_id=%s reason=%s err=%s",
            razorpay_payment_id,
            reason,
            exc,
        )
        return False


async def _book_after_payment(user_id: int, pending: dict, razorpay_order_id: str, razorpay_payment_id: str):
    pending_owner = pending.get("user_id")
    if pending_owner is not None and not row_owned_by({"user_id": pending_owner}, user_id):
        return unauthorized("Unauthorized payment")

    claim = await pt_model.claim_for_fulfillment(razorpay_order_id)
    kind = claim.get("kind")

    if kind == "paid":
        row = claim["row"]
        return {
            "success": True,
            "appointment_id": row.get("appointment_id"),
            "appointmentId": row.get("appointment_id"),
            "message": "Payment already processed",
            "payment": pt_model.row_to_payment_record(row),
        }
    if kind == "missing":
        return {"success": False, "message": "Order not found or already processed"}
    if kind == "failed":
        return {"success": False, "message": "Payment previously failed"}
    if kind == "processing":
        existing = await pt_model.get_paid_by_order_id(razorpay_order_id)
        if existing:
            return {
                "success": True,
                "appointment_id": existing.get("appointment_id"),
                "appointmentId": existing.get("appointment_id"),
                "message": "Payment already processed",
            }
        return {
            "success": False,
            "message": "Payment is being processed, please retry shortly",
        }

    if pending.get("simple"):
        paid_row = await pt_model.mark_paid(razorpay_order_id, razorpay_payment_id)
        record = pt_model.row_to_payment_record(paid_row or {})
        return {
            "success": True,
            "message": "Payment successful",
            "payment": record,
        }

    # Pharmacy catalog / billed order checkout (no appointment booking).
    if pending.get("kind") == "pharmacy_order" or pending.get("pharmacy_order_id"):
        from app.services import pharmacy_service

        pharmacy_order_id = int(pending.get("pharmacy_order_id") or 0)
        if not pharmacy_order_id:
            await pt_model.release_claim(razorpay_order_id)
            return {"success": False, "message": "Pharmacy order id missing on payment"}
        result = await pharmacy_service.mark_order_paid_from_transaction(
            user_id,
            pharmacy_order_id,
            razorpay_order_id,
            razorpay_payment_id,
        )
        if not result.get("success"):
            await pt_model.release_claim(razorpay_order_id)
            return result
        return {
            "success": True,
            "message": "Pharmacy payment successful",
            "pharmacy_order_id": pharmacy_order_id,
            "pharmacyOrderId": pharmacy_order_id,
            "data": result.get("data"),
        }

    visit = pending.get("visit_type") or "online"
    mode = pending.get("mode") or ("online" if visit == "online" else "offline")
    book_body = {
        "docId": pending["doctor_id"],
        "slotDate": pending["appointment_date"],
        "slotTime": pending["appointment_time"],
        "symptoms": _booking_symptoms(pending),
        "paymentMethod": "razorpay",
        "mode": mode,
        "visitType": "Online" if visit == "online" else "In-clinic",
        "actualPatient": pending.get("actual_patient") or {"isSelf": True},
    }
    if pending.get("slot_id"):
        book_body["slotId"] = pending["slot_id"]
    if pending.get("slot_type"):
        book_body["slotType"] = pending["slot_type"]

    try:
        booked = await user_controller.book_appointment(user_id, book_body)
        if not booked.get("success", True) and booked.get("message"):
            await pt_model.release_claim(razorpay_order_id)
            fail_msg = str(booked.get("message") or "Booking failed after payment")
            refunded = await _refund_payment_best_effort(
                razorpay_payment_id,
                reason="booking_policy_blocked",
            )
            if refunded:
                fail_msg = f"{fail_msg} Your payment is being refunded automatically."
            else:
                fail_msg = (
                    f"{fail_msg} Payment was captured — contact support with "
                    f"payment id {razorpay_payment_id} for a refund."
                )
            return {
                "success": False,
                "message": fail_msg,
                "paymentCaptured": True,
                "refundInitiated": refunded,
            }

        real_appointment_id = (
            booked.get("appointmentId")
            or booked.get("appointment_id")
            or booked.get("id")
            or pending.get("appointment_id")
        )

        try:
            await appointment_model.update_appointment(
                int(real_appointment_id),
                {
                    "payment": True,
                    "paymentStatus": "paid",
                    "transactionId": razorpay_payment_id,
                    "paymentMethod": "razorpay",
                },
            )
            from app.services import appointment_lifecycle_service
            await appointment_lifecycle_service.mark_paid_confirmed(int(real_appointment_id))
        except Exception as e:
            log.warning("Could not mark appointment paid: %s", e)

        # Consultation/Agora session is set up on demand when the call starts,
        # so create it in the background to keep the payment response fast.
        async def _setup_consultation_bg(uid: int, aid: int):
            try:
                from app.controllers import consultation_controller
                await consultation_controller.ensure_consultation_for_appointment(uid, aid)
            except Exception as consult_err:
                log.warning("Video consultation session setup: %s", consult_err)

        if mode == "online":
            asyncio.create_task(_setup_consultation_bg(user_id, int(real_appointment_id)))

        paid_row = await pt_model.mark_paid(
            razorpay_order_id,
            razorpay_payment_id,
            str(real_appointment_id),
        )
        record = pt_model.row_to_payment_record(paid_row or {})

        return {
            "success": True,
            "appointment_id": str(real_appointment_id),
            "appointmentId": real_appointment_id,
            "publicId": booked.get("publicId") or booked.get("public_id"),
            "bookingId": booked.get("bookingId"),
            "tokenNumber": booked.get("tokenNumber"),
            "message": "Payment successful",
            "payment": record,
        }
    except Exception as e:
        await pt_model.release_claim(razorpay_order_id)
        raise e


async def verify_appointment_payment(
    user_id: int | None,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    appointment_id: str | None = None,
):
    verified = await verify_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature
    )
    if not verified.get("success"):
        return verified

    existing = await pt_model.get_paid_by_order_id(razorpay_order_id)
    if existing:
        return {
            "success": True,
            "appointment_id": existing.get("appointment_id") or appointment_id,
            "appointmentId": existing.get("appointment_id") or appointment_id,
            "message": "Payment already processed",
        }

    target_apt_id = appointment_id
    pending = await _resolve_pending_order(razorpay_order_id)
    if pending and not target_apt_id:
        target_apt_id = pending.get("appointment_id")

    if target_apt_id and str(target_apt_id).isdigit():
        apt_id_int = int(target_apt_id)
        try:
            await appointment_model.update_appointment(
                apt_id_int,
                {
                    "payment": True,
                    "paymentStatus": "paid",
                    "transactionId": razorpay_payment_id,
                    "paymentMethod": "razorpay",
                },
            )
            from app.services import appointment_lifecycle_service
            await appointment_lifecycle_service.mark_paid_confirmed(apt_id_int)
        except Exception as e:
            log.warning("Could not mark appointment paid: %s", e)

        paid_row = await pt_model.mark_paid(
            razorpay_order_id,
            razorpay_payment_id,
            str(apt_id_int),
        )
        record = pt_model.row_to_payment_record(paid_row or {})
        return {
            "success": True,
            "appointment_id": str(apt_id_int),
            "appointmentId": apt_id_int,
            "message": "Payment successful",
            "payment": record,
        }

    if not pending:
        return {"success": False, "message": "Order not found or already processed"}
    if user_id is not None and pending.get("user_id") not in (None, user_id):
        return {"success": False, "message": "Unauthorized payment verification"}

    effective_uid = user_id if user_id is not None else (pending.get("user_id") or 0)
    return await _book_after_payment(effective_uid, pending, razorpay_order_id, razorpay_payment_id)


async def get_order_status(user_id: int, order_id: str):
    """Check Razorpay order status (paid / pending / failed)."""
    row = await pt_model.get_by_order_id(order_id)
    if row and row.get("user_id") not in (None, user_id):
        return {"success": False, "message": "Unauthorized"}

    if _is_mock_order_id(order_id):
        paid = bool(row and row.get("status") == "paid")
        pending = pt_model.row_to_pending(row) if row else None
        return {
            "success": True,
            "order_id": order_id,
            "order_status": "paid" if paid else "created",
            "paid": paid,
            "failed": False,
            "amount_paise": int((row or {}).get("amount_paise") or 0),
            "amount_paid_paise": int((row or {}).get("amount_paise") or 0) if paid else 0,
            "payment_id": (row or {}).get("razorpay_payment_id"),
            "pending_in_app": bool(row and row.get("status") == "pending"),
            "doctor_name": (pending or {}).get("doctor_name") or (row or {}).get("doctor_name"),
            "mock": True,
        }

    try:
        _require_client()
        order, payments_res = await asyncio.gather(
            asyncio.to_thread(razorpay_client.order.fetch, order_id),
            asyncio.to_thread(razorpay_client.order.payments, order_id),
        )
        items = payments_res.get("items") or []
        captured = next((p for p in items if p.get("status") == "captured"), None)
        failed = next((p for p in items if p.get("status") == "failed"), None)
        order_status = order.get("status")
        amount_paid = int(order.get("amount_paid") or 0)
        amount_due = int(order.get("amount_due") or 0)
        paid = order_status == "paid" or captured is not None or amount_due == 0 and amount_paid > 0

        pending = pt_model.row_to_pending(row) if row else None
        return {
            "success": True,
            "order_id": order_id,
            "order_status": order_status,
            "paid": paid,
            "failed": failed is not None and not paid,
            "amount_paise": int(order.get("amount") or 0),
            "amount_paid_paise": amount_paid,
            "payment_id": (captured or {}).get("id"),
            "pending_in_app": bool(row and row.get("status") == "pending"),
            "doctor_name": (pending or {}).get("doctor_name") or (row or {}).get("doctor_name"),
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


async def confirm_paid_order(user_id: int, order_id: str):
    """Complete booking when Razorpay confirms payment (no manual signature paste)."""
    status = await get_order_status(user_id, order_id)
    if not status.get("success"):
        return status
    if status.get("failed"):
        return {"success": False, "message": "Payment failed at Razorpay", "paid": False}
    if not status.get("paid"):
        return {
            "success": False,
            "message": "Payment not completed yet. Finish payment in Razorpay checkout.",
            "paid": False,
            "order_status": status.get("order_status"),
        }

    existing = await pt_model.get_paid_by_order_id(order_id)
    if existing:
        return {
            "success": True,
            "paid": True,
            "appointment_id": existing.get("appointment_id"),
            "appointmentId": existing.get("appointment_id"),
            "message": "Appointment already booked for this payment",
        }

    pending = await _resolve_pending_order(order_id)
    if not pending:
        return {
            "success": False,
            "message": "Payment received but booking session expired. Tap 'I've paid' in the app or contact support with your order ID.",
            "paid": True,
        }
    if pending.get("user_id") != user_id:
        return {"success": False, "message": "Unauthorized"}

    payment_id = status.get("payment_id")
    if not payment_id:
        return {"success": False, "message": "Payment ID not found on Razorpay order"}

    result = await _book_after_payment(user_id, pending, order_id, payment_id)
    result["paid"] = True
    return result


async def complete_checkout_payment(
    checkout_token: str,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
):
    """Called from hosted checkout page right after Razorpay success."""
    row = await pt_model.get_by_checkout_token(checkout_token)
    if not row or row.get("razorpay_order_id") != razorpay_order_id:
        return {"success": False, "message": "Invalid or expired checkout session"}

    verified = await verify_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature
    )
    if not verified.get("success"):
        return verified

    user_id = int(row.get("user_id") or 0)
    if not user_id:
        return {"success": False, "message": "Checkout session has no user id"}
    existing = await pt_model.get_paid_by_order_id(razorpay_order_id)
    if existing:
        return {
            "success": True,
            "appointment_id": existing.get("appointment_id"),
            "appointmentId": existing.get("appointment_id"),
            "bookingId": None,
            "message": "Appointment already booked",
        }

    pending = await _resolve_pending_order(razorpay_order_id)
    if not pending:
        return {
            "success": False,
            "message": "Could not restore booking details. Return to the app and tap I've paid.",
        }

    return await _book_after_payment(
        user_id, pending, razorpay_order_id, razorpay_payment_id
    )


async def record_failed_payment(
    order_id: str,
    appointment_id: str | None,
    error: str,
    user_id: int | None = None,
):
    if user_id is not None and order_id:
        _, err = await load_payment_for_user(order_id, int(user_id))
        if err:
            return err

    row = await pt_model.mark_failed(
        order_id,
        error or "Payment failed",
        user_id=user_id,
        appointment_id=appointment_id,
    )
    if not row:
        pending = await pt_model.get_by_order_id(order_id)
        record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id or (pending or {}).get("user_id"),
            "order_id": order_id,
            "appointment_id": appointment_id or (pending or {}).get("appointment_id"),
            "status": "failed",
            "error": error or "Payment failed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return {"success": True, "message": "Payment failure recorded", "payment": record}
    return {
        "success": True,
        "message": "Payment failure recorded",
        "payment": pt_model.row_to_payment_record(row),
    }


async def get_checkout_html(checkout_token: str, preferred_upi: str | None = None) -> str | None:
    row = await pt_model.get_by_checkout_token(checkout_token)
    if not row or not settings.RAZORPAY_KEY_ID:
        return None

    pending = pt_model.row_to_pending(row)
    order_id = row.get("razorpay_order_id")
    key = settings.RAZORPAY_KEY_ID
    amount = pending.get("amount_paise", 0)
    doctor_name = pending.get("doctor_name", "Doctor")
    description = f"Consultation with {doctor_name}".replace('"', "&quot;")
    prefill_name = _js_str(pending.get("customer_name") or "")
    prefill_email = _js_str(pending.get("customer_email") or "")
    prefill_contact = _js_str(pending.get("customer_phone") or "")
    checkout_token_js = _js_str(checkout_token)
    from app.utils.mobile_links import deep_link_schemes

    schemes = deep_link_schemes()
    primary_scheme = schemes[0]

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MedClues Payment</title>
  <style>
    body {{ font-family: system-ui, sans-serif; background: #0B0B0B; margin: 0; padding: 24px; text-align: center; }}
    h1 {{ color: #F5F5F5; font-size: 22px; }}
    p {{ color: #A3A3A3; }}
    .loader {{ margin: 40px auto; width: 48px; height: 48px; border: 4px solid #2E2E2E; border-top-color: #38BDF8; border-radius: 50%; animation: spin 0.8s linear infinite; }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
  </style>
</head>
<body>
  <h1>MedClues</h1>
  <p id="status-msg">Opening secure Razorpay checkout…</p>
  <div class="loader" id="loader"></div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function goApp(query) {{
      try {{ window.location.href = "{primary_scheme}://payment" + (query || ""); }} catch (e) {{}}
    }}
    function showSuccess(response, data) {{
      document.body.innerHTML =
        '<div style="max-width:480px;margin:40px auto;padding:24px;background:#ECFDF5;border:1px solid #86EFAC;border-radius:16px;">' +
        '<h1 style="color:#16A34A;margin:0 0 12px;">Payment &amp; booking successful</h1>' +
        '<p style="color:#166534;line-height:1.5;">Close this tab and return to <strong>MedClues</strong>. Your appointment confirmation should appear automatically.</p>' +
        '<p style="font-size:12px;color:#64748B;margin-top:16px;">Order: ' + response.razorpay_order_id + '</p>' +
        (data.publicId ? '<p style="font-size:12px;color:#64748B;">Appointment ID: ' + data.publicId + '</p>' : '') +
        (data.bookingId ? '<p style="font-size:12px;color:#64748B;">Receipt / QR: ' + data.bookingId + '</p>' : '') +
        '</div>';
    }}
    function confirmCheckout(response, attempt) {{
      var token = {checkout_token_js};
      document.getElementById("loader").style.display = "block";
      document.getElementById("status-msg").textContent =
        attempt > 0
          ? "Confirming payment… (retry " + attempt + ")"
          : "Payment received — confirming your appointment…";
      return fetch("/api/payments/checkout-complete", {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify({{
          checkout_token: token,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        }})
      }})
      .then(function (r) {{ return r.json(); }})
      .then(function (data) {{
        if (data.success) {{
          document.getElementById("loader").style.display = "none";
          showSuccess(response, data);
          return;
        }}
        var msg = (data.message || "Booking could not be confirmed").toString();
        var busy = /being processed|retry shortly/i.test(msg);
        if (busy && attempt < 3) {{
          return new Promise(function (resolve) {{
            setTimeout(function () {{ resolve(confirmCheckout(response, attempt + 1)); }}, 1200 * (attempt + 1));
          }});
        }}
        document.getElementById("loader").style.display = "none";
        document.getElementById("status-msg").textContent =
          msg + " — return to the app and tap I've paid.";
      }})
      .catch(function () {{
        if (attempt < 3) {{
          return new Promise(function (resolve) {{
            setTimeout(function () {{ resolve(confirmCheckout(response, attempt + 1)); }}, 1200 * (attempt + 1));
          }});
        }}
        document.getElementById("loader").style.display = "none";
        document.getElementById("status-msg").textContent =
          "Payment succeeded but booking confirm failed — return to the app and tap I've paid.";
      }});
    }}
    var options = {{
      key: "{key}",
      amount: {amount},
      currency: "INR",
      name: "MedClues",
      description: "{description}",
      order_id: "{order_id}",
      method: {{
        upi: true,
        card: true,
        netbanking: true,
        wallet: true
      }},
      config: {{
        display: {{
          sequence: ["upi", "card", "netbanking", "wallet"],
          preferences: {{ show_default_blocks: true }}
        }}
      }},
      prefill: {{
        name: {prefill_name},
        email: {prefill_email},
        contact: {prefill_contact},
        method: "upi"
      }},
      handler: function (response) {{
        confirmCheckout(response, 0);
      }},
      modal: {{
        ondismiss: function () {{
          document.body.innerHTML =
            '<h1>Payment cancelled</h1>' +
            '<p>Close this tab and tap <b>Cancel payment</b> in the app.</p>';
          try {{ goApp("?cancelled=1"); }} catch (e) {{}}
          try {{ window.close(); }} catch (e) {{}}
        }}
      }},
      theme: {{ color: "#1A1A1A" }}
    }};
    var rzp = new Razorpay(options);
    rzp.on("payment.failed", function (resp) {{
      var msg = (resp && resp.error && resp.error.description) ? resp.error.description : "Payment failed";
      if (/international/i.test(msg)) {{
        msg += " — Use Indian test card 5267 3181 8797 5449 or UPI ID success@razorpay (test mode).";
      }}
      if (/authentication/i.test(msg)) {{
        msg += " — Razorpay Key ID and Secret must be a matching test or live pair.";
      }}
      document.getElementById("loader").style.display = "none";
      document.getElementById("status-msg").textContent = msg;
      goApp("?failed=1");
    }});
    rzp.open();
  </script>
</body>
</html>"""


async def get_payment_history(
    user_id: int | None = None,
    *,
    limit: int | None = None,
    offset: int = 0,
):
    from app.utils.pagination import paginate_items, pagination_meta, with_pagination

    seen_orders: set[str] = set()
    items: list[dict] = []

    if user_id is not None:
        for row in await pt_model.list_for_user(user_id, limit=50):
            oid = row.get("razorpay_order_id")
            if oid:
                seen_orders.add(oid)
            items.append(pt_model.row_to_payment_record(row))

    if user_id is not None:
        try:
            appts = await appointment_model.get_appointments_by_user_id(user_id)
            for apt in appts:
                method = (apt.get("payment_method") or "").lower()
                if not apt.get("payment") and method not in ("razorpay", "onlinepayment", "online"):
                    continue
                txn = apt.get("transaction_id") or f"apt_{apt['id']}"
                if txn in seen_orders:
                    continue
                seen_orders.add(txn)
                doc_data = apt.get("doctor_data")
                doctor_name = None
                if isinstance(doc_data, str):
                    try:
                        doctor_name = json.loads(doc_data).get("name")
                    except Exception:
                        pass
                elif isinstance(doc_data, dict):
                    doctor_name = doc_data.get("name")
                items.append({
                    "id": f"apt_{apt['id']}",
                    "user_id": user_id,
                    "order_id": txn,
                    "payment_id": apt.get("transaction_id"),
                    "appointment_id": str(apt["id"]),
                    "doctor_name": doctor_name,
                    "amount_inr": float(apt.get("amount") or 0),
                    "status": "paid" if apt.get("payment") else "pending",
                    "created_at": (
                        apt.get("created_at").isoformat()
                        if hasattr(apt.get("created_at"), "isoformat")
                        else str(apt.get("created_at") or "")
                    ),
                })
        except Exception as e:
            log.warning("payment history DB merge: %s", e)

    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    effective_limit = limit if limit is not None else 50
    total = len(items)
    page = paginate_items(items, effective_limit, offset)
    payload = {"success": True, "payments": page}
    if limit is not None:
        return with_pagination(
            payload,
            pagination_meta(
                total=total,
                limit=effective_limit,
                offset=offset,
                returned=len(page),
            ),
        )
    return payload


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    secret = (getattr(settings, "RAZORPAY_WEBHOOK_SECRET", None) or "").strip()
    if not secret or not razorpay_client:
        return False
    try:
        razorpay_client.utility.verify_webhook_signature(body.decode("utf-8"), signature, secret)
        return True
    except Exception:
        return False


async def handle_razorpay_webhook(payload: dict) -> dict:
    """Process Razorpay webhook events (payment.captured / payment.failed)."""
    event = payload.get("event") or ""
    entity_container = payload.get("payload") or {}

    if event == "payment.captured":
        payment = (entity_container.get("payment") or {}).get("entity") or {}
        order_id = payment.get("order_id")
        payment_id = payment.get("id")
        if not order_id or not payment_id:
            return {"success": False, "message": "Missing order or payment id"}

        existing = await pt_model.get_paid_by_order_id(order_id)
        if existing:
            return {"success": True, "message": "Already processed", "duplicate": True}

        pending = await _resolve_pending_order(order_id)
        if not pending:
            return {"success": True, "message": "No booking metadata for order", "skipped": True}
        if pending.get("simple"):
            await pt_model.mark_paid(order_id, payment_id)
            return {"success": True, "message": "Simple payment recorded"}

        user_id = pending.get("user_id")
        if not user_id:
            return {"success": True, "message": "No user on order", "skipped": True}

        result = await _book_after_payment(int(user_id), pending, order_id, payment_id)
        return result

    if event == "payment.failed":
        payment = (entity_container.get("payment") or {}).get("entity") or {}
        order_id = payment.get("order_id")
        error = (payment.get("error_description") or payment.get("error_reason") or "Payment failed")
        if order_id:
            await pt_model.mark_failed(order_id, error)
        return {"success": True, "message": "Failure recorded"}

    return {"success": True, "message": f"Event ignored: {event}"}
