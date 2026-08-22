from fastapi import APIRouter, Request, Depends
from app.controllers import blood_bank_controller
from app.middleware.auth import auth_admin

router = APIRouter(prefix="/api/blood-bank", tags=["Blood Bank"])

@router.get("/list")
async def list_blood_banks():
    return await blood_bank_controller.list_blood_banks()

@router.get("/nearby")
async def get_nearby_blood_banks(lat: float, lng: float):
    return await blood_bank_controller.get_nearby_blood_banks(lat, lng)

# Admin Routes
@router.post("/add")
@router.post("/add-blood-bank")
async def add_blood_bank(req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    return await blood_bank_controller.add_blood_bank(body)

@router.put("/update/{bank_id}")
@router.put("/update-blood-bank/{bank_id}")
async def update_blood_bank(bank_id: int, req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    return await blood_bank_controller.update_blood_bank(bank_id, body)

@router.delete("/delete/{bank_id}")
@router.delete("/delete-blood-bank/{bank_id}")
async def delete_blood_bank(bank_id: int, admin_email: str = Depends(auth_admin)):
    return await blood_bank_controller.delete_blood_bank(bank_id)
