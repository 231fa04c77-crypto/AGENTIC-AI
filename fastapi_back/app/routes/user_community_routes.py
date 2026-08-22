"""Patient Health Community APIs — JWT required (never public)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.middleware.auth import auth_user
from app.services import community_service as svc

router = APIRouter(prefix="/api/user/community", tags=["User Community"])


@router.get("/categories")
async def categories(user_id: int = Depends(auth_user)):
    return await svc.categories()


@router.get("/feed")
async def feed(
    sort: str = Query(default="recent"),
    specialty: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=50),
    offset: int = Query(default=0, ge=0, le=5000),
    cursor: int | None = Query(default=None, description="Alias for offset (additive pagination)"),
    user_id: int = Depends(auth_user),
):
    off = int(cursor if cursor is not None else offset)
    return await svc.patient_feed(sort=sort, specialty=specialty, limit=limit, offset=off)


@router.get("/search")
async def search(q: str = Query(..., min_length=2), user_id: int = Depends(auth_user)):
    return await svc.patient_search(q)


@router.post("/questions")
async def ask(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await svc.ask_question(int(user_id), body or {})


@router.get("/questions/{question_id}")
async def detail(question_id: int, user_id: int = Depends(auth_user)):
    return await svc.get_question_detail(int(user_id), question_id)


@router.post("/questions/{question_id}/follow-up")
async def follow_up(question_id: int, req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await svc.patient_follow_up(int(user_id), question_id, body or {})


@router.get("/my-questions")
async def my_questions(user_id: int = Depends(auth_user)):
    return await svc.my_questions(int(user_id))


@router.get("/bookmarks")
async def bookmarks(user_id: int = Depends(auth_user)):
    return await svc.bookmarks(int(user_id))


@router.post("/questions/{question_id}/bookmark")
async def bookmark(question_id: int, user_id: int = Depends(auth_user)):
    return await svc.bookmark(int(user_id), question_id)


@router.delete("/questions/{question_id}/bookmark")
async def unbookmark(question_id: int, user_id: int = Depends(auth_user)):
    return await svc.unbookmark(int(user_id), question_id)


@router.post("/report")
async def report(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await svc.report_content(int(user_id), None, body or {})


@router.get("/archive")
async def archive(
    specialty: str | None = Query(default=None),
    q: str | None = Query(default=None),
    user_id: int = Depends(auth_user),
):
    return await svc.knowledge_archive(specialty=specialty, q=q)


@router.post("/answers/{answer_id}/vote")
async def vote(answer_id: int, req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    value = int((body or {}).get("value") or 1)
    return await svc.vote_helpful(int(user_id), answer_id, value)


@router.get("/plus")
async def plus(user_id: int = Depends(auth_user)):
    return await svc.plus_status(int(user_id))


@router.post("/plus/activate")
async def plus_activate(user_id: int = Depends(auth_user)):
    """Temporary activation endpoint — replace with payment webhook later."""
    return await svc.activate_plus(int(user_id))
