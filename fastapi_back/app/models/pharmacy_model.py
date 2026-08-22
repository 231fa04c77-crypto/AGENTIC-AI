"""Pharmacy registry — hospital ↔ partner mapping (Dean-managed)."""
from __future__ import annotations

import json
from typing import Any, Optional

from app.config.db import db


def _serialize_row(r: dict) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "partnerId": r["partner_id"],
        "partnerName": r.get("partner_name"),
        "partnerStatus": r.get("partner_status"),
        "pharmacyType": r.get("pharmacy_type"),
        "supportsPickup": r.get("supports_pickup", True),
        "supportsDelivery": r.get("supports_delivery", False),
        "hours": r.get("hours") or {},
        "priority": r.get("priority", 100),
        "isActive": r.get("is_active", True),
        "managerName": r.get("manager_name"),
        "email": r.get("email"),
        "phone": r.get("phone"),
        "address": r.get("address"),
        "licenseNumber": r.get("license_number"),
        "partnerPharmacyRef": r.get("partner_pharmacy_ref"),
        "connectionStatus": r.get("connection_status") or "pending",
    }


async def list_for_hospital(hospital_id: int, active_only: bool = True) -> list:
    sql = """
        SELECT ph.*, p.name AS partner_name, p.public_id AS partner_public_id,
               p.status AS partner_status
        FROM pharmacies ph
        JOIN partners p ON p.id = ph.partner_id
        WHERE ph.hospital_id = $1
    """
    if active_only:
        sql += " AND ph.is_active = true AND p.status = 'active' AND p.deleted_at IS NULL"
    sql += " ORDER BY ph.priority ASC, ph.name ASC"
    return await db.query(sql, hospital_id)


async def get_by_id(pharmacy_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT ph.*, p.name AS partner_name, p.webhook_url, p.status AS partner_status
        FROM pharmacies ph
        JOIN partners p ON p.id = ph.partner_id
        WHERE ph.id = $1
        """,
        pharmacy_id,
    )
    return dict(row) if row else None


async def list_active_for_catalog(*, prefer_delivery: bool = True, limit: int = 20) -> list:
    """Active hospital pharmacies usable for retail / home-delivery catalog carts."""
    order = (
        "ph.supports_delivery DESC, ph.priority ASC, ph.name ASC"
        if prefer_delivery
        else "ph.priority ASC, ph.name ASC"
    )
    return await db.query(
        f"""
        SELECT ph.*, p.name AS partner_name, p.webhook_url, p.status AS partner_status
        FROM pharmacies ph
        JOIN partners p ON p.id = ph.partner_id
        WHERE ph.is_active = true
          AND p.status = 'active'
          AND p.deleted_at IS NULL
        ORDER BY {order}
        LIMIT $1
        """,
        limit,
    )


async def create(data: dict) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO pharmacies (
            hospital_id, partner_id, name, pharmacy_type,
            supports_pickup, supports_delivery, hours, priority, is_active,
            manager_name, email, phone, address, license_number,
            partner_pharmacy_ref, connection_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *
        """,
        data["hospital_id"],
        data["partner_id"],
        data["name"],
        data.get("pharmacy_type", "main"),
        data.get("supports_pickup", True),
        data.get("supports_delivery", False),
        json.dumps(data.get("hours") or {}),
        data.get("priority", 100),
        data.get("is_active", True),
        data.get("manager_name"),
        data.get("email"),
        data.get("phone"),
        data.get("address"),
        data.get("license_number"),
        data.get("partner_pharmacy_ref"),
        data.get("connection_status", "pending"),
    )
    return dict(row)


async def update(pharmacy_id: int, hospital_id: int, data: dict) -> Optional[dict]:
    fields, values, idx = [], [], 1
    mapping = {
        "name": "name",
        "partner_id": "partner_id",
        "pharmacy_type": "pharmacy_type",
        "supports_pickup": "supports_pickup",
        "supports_delivery": "supports_delivery",
        "priority": "priority",
        "is_active": "is_active",
        "manager_name": "manager_name",
        "email": "email",
        "phone": "phone",
        "address": "address",
        "license_number": "license_number",
        "partner_pharmacy_ref": "partner_pharmacy_ref",
        "connection_status": "connection_status",
    }
    for key, col in mapping.items():
        if key in data and data[key] is not None:
            fields.append(f"{col} = ${idx}")
            values.append(data[key])
            idx += 1
    if "hours" in data and data["hours"] is not None:
        fields.append(f"hours = ${idx}::jsonb")
        values.append(json.dumps(data["hours"]))
        idx += 1
    if not fields:
        return None
    fields.append("updated_at = NOW()")
    values.extend([pharmacy_id, hospital_id])
    sql = (
        f"UPDATE pharmacies SET {', '.join(fields)} "
        f"WHERE id = ${idx} AND hospital_id = ${idx + 1} RETURNING *"
    )
    row = await db.fetch_row(sql, *values)
    return dict(row) if row else None


async def soft_deactivate(pharmacy_id: int, hospital_id: int) -> bool:
    result = await db.execute(
        """
        UPDATE pharmacies SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND hospital_id = $2
        """,
        pharmacy_id, hospital_id,
    )
    return result == "UPDATE 1"


async def list_partner_hospital_ids(partner_id: int) -> list[int]:
    rows = await db.query(
        """
        SELECT DISTINCT hospital_id FROM pharmacies
        WHERE partner_id = $1 AND is_active = true
        """,
        partner_id,
    )
    return [int(r["hospital_id"]) for r in rows]


def to_api(row: dict) -> dict[str, Any]:
    return _serialize_row(dict(row))
