from fastapi import APIRouter, Request
from app.controllers import location_controller

router = APIRouter(prefix="/api/location", tags=["Location Services"])

@router.get("/geocode")
async def geocode_address(address: str):
    return await location_controller.geocode_address(address)

@router.get("/nearby-hospitals")
async def find_nearby_hospitals(lat: float, lon: float, radius: float = 3.0):
    return await location_controller.find_nearby_hospitals(lat, lon, radius)
