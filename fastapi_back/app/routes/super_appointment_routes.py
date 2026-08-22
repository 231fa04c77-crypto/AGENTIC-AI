"""Super Admin appointment CRUD under `/api/appointments`.

Shares prefix with public BK GET (`appointment_routes.py`). Admin
list/create/status updates require `auth_admin`; public BK lookup does not.
"""
from fastapi import APIRouter, Depends, Request
from typing import Dict, Any, Optional
from app.controllers import super_appointment_controller
from app.middleware.auth import auth_admin

router = APIRouter(prefix="/api/appointments", tags=["Appointments — admin CRUD"])

@router.post("")
@router.post("/")
async def book_appointment(req: Request, admin_email: str = Depends(auth_admin)):
    data = await req.json()
    return await super_appointment_controller.book_appointment(data)

@router.get("")
@router.get("/")
async def list_appointments(admin_email: str = Depends(auth_admin)):
    return await super_appointment_controller.list_appointments()

@router.post("/{id}/update-status")
async def update_status(id: int, status: str, admin_email: str = Depends(auth_admin)):
    return await super_appointment_controller.update_status(id, status)
