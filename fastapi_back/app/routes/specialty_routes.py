from fastapi import APIRouter, Request, Depends
from app.controllers import specialty_controller
from app.middleware.auth import auth_admin

router = APIRouter(prefix="/api/specialty", tags=["Specialty"])

# Public Routes
@router.get("/helpline/{doc_id}")
async def get_helpline_for_appointment(doc_id: int):
    return await specialty_controller.get_helpline_for_appointment(doc_id)

@router.get("/public/all")
async def get_all_specialties_public():
    return await specialty_controller.get_all_specialties()

# Admin Routes
@router.get("/all")
async def get_all_specialties_admin(admin_email: str = Depends(auth_admin)):
    return await specialty_controller.get_all_specialties()

@router.get("/{specialty_name}")
async def get_specialty_by_name(specialty_name: str, admin_email: str = Depends(auth_admin)):
    return await specialty_controller.get_specialty_by_name(specialty_name)

@router.post("/create")
async def create_specialty(req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    return await specialty_controller.create_specialty(body)

@router.put("/update/{id}")
async def update_specialty(id: int, req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    return await specialty_controller.update_specialty(id, body)

@router.delete("/delete/{id}")
async def delete_specialty(id: int, admin_email: str = Depends(auth_admin)):
    return await specialty_controller.delete_specialty(id)
