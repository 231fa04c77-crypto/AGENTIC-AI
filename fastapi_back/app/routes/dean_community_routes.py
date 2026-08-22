"""Dean Health Community moderation (hospital-scoped)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.middleware.auth import auth_dean
from app.services import community_service as svc
from app.services import community_reputation_service as rep

router = APIRouter(prefix="/api/dean/community", tags=["Dean Community"])


@router.get("/moderation")
async def moderation(dean: dict = Depends(auth_dean)):
    return await svc.dean_moderation_list(int(dean["hospital_id"]))


@router.post("/questions/{question_id}/publish")
async def publish(question_id: int, dean: dict = Depends(auth_dean)):
    return await svc.admin_publish(question_id)


@router.post("/questions/{question_id}/reject")
async def reject(question_id: int, dean: dict = Depends(auth_dean)):
    return await svc.admin_reject(question_id)


@router.post("/questions/{question_id}/soft-delete")
async def soft_delete(question_id: int, dean: dict = Depends(auth_dean)):
    return await svc.admin_soft_delete(question_id)


@router.post("/users/{user_id}/warn")
async def warn(user_id: int, req: Request, dean: dict = Depends(auth_dean)):
    body = await req.json()
    row = await rep.issue_sanction(
        user_id,
        "warn",
        (body or {}).get("reason") or "Dean community warning",
        dean_id=int(dean["id"]),
        days=None,
    )
    return {"success": True, "data": {"id": row["id"]}}
