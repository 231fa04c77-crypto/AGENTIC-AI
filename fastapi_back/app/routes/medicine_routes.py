"""Medicine Information APIs — openFDA via backend only (API key never exposed)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.middleware.auth import auth_user
from app.schemas.medicine_schemas import MedicineFavoriteCreate
from app.services import medicine_service
from app.services.openfda_service import OpenFDAError

router = APIRouter(prefix="/api/medicine", tags=["Medicine Information"])


def _error_response(exc: OpenFDAError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "code": exc.code,
            "count": 0,
            "results": [],
        },
    )


@router.get(
    "/search",
    summary="Search medicines",
    description="Search openFDA drug labels by brand, generic, or substance name. Min 2 characters.",
)
async def search_medicines(
    q: str = Query(..., min_length=2, description="Medicine name query"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    user_id: int = Depends(auth_user),
):
    try:
        return await medicine_service.search_medicines(
            q, user_id=user_id, page=page, limit=limit
        )
    except OpenFDAError as exc:
        return _error_response(exc)


@router.get(
    "/details/{medicine_name}",
    summary="Medicine details",
    description="Full label information for a medicine name (brand or generic).",
)
async def medicine_details(
    medicine_name: str,
    user_id: int = Depends(auth_user),
):
    _ = user_id
    try:
        return await medicine_service.medicine_details(medicine_name)
    except OpenFDAError as exc:
        return _error_response(exc)


@router.get(
    "/autocomplete",
    summary="Autocomplete suggestions",
    description="Top medicine name suggestions for typed prefix.",
)
async def autocomplete(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=20),
    user_id: int = Depends(auth_user),
):
    _ = user_id
    try:
        return await medicine_service.autocomplete(q, limit=limit)
    except OpenFDAError as exc:
        return _error_response(exc)


@router.get(
    "/manufacturer/{manufacturer}",
    summary="Medicines by manufacturer",
)
async def by_manufacturer(
    manufacturer: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    user_id: int = Depends(auth_user),
):
    _ = user_id
    try:
        return await medicine_service.by_manufacturer(
            manufacturer, page=page, limit=limit
        )
    except OpenFDAError as exc:
        return _error_response(exc)


@router.get(
    "/ingredient/{ingredient}",
    summary="Medicines by active ingredient",
)
async def by_ingredient(
    ingredient: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    user_id: int = Depends(auth_user),
):
    _ = user_id
    try:
        return await medicine_service.by_ingredient(ingredient, page=page, limit=limit)
    except OpenFDAError as exc:
        return _error_response(exc)


@router.get("/recent", summary="Recent searches for current user")
async def recent_searches(
    limit: int = Query(10, ge=1, le=30),
    user_id: int = Depends(auth_user),
):
    try:
        return await medicine_service.recent_searches(user_id, limit=limit)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc), "results": []},
        )


@router.get("/history", summary="Full search history")
async def search_history(
    limit: int = Query(50, ge=1, le=100),
    user_id: int = Depends(auth_user),
):
    return await medicine_service.search_history(user_id, limit=limit)


@router.delete("/history", summary="Clear search history")
async def clear_history(user_id: int = Depends(auth_user)):
    return await medicine_service.clear_history(user_id)


@router.get("/popular", summary="Popular medicine searches")
async def popular(
    limit: int = Query(10, ge=1, le=30),
    user_id: int = Depends(auth_user),
):
    _ = user_id
    return await medicine_service.popular_medicines(limit=limit)


@router.get("/trending", summary="Trending medicine searches")
async def trending(
    limit: int = Query(10, ge=1, le=30),
    user_id: int = Depends(auth_user),
):
    _ = user_id
    return await medicine_service.trending_searches(limit=limit)


@router.get("/favorites", summary="Favorite medicines")
async def favorites(user_id: int = Depends(auth_user)):
    return await medicine_service.list_favorites(user_id)


@router.post("/favorites", summary="Add favorite medicine")
async def add_favorite(
    body: MedicineFavoriteCreate,
    user_id: int = Depends(auth_user),
):
    try:
        return await medicine_service.add_favorite(user_id, body.model_dump())
    except OpenFDAError as exc:
        return _error_response(exc)


@router.delete("/favorites/{medicine_key}", summary="Remove favorite")
async def remove_favorite(medicine_key: str, user_id: int = Depends(auth_user)):
    return await medicine_service.remove_favorite(user_id, medicine_key)
