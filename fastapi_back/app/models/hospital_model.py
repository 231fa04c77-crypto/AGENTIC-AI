import json
import re
from app.config.db import db
from datetime import datetime


def _extract_latlon_from_maps_link(url: str | None):
    """Extract (latitude, longitude) from a Google Maps URL, or return (None, None).

    Handles the common formats:
      • /maps/place/Name/@17.4532,78.3489,15z
      • /maps?q=17.4532,78.3489
      • maps.google.com/?ll=17.4532,78.3489
      • /maps/search/17.4532,78.3489
      • short links like maps.app.goo.gl  → cannot parse without HTTP redirect,
        so those return (None, None) — user must enter full URL.
    """
    if not url:
        return None, None
    # Pattern: two decimal numbers separated by a comma (optionally with a leading @)
    # Works for @lat,lon,zoom  and  q=lat,lon  and  ll=lat,lon
    match = re.search(
        r'[@?&/](-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)',
        url
    )
    if match:
        try:
            lat = float(match.group(1))
            lon = float(match.group(2))
            # Basic sanity check: valid lat/lon range
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                return lat, lon
        except ValueError:
            pass
    return None, None

# --- Hospital Model (Login-able) ---

async def get_all_hospitals():
    sql = "SELECT * FROM hospitals WHERE available = true ORDER BY name ASC"
    return await db.fetch_all(sql)

async def get_hospital_by_id(hospital_id: int):
    hospital_id = int(hospital_id)
    sql = "SELECT * FROM hospitals WHERE id = $1"
    return await db.fetch_one(sql, hospital_id)

async def get_hospital_by_email(email: str):
    sql = "SELECT * FROM hospitals WHERE email = $1"
    return await db.fetch_one(sql, email)

async def create_hospital(data: dict):
    sql = """
        INSERT INTO hospitals (
            name, email, password, image, address_line1, address_line2,
            speciality, about, available, date, latitude, longitude
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
    """
    address = data.get('address', {})
    values = [
        data.get('name'),
        data.get('email'),
        data.get('password'),
        data.get('image'),
        address.get('line1', ''),
        address.get('line2', ''),
        data.get('speciality', []),
        data.get('about', ''),
        data.get('available', True),
        int(datetime.now().timestamp() * 1000),
        data.get('latitude'),
        data.get('longitude')
    ]
    return await db.fetch_one(sql, *values)

async def update_hospital(hospital_id: int, data: dict):
    hospital_id = int(hospital_id)
    sql = """
        UPDATE hospitals SET
            name = COALESCE($1, name),
            image = COALESCE($2, image),
            address_line1 = COALESCE($3, address_line1),
            address_line2 = COALESCE($4, address_line2),
            speciality = COALESCE($5, speciality),
            about = COALESCE($6, about),
            available = COALESCE($7, available),
            latitude = COALESCE($8, latitude),
            longitude = COALESCE($9, longitude),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *
    """
    address = data.get('address', {})
    values = [
        data.get('name'),
        data.get('image'),
        address.get('line1'),
        address.get('line2'),
        data.get('speciality'),
        data.get('about'),
        data.get('available'),
        data.get('latitude'),
        data.get('longitude'),
        hospital_id
    ]
    return await db.fetch_one(sql, *values)

async def delete_hospital(hospital_id: int):
    hospital_id = int(hospital_id)
    sql = "DELETE FROM hospitals WHERE id = $1 RETURNING *"
    return await db.fetch_one(sql, hospital_id)


# --- Hospital Tie-Up Model ---

async def get_all_hospital_tieups():
    sql = "SELECT * FROM hospital_tieups ORDER BY id ASC"
    return await db.fetch_all(sql)

async def get_public_hospital_tieups():
    sql = "SELECT * FROM hospital_tieups WHERE show_on_home = true ORDER BY id ASC"
    return await db.fetch_all(sql)

async def get_hospital_tieup_by_id(tieup_id: int):
    tieup_id = int(tieup_id)
    sql = "SELECT * FROM hospital_tieups WHERE id = $1"
    return await db.fetch_one(sql, tieup_id)


