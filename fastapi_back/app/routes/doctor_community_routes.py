"""Doctor Health Community APIs — verified doctor JWT."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.middleware.auth import auth_doctor
from app.services import community_service as svc

router = APIRouter(prefix="/api/doctor/community", tags=["Doctor Community"])


@router.get("/feed")
async def feed(
    mode: str = Query(default="all"),
    limit: int = Query(default=40, ge=1, le=60),
    doctor_id: int = Depends(auth_doctor),
):
    return await svc.doctor_feed(int(doctor_id), mode=mode, limit=limit)


@router.get("/my-answers")
async def my_answers(doctor_id: int = Depends(auth_doctor)):
    return await svc.doctor_my_answers(int(doctor_id))


@router.get("/questions/{question_id}")
async def detail(question_id: int, doctor_id: int = Depends(auth_doctor)):
    return await svc.get_question_detail(None, question_id)


@router.post("/questions/{question_id}/answers")
async def answer(question_id: int, req: Request, doctor_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await svc.doctor_answer(int(doctor_id), question_id, body or {})


@router.put("/answers/{answer_id}")
async def edit_answer(answer_id: int, req: Request, doctor_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await svc.doctor_edit_answer(int(doctor_id), answer_id, body or {})


@router.post("/questions/{question_id}/resolve")
async def resolve(question_id: int, doctor_id: int = Depends(auth_doctor)):
    return await svc.doctor_resolve(int(doctor_id), question_id)


@router.post("/questions/{question_id}/specialty")
async def specialty(question_id: int, req: Request, doctor_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await svc.doctor_recategorize(
        int(doctor_id), question_id, (body or {}).get("specialty") or "general",
    )


@router.post("/questions/{question_id}/recommend")
async def recommend(question_id: int, req: Request, doctor_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await svc.doctor_recommend(int(doctor_id), question_id, body or {})


@router.post("/report")
async def report(req: Request, doctor_id: int = Depends(auth_doctor)):
    body = await req.json()
    return await svc.report_content(None, int(doctor_id), body or {})


@router.get("/stats")
async def stats(doctor_id: int = Depends(auth_doctor)):
    return await svc.doctor_community_stats(int(doctor_id))
