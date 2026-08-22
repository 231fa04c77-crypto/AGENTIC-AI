"""Unified enterprise search API."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.middleware.auth import auth_admin, auth_dean, auth_doctor, auth_user
from app.services import search_service

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("")
@router.get("/")
async def search(
    q: str = Query(..., min_length=1),
    types: Optional[str] = Query(
        default="doctor,hospital,community",
        description="Comma-separated: doctor,hospital,patient,community",
    ),
    limit: int = 20,
    offset: int = 0,
):
    type_list = [t.strip() for t in (types or "").split(",") if t.strip()]
    # patient search requires staff — strip for anonymous/public
    safe = [t for t in type_list if t.lower() != "patient"]
    return await search_service.search_all(q, types=safe or None, limit=limit, offset=offset)


@router.get("/staff")
async def search_staff(
    q: str = Query(..., min_length=1),
    types: Optional[str] = Query(default="doctor,hospital,patient,community"),
    limit: int = 20,
    offset: int = 0,
    _user=Depends(auth_user),
):
    """Authenticated patient can search doctors/hospitals/community (not other patients)."""
    type_list = [t.strip() for t in (types or "").split(",") if t.strip()]
    safe = [t for t in type_list if t.lower() != "patient"]
    return await search_service.search_all(q, types=safe, limit=limit, offset=offset)


@router.get("/clinical")
async def search_clinical(
    q: str = Query(..., min_length=1),
    types: Optional[str] = Query(default="doctor,hospital,patient,community"),
    limit: int = 20,
    offset: int = 0,
    _doc=Depends(auth_doctor),
):
    type_list = [t.strip() for t in (types or "").split(",") if t.strip()]
    return await search_service.search_all(q, types=type_list, limit=limit, offset=offset)


@router.get("/admin")
async def search_admin(
    q: str = Query(..., min_length=1),
    types: Optional[str] = Query(default="doctor,hospital,patient,community"),
    limit: int = 20,
    offset: int = 0,
    _admin=Depends(auth_admin),
):
    type_list = [t.strip() for t in (types or "").split(",") if t.strip()]
    return await search_service.search_all(q, types=type_list, limit=limit, offset=offset)


@router.get("/dean")
async def search_dean(
    q: str = Query(..., min_length=1),
    types: Optional[str] = Query(default="doctor,patient"),
    limit: int = 20,
    offset: int = 0,
    _dean=Depends(auth_dean),
):
    type_list = [t.strip() for t in (types or "").split(",") if t.strip()]
    return await search_service.search_all(q, types=type_list, limit=limit, offset=offset)