async def _sync_hospital_tieups_id_sequence():
    """Keep hospital_tieups id sequence aligned after seed scripts with explicit ids."""
    await db.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('hospital_tieups', 'id'),
            COALESCE((SELECT MAX(id) FROM hospital_tieups), 1),
            true
        )
        """
    )


async def create_hospital_tieup(data: dict):
    await _sync_hospital_tieups_id_sequence()
    sql = """
        INSERT INTO hospital_tieups (
            name, address, contact, specialization, type, show_on_home,
            latitude, longitude, maps_link, background_image
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    """
    maps_link = (data.get('mapsLink') or data.get('maps_link') or '').strip() or None
    background_image = (data.get('backgroundImage') or data.get('background_image') or '').strip() or None

    # Auto-extract lat/lon from Google Maps link if not explicitly provided
    lat = data.get('latitude')
    lon = data.get('longitude')
    if (lat is None or lon is None) and maps_link:
        extracted_lat, extracted_lon = _extract_latlon_from_maps_link(maps_link)
        if extracted_lat is not None:
            lat = lat if lat is not None else extracted_lat
            lon = lon if lon is not None else extracted_lon

    values = [
        data.get('name'),
        data.get('address'),
        data.get('contact'),
        data.get('specialization'),
        data.get('type', 'General'),
        data.get('showOnHome', False),
        lat,
        lon,
        maps_link,
        background_image,
    ]
    return await db.fetch_one(sql, *values)

async def update_hospital_tieup(tieup_id: int, data: dict):
    tieup_id = int(tieup_id)
    fields = []
    values = []
    param_count = 1

    mapping = {
        'name': 'name',
        'address': 'address',
        'contact': 'contact',
        'specialization': 'specialization',
        'type': 'type',
        'showOnHome': 'show_on_home',
        'latitude': 'latitude',
        'longitude': 'longitude',
        'mapsLink': 'maps_link',
        'maps_link': 'maps_link',
        'backgroundImage': 'background_image',
        'background_image': 'background_image',
    }

    seen_db_keys = set()
    maps_link_val = None  # track for lat/lon extraction
    for key, db_key in mapping.items():
        if db_key in seen_db_keys:
            continue
        if key in data and data[key] is not None:
            val = data[key]
            if db_key == 'maps_link':
                val = (val or '').strip() or None
                maps_link_val = val
            elif db_key == 'background_image':
                # Empty string clears the banner (stored as NULL)
                val = (val or '').strip() or None
            seen_db_keys.add(db_key)
            fields.append(f"{db_key} = ${param_count}")
            values.append(val)
            param_count += 1

    # Auto-fill lat/lon from the maps_link if not already being updated
    if maps_link_val and 'latitude' not in seen_db_keys and 'longitude' not in seen_db_keys:
        extracted_lat, extracted_lon = _extract_latlon_from_maps_link(maps_link_val)
        if extracted_lat is not None:
            fields.append(f"latitude = ${param_count}")
            values.append(extracted_lat)
            param_count += 1
            fields.append(f"longitude = ${param_count}")
            values.append(extracted_lon)
            param_count += 1

    if not fields:
        return None
    
    fields.append(f"updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE hospital_tieups SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(tieup_id)

    return await db.fetch_one(sql, *values)

async def delete_hospital_tieup(tieup_id: int):
    tieup_id = int(tieup_id)
    sql = "DELETE FROM hospital_tieups WHERE id = $1 RETURNING *"
    return await db.fetch_one(sql, tieup_id)


# --- Hospital Tie-Up Doctors ---

async def get_hospital_tieup_doctors(hospital_id: int):
    hospital_id = int(hospital_id)
    sql = "SELECT * FROM hospital_tieup_doctors WHERE hospital_tieup_id = $1"
    return await db.fetch_all(sql, hospital_id)

async def get_all_hospital_tieup_doctors_with_hospitals():
    sql = """
        SELECT d.*, h.name as hospital_name, h.address as hospital_address
        FROM hospital_tieup_doctors d
        JOIN (
            SELECT id, name, address FROM hospital_tieups
            ORDER BY id ASC
            LIMIT 10
        ) h ON d.hospital_tieup_id = h.id
    """
    return await db.fetch_all(sql)

async def add_hospital_tieup_doctor(hospital_id: int, data: dict):
    hospital_id = int(hospital_id)
    sql = """
        INSERT INTO hospital_tieup_doctors (
            hospital_tieup_id, name, qualification, specialization, experience, 
            image, available, show_on_hospital_page
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    """
    values = [
        hospital_id,
        data.get('name'),
        data.get('qualification'),
        data.get('specialization'),
        data.get('experience'),
        data.get('image', ''),
        data.get('available', True),
        data.get('showOnHospitalPage', True)
    ]
    return await db.fetch_one(sql, *values)

async def delete_hospital_tieup_doctor(doctor_id: int):
    sql = "DELETE FROM hospital_tieup_doctors WHERE id = $1 RETURNING *"
    return await db.fetch_one(sql, doctor_id)
