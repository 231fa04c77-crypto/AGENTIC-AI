import bcrypt
import json
from app.models import hospital_model, doctor_model
from app.config.db import db
from app.utils.formatters import format_doctor

# Helper for formatting hospital for frontend
def format_hospital(h):
    if not h: return None
    
    # Convert to dict for safe property access if it's a Record object
    h_dict = dict(h) if not isinstance(h, dict) else h

    spec = (h_dict.get('specialization') or '').lower()
    typ = (h_dict.get('type') or '').lower()
    emergency_available = typ == 'main' or any(
        k in spec for k in ('critical', 'emergency', 'trauma', '24/7', 'multi-specialty')
    )

    return {
        "_id": str(h_dict.get('id')),
        "id": h_dict.get('id'),
        "name": h_dict.get('name'),
        "address": h_dict.get('address') if 'address' in h_dict else f"{h_dict.get('address_line1', '')} {h_dict.get('address_line2', '')}".strip(),
        "hospitalName": h_dict.get('name'),
        "location": h_dict.get('address') if 'address' in h_dict else f"{h_dict.get('address_line1', '')} {h_dict.get('address_line2', '')}".strip(),
        "contact": h_dict.get('contact', "Not available"),
        "mapsLink": (h_dict.get('maps_link') or '').strip() or None,
        "backgroundImage": (h_dict.get('background_image') or '').strip() or None,
        "hospitalType": 'PARTNER' if h_dict.get('type') == 'General' else ('MAIN' if h_dict.get('type') == 'Main' else h_dict.get('type', 'GENERAL')),
        "type": h_dict.get('type', 'General'),
        "specialization": h_dict.get('specialization', 'General'),
        "showOnHome": h_dict.get('show_on_home', True),
        "latitude": h_dict.get('latitude'),
        "longitude": h_dict.get('longitude'),
        "emergencyAvailable": emergency_available,
        "emergencyLabel": "24/7" if emergency_available else "Limited",
    }

# --- Public API ---

async def hospital_list(limit: int | None = 100, offset: int = 0, q: str | None = None):
    try:
        from app.services import cache_keys as ck
        from app.services import cache_service as cache

        lim = max(1, min(int(limit or 100), 1000))
        off = max(0, int(offset or 0))
        cache_key = ck.hospital_list(lim, off, q or "")

        async def _load():
            import asyncio
            from collections import defaultdict

            hospitals, all_doctors, all_embedded_docs = await asyncio.gather(
                hospital_model.get_all_hospital_tieups(),
                doctor_model.get_all_doctors(limit=None),
                hospital_model.get_all_hospital_tieup_doctors_with_hospitals(),
            )

            doc_count = defaultdict(int)
            for doc in all_doctors:
                h_id = doc.get('hospital_id')
                if h_id is not None:
                    doc_count[int(h_id)] += 1
            for d in all_embedded_docs:
                h_id = d.get('hospital_tieup_id')
                if h_id is not None:
                    doc_count[int(h_id)] += 1

            formatted = []
            ql = (q or "").strip().lower()
            for h in hospitals:
                entry = format_hospital(h)
                if not entry:
                    continue
                if ql and ql not in (entry.get("name") or "").lower() and ql not in (entry.get("address") or "").lower():
                    continue
                hospital_id = entry.get('id')
                if hospital_id is not None:
                    entry['doctorCount'] = doc_count.get(int(hospital_id), 0)
                formatted.append(entry)
            formatted.sort(key=lambda x: (0 if x['hospitalType'] == 'MAIN' else 1, x['name']))
            page = formatted[off : off + lim]
            return {
                "success": True,
                "hospitals": page,
                "total": len(formatted),
                "limit": lim,
                "offset": off,
            }

        return await cache.cache_aside(cache_key, ck.TTL_HOSPITAL_LIST, _load)
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_hospital_tieup_details(hospital_id: int):
    try:
        # Get hospital details and convert to dict
        hospital = await hospital_model.get_hospital_tieup_by_id(hospital_id)
        if not hospital:
            return {"success": False, "message": "Hospital not found"}
        
        h_dict = dict(hospital)

        # Fetch both doctor sets in parallel (regular + embedded roster).
        import asyncio
        assigned_docs, embedded_docs = await asyncio.gather(
            doctor_model.get_doctors_by_hospital_id(hospital_id),
            hospital_model.get_hospital_tieup_doctors(hospital_id),
        )
        real_doctors = [format_doctor(doc) for doc in assigned_docs]

        # Track names to prevent duplicates
        seen_names = {d['name'].lower().strip() for d in real_doctors}

        for doc in embedded_docs:
            d_dict = dict(doc)
            name_key = d_dict['name'].lower().strip()
            if name_key not in seen_names:
                emb_formatted = format_doctor({
                    **d_dict,
                    "id": f"emb_{d_dict['id']}",
                    "speciality": d_dict.get('specialization'),
                    "degree": d_dict.get('qualification'),
                })
                if emb_formatted:
                    real_doctors.append(emb_formatted)
                    seen_names.add(name_key)

        hospital_data = format_hospital(h_dict)
        hospital_data['doctors'] = real_doctors

        return {
            "success": True,
            "hospital": hospital_data
        }
    except Exception as e:
        print(f"[ERROR] Error in get_hospital_tieup_details: {e}")
        return {"success": False, "message": str(e)}

