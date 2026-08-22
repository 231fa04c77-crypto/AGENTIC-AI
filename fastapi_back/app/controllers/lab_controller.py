import math
import json
from app.models import lab_model, lab_booking_model

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in KM
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLon / 2) * math.sin(dLon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def format_lab(lab):
    if not lab: return None
    # Convert 'services' stored as JSON string back to list
    services = lab.get('services')
    if isinstance(services, str):
        try:
            services = json.loads(services)
        except:
            services = []
            
    return {
        "id": lab['id'],
        "name": lab['name'],
        "location": lab['location'],
        "city": lab['city'],
        "latitude": lab['latitude'],
        "longitude": lab['longitude'],
        "rating": lab['rating'],
        "verified": lab['verified'],
        "services": services,
        "openNow": lab.get('open_now', True),
        "partnerType": lab.get('partner_type', 'normal'),
        "image": lab['image'],
        "distance": lab.get('distance')
    }

async def list_labs():
    try:
        labs = await lab_model.get_all_labs()
        formatted = [format_lab(lab) for lab in labs]
        return {"success": True, "labs": formatted}
    except Exception as e:
        print(f"[ERROR] Error in list_labs: {e}")
        return {"success": False, "message": str(e)}

async def get_nearby_labs(lat: float, lng: float):
    try:
        all_labs = await lab_model.get_all_labs()
        labs_with_dist = []
        for lab in all_labs:
            dist = calculate_distance(lat, lng, float(lab['latitude']), float(lab['longitude']))
            lab_data = format_lab(lab)
            lab_data['distance'] = dist
            labs_with_dist.append(lab_data)
        
        labs_with_dist.sort(key=lambda x: x['distance'])
        return {"success": True, "labs": labs_with_dist}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def add_lab(data: dict):
    try:
        lab = await lab_model.create_lab(data)
        return {"success": True, "message": "Lab added", "lab": lab}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def update_lab(lab_id: int, data: dict):
    try:
        lab = await lab_model.update_lab(lab_id, data)
        return {"success": True, "message": "Lab updated", "lab": lab}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def delete_lab(lab_id: int):
    try:
        await lab_model.delete_lab(lab_id)
        return {"success": True, "message": "Lab deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# User Booking logic
async def book_lab_test(user_id: int, data: dict):
    try:
        from app.utils.ownership import reject_client_user_override

        override_err = reject_client_user_override(data, user_id)
        if override_err:
            return override_err
        data['userId'] = user_id
        booking = await lab_booking_model.create_lab_booking(data)
        return {"success": True, "message": "Lab test booked", "booking": booking}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_user_lab_bookings(user_id: int):
    try:
        bookings = await lab_booking_model.get_lab_bookings_by_user_id(user_id)
        return {"success": True, "bookings": bookings}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def cancel_lab_test(user_id: int, booking_id: int):
    try:
        from app.utils.ownership import row_owned_by, unauthorized

        booking = await lab_booking_model.get_lab_booking_by_id(int(booking_id))
        if not row_owned_by(booking, user_id):
            return unauthorized("Booking not found or unauthorized")
        await lab_booking_model.cancel_lab_booking(int(booking_id))
        return {"success": True, "message": "Booking cancelled"}
    except Exception as e:
        return {"success": False, "message": str(e)}
