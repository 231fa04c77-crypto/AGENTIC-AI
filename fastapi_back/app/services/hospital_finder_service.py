"""Hospital finder service — returns the nearest MEDCLUES tie-up or OSM fallback.

Priority logic:
  1. Query hospital_tieups with a PROGRESSIVE radius search:
       15 km → 35 km → 75 km → 100 km (stop at 100 km).
  2. Sort by Haversine distance — return the closest one.
  3. If no tie-up is found at any radius, query OSM using the last
     expanded radius to find any public hospital nearby.
  4. If still nothing, return a None-hospital placeholder so the case still
     creates and the Dual-Triage fallback path activates on the partner app.

Dual-Triage thresholds (returned in the result):
  - close_dispatch     : hospital is within TRIAGE_CLOSE_KM (25 km)
                         → standard MEDCLUES ambulance dispatch
  - hybrid_triage      : hospital is 25–100 km away
                         → call 108/Police immediately AND book ER slot
  - no_partner_found   : no partner hospital found at all
                         → call 108/Police only
"""
from __future__ import annotations

import math
from typing import Optional

import httpx

from app.config.db import db
from app.utils.app_logger import get_logger

log = get_logger(__name__)

_EARTH_R = 6371.0  # km

# ── Tunable constants ─────────────────────────────────────────────────────────
# Progressive search rings (km)
SEARCH_RADII = [15, 35, 75, 100]
# Maximum radius ever attempted (anything beyond is physically impossible)
MAX_RADIUS_KM = 100

# Dual-triage threshold: below this → standard dispatch; above → hybrid
TRIAGE_CLOSE_KM = 25

# Emergency contact defaults for India
EMERGENCY_NUMBER_AMBULANCE = "108"
EMERGENCY_NUMBER_POLICE    = "112"


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in km between two coordinate pairs."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return _EARTH_R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _estimate_eta_minutes(distance_km: float, speed_kmh: float = 40.0) -> int:
    """Simple ETA estimate based on average road speed."""
    return max(1, round((distance_km / speed_kmh) * 60))


def _triage_mode(distance_km: float | None, is_tieup: bool) -> str:
    """Classify the result into a triage action mode.

    Returns one of:
      'close_dispatch'   – MEDCLUES ambulance can reach; standard flow
      'hybrid_triage'    – too far for our ambulance; call 108 + book ER slot
      'no_partner_found' – no partner hospital at all; call 108 only
    """
    if not is_tieup or distance_km is None:
        return "no_partner_found"
    if distance_km <= TRIAGE_CLOSE_KM:
        return "close_dispatch"
    return "hybrid_triage"


# ── Core finder ───────────────────────────────────────────────────────────────

async def find_nearest_hospital(lat: float, lon: float,
                                 max_radius_km: float | None = None) -> dict:
    """Return the nearest hospital with metadata needed for the case response.

    Performs a PROGRESSIVE RADIUS SEARCH over SEARCH_RADII rings.  The first
    ring that yields a MEDCLUES partner tie-up is used. If none is found even
    at the largest radius, falls back to OSM public hospital data.

    Returns a dict with keys:
        hospital_id, hospital_name, hospital_address, hospital_phone,
        distance_km, eta_minutes, latitude, longitude, is_tieup,
        triage_mode, emergency_contacts, search_radius_used
    """
    # Fetch all tie-up hospitals once (single DB query, then filter in Python
    # across each radius ring — avoids N round-trips to the database).
    rows = await db.query(
        """
        SELECT id, name, address, contact,
               latitude, longitude
        FROM hospital_tieups
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """,
    )

    # Pre-compute distances for every tie-up
    candidates_all: list[dict] = []
    for row in rows:
        try:
            h_lat, h_lon = float(row["latitude"]), float(row["longitude"])
        except (TypeError, ValueError):
            continue
        dist = _haversine(lat, lon, h_lat, h_lon)
        candidates_all.append({
            "hospital_id": row["id"],
            "hospital_name": row["name"],
            "hospital_address": row["address"] or "",
            "hospital_phone": row["contact"] or "",
            "latitude": h_lat,
            "longitude": h_lon,
            "distance_km": round(dist, 2),
            "eta_minutes": _estimate_eta_minutes(dist),
            "is_tieup": True,
        })

    # ── Progressive radius expansion ──────────────────────────────────────────
    radii = SEARCH_RADII if not max_radius_km else [r for r in SEARCH_RADII if r <= max_radius_km] or [max_radius_km]
    last_radius = radii[-1]

    for radius in radii:
        within = [c for c in candidates_all if c["distance_km"] <= radius]
        if within:
            best = min(within, key=lambda x: x["distance_km"])
            log.info(
                "Hospital finder: tie-up '%s' at %.2fkm (search radius %dkm)",
                best["hospital_name"], best["distance_km"], radius
            )
            mode = _triage_mode(best["distance_km"], is_tieup=True)
            return _build_result(best, mode, radius)

        log.info(
            "Hospital finder: no tie-up within %dkm, expanding search…", radius
        )

    # ── OSM fallback (public hospital) ────────────────────────────────────────
    log.info("Hospital finder: no tie-up found — falling back to OSM (radius=%dkm)", last_radius)
    osm = await _osm_nearest_hospital(lat, lon, radius_km=last_radius)
    if osm:
        mode = "no_partner_found"   # OSM result = public hospital, not MEDCLUES partner
        return _build_result(osm, mode, last_radius)

    # ── Nothing found ─────────────────────────────────────────────────────────
    log.warning("Hospital finder: no hospital found near (%.4f, %.4f)", lat, lon)
    return _build_result(
        {
            "hospital_id": None,
            "hospital_name": "Nearest Hospital (Locating…)",
            "hospital_address": "",
            "hospital_phone": "",
            "latitude": lat,
            "longitude": lon,
            "distance_km": 0.0,
            "eta_minutes": 15,
            "is_tieup": False,
        },
        "no_partner_found",
        last_radius,
    )


