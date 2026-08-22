from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from app.controllers import payments_controller
from app.middleware.auth import auth_user

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post("/checkout-complete")
async def checkout_complete(req: Request):
    body = await req.json()
    return await payments_controller.complete_checkout_payment(
        body.get("checkout_token") or "",
        body.get("razorpay_order_id") or "",
        body.get("razorpay_payment_id") or "",
        body.get("razorpay_signature") or "",
    )


@router.post("/webhook")
async def razorpay_webhook(req: Request):
    """Razorpay server-to-server webhook (configure in Razorpay Dashboard)."""
    body = await req.body()
    signature = req.headers.get("X-Razorpay-Signature") or ""
    if not payments_controller.verify_webhook_signature(body, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    import json
    payload = json.loads(body.decode("utf-8"))
    result = await payments_controller.handle_razorpay_webhook(payload)
    return JSONResponse(content=result)


@router.get("/checkout")
async def payment_checkout(token: str, preferred_upi: str | None = None):
    html = await payments_controller.get_checkout_html(token, preferred_upi=preferred_upi)
    if not html:
        return HTMLResponse(
            "<h2>Invalid or expired payment link</h2><p>Please return to the app and try again.</p>",
            status_code=404,
        )
    return HTMLResponse(content=html)


@router.get("/razorpay-key")
async def razorpay_key():
    return payments_controller.get_razorpay_key()


@router.post("/create-order")
async def create_order(req: Request, user_id: int = Depends(auth_user)):
    from app.schemas.payments import CreateOrderRequest
    from app.utils.validation import validate_body

    body = await req.json()
    parsed = validate_body(CreateOrderRequest, body)
    if hasattr(parsed, "status_code"):
        return parsed
    data = parsed.model_dump(by_alias=False)
    # Preserve camelCase keys the controller also accepts.
    if data.get("actual_patient") is not None:
        data["actualPatient"] = data["actual_patient"]
    if data.get("doctor_id"):
        return await payments_controller.create_appointment_order(user_id, data)

    amount = data.get("amount")
    currency = data.get("currency", "INR")
    receipt = data.get("receipt")
    # amount is always paise
    return await payments_controller.create_order(amount, currency, receipt)


@router.post("/appointment-order")
async def appointment_payment_order(req: Request, user_id: int = Depends(auth_user)):
    """Pay for an already-booked appointment (amount in DB is INR → paise once)."""
    body = await req.json()
    return await payments_controller.create_order_for_existing_appointment(
        body.get("appointmentId") or body.get("appointment_id")
    )


@router.post("/appointment-verify")
async def appointment_payment_verify(req: Request, user_id: int = Depends(auth_user)):
    from app.controllers import user_controller
    body = await req.json()
    return await user_controller.verify_razorpay(body, user_id=user_id)


@router.post("/verify")
async def verify_payment(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    if body.get("appointment_id") or body.get("razorpay_order_id"):
        return await payments_controller.verify_appointment_payment(
            user_id,
            body.get("razorpay_order_id"),
            body.get("razorpay_payment_id"),
            body.get("razorpay_signature"),
            body.get("appointment_id"),
        )
    return await payments_controller.verify_signature(
        body.get("razorpay_order_id"),
        body.get("razorpay_payment_id"),
        body.get("razorpay_signature"),
    )


@router.post("/verify-signature")
async def verify_signature(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    if body.get("appointment_id"):
        return await payments_controller.verify_appointment_payment(
            user_id,
            body.get("razorpay_order_id"),
            body.get("razorpay_payment_id"),
            body.get("razorpay_signature"),
            body.get("appointment_id"),
        )
    return await payments_controller.verify_signature(
        body.get("razorpay_order_id"),
        body.get("razorpay_payment_id"),
        body.get("razorpay_signature"),
    )


@router.post("/failed")
async def payment_failed(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await payments_controller.record_failed_payment(
        body.get("order_id") or body.get("razorpay_order_id"),
        body.get("appointment_id"),
        body.get("error") or "Payment failed",
        user_id=user_id,
    )


@router.get("/status/{order_id}")
async def payment_status(order_id: str, user_id: int = Depends(auth_user)):
    return await payments_controller.get_order_status(user_id, order_id)


@router.post("/confirm-order")
async def confirm_order(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    order_id = body.get("order_id") or body.get("razorpay_order_id")
    if not order_id:
        return {"success": False, "message": "order_id is required"}
    return await payments_controller.confirm_paid_order(user_id, order_id)


@router.get("/history")
async def payment_history(
    user_id: int = Depends(auth_user),
    limit: int | None = None,
    offset: int = 0,
):
    from app.utils.pagination import parse_pagination

    lim, off = parse_pagination(limit, offset)
    return await payments_controller.get_payment_history(user_id, limit=lim, offset=off)
