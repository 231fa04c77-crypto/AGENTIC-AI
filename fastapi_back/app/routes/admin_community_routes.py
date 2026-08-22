"""Super Admin Health Community moderation."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.middleware.auth import auth_admin
from app.services import community_service as svc

router = APIRouter(prefix="/api/admin/community", tags=["Admin Community"])


@router.get("/moderation")
async def moderation(_admin=Depends(auth_admin)):
    return await svc.admin_moderation_list()


@router.post("/questions/{question_id}/publish")
async def publish(question_id: int, _admin=Depends(auth_admin)):
    return await svc.admin_publish(question_id)


@router.post("/questions/{question_id}/reject")
async def reject(question_id: int, _admin=Depends(auth_admin)):
    return await svc.admin_reject(question_id)


@router.post("/questions/{question_id}/soft-delete")
async def soft_delete(question_id: int, _admin=Depends(auth_admin)):
    return await svc.admin_soft_delete(question_id)


@router.post("/users/{user_id}/warn")
async def warn(user_id: int, req: Request, _admin=Depends(auth_admin)):
    body = await req.json()
    return await svc.admin_warn_user(user_id, (body or {}).get("reason") or "Warning")


@router.post("/users/{user_id}/suspend")
async def suspend(user_id: int, req: Request, _admin=Depends(auth_admin)):
    body = await req.json()
    days = int((body or {}).get("days") or 7)
    return await svc.admin_suspend_user(
        user_id, (body or {}).get("reason") or "Suspended", days=days,
    )


@router.post("/archive-job")
async def archive_job(req: Request, _admin=Depends(auth_admin)):
    body = {}
    try:
        body = await req.json()
    except Exception:
        pass
    days = int((body or {}).get("days") or 90)
    return await svc.run_archive_job(days)
