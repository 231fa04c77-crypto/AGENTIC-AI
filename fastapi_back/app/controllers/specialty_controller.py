import re
from app.models import specialty_model, doctor_model

async def get_all_specialties():
    try:
        from app.services import cache_keys as ck
        from app.services import cache_service as cache

        async def _load():
            specialties = await specialty_model.get_all_specialties()
            return {"success": True, "data": specialties}

        return await cache.cache_aside(ck.specialty_list(), ck.TTL_SPECIALTY_LIST, _load)
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_specialty_by_name(specialty_name: str):
    try:
        specialty = await specialty_model.get_specialty_by_name(specialty_name)
        if not specialty:
            return {"success": False, "message": "Specialty not found"}
        return {"success": True, "data": specialty}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def create_specialty(data: dict, admin_id: int = None):
    try:
        specialty_name = data.get('specialtyName')
        helpline_number = data.get('helplineNumber')
        availability = data.get('availability', '24x7')
        status = data.get('status', 'Active')

        # Validate phone number format
        if helpline_number and not re.match(r"^[\d\s\-\+\(\)]+$", helpline_number):
            return {"success": False, "message": "Invalid phone number format"}

        # Check if specialty already exists
        existing = await specialty_model.get_specialty_by_name(specialty_name)
        if existing:
            return {"success": False, "message": "Specialty already exists"}

        specialty_data = {
            "specialtyName": specialty_name,
            "helplineNumber": helpline_number,
            "availability": availability,
            "status": status,
            "updatedBy": admin_id
        }

        specialty = await specialty_model.create_specialty(specialty_data)
        try:
            from app.services import cache_service as cache
            await cache.invalidate_specialties()
        except Exception:
            pass
        return {"success": True, "message": "Specialty helpline created successfully", "data": specialty}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def update_specialty(specialty_id: int, data: dict, admin_id: int = None):
    try:
        helpline_number = data.get('helplineNumber')
        availability = data.get('availability')
        status = data.get('status')

        # Validate phone number if provided
        if helpline_number and not re.match(r"^[\d\s\-\+\(\)]+$", helpline_number):
            return {"success": False, "message": "Invalid phone number format"}

        update_data = {
            "helplineNumber": helpline_number,
            "availability": availability,
            "status": status,
            "updatedBy": admin_id
        }

        specialty = await specialty_model.update_specialty(specialty_id, update_data)
        if not specialty:
            return {"success": False, "message": "Specialty not found"}

        try:
            from app.services import cache_service as cache
            await cache.invalidate_specialties()
        except Exception:
            pass
        return {"success": True, "message": "Specialty helpline updated successfully", "data": specialty}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def delete_specialty(specialty_id: int):
    try:
        specialty = await specialty_model.delete_specialty(specialty_id)
        if not specialty:
            return {"success": False, "message": "Specialty not found"}
        try:
            from app.services import cache_service as cache
            await cache.invalidate_specialties()
        except Exception:
            pass
        return {"success": True, "message": "Specialty helpline deleted successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_helpline_for_appointment(doc_id):
    try:
        doctor = await doctor_model.get_doctor_by_id(int(doc_id))
        if not doctor:
            return {"success": False, "message": "Doctor not found"}

        specialty = await specialty_model.get_specialty_by_name(doctor['speciality'])
        if not specialty:
            return {"success": False, "message": "Helpline not available for this specialty"}

        return {"success": True, "data": specialty}
    except Exception as e:
        return {"success": False, "message": str(e)}
