"""Dean hospital pharmacy mapping — connect with PharmaSync."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.middleware.auth import auth_dean
from app.models import pharmacy_model, partner_model, hospital_model
from app.services import pharmasync_provision_service as pps

router = APIRouter(prefix="/api/dean/pharmacies", tags=["Dean Pharmacies"])


class CreatePharmacyBody(BaseModel):
    partner_id: Optional[int] = None
    name: str = Field(..., min_length=2, max_length=255)
    manager_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=32)
    address: Optional[str] = None
    license_number: Optional[str] = Field(default=None, max_length=128)
    pharmacy_type: str = "main"
    supports_pickup: bool = True
    supports_delivery: bool = False
    hours: Optional[dict] = None
    priority: int = 100
    is_active: bool = True


class UpdatePharmacyBody(BaseModel):
    partner_id: Optional[int] = None
    name: Optional[str] = None
    manager_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    license_number: Optional[str] = None
    pharmacy_type: Optional[str] = None
    supports_pickup: Optional[bool] = None
    supports_delivery: Optional[bool] = None
    hours: Optional[dict] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


async def _resolve_pharmacy_partner(partner_id: int | None) -> dict:
    if partner_id:
        partner = await partner_model.get_partner_by_id(partner_id)
        if not partner or partner.get("partner_type") != "PHARMACY":
            raise HTTPException(status_code=400, detail="Partner must be an active PHARMACY type")
        if partner.get("status") != "active":
            raise HTTPException(status_code=400, detail="Partner is not active")
        return partner

    partners = await partner_model.list_active_pharmacy_partners()
    if not partners:
        raise HTTPException(
            status_code=400,
            detail="No active PharmaSync partner. Ask Super Admin to register PharmaSync under Enterprise Integrations.",
        )
    if len(partners) > 1:
        raise HTTPException(
            status_code=400,
            detail="Multiple pharmacy partners available — partner_id is required",
        )
    return dict(partners[0])


@router.get("/")
async def list_pharmacies(dean: dict = Depends(auth_dean)):
    rows = await pharmacy_model.list_for_hospital(int(dean["hospital_id"]), active_only=False)
    return {"success": True, "data": [pharmacy_model.to_api(dict(r)) for r in rows]}


@router.get("/available-partners")
async def available_partners(dean: dict = Depends(auth_dean)):
    """List active PHARMACY partners for mapping (no secrets)."""
    rows = await partner_model.list_active_pharmacy_partners()
    return {
        "success": True,
        "data": [
            {"id": r["id"], "name": r["name"], "publicId": r["public_id"]}
            for r in rows
        ],
    }


@router.post("/")
async def create_pharmacy(body: CreatePharmacyBody, dean: dict = Depends(auth_dean)):
    hospital_id = int(dean["hospital_id"])
    partner = await _resolve_pharmacy_partner(body.partner_id)
    partner_id = int(partner["id"])

    hospital = await hospital_model.get_hospital_tieup_by_id(hospital_id)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    hospital_name = hospital.get("name") or f"Hospital {hospital_id}"
    hospital_address = hospital.get("address")

    provision = await pps.provision_pharmacy(
        partner=partner,
        hospital_id=hospital_id,
        hospital_name=hospital_name,
        hospital_address=hospital_address,
        pharmacy_name=body.name,
        manager_name=body.manager_name,
        email=str(body.email),
        phone=body.phone,
        address=body.address,
        license_number=body.license_number,
    )
    if not provision.get("success"):
        raise HTTPException(
            status_code=502,
            detail=provision.get("message") or "Failed to connect with PharmaSync",
        )

    connection_status = (provision.get("status") or "CONNECTED").lower()
    row = await pharmacy_model.create({
        "hospital_id": hospital_id,
        "partner_id": partner_id,
        "name": body.name,
        "pharmacy_type": body.pharmacy_type,
        "supports_pickup": body.supports_pickup,
        "supports_delivery": body.supports_delivery,
        "hours": body.hours,
        "priority": body.priority,
        "is_active": body.is_active,
        "manager_name": body.manager_name,
        "email": str(body.email),
        "phone": body.phone,
        "address": body.address or hospital_address,
        "license_number": body.license_number,
        "partner_pharmacy_ref": provision.get("pharmacyId"),
        "connection_status": connection_status,
    })

    data = pharmacy_model.to_api(row)
    data["provisionMode"] = provision.get("mode")
    return {
        "success": True,
        "message": "Pharmacy connected with PharmaSync",
        "data": data,
    }


@router.put("/{pharmacy_id}")
async def update_pharmacy(
    pharmacy_id: int,
    body: UpdatePharmacyBody,
    dean: dict = Depends(auth_dean),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    if "partner_id" in data:
        partner = await partner_model.get_partner_by_id(data["partner_id"])
        if not partner or partner.get("partner_type") != "PHARMACY":
            raise HTTPException(status_code=400, detail="Partner must be PHARMACY type")
    updated = await pharmacy_model.update(pharmacy_id, int(dean["hospital_id"]), data)
    if not updated:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return {"success": True, "data": pharmacy_model.to_api(updated)}


@router.delete("/{pharmacy_id}")
async def deactivate_pharmacy(pharmacy_id: int, dean: dict = Depends(auth_dean)):
    ok = await pharmacy_model.soft_deactivate(pharmacy_id, int(dean["hospital_id"]))
    if not ok:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return {"success": True, "message": "Pharmacy deactivated"}
