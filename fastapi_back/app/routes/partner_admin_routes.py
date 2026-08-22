"""Super Admin routes — CRUD for partner / Enterprise Integrations management.

Base path: /api/admin/partners
Auth: auth_admin (MEDCLUES Super Admin JWT)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.middleware.auth import auth_admin
from app.models import partner_model, emergency_case_model as ecm
from app.services.partner_auth_service import (
    encrypt_secret,
    generate_api_key,
    generate_secret_key,
    generate_webhook_secret,
    hash_secret,
)
from app.services.public_id_service import new_partner_public_id
from app.services.partner_domain_registry import default_apis_for_partner_type
from app.utils.app_logger import get_logger

log = get_logger(__name__)

router = APIRouter(prefix="/api/admin/partners", tags=["Admin Partner Management"])


class CreatePartnerRequest(BaseModel):
    name: str
    partner_type: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    webhook_url: Optional[str] = None
    allowed_domains: list[str] = []
    allowed_apis: Optional[list[str]] = None
    rate_limit_rpm: int = 60
    ip_whitelist: list[str] = []
    billing_plan: Optional[str] = None


class UpdatePartnerRequest(BaseModel):
    name: Optional[str] = None
    partner_type: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    webhook_url: Optional[str] = None
    status: Optional[str] = None
    rate_limit_rpm: Optional[int] = None
    allowed_domains: Optional[list[str]] = None
    allowed_apis: Optional[list[str]] = None
    ip_whitelist: Optional[list[str]] = None


class CreateKeyRequest(BaseModel):
    environment: str = "sandbox"  # sandbox | production


class RotateWebhookSecretRequest(BaseModel):
    pass


def _default_apis_for_type(partner_type: str) -> list[str]:
    return default_apis_for_partner_type(partner_type)


@router.get("/", summary="List all registered partners")
async def list_partners(
    include_deleted: bool = Query(default=False),
    _admin=Depends(auth_admin),
):
    rows = await partner_model.get_all_partners(include_deleted)
    # Never expose encrypted secrets in list responses
    data = []
    for r in rows:
        row = dict(r)
        row.pop("webhook_signing_secret_encrypted", None)
        data.append(row)
    return {"success": True, "data": data}


@router.post("/", summary="Register a new partner and issue an initial sandbox key")
async def create_partner(body: CreatePartnerRequest, _admin=Depends(auth_admin)):
    public_id = await new_partner_public_id()
    data = body.model_dump()
    data["public_id"] = public_id
    data["status"] = "pending"
    if not data.get("allowed_apis"):
        data["allowed_apis"] = _default_apis_for_type(body.partner_type)

    raw_webhook_secret = generate_webhook_secret()
    data["webhook_signing_secret_encrypted"] = encrypt_secret(raw_webhook_secret)

    partner = await partner_model.create_partner(data)

    raw_key = generate_api_key()
    raw_secret = generate_secret_key()
    await partner_model.create_api_key(
        partner["id"],
        raw_key,
        hash_secret(raw_secret),
        "sandbox",
        secret_encrypted=encrypt_secret(raw_secret),
    )

    safe_partner = dict(partner)
    safe_partner.pop("webhook_signing_secret_encrypted", None)

    return {
        "success": True,
        "message": (
            "Partner registered. Store secret_key and webhook_signing_secret securely — "
            "they will NOT be shown again."
        ),
        "partner": safe_partner,
        "credentials": {
            "api_key": raw_key,
            "secret_key": raw_secret,
            "webhook_signing_secret": raw_webhook_secret,
            "environment": "sandbox",
            "note": "Use X-Api-Key, X-Timestamp, X-Signature headers for all API calls.",
        },
    }


@router.get("/emergency/cases", summary="Admin: view all emergency cases across partners")
async def list_all_cases(
    _admin=Depends(auth_admin),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    cases = await ecm.list_all_cases(limit, offset)
    from app.controllers.dispatch_controller import _format_case_response
    return {
        "success": True,
        "data": [_format_case_response(dict(c)) for c in cases],
        "pagination": {"limit": limit, "offset": offset, "count": len(cases)},
    }


@router.get("/{partner_id}", summary="Get partner detail and API keys")
async def get_partner(partner_id: int, _admin=Depends(auth_admin)):
    partner = await partner_model.get_partner_by_id(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    keys = await partner_model.list_keys_for_partner(partner_id)
    safe = dict(partner)
    safe.pop("webhook_signing_secret_encrypted", None)
    safe["has_webhook_signing_secret"] = bool(partner.get("webhook_signing_secret_encrypted"))
    return {
        "success": True,
        "data": {
            **safe,
            "api_keys": [dict(k) for k in keys],
        },
    }


@router.put("/{partner_id}", summary="Update partner details or status")
async def update_partner(partner_id: int, body: UpdatePartnerRequest, _admin=Depends(auth_admin)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await partner_model.update_partner(partner_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Partner not found or nothing to update")
    safe = dict(updated)
    safe.pop("webhook_signing_secret_encrypted", None)
    return {"success": True, "data": safe}


@router.delete("/{partner_id}", summary="Disable a partner account")
async def delete_partner(partner_id: int, _admin=Depends(auth_admin)):
    ok = await partner_model.soft_delete_partner(partner_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"success": True, "message": "Partner disabled successfully"}


@router.post("/{partner_id}/keys", summary="Generate a new API key pair for a partner")
async def create_key(partner_id: int, body: CreateKeyRequest, _admin=Depends(auth_admin)):
    partner = await partner_model.get_partner_by_id(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    raw_key = generate_api_key()
    raw_secret = generate_secret_key()
    key_row = await partner_model.create_api_key(
        partner_id,
        raw_key,
        hash_secret(raw_secret),
        body.environment,
        secret_encrypted=encrypt_secret(raw_secret),
    )
    safe_key = dict(key_row)
    safe_key.pop("secret_hash", None)
    safe_key.pop("secret_encrypted", None)
    return {
        "success": True,
        "message": "Key pair generated. Store the secret_key securely.",
        "key": safe_key,
        "credentials": {
            "api_key": raw_key,
            "secret_key": raw_secret,
            "environment": body.environment,
        },
    }


@router.delete("/{partner_id}/keys/{api_key}", summary="Revoke a specific API key")
async def revoke_key(partner_id: int, api_key: str, _admin=Depends(auth_admin)):
    await partner_model.revoke_key(api_key)
    return {"success": True, "message": f"Key {api_key[:12]}… revoked"}


@router.post(
    "/{partner_id}/webhook-secret/rotate",
    summary="Rotate outbound webhook signing secret (shown once)",
)
async def rotate_webhook_secret(partner_id: int, _admin=Depends(auth_admin)):
    partner = await partner_model.get_partner_by_id(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    raw = generate_webhook_secret()
    await partner_model.update_partner(
        partner_id,
        {"webhook_signing_secret_encrypted": encrypt_secret(raw)},
    )
    return {
        "success": True,
        "message": "Webhook signing secret rotated. Store it securely — shown once.",
        "credentials": {"webhook_signing_secret": raw},
    }
