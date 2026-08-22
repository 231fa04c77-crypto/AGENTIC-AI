import math
from app.models import blood_bank_model

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in KM
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLon / 2) * math.sin(dLon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def list_blood_banks():
    try:
        banks = await blood_bank_model.get_all_blood_banks()
        return {"success": True, "bloodBanks": banks}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_nearby_blood_banks(lat: float, lng: float):
    try:
        all_banks = await blood_bank_model.get_all_blood_banks()
        
        banks_with_distance = []
        for bank in all_banks:
            dist = calculate_distance(lat, lng, float(bank['latitude']), float(bank['longitude']))
            # Use dict copy to avoid modifying original if needed
            bank_data = dict(bank)
            bank_data['distance'] = dist
            banks_with_distance.append(bank_data)
            
        banks_with_distance.sort(key=lambda x: x['distance'])
        return {"success": True, "bloodBanks": banks_with_distance}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def add_blood_bank(data: dict):
    try:
        bank = await blood_bank_model.create_blood_bank(data)
        return {"success": True, "message": "Blood bank added", "bloodBank": bank}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def update_blood_bank(bank_id: int, data: dict):
    try:
        bank = await blood_bank_model.update_blood_bank(bank_id, data)
        return {"success": True, "message": "Blood bank updated", "bloodBank": bank}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def delete_blood_bank(bank_id: int):
    try:
        await blood_bank_model.delete_blood_bank(bank_id)
        return {"success": True, "message": "Blood bank deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}
