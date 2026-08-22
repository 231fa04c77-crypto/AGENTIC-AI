"""Health Protection patient APIs — JWT only; curated plans + AI helpers."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from app.middleware.auth import auth_user
from app.models import health_protection_model as model
from app.services import health_protection_service as svc
from app.services.health_protection_service import HPError

router = APIRouter(prefix="/api/health-protection", tags=["Health Protection"])


def _err(exc: HPError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.message, "code": exc.code},
    )


@router.get("/hub")
async def get_hub(user_id: int = Depends(auth_user)):
    return await svc.hub(user_id)


@router.get("/score")
async def get_score(user_id: int = Depends(auth_user)):
    return {"success": True, "data": await svc.get_score(user_id)}


@router.post("/score/recompute")
async def recompute_score(user_id: int = Depends(auth_user)):
    return {"success": True, "data": await svc.recompute_score(user_id)}


@router.get("/companies")
async def companies(user_id: int = Depends(auth_user)):
    _ = user_id
    return {"success": True, "results": await model.list_companies()}


@router.get("/plans")
async def plans(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(auth_user),
):
    _ = user_id
    results = await model.list_plans(limit=limit, offset=offset)
    return {"success": True, "count": len(results), "results": results}


@router.get("/plans/{plan_id}")
async def plan_detail(plan_id: int, user_id: int = Depends(auth_user)):
    _ = user_id
    plan = await model.get_plan(plan_id)
    if not plan:
        return JSONResponse(status_code=404, content={"success": False, "message": "Plan not found"})
    return {"success": True, "data": plan}


@router.get("/policies")
async def policies(user_id: int = Depends(auth_user)):
    return {"success": True, "results": await model.list_user_policies(user_id)}


@router.post("/policies")
async def create_policy(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return {"success": True, "data": await model.create_policy(user_id, body or {})}


@router.patch("/policies/{policy_id}")
async def patch_policy(policy_id: int, req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    data = await model.update_policy(user_id, policy_id, body or {})
    if not data:
        return JSONResponse(status_code=404, content={"success": False, "message": "Policy not found"})
    return {"success": True, "data": data}


@router.get("/emergency-card")
async def get_card(user_id: int = Depends(auth_user)):
    card = await model.get_emergency_card(user_id)
    return {"success": True, "data": card}


@router.put("/emergency-card")
async def put_card(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return {"success": True, "data": await model.upsert_emergency_card(user_id, body or {})}


@router.get("/emergency-card/pdf")
async def card_pdf(user_id: int = Depends(auth_user)):
    card = await model.get_emergency_card(user_id)
    if not card:
        return JSONResponse(status_code=404, content={"success": False, "message": "Card not found"})
    pdf = svc.build_emergency_card_pdf(card)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=medclues_emergency_card.pdf"},
    )


@router.post("/recommend")
async def recommend(req: Request, user_id: int = Depends(auth_user)):
    try:
        body = await req.json()
        return await svc.recommend(user_id, body or {})
    except HPError as e:
        return _err(e)


@router.post("/compare")
async def compare(req: Request, user_id: int = Depends(auth_user)):
    _ = user_id
    try:
        body = await req.json()
        return await svc.compare_plans(body or {})
    except HPError as e:
        return _err(e)


@router.post("/eligibility")
async def eligibility(req: Request, user_id: int = Depends(auth_user)):
    _ = user_id
    body = await req.json()
    return await svc.check_eligibility(body or {})


@router.post("/policy/analyze")
async def analyze_policy(
    file: UploadFile = File(...),
    user_id: int = Depends(auth_user),
):
    content = await file.read()
    if not content:
        return JSONResponse(status_code=400, content={"success": False, "message": "Empty file"})
    if len(content) > 12 * 1024 * 1024:
        return JSONResponse(status_code=400, content={"success": False, "message": "File too large (max 12MB)"})

    file_url = f"local://{file.filename}"
    public_id = None
    try:
        import cloudinary.uploader

        result = cloudinary.uploader.upload(
            content,
            folder="medclues/health_protection/policies",
            resource_type="auto",
            filename_override=file.filename,
        )
        file_url = result.get("secure_url") or file_url
        public_id = result.get("public_id")
    except Exception:
        # Allow local/dev without Cloudinary — still persist analysis
        pass

    return await svc.analyze_policy(
        user_id,
        file_url=file_url,
        public_id=public_id,
        file_name=file.filename,
    )


@router.get("/policy/uploads")
async def policy_uploads(user_id: int = Depends(auth_user)):
    return {"success": True, "results": await model.list_policy_uploads(user_id)}


@router.get("/claims")
async def claims(user_id: int = Depends(auth_user)):
    return {"success": True, "results": await model.list_claims(user_id)}


@router.post("/claims")
async def create_claim(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return {"success": True, "data": await model.create_claim(user_id, body or {})}


@router.get("/claims/{claim_id}")
async def claim_detail(claim_id: int, user_id: int = Depends(auth_user)):
    data = await model.get_claim(user_id, claim_id)
    if not data:
        return JSONResponse(status_code=404, content={"success": False, "message": "Claim not found"})
    return {"success": True, "data": data}


@router.post("/claims/{claim_id}/documents")
async def claim_document(
    claim_id: int,
    doc_type: str = Form("bill"),
    file: UploadFile = File(...),
    user_id: int = Depends(auth_user),
):
    content = await file.read()
    file_url = f"local://{file.filename}"
    public_id = None
    try:
        import cloudinary.uploader

        result = cloudinary.uploader.upload(
            content,
            folder="medclues/health_protection/claims",
            resource_type="auto",
        )
        file_url = result.get("secure_url") or file_url
        public_id = result.get("public_id")
    except Exception:
        pass
    data = await model.add_claim_document(user_id, claim_id, doc_type, file_url, public_id)
    if not data:
        return JSONResponse(status_code=404, content={"success": False, "message": "Claim not found"})
    return {"success": True, "data": data}


@router.post("/claims/{claim_id}/submit")
async def submit_claim(claim_id: int, user_id: int = Depends(auth_user)):
    data = await model.submit_claim(user_id, claim_id)
    if not data:
        return JSONResponse(status_code=404, content={"success": False, "message": "Claim not found"})
    try:
        from app.services import fcm_service

        await fcm_service.send_to_user(
            user_id,
            title="Claim submitted",
            body="Your insurance claim is under review.",
            data={"type": "claim_update", "claimId": str(claim_id)},
        )
    except Exception:
        pass
    return {"success": True, "data": data}


@router.get("/cashless-hospitals")
async def cashless(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radiusKm: float = Query(25, alias="radiusKm"),
    insurer: Optional[str] = None,
    user_id: int = Depends(auth_user),
):
    _ = user_id
    results = await model.list_cashless(
        lat=lat, lng=lng, radius_km=radiusKm, insurer=insurer
    )
    return {"success": True, "count": len(results), "results": results}


@router.get("/family")
async def family(user_id: int = Depends(auth_user)):
    return {"success": True, "results": await model.list_family(user_id)}


@router.post("/family")
async def add_family(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return {"success": True, "data": await model.add_family(user_id, body or {})}


@router.patch("/family/{member_id}")
async def patch_family(member_id: int, req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    data = await model.update_family(user_id, member_id, body or {})
    if not data:
        return JSONResponse(status_code=404, content={"success": False, "message": "Member not found"})
    return {"success": True, "data": data}


@router.delete("/family/{member_id}")
async def delete_family(member_id: int, user_id: int = Depends(auth_user)):
    await model.delete_family(user_id, member_id)
    return {"success": True, "message": "Removed"}


@router.get("/expenses")
async def expenses(user_id: int = Depends(auth_user)):
    return {"success": True, "results": await model.list_expenses(user_id)}


@router.post("/expenses")
async def add_expense(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return {"success": True, "data": await model.add_expense(user_id, body or {})}


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: int, user_id: int = Depends(auth_user)):
    await model.delete_expense(user_id, expense_id)
    return {"success": True, "message": "Deleted"}


@router.get("/expenses/charts")
async def expense_charts(user_id: int = Depends(auth_user)):
    return await svc.expense_charts(user_id)


@router.post("/risk-score")
async def post_risk(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await svc.risk_score(user_id, body or {})


@router.get("/risk-score")
async def get_risk(user_id: int = Depends(auth_user)):
    data = await model.latest_risk(user_id)
    return {"success": True, "data": data}


@router.post("/chat")
async def chat(req: Request, user_id: int = Depends(auth_user)):
    try:
        body = await req.json()
        return await svc.chat(user_id, (body or {}).get("message") or "")
    except HPError as e:
        return _err(e)


@router.get("/chat/history")
async def chat_history(user_id: int = Depends(auth_user)):
    return {"success": True, "results": await model.chat_history(user_id)}


@router.get("/analytics/summary")
async def analytics(user_id: int = Depends(auth_user)):
    return await svc.analytics_summary(user_id)


@router.post("/renewal/remind")
async def renewal_remind(user_id: int = Depends(auth_user)):
    try:
        return await svc.renewal_remind(user_id)
    except HPError as e:
        return _err(e)
