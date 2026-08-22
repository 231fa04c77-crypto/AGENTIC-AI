import math
import httpx
import urllib.parse
import re
from typing import List, Optional

# Earth's radius in km
R = 6371

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates using Haversine formula"""
    d_lat = (lat2 - lat1) * math.pi / 180
    d_lon = (lon2 - lon1) * math.pi / 180
    a = (math.sin(d_lat / 2) * math.sin(d_lat / 2) +
         math.cos(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) *
         math.sin(d_lon / 2) * math.sin(d_lon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def geocode_address(address: str):
    try:
        if not address:
            return {"success": False, "message": "Address is required"}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": address,
                    "format": "json",
                    "limit": 1
                },
                headers={
                    "User-Agent": "MedChain Hospital Finder"
                }
            )
            
            data = response.json()
            if data and len(data) > 0:
                return {
                    "success": True,
                    "coordinates": {
                        "lat": float(data[0]['lat']),
                        "lon": float(data[0]['lon'])
                    }
                }
            
            return {"success": False, "message": "Address not found"}
    except Exception as e:
        print(f"Geocoding error: {e}")
        return {"success": False, "message": "Error geocoding address", "error": str(e)}

async def find_nearby_hospitals(lat: float, lon: float, radius: float = 3.0):
    try:
        radius_meters = radius * 1000
        
        # Overpass API query - streamlined for Hospitals AND Labs
        overpass_query = f"""
          [out:json][timeout:25];
          (
            node["amenity"~"hospital|clinic|laboratory|doctors|dentist"](around:{radius_meters},{lat},{lon});
            way["amenity"~"hospital|clinic|laboratory|doctors|dentist"](around:{radius_meters},{lat},{lon});
            node["healthcare"~"hospital|clinic|laboratory|diagnostic_center"](around:{radius_meters},{lat},{lon});
            way["healthcare"~"hospital|clinic|laboratory|diagnostic_center"](around:{radius_meters},{lat},{lon});
          );
          out center tags;
        """
        
        endpoints = [
          'https://overpass-api.de/api/interpreter',
          'https://overpass.kumi.systems/api/interpreter',
          'https://lz4.overpass-api.de/api/interpreter'
        ]
        
        response_data = None
        last_error = None
        
        async with httpx.AsyncClient() as client:
            headers = {"User-Agent": "MedCluesApp/1.0 (https://github.com/medichain; contact@medclues.com)"}
            for endpoint in endpoints:
                try:
                    res = await client.post(
                        endpoint,
                        data={"data": overpass_query},
                        headers=headers,
                        timeout=25.0  # BUG FIX: Increased from 10s to 25s — was causing intermittent empty results
                    )
                    if res.status_code == 200:
                        response_data = res.json()
                        break
                    elif res.status_code == 429:
                        continue
                except Exception as e:
                    last_error = str(e)
                    continue
                    
        if not response_data:
            return {
                "success": False, 
                "message": "Unable to fetch nearby hospitals", 
                "error": last_error or "All endpoints failed"
            }
            
        hospitals = []
        elements = response_data.get('elements', [])
        
        for element in elements:
            tags = element.get('tags', {})
            amenity = tags.get('amenity', '').lower()
            healthcare = tags.get('healthcare', '').lower()
            
            # More inclusive filtering - check both amenity and healthcare tags
            is_medical = (
                amenity in ['hospital', 'clinic', 'doctors', 'pharmacy', 'laboratory', 'dentist'] or
                healthcare in ['hospital', 'clinic', 'doctors', 'laboratory', 'diagnostic_center', 'center'] or
                'hospital' in tags.get('name', '').lower()
            )
            
            if not is_medical:
                continue
                
            e_lat, e_lon = None, None
            if element.get('type') == 'node':
                e_lat, e_lon = element.get('lat'), element.get('lon')
            elif element.get('center'):
                e_lat, e_lon = element['center'].get('lat'), element['center'].get('lon')
            elif element.get('lat') and element.get('lon'):
                e_lat, e_lon = element.get('lat'), element.get('lon')
                
            if e_lat is None or e_lon is None:
                continue
                
            distance = calculate_distance(lat, lon, e_lat, e_lon)
            
            # Address extraction
            address_list = []
            for key in ['addr:housenumber', 'addr:street', 'addr:road', 'addr:house', 
                        'addr:neighbourhood', 'addr:city', 'addr:state', 'addr:postcode']:
                val = tags.get(key)
                if val: address_list.append(val)
                
            address = ", ".join(address_list) if address_list else tags.get('addr:full', 'Address not available')
            
            # Phone extraction
            phone = tags.get('phone') or tags.get('contact:phone') or tags.get('tel') or 'Not available'
            
            # Specialization
            specialty = tags.get('healthcare:speciality') or tags.get('speciality') or 'General'
            
            # Determine display type
            display_type = 'Hospital'
            if 'laboratory' in [amenity, healthcare] or 'diagnostic' in healthcare:
                display_type = 'Laboratory'
            elif 'clinic' in [amenity, healthcare]:
                display_type = 'Clinic'
            elif 'pharmacy' in amenity:
                display_type = 'Pharmacy'
            elif amenity:
                display_type = amenity.capitalize()

            hospitals.append({
                "name": tags.get('name') or tags.get('name:en') or "Unnamed Medical Facility",
                "address": address,
                "phone": phone,
                "latitude": e_lat,
                "longitude": e_lon,
                "distance": round(distance, 2),
                "type": display_type,
                "specialization": specialty,
                "website": tags.get('website'),
                "openingHours": tags.get('opening_hours')
            })
            
        hospitals.sort(key=lambda x: x['distance'])
        
        return {
            "success": True,
            "hospitals": hospitals,
            "count": len(hospitals),
            "userLocation": {"lat": lat, "lon": lon},
            "radius": radius
        }
    except Exception as e:
        print(f"Nearby Hospitals Error: {e}")
        return {"success": False, "message": "Error finding nearby hospitals", "error": str(e)}
