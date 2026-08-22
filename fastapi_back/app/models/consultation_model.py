from app.config.db import db
from datetime import datetime
from typing import Optional, List, Dict, Any

async def get_consultation_by_id(consultation_id: int):
    sql = 'SELECT * FROM consultations WHERE id = $1'
    return await db.fetch_row(sql, consultation_id)

async def get_consultations_by_doctor_id(doctor_id: int):
    sql = 'SELECT * FROM consultations WHERE doctor_id = $1 ORDER BY created_at DESC'
    return await db.query(sql, doctor_id)

async def get_consultations_by_user_id(user_id: int):
    sql = 'SELECT * FROM consultations WHERE user_id = $1 ORDER BY created_at DESC'
    return await db.query(sql, user_id)

async def get_consultations_by_user_and_doctor(user_id: int, doctor_id: int):
    sql = """
        SELECT * FROM consultations
        WHERE user_id = $1 AND doctor_id = $2
        ORDER BY created_at DESC
    """
    return await db.query(sql, user_id, doctor_id)

async def get_consultation_by_appointment_id(appointment_id: int):
    sql = 'SELECT * FROM consultations WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 1'
    return await db.fetch_row(sql, appointment_id)

async def create_consultation(data: Dict[str, Any]):
    sql = """
        INSERT INTO consultations (appointment_id, user_id, doctor_id, status, type, notes, meeting_link, meeting_id, meeting_provider, scheduled_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    """
    values = (
        data.get('appointmentId'),
        data.get('userId') or data.get('patientId'),
        data.get('doctorId'),
        data.get('status', 'scheduled'),
        data.get('type', 'video'),
        data.get('notes', ''),
        data.get('meetingLink'),
        data.get('meetingId'),
        data.get('meetingProvider', 'google-meet'),
        data.get('scheduledAt', datetime.now())
    )
    return await db.fetch_row(sql, *values)

async def update_consultation(consultation_id: int, data: Dict[str, Any]):
    fields = []
    values = []
    param_count = 1

    mapping = {
        'status': 'status',
        'notes': 'notes',
        'endTime': 'end_time',
        'startedAt': 'started_at',
        'endedAt': 'ended_at',
        'duration': 'duration',
        'prescription': 'prescription',
        'prescriptionFile': 'prescription_file'
    }

    for key, column in mapping.items():
        if key in data:
            fields.append(f"{column} = ${param_count}")
            values.append(data[key])
            param_count += 1

    if not fields:
        return None

    fields.append(f"updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE consultations SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(consultation_id)

    return await db.fetch_row(sql, *values)

async def get_video_consult_doctors_query():
    sql = 'SELECT * FROM doctors WHERE video_consult = true AND available = true'
    return await db.query(sql)
