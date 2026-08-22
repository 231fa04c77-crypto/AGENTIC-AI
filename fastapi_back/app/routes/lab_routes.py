from fastapi import APIRouter, Request, Depends
from app.controllers import lab_controller
from app.middleware.auth import auth_admin, auth_user

router = APIRouter(prefix="/api/lab", tags=["Lab Management"])

# Public Routes
@router.get("/list")
async def list_labs():
    return await lab_controller.list_labs()

@router.get("/nearby")
async def get_nearby_labs(lat: float, lng: float):
    return await lab_controller.get_nearby_labs(lat, lng)

# User Routes
@router.post("/book")
async def book_lab_test(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await lab_controller.book_lab_test(user_id, body)

@router.get("/my-bookings")
async def get_user_lab_bookings(user_id: int = Depends(auth_user)):
    return await lab_controller.get_user_lab_bookings(user_id)

@router.post("/cancel")
async def cancel_lab_test(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    return await lab_controller.cancel_lab_test(user_id, body.get('id'))

# Admin Routes
@router.post("/add")
@router.post("/add-lab")
async def add_lab(req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    return await lab_controller.add_lab(body)

@router.put("/update/{lab_id}")
@router.put("/update-lab/{lab_id}")
async def update_lab(lab_id: int, req: Request, admin_email: str = Depends(auth_admin)):
    body = await req.json()
    return await lab_controller.update_lab(lab_id, body)

@router.delete("/delete/{lab_id}")
@router.delete("/delete-lab/{lab_id}")
async def delete_lab(lab_id: int, admin_email: str = Depends(auth_admin)):
    return await lab_controller.delete_lab(lab_id)
