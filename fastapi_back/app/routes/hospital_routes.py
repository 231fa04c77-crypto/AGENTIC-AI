from fastapi import APIRouter, Request, Depends
from app.controllers import hospital_controller
from app.middleware.auth import auth_admin

router = APIRouter(prefix="/api/hospital-tieup", tags=["Hospital Management"])

# Public Routes
@router.get("/list")
async def hospital_list(limit: int | None = 100, offset: int = 0, q: str | None = None):
    return await hospital_controller.hospital_list(limit=limit, offset=offset, q=q)

@router.get("/doctors/{hospital_id}")
async def get_doctors_by_hospital(hospital_id: int):
    return await hospital_controller.get_doctors_by_hospital(hospital_id)

@router.get("/details/{hospital_id}")
async def get_hospital_details(hospital_id: int):
    print(f"📡 Hospital Details Route Hit for ID: {hospital_id}")
    return await hospital_controller.get_hospital_tieup_details(hospital_id)

@router.get("/public")
async def get_public_hospitals(limit: int | None = 100, offset: int = 0, q: str | None = None):
    return await hospital_controller.hospital_list(limit=limit, offset=offset, q=q)

@router.get("/public/doctors")
async def get_all_hospital_doctors_public(
    limit: int | None = 100, offset: int = 0, q: str | None = None
):
    return await hospital_controller.get_all_hospital_doctors_public(
        limit=limit, offset=offset, q=q
    )

@router.get("/public/all")
async def get_all_hospital_tieups_public():
    return await hospital_controller.get_all_hospitals_admin()

@router.get("/nearby")
async def get_nearby_hospitals(lat: float, lon: float, radius: float = 50.0):
    return await hospital_controller.get_nearby_hospitals(lat, lon, radius)

# Admin Routes
@router.get("/all")
async def get_all_hospitals_admin(admin_email: str = Depends(auth_admin)):
    return await hospital_controller.get_all_hospitals_admin()

@router.post("/add")
async def add_hospital_tieup(req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    return await hospital_controller.add_hospital_tieup(body)

@router.put("/update")
async def update_hospital_tieup(req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    tieup_id = body.get('id')
    return await hospital_controller.update_hospital_tieup(tieup_id, body)

@router.post("/delete") # Node uses POST for delete in hospitalTieUpController.js
async def delete_hospital_tieup(req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    tieup_id = body.get('id')
    return await hospital_controller.delete_hospital_tieup(tieup_id)
