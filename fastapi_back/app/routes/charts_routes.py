from fastapi import APIRouter, Depends
from app.controllers import charts_controller
from app.middleware.auth import auth_admin, auth_dean, auth_doctor

router = APIRouter(prefix="/api/charts", tags=["Charts"])


@router.get("/admin")
async def admin_charts(_admin_email: str = Depends(auth_admin)):
    return await charts_controller.get_admin_chart_stats()


@router.get("/dean")
async def dean_charts(dean_info: dict = Depends(auth_dean)):
    return await charts_controller.get_dean_chart_stats(dean_info["hospital_id"])


@router.get("/doctor")
async def doctor_charts(doctor_id: int = Depends(auth_doctor)):
    return await charts_controller.get_doctor_chart_stats(doctor_id)
