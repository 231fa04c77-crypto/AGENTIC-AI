from typing import Optional, List, Dict, Any, Union
from app.models import appointment_model, doctor_model
from app.config.db import db
import json
import time

def _normalize_doc_id_for_db(doc_id: Union[str, int]) -> Union[str, int]:
    if isinstance(doc_id, str):
        if doc_id.startswith('emb_'):
            try:
                return int(doc_id.replace('emb_', ''))
            except ValueError:
                return doc_id
        try:
            return int(doc_id)
        except ValueError:
            return doc_id
    return doc_id

def _parse_json_field(val):
    if not val:
        return {}
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return {}
    return {}

def _parse_symptoms(raw):
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return raw if isinstance(raw, list) else []

def _is_in_doctor_queue(apt: dict) -> bool:
    """Patients reception verified and ready for the doctor."""
    rs = (apt.get('reception_status') or '').upper()
    lc = (apt.get('lifecycle_status') or '').upper()
    st = (apt.get('status') or '').lower()
    has_token = bool(apt.get('token_number') or apt.get('today_token'))
    if st == 'in-consult':
        return True
    if rs == 'READY_FOR_DOCTOR':
        return True
    if lc == 'CHECKED_IN' and has_token:
        return True
    if has_token and st in ('confirmed', 'in-queue', 'pending'):
        return True
    return False

def _format_queue_appointment(apt: dict, index: int) -> dict:
    user_data = _parse_json_field(apt.get('user_data'))
    patient_name = user_data.get('name', 'Unknown Patient')
    if apt.get('actual_patient_name') and not apt.get('actual_patient_is_self'):
        patient_name = apt.get('actual_patient_name')
    symptoms = _parse_symptoms(apt.get('selected_symptoms'))
    rs = apt.get('reception_status') or ''
    return {
        "_id": apt['id'],
        "id": apt['id'],
        "tokenNumber": apt.get('token_number') or apt.get('today_token') or (index + 1),
        "patientName": patient_name,
        "patientImage": user_data.get('image'),
        "patientPhone": user_data.get('phone'),
        "patientGender": user_data.get('gender'),
        "slotTime": apt.get('slot_time'),
        "slotDate": apt.get('slot_date'),
        "status": apt.get('status', 'pending'),
        "receptionStatus": rs,
        "lifecycleStatus": apt.get('lifecycle_status'),
        "queuePosition": index + 1,
        "mode": apt.get('mode'),
        "paymentMethod": apt.get('payment_method'),
        "payment": apt.get('payment'),
        "cancelled": bool(apt.get('cancelled')),
        "isCompleted": bool(apt.get('is_completed')),
        "symptoms": symptoms,
        "arrivedAt": (
            apt.get('arrived_at').isoformat()
            if apt.get('arrived_at') and hasattr(apt.get('arrived_at'), 'isoformat')
            else apt.get('arrived_at')
        ),
    }

async def calculate_queue_position(doc_id: Union[str, int], slot_date: str):
    try:
        db_doc_id = _normalize_doc_id_for_db(doc_id)
        # Get pending appointments for the doctor on that date
        appointments = await appointment_model.get_appointments_by_filters({
            "docId": db_doc_id,
            "slotDate": slot_date,
            "cancelled": False,
            "isCompleted": False,
            "status": ["pending", "confirmed", "in-queue", "in-consult"]
        })
        
        # Sort by token number
        appointments.sort(key=lambda x: x.get('token_number', 0))
        
        doctor = await doctor_model.get_doctor_by_id(doc_id)
        avg_consult_time = doctor.get('average_consultation_time', 15) if doctor else 15
        
        total_in_queue = len(appointments)
        
        # The position for the NEXT appointment would be total + 1
        queue_position = total_in_queue + 1
        estimated_wait_time = total_in_queue * avg_consult_time
        
        return {
            "queuePosition": queue_position,
            "estimated_wait_time": estimated_wait_time,
            "totalInQueue": total_in_queue
        }
    except Exception as e:
        print(f"[ERROR] Error calculating queue position: {e}")
        return {"queuePosition": 1, "estimated_wait_time": 0, "totalInQueue": 0}