async def get_doctors_by_hospital(hospital_id: int):
    try:
        hospital = await hospital_model.get_hospital_tieup_by_id(hospital_id)
        if not hospital:
            return {"success": False, "message": "Hospital not found"}

        # Get real doctors assigned to this hospital
        assigned_docs = await doctor_model.get_doctors_by_hospital_id(hospital_id)
        # Filter regular doctors
        real_doctors = [
            format_doctor(doc) for doc in assigned_docs 
            if doc['available']
        ]

        return {
            "success": True,
            "doctors": real_doctors,
            "hospital": format_hospital(hospital)
        }
    except Exception as e:
        print(f"[ERROR] Error in get_doctors_by_hospital: {e}")
        return {"success": False, "message": str(e)}

# --- Admin API (Tie-ups) ---

async def add_hospital_tieup(data: dict):
    try:
        # Auto-geocode address
        from app.controllers.location_controller import geocode_address
        geo_res = await geocode_address(data.get('address', ''))
        if geo_res.get('success'):
            data['latitude'] = geo_res['coordinates']['lat']
            data['longitude'] = geo_res['coordinates']['lon']
            
        await hospital_model.create_hospital_tieup(data)
        try:
            from app.services import cache_service as cache
            await cache.invalidate_hospitals()
        except Exception:
            pass
        return {"success": True, "message": "Hospital Tie-up Added"}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def update_hospital_tieup(tieup_id: int, data: dict):
    try:
        # If address is updated, re-geocode
        if 'address' in data:
            from app.controllers.location_controller import geocode_address
            geo_res = await geocode_address(data['address'])
            if geo_res.get('success'):
                data['latitude'] = geo_res['coordinates']['lat']
                data['longitude'] = geo_res['coordinates']['lon']

        if 'mapsLink' in data or 'maps_link' in data:
            raw = (data.get('mapsLink') or data.get('maps_link') or '').strip()
            data['mapsLink'] = raw or None

        await hospital_model.update_hospital_tieup(tieup_id, data)
        try:
            from app.services import cache_service as cache
            await cache.invalidate_hospitals()
        except Exception:
            pass
        return {"success": True, "message": "Hospital Tie-up Updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def delete_hospital_tieup(tieup_id: int):
    try:
        await hospital_model.delete_hospital_tieup(tieup_id)
        try:
            from app.services import cache_service as cache
            await cache.invalidate_hospitals()
        except Exception:
            pass
        return {"success": True, "message": "Hospital Tie-up Deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_all_hospitals_admin():
    try:
        from collections import defaultdict
        
        # Fetch everything in parallel
        import asyncio
        hospitals_task = hospital_model.get_all_hospital_tieups()
        doctors_task = doctor_model.get_all_doctors()
        embedded_task = hospital_model.get_all_hospital_tieup_doctors_with_hospitals()
        
        hospitals, all_doctors, all_embedded_docs = await asyncio.gather(hospitals_task, doctors_task, embedded_task)
        
        # Pre-group doctors by hospital_id for O(1) lookup
        docs_by_hosp = defaultdict(list)
        for doc in all_doctors:
            h_id = doc.get('hospital_id')
            if h_id:
                docs_by_hosp[h_id].append({
                    "_id": doc['id'],
                    "name": doc['name'],
                    "qualification": doc['degree'],
                    "specialization": doc['speciality'],
                    "experience": doc['experience'],
                    "image": doc['image'],
                    "available": doc['available']
                })

        # Pre-group embedded docs by hospital_id
        embedded_by_hosp = defaultdict(list)
        for d in all_embedded_docs:
            h_id = d['hospital_tieup_id']
            embedded_by_hosp[h_id].append(d)

        hospitals_with_doc = []
        for h in hospitals:
            h_id = h['id']
            h_data = format_hospital(h)
            
            # Combine docs without duplicates
            hosp_docs = docs_by_hosp[h_id][:] # Start with regular docs
            seen_names = {d['name'].lower().strip() for d in hosp_docs}
            
            for d in embedded_by_hosp[h_id]:
                name_key = d['name'].lower().strip()
                if name_key not in seen_names:
                    hosp_docs.append({
                        "_id": d['id'],
                        "name": d['name'],
                        "qualification": d['qualification'],
                        "specialization": d['specialization'],
                        "experience": d['experience'],
                        "image": d['image'],
                        "available": d['available']
                    })
                    seen_names.add(name_key)
            
            h_data['doctors'] = hosp_docs
            hospitals_with_doc.append(h_data)
            
        return {"success": True, "hospitals": hospitals_with_doc}
    except Exception as e:
        print(f"[ERROR] Error in get_all_hospitals_admin: {e}")
        return {"success": False, "message": str(e)}
    except Exception as e:
        print(f"[ERROR] Error in get_all_hospitals_admin: {e}")
        return {"success": False, "message": str(e)}

async def get_all_hospital_doctors_public(
    limit: int | None = 100, offset: int = 0, q: str | None = None
):
    try:
        # Get all hospital doctors in one go instead of looping
        docs = await hospital_model.get_all_hospital_tieup_doctors_with_hospitals()
        all_public_doctors = []
        ql = (q or "").strip().lower()

        for doc in docs:
            d_dict = dict(doc)
            from app.utils.formatters import _parse_doctor_rating
            emb_rating = _parse_doctor_rating(d_dict)
            emb_reviews = d_dict.get('reviews') or 0
            try:
                emb_reviews = int(emb_reviews)
            except (TypeError, ValueError):
                emb_reviews = 10 + (d_dict['id'] % 90)
            name = d_dict.get('name') or ''
            spec = d_dict.get('specialization') or ''
            hname = d_dict.get('hospital_name') or ''
            if ql and ql not in name.lower() and ql not in spec.lower() and ql not in hname.lower():
                continue
            all_public_doctors.append({
                "_id": f"emb_{d_dict['id']}",
                "id": f"emb_{d_dict['id']}",
                "name": d_dict['name'],
                "specialization": d_dict.get('specialization'),
                "hospitalName": d_dict.get('hospital_name'),
                "hospitalId": d_dict['hospital_tieup_id'],
                "location": d_dict.get('hospital_address'),
                "qualification": d_dict.get('qualification') or d_dict.get('degree', 'M.B.B.S'),
                "fees": d_dict.get('fees', 50),
                "image": d_dict.get('image', ''),
                "available": d_dict.get('available', True),
                "rating": emb_rating,
                "reviews": emb_reviews,
                "experience": d_dict.get('experience'),
                "about": d_dict.get('about') or f"Dr. {d_dict['name']} is a specialist at {d_dict.get('hospital_name')}."
            })

        lim = max(1, min(int(limit or 100), 2000))
        off = max(0, int(offset or 0))
        page = all_public_doctors[off : off + lim]
        return {
            "success": True,
            "doctors": page,
            "total": len(all_public_doctors),
            "limit": lim,
            "offset": off,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_nearby_hospitals(lat: float, lon: float, radius_km: float = 50.0):
    try:
        from math import radians, cos, sin, asin, sqrt
        hospitals = await hospital_model.get_all_hospital_tieups()
        
        nearby = []
        for h in hospitals:
            h_lat = h.get('latitude')
            h_lon = h.get('longitude')
            
            if h_lat is None or h_lon is None:
                continue
                
            # Haversine formula
            lon1, lat1, lon2, lat2 = map(radians, [lon, lat, h_lon, h_lat])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            km = 6371 * c
            
            if km <= radius_km:
                h_data = format_hospital(h)
                h_data['distance'] = round(km, 1)
                nearby.append(h_data)
        
        nearby.sort(key=lambda x: x['distance'])
        return {"success": True, "hospitals": nearby[:5]} # Top 5 nearest
    except Exception as e:
        print(f"[ERROR] Error in get_nearby_hospitals: {e}")
        return {"success": False, "message": str(e)}
