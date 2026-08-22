"""Ambulance model — CRUD for fleet registry, operator auth, assignments, GPS pings."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Optional

from app.config.db import db


# ── Fleet ─────────────────────────────────────────────────────────────────────

async def create_ambulance(data: dict) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO ambulances
            (vehicle_number, vehicle_type, operator_name, operator_phone, operator_email, hospital_id)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
        """,
        data["vehicle_number"], data.get("vehicle_type", "BLS"),
        data.get("operator_name"), data.get("operator_phone"), data.get("operator_email"),
        data.get("hospital_id"),
    )
    return dict(row)


async def list_ambulances(hospital_id: int | None = None) -> list:
    if hospital_id:
        return await db.query("SELECT * FROM ambulances WHERE hospital_id=$1 ORDER BY id", hospital_id)
    return await db.query("SELECT * FROM ambulances ORDER BY id")


async def get_ambulance_by_id(amb_id: int) -> Optional[dict]:
    row = await db.fetch_row("SELECT * FROM ambulances WHERE id=$1", amb_id)
    return dict(row) if row else None


async def set_ambulance_status(amb_id: int, status: str) -> None:
    await db.execute(
        "UPDATE ambulances SET status=$1, updated_at=NOW() WHERE id=$2",
        status, amb_id,
    )


async def update_ambulance_location(amb_id: int, lat: float, lon: float) -> None:
    await db.execute(
        "UPDATE ambulances SET latitude=$1, longitude=$2, updated_at=NOW() WHERE id=$3",
        lat, lon, amb_id,
    )


async def find_nearest_available_ambulance(lat: float, lon: float,
                                           max_km: float = 20.0) -> Optional[dict]:
    """Return the closest ambulance with status='available'."""
    rows = await db.query(
        "SELECT * FROM ambulances WHERE status='available' AND latitude IS NOT NULL AND longitude IS NOT NULL"
    )
    if not rows:
        return None
    import math
    def _dist(r: dict) -> float:
        dlat = math.radians(float(r["latitude"]) - lat)
        dlon = math.radians(float(r["longitude"]) - lon)
        a = (math.sin(dlat/2)**2 +
             math.cos(math.radians(lat))*math.cos(math.radians(float(r["latitude"])))*math.sin(dlon/2)**2)
        return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    nearest = min(rows, key=lambda r: _dist(dict(r)))
    if _dist(dict(nearest)) > max_km:
        return None
    return dict(nearest)


# ── Operator auth ─────────────────────────────────────────────────────────────

def _hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


async def create_operator(ambulance_id: int, username: str, password: str) -> dict:
    row = await db.fetch_row(
        """
        INSERT INTO ambulance_operators (ambulance_id, username, password_hash)
        VALUES ($1,$2,$3) RETURNING id, ambulance_id, username, is_active, created_at
        """,
        ambulance_id, username, _hash_password(password),
    )
    return dict(row)


async def get_operator_by_username(username: str) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT ao.*, a.vehicle_number, a.hospital_id
        FROM ambulance_operators ao
        JOIN ambulances a ON a.id = ao.ambulance_id
        WHERE ao.username=$1 AND ao.is_active=true
        """,
        username,
    )
    return dict(row) if row else None


def verify_operator_password(raw: str, stored_hash: str) -> bool:
    return hmac.compare_digest(_hash_password(raw), stored_hash)


# ── Assignments ───────────────────────────────────────────────────────────────

async def create_assignment(case_id: int, ambulance_id: int,
                            distance_km: float, eta_minutes: int) -> dict:
    """Create (or upsert) an ambulance assignment and return it with a driver_trip_token.
    
    driver_trip_token is a secure URL-safe token used to generate the one-tap
    driver trip link — no username/password required on the driver's phone.
    """
    trip_token = secrets.token_urlsafe(16)
    row = await db.fetch_row(
        """
        INSERT INTO ambulance_assignments
            (case_id, ambulance_id, distance_km, eta_minutes, driver_trip_token)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (case_id) DO UPDATE
            SET ambulance_id=$2, distance_km=$3, eta_minutes=$4,
                driver_trip_token=COALESCE(ambulance_assignments.driver_trip_token, $5),
                assigned_at=NOW()
        RETURNING *
        """,
        case_id, ambulance_id, distance_km, eta_minutes, trip_token,
    )
    await set_ambulance_status(ambulance_id, "busy")
    return dict(row)


async def get_assignment_by_trip_token(token: str) -> Optional[dict]:
    """Look up an assignment by its driver_trip_token (used for the public driver trip page)."""
    row = await db.fetch_row(
        """
        SELECT aa.*,
               a.vehicle_number, a.vehicle_type, a.operator_name, a.operator_phone,
               a.latitude AS amb_lat, a.longitude AS amb_lon,
               ec.public_id, ec.patient_name, ec.patient_phone,
               ec.latitude AS case_lat, ec.longitude AS case_lon,
               ec.location_text, ec.emergency_type, ec.status AS case_status,
               ec.hospital_name, ec.hospital_address
        FROM ambulance_assignments aa
        JOIN ambulances a ON a.id = aa.ambulance_id
        JOIN emergency_cases ec ON ec.id = aa.case_id
        WHERE aa.driver_trip_token = $1
        """,
        token,
    )
    return dict(row) if row else None


async def accept_assignment(case_id: int) -> None:
    await db.execute(
        "UPDATE ambulance_assignments SET accepted_at=NOW() WHERE case_id=$1", case_id,
    )


async def complete_assignment(case_id: int) -> None:
    row = await db.fetch_row(
        "UPDATE ambulance_assignments SET completed_at=NOW() WHERE case_id=$1 RETURNING ambulance_id",
        case_id,
    )
    if row:
        await set_ambulance_status(row["ambulance_id"], "available")


async def get_assignment(case_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        "SELECT * FROM ambulance_assignments WHERE case_id=$1", case_id,
    )
    return dict(row) if row else None


# ── GPS pings ─────────────────────────────────────────────────────────────────

async def record_gps_ping(ambulance_id: int, case_id: int | None,
                          lat: float, lon: float,
                          speed_kmh: float | None = None,
                          heading: float | None = None) -> None:
    await db.execute(
        """
        INSERT INTO ambulance_gps_pings
            (ambulance_id, case_id, latitude, longitude, speed_kmh, heading)
        VALUES ($1,$2,$3,$4,$5,$6)
        """,
        ambulance_id, case_id, lat, lon, speed_kmh, heading,
    )
    await update_ambulance_location(ambulance_id, lat, lon)


async def get_latest_ping(ambulance_id: int) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT * FROM ambulance_gps_pings
        WHERE ambulance_id=$1
        ORDER BY created_at DESC LIMIT 1
        """,
        ambulance_id,
    )
    return dict(row) if row else None