async def assign_token_number(doc_id: Union[str, int], slot_date: str):
    """Next token for doctor+date under a transaction advisory lock (no duplicate tokens)."""
    try:
        from app.config.db import db

        db_doc_id = _normalize_doc_id_for_db(doc_id)
        if not db.pool:
            await db.connect()
        lock_key = f"queue_token:{db_doc_id}:{slot_date}"
        async with db.pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtext($1::text))",
                    lock_key,
                )
                if isinstance(db_doc_id, int) or (
                    isinstance(db_doc_id, str) and str(db_doc_id).isdigit()
                ):
                    row = await conn.fetchrow(
                        """
                        SELECT COALESCE(MAX(token_number), 0)::int AS m
                        FROM appointments
                        WHERE doctor_id = $1
                          AND slot_date = $2
                          AND cancelled = false
                        """,
                        int(db_doc_id),
                        slot_date,
                    )
                else:
                    row = await conn.fetchrow(
                        """
                        SELECT COALESCE(MAX(token_number), 0)::int AS m
                        FROM appointments
                        WHERE doctor_id::text = $1
                          AND slot_date = $2
                          AND cancelled = false
                        """,
                        str(db_doc_id),
                        slot_date,
                    )
                return int(row["m"]) + 1 if row else 1
    except Exception as e:
        print(f"[ERROR] Error assigning token number: {e}")
        return 1

async def get_doctor_queue_status(doc_id: Union[str, int], slot_date: str):
    try:
        from app.services import cache_keys as ck
        from app.services import cache_service as cache

        async def _load():
            db_doc_id = _normalize_doc_id_for_db(doc_id)
            appointments = await appointment_model.get_appointments_by_filters({
                "docId": db_doc_id,
                "slotDate": slot_date,
                "cancelled": False,
                "isCompleted": False,
                "status": ["pending", "confirmed", "in-queue", "in-consult"]
            })
            
            appointments.sort(key=lambda x: x.get('token_number', 0))
            
            doctor = await doctor_model.get_doctor_by_id(doc_id)
            current_status = doctor.get('status', 'in-clinic') if doctor else 'in-clinic'
            current_appointment_id = doctor.get('current_appointment_id') if doctor else None
            
            formatted_appointments = []
            for index, apt in enumerate(appointments):
                formatted_appointments.append(_format_queue_appointment(apt, index))
                
            return {
                "status": current_status,
                "currentAppointmentId": current_appointment_id,
                "queueLength": len(appointments),
                "appointments": formatted_appointments
            }

        return await cache.cache_aside(
            ck.queue_snapshot(doc_id, slot_date),
            ck.TTL_QUEUE_SNAPSHOT,
            _load,
        )
    except Exception as e:
        print(f"[ERROR] Error getting queue status: {e}")
        return None

async def get_doctor_in_queue(doc_id: Union[str, int], slot_date: str):
    """Queue patients verified by reception and ready for consultation."""
    try:
        db_doc_id = _normalize_doc_id_for_db(doc_id)
        appointments = await appointment_model.get_appointments_by_filters({
            "docId": db_doc_id,
            "slotDate": slot_date,
            "cancelled": False,
            "isCompleted": False,
        })
        in_queue = [a for a in appointments if _is_in_doctor_queue(a)]
        in_queue.sort(key=lambda x: (x.get('token_number') or x.get('today_token') or 9999))

        doctor = await doctor_model.get_doctor_by_id(doc_id)
        current_status = doctor.get('status', 'in-clinic') if doctor else 'in-clinic'
        current_appointment_id = doctor.get('current_appointment_id') if doctor else None

        formatted = [_format_queue_appointment(apt, i) for i, apt in enumerate(in_queue)]
        return {
            "status": current_status,
            "currentAppointmentId": current_appointment_id,
            "queueLength": len(formatted),
            "appointments": formatted,
        }
    except Exception as e:
        print(f"[ERROR] Error getting doctor in-queue: {e}")
        return None


async def get_next_waiting_appointment(
    doc_id: Union[str, int],
    slot_date: str,
    exclude_appointment_id: int,
):
    """Return the first reception-verified patient waiting after the active consult."""
    db_doc_id = _normalize_doc_id_for_db(doc_id)
    appointments = await appointment_model.get_appointments_by_filters({
        "docId": db_doc_id,
        "slotDate": slot_date,
        "cancelled": False,
        "isCompleted": False,
    })
    waiting = [
        apt for apt in appointments
        if int(apt.get("id") or 0) != int(exclude_appointment_id)
        and (apt.get("status") or "").lower() != "in-consult"
        and _is_in_doctor_queue(apt)
    ]
    waiting.sort(key=lambda apt: (
        apt.get("token_number") or apt.get("today_token") or 9999,
        apt.get("id") or 0,
    ))
    return waiting[0] if waiting else None
