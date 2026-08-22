import json
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from app.config.db import db

async def get_all_doctors(limit: int | None = 500, offset: int = 0, q: str | None = None):
    """List doctors with optional pagination and trigram-friendly search."""
    params: list = []
    where = ""
    if q and q.strip():
        params.append(f"%{q.strip()}%")
        where = """
        WHERE (
            d.name ILIKE $1
            OR COALESCE(d.speciality, '') ILIKE $1
            OR COALESCE(h.name, '') ILIKE $1
        )
        """
    base = f"""
        SELECT d.*, h.name as hospital_name, h.contact as hospital_contact
        FROM doctors d
        LEFT JOIN hospital_tieups h ON d.hospital_id = h.id
        {where}
        ORDER BY d.date DESC NULLS LAST, d.id DESC
    """
    if limit is None:
        return await db.query(base, *params) if params else await db.query(base)
    lim = max(1, min(int(limit), 2000))
    off = max(0, int(offset or 0))
    if params:
        return await db.query(base + f" LIMIT ${len(params)+1} OFFSET ${len(params)+2}", *params, lim, off)
    return await db.query(base + " LIMIT $1 OFFSET $2", lim, off)

async def get_doctor_by_id(doc_id: Union[int, str]):
    if isinstance(doc_id, str) and doc_id.startswith('emb_'):
        # Search in hospital_tieup_doctors
        try:
            actual_id = int(doc_id.replace('emb_', ''))
            sql = '''
                SELECT d.*, h.name as hospital_name, h.contact as hospital_contact, h.id as hospital_id
                FROM hospital_tieup_doctors d
                JOIN hospital_tieups h ON d.hospital_tieup_id = h.id
                WHERE d.id = $1
            '''
            doc = await db.fetch_row(sql, actual_id)
            if doc:
                # Format to match general doctor fields
                return {
                    "id": f"emb_{doc['id']}",
                    "name": doc['name'],
                    "speciality": doc.get('specialization') or doc.get('speciality'),
                    "degree": doc.get('qualification') or doc.get('degree'),
                    "experience": doc['experience'],
                    "about": doc.get('about', "Medical Specialist"),
                    "fees": doc.get('fees', 500),
                    "image": doc['image'],
                    "available": doc.get('available', True),
                    "hospital_id": doc['hospital_tieup_id'],
                    "hospital_name": doc['hospital_name'],
                    "slots_booked": doc.get('slots_booked', '{}')
                }
            return None
        except ValueError:
            return None

    # Standard doctor
    try:
        numeric_id = int(doc_id)
        sql = '''
            SELECT d.*, h.name as hospital_name, h.contact as hospital_contact 
            FROM doctors d 
            LEFT JOIN hospital_tieups h ON d.hospital_id = h.id 
            WHERE d.id = $1
        '''
        standard_doc = await db.fetch_row(sql, numeric_id)
        if standard_doc:
            return standard_doc

        # Fallback: allow numeric ids that belong to embedded hospital doctors.
        emb_sql = '''
            SELECT d.*, h.name as hospital_name, h.contact as hospital_contact, h.id as hospital_id
            FROM hospital_tieup_doctors d
            JOIN hospital_tieups h ON d.hospital_tieup_id = h.id
            WHERE d.id = $1
        '''
        emb_doc = await db.fetch_row(emb_sql, numeric_id)
        if emb_doc:
            return {
                "id": f"emb_{emb_doc['id']}",
                "name": emb_doc['name'],
                "speciality": emb_doc.get('specialization') or emb_doc.get('speciality'),
                "degree": emb_doc.get('qualification') or emb_doc.get('degree'),
                "experience": emb_doc['experience'],
                "about": emb_doc.get('about', "Medical Specialist"),
                "fees": emb_doc.get('fees', 500),
                "image": emb_doc['image'],
                "available": emb_doc.get('available', True),
                "hospital_id": emb_doc['hospital_tieup_id'],
                "hospital_name": emb_doc['hospital_name'],
                "slots_booked": emb_doc.get('slots_booked', '{}')
            }
        return None
    except ValueError:
        return None