def _build_result(hospital: dict, triage_mode: str, search_radius_used: int) -> dict:
    """Attach triage metadata and emergency contacts to the hospital result."""
    result = dict(hospital)
    result["triage_mode"] = triage_mode
    result["search_radius_used"] = search_radius_used
    result["emergency_contacts"] = {
        "ambulance_108": EMERGENCY_NUMBER_AMBULANCE,
        "police_112":    EMERGENCY_NUMBER_POLICE,
    }

    # Human-readable action guidance for the partner app / front-end
    dist = hospital.get("distance_km") or 0
    if triage_mode == "close_dispatch":
        result["triage_message"] = (
            f"✅ MEDCLUES partner hospital is {dist} km away. "
            "Ambulance being dispatched. Please wait."
        )
        result["show_108_button"]      = False
        result["show_er_booking"]      = True
        result["er_booking_immediate"] = True

    elif triage_mode == "hybrid_triage":
        result["triage_message"] = (
            f"⚠️ Nearest MEDCLUES partner hospital is {dist} km away. "
            "Call 108 for immediate local ambulance — we have pre-booked "
            "your ER slot at the partner hospital so the team will be ready."
        )
        result["show_108_button"]      = True
        result["show_er_booking"]      = True
        result["er_booking_immediate"] = False   # notify hospital for preparation, not ambulance dispatch

    else:   # no_partner_found
        result["triage_message"] = (
            "🚨 No MEDCLUES partner hospital is reachable. "
            "Please call 108 (Ambulance) or 112 (Police) immediately."
        )
        result["show_108_button"]      = True
        result["show_er_booking"]      = False
        result["er_booking_immediate"] = False

    return result


# ── OSM Overpass fallback ─────────────────────────────────────────────────────

async def _osm_nearest_hospital(lat: float, lon: float,
                                radius_km: float = 15.0) -> Optional[dict]:
    """Query OpenStreetMap Overpass API for the nearest hospital node."""
    radius_m = int(radius_km * 1000)
    query = f"""
      [out:json][timeout:25];
      (
        node["amenity"~"hospital|clinic"]["name"](around:{radius_m},{lat},{lon});
        way["amenity"~"hospital|clinic"]["name"](around:{radius_m},{lat},{lon});
      );
      out center tags 5;
    """
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    for url in endpoints:
        try:
            async with httpx.AsyncClient(timeout=28.0) as client:
                resp = await client.post(url, data={"data": query},
                                         headers={"User-Agent": "MEDCLUES/EmergencyFinder"})
                if resp.status_code != 200:
                    continue
                elements = resp.json().get("elements", [])
                if not elements:
                    continue
                best: Optional[dict] = None
                best_dist = float("inf")
                for el in elements:
                    tags = el.get("tags", {})
                    h_lat = el.get("lat") or (el.get("center") or {}).get("lat")
                    h_lon = el.get("lon") or (el.get("center") or {}).get("lon")
                    if h_lat is None or h_lon is None:
                        continue
                    dist = _haversine(lat, lon, float(h_lat), float(h_lon))
                    if dist < best_dist:
                        best_dist = dist
                        best = {
                            "hospital_id": None,
                            "hospital_name": tags.get("name") or "Public Hospital",
                            "hospital_address": tags.get("addr:full") or tags.get("addr:street") or "",
                            "hospital_phone": tags.get("phone") or tags.get("contact:phone") or "",
                            "latitude": float(h_lat),
                            "longitude": float(h_lon),
                            "distance_km": round(dist, 2),
                            "eta_minutes": _estimate_eta_minutes(dist),
                            "is_tieup": False,
                        }
                if best:
                    log.info("OSM fallback: '%s' %.2fkm", best["hospital_name"], best["distance_km"])
                    return best
        except Exception as exc:
            log.warning("OSM fallback error (%s): %s", url, exc)

    return None
