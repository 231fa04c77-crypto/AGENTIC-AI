from fastapi import APIRouter, Request, Depends, UploadFile, File, Form
from typing import Optional
from app.controllers import job_application_controller
from app.middleware.auth import auth_admin

router = APIRouter(prefix="/api/job-applications", tags=["Job Applications"])

# Public Route: Apply for job
@router.post("")
@router.post("/")
async def apply_for_job(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    city: str = Form(...),
    qualification: str = Form(...),
    experience: str = Form(...),
    role_applied: str = Form(...),
    skills: str = Form(...),
    coverLetter: Optional[str] = Form(""),
    resume: UploadFile = File(...)
):
    data = {
        "name": name,
        "email": email,
        "phone": phone,
        "city": city,
        "qualification": qualification,
        "experience": experience,
        "role_applied": role_applied,
        "skills": skills,
        "coverLetter": coverLetter
    }
    return await job_application_controller.apply_for_job(data, resume)

# Admin Routes
@router.get("")
@router.get("/")
async def list_job_applications(search: Optional[str] = None, admin_email: str = Depends(auth_admin)):
    return await job_application_controller.list_job_applications(search)

@router.get("/{id}/resume")
async def get_resume(id: int, admin_email: str = Depends(auth_admin)):
    return await job_application_controller.get_resume(id)

@router.post("/{id}/approve")
async def approve_job_application(id: int, admin_email: str = Depends(auth_admin)):
    return await job_application_controller.approve_job_application(id)

@router.post("/{id}/reject")
async def reject_job_application(id: int, admin_email: str = Depends(auth_admin)):
    return await job_application_controller.reject_job_application(id)