async def get_doctor_by_email(email: str):
    sql = 'SELECT * FROM doctors WHERE email = $1'
    return await db.fetch_row(sql, email)

async def get_doctors_by_specialty(speciality: str):
    sql = """
        SELECT d.*, h.name as hospital_name, h.contact as hospital_contact
        FROM doctors d
        LEFT JOIN hospital_tieups h ON d.hospital_id = h.id
        WHERE d.speciality = $1 AND d.available = true
        ORDER BY d.name ASC
    """
    return await db.query(sql, speciality)
 
async def get_doctors_by_hospital_id(hospital_id: int):
    sql = '''
        SELECT d.*, h.name as hospital_name, h.contact as hospital_contact
        FROM doctors d
        LEFT JOIN hospital_tieups h ON d.hospital_id = h.id
        WHERE d.hospital_id = $1
        ORDER BY d.name ASC
    '''
    return await db.query(sql, hospital_id)

async def _sync_doctors_id_sequence():
    """Keep doctors id sequence aligned after seed scripts that insert explicit ids."""
    await db.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('doctors', 'id'),
            COALESCE((SELECT MAX(id) FROM doctors), 1),
            true
        )
        """
    )


def _coerce_doctor_date_ms(raw) -> int:
    """doctors.date is BIGINT (epoch ms), not a timestamp string."""
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    if isinstance(raw, str) and raw.isdigit():
        return int(raw)
    return int(datetime.now().timestamp() * 1000)


async def create_doctor(doctor_data: Dict[str, Any]):
    address = doctor_data.get('address', {})
    address_line1 = address.get('line1', '')
    address_line2 = address.get('line2', '')
    
    date_val = _coerce_doctor_date_ms(doctor_data.get('date'))

    await _sync_doctors_id_sequence()

    from app.services import public_id_service

    public_id = await public_id_service.new_doctor_public_id()
    sql = """
        INSERT INTO doctors (
            name, email, password, image, speciality, degree, experience,
            about, available, fees, address_line1, address_line2, date, slots_booked,
            hospital_id, video_consult, public_id, documents, phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
    """
    values = (
        doctor_data.get('name'),
        doctor_data.get('email'),
        doctor_data.get('password'),
        doctor_data.get('image'),
        doctor_data.get('speciality'),
        doctor_data.get('degree'),
        doctor_data.get('experience'),
        doctor_data.get('about'),
        doctor_data.get('available', True),
        doctor_data.get('fees'),
        address_line1,
        address_line2,
        date_val,
        json.dumps(doctor_data.get('slots_booked', {})),
        doctor_data.get('hospitalId'),
        doctor_data.get('videoConsult', False),
        public_id,
        json.dumps(doctor_data.get('documents') or {}),
        doctor_data.get('phone'),
    )
    return await db.fetch_row(sql, *values)

async def update_doctor(doc_id: Union[int, str], doctor_data: Dict[str, Any]):
    # Handle embedded doctor
    if isinstance(doc_id, str) and doc_id.startswith('emb_'):
        try:
            actual_id = int(doc_id.replace('emb_', ''))
            fields = []
            values = []
            param_count = 1
            
            # Limited mapping for embedded doctors table
            mapping = {
                'name': 'name',
                'speciality': 'specialization',
                'degree': 'qualification',
                'experience': 'experience',
                'about': 'about',
                'fees': 'fees',
                'available': 'available',
                'status': 'status',
                'op_start': 'op_start',
                'op_end': 'op_end',
                'op_start_afternoon': 'op_start_afternoon',
                'op_end_afternoon': 'op_end_afternoon',
                'max_appointments_morning': 'max_appointments_morning',
                'max_appointments_afternoon': 'max_appointments_afternoon',
                'video_op_start': 'video_op_start',
                'video_op_end': 'video_op_end',
                'max_video_slots': 'max_video_slots',
                'video_slot_minutes': 'video_slot_minutes',
            }
            
            for key, column in mapping.items():
                if key in doctor_data:
                    fields.append(f"{column} = ${param_count}")
                    values.append(doctor_data[key])
                    param_count += 1
            
            if 'image' in doctor_data:
                fields.append(f"image = ${param_count}")
                values.append(doctor_data['image'])
                param_count += 1
                
            if 'slots_booked' in doctor_data:
                fields.append(f"slots_booked = ${param_count}")
                values.append(json.dumps(doctor_data['slots_booked']))
                param_count += 1

            if not fields:
                return None

            fields.append(f"updated_at = CURRENT_TIMESTAMP")
            sql = f"UPDATE hospital_tieup_doctors SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
            values.append(actual_id)
            return await db.fetch_row(sql, *values)
        except:
            return None

    # Standard doctor update
    doc_id = int(doc_id)
    fields = []
    values = []
    param_count = 1

    mapping = {
        'name': 'name',
        'email': 'email',
        'password': 'password',
        'image': 'image',
        'speciality': 'speciality',
        'degree': 'degree',
        'experience': 'experience',
        'about': 'about',
        'available': 'available',
        'fees': 'fees',
        'status': 'status',
        'current_appointment_id': 'current_appointment_id',
        'hospitalId': 'hospital_id',
        'videoConsult': 'video_consult',
        'locationLat': 'location_lat',
        'locationLng': 'location_lng',
        'op_start': 'op_start',
        'op_end': 'op_end',
        'op_start_afternoon': 'op_start_afternoon',
        'op_end_afternoon': 'op_end_afternoon',
        'max_appointments_morning': 'max_appointments_morning',
        'max_appointments_afternoon': 'max_appointments_afternoon',
        'video_op_start': 'video_op_start',
        'video_op_end': 'video_op_end',
        'max_video_slots': 'max_video_slots',
        'video_slot_minutes': 'video_slot_minutes',
        'phone': 'phone',
    }

    for key, column in mapping.items():
        if key in doctor_data:
            fields.append(f"{column} = ${param_count}")
            values.append(doctor_data[key])
            param_count += 1

    if 'available_days' in doctor_data:
        fields.append(f"available_days = ${param_count}")
        values.append(json.dumps(doctor_data['available_days'] or []))
        param_count += 1

    if 'address' in doctor_data:
        addr = doctor_data['address'] or {}
        fields.append(f"address_line1 = ${param_count}")
        values.append(addr.get('line1', ''))
        param_count += 1
        fields.append(f"address_line2 = ${param_count}")
        values.append(addr.get('line2', ''))
        param_count += 1

    if 'slots_booked' in doctor_data:
        fields.append(f"slots_booked = ${param_count}")
        values.append(json.dumps(doctor_data['slots_booked']))
        param_count += 1

    if not fields:
        return None

    fields.append(f"updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE doctors SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(doc_id)

    return await db.fetch_row(sql, *values)

async def update_doctor_password(doc_id: int, hashed_password: str):
    sql = 'UPDATE doctors SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *'
    return await db.fetch_row(sql, hashed_password, doc_id)

async def change_doctor_availability(doc_id: Union[int, str], available: bool):
    if isinstance(doc_id, str) and doc_id.startswith('emb_'):
        try:
            actual_id = int(doc_id.replace('emb_', ''))
            sql = 'UPDATE hospital_tieup_doctors SET available = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *'
            return await db.fetch_row(sql, available, actual_id)
        except:
            return None
            
    sql = 'UPDATE doctors SET available = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *'
    return await db.fetch_row(sql, available, doc_id)

async def delete_doctor(doc_id: int):
    sql = 'DELETE FROM doctors WHERE id = $1 RETURNING *'
    return await db.fetch_row(sql, doc_id)
