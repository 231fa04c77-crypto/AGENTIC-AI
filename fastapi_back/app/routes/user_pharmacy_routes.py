"""Patient pharmacy APIs — JWT auth only (never calls PharmaSync directly)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from app.middleware.auth import auth_user
from app.services import pharmacy_service

router = APIRouter(prefix="/api/user/pharmacy", tags=["User Pharmacy"])


@router.get("/prescriptions")
async def list_prescriptions(user_id: int = Depends(auth_user)):
    return await pharmacy_service.list_patient_prescriptions(int(user_id))


@router.get("/search")
async def search_medicines(query: str = "", user_id: int = Depends(auth_user)):
    return await pharmacy_service.search_medicine_catalog(query)


@router.get("/catalog/categories")
async def catalog_categories(user_id: int = Depends(auth_user)):
    return await pharmacy_service.list_medicine_catalog_categories()


@router.post("/availability")
async def probe_availability(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await pharmacy_service.probe_availability(int(user_id), body or {})



@router.get("/orders")
async def list_orders(user_id: int = Depends(auth_user)):
    return await pharmacy_service.list_patient_orders(int(user_id))


@router.get("/payments")
async def list_payments(user_id: int = Depends(auth_user)):
    return await pharmacy_service.list_patient_payments(int(user_id))


@router.get("/orders/{order_id}")
async def get_order(order_id: int, user_id: int = Depends(auth_user)):
    return await pharmacy_service.get_patient_order(int(user_id), order_id)


@router.post("/orders")
async def place_order(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    body = body or {}
    # Catalog / retail cart (no prescription) vs Rx-linked hospital order.
    if body.get("items") and not (body.get("consultationId") or body.get("consultation_id")):
        return await pharmacy_service.place_catalog_order(int(user_id), body)
    return await pharmacy_service.place_order(int(user_id), body)


@router.post("/catalog-orders")
async def place_catalog_order(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await pharmacy_service.place_catalog_order(int(user_id), body or {})


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: int, req: Request, user_id: int = Depends(auth_user)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        pass
    return await pharmacy_service.cancel_patient_order(
        int(user_id), order_id, (body or {}).get("reason"),
    )


@router.post("/orders/{order_id}/refill")
async def refill_order(order_id: int, user_id: int = Depends(auth_user)):
    return await pharmacy_service.refill_order(int(user_id), order_id)


@router.post("/orders/{order_id}/pay")
async def pay_order(order_id: int, user_id: int = Depends(auth_user)):
    return await pharmacy_service.create_pay_order(int(user_id), order_id)


@router.post("/orders/{order_id}/pay/verify")
async def verify_pay(order_id: int, req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await pharmacy_service.verify_pharmacy_payment(
        int(user_id),
        order_id,
        str(body.get("razorpay_order_id") or body.get("razorpayOrderId") or ""),
        str(body.get("razorpay_payment_id") or body.get("razorpayPaymentId") or ""),
        str(body.get("razorpay_signature") or body.get("razorpaySignature") or ""),
    )


@router.get("/orders/{order_id}/invoice.pdf")
async def invoice_pdf(order_id: int, user_id: int = Depends(auth_user)):
    result = await pharmacy_service.build_invoice_pdf(int(user_id), order_id)
    if not result.get("success"):
        return result
    return Response(
        content=result["content"],
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
        },
    )
