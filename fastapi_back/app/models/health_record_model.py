import json
from app.config.db import db
from datetime import datetime

async def get_health_records_by_user_id(user_id: int):
    sql = 'SELECT * FROM health_records WHERE user_id = $1 ORDER BY created_at DESC'
    return await db.fetch_all(sql, user_id)

async def create_health_record(data: dict):
    from app.services import public_id_service

    files_json = json.dumps(data.get('files', []))
    tags_json = json.dumps(data.get('tags', []))
    record_date = data.get('date', datetime.now())
    record_year = record_date.year if hasattr(record_date, 'year') else None
    public_id = await public_id_service.new_health_record_public_id(record_year)

    sql = """
        INSERT INTO health_records (
            user_id, doctor_id, appointment_id, diagnosis, prescription, notes, 
            attachments, record_type, title, description, doctor_name, record_date,
            tags, is_important, uploaded_before_appointment, public_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
    """
    
    # Use data.get with defaults to handle missing fields
    values = [
        data.get('userId'), 
        data.get('docId'), 
        data.get('appointmentId'), # Can be None
        data.get('diagnosis', ''), 
        data.get('prescription', ''), 
        data.get('notes', ''),
        files_json, 
        data.get('recordType', 'general'), 
        data.get('title', ''),
        data.get('description', ''), 
        data.get('doctorName', ''), 
        record_date,
        tags_json, 
        data.get('isImportant', False), 
        data.get('uploadedBeforeAppointment', False),
        public_id,
    ]
    
    return await db.fetch_one(sql, *values)

async def get_health_records(filters: dict):
    sql = 'SELECT * FROM health_records WHERE 1=1'
    values = []
    param_count = 1

    if filters.get('userId'):
        sql += f" AND user_id = ${param_count}"
        values.append(filters['userId'])
        param_count += 1
        
    if filters.get('docId'):
        sql += f" AND doctor_id = ${param_count}"
        values.append(filters['docId'])
        param_count += 1
        
    if filters.get('appointmentId'):
        sql += f" AND appointment_id = ${param_count}"
        values.append(filters['appointmentId'])
        param_count += 1
        
    if filters.get('recordType'):
        sql += f" AND record_type = ${param_count}"
        values.append(filters['recordType'])
        param_count += 1
        
    if filters.get('startDate'):
        sql += f" AND record_date >= ${param_count}"
        values.append(filters['startDate'])
        param_count += 1
        
    if filters.get('endDate'):
        sql += f" AND record_date <= ${param_count}"
        values.append(filters['endDate'])
        param_count += 1
        
    if filters.get('search'):
        sql += f" AND (title ILIKE ${param_count} OR description ILIKE ${param_count} OR doctor_name ILIKE ${param_count})"
        values.append(f"%{filters['search']}%")
        param_count += 1

    sql += " ORDER BY created_at DESC"

    limit = filters.get("limit")
    offset = int(filters.get("offset") or 0)
    if limit is not None:
        sql += f" LIMIT ${param_count}"
        values.append(int(limit))
        param_count += 1
        sql += f" OFFSET ${param_count}"
        values.append(max(0, offset))

    return await db.fetch_all(sql, *values)


async def count_health_records(filters: dict) -> int:
    sql = "SELECT COUNT(*)::int AS c FROM health_records WHERE 1=1"
    values = []
    param_count = 1

    if filters.get("userId"):
        sql += f" AND user_id = ${param_count}"
        values.append(filters["userId"])
        param_count += 1
    if filters.get("docId"):
        sql += f" AND doctor_id = ${param_count}"
        values.append(filters["docId"])
        param_count += 1
    if filters.get("appointmentId"):
        sql += f" AND appointment_id = ${param_count}"
        values.append(filters["appointmentId"])
        param_count += 1
    if filters.get("recordType"):
        sql += f" AND record_type = ${param_count}"
        values.append(filters["recordType"])
        param_count += 1

    row = await db.fetch_row(sql, *values)
    return int(row["c"]) if row else 0

async def get_health_record_by_id(record_id: int):
    sql = 'SELECT * FROM health_records WHERE id = $1'
    return await db.fetch_one(sql, record_id)

async def delete_health_record(record_id: int):
    sql = 'DELETE FROM health_records WHERE id = $1 RETURNING *'
    return await db.fetch_one(sql, record_id)

async def update_health_record(record_id: int, data: dict):
    fields = []
    values = []
    param_count = 1

    if data.get('viewedByDoctor') is not None:
        fields.append(f"viewed_by_doctor = ${param_count}")
        values.append(data['viewedByDoctor'])
        param_count += 1
        
    if data.get('viewedAt'):
        fields.append(f"viewed_at = ${param_count}")
        values.append(data['viewedAt'])
        param_count += 1

    if not fields:
        return None

    fields.append(f"updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE health_records SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(record_id)

    return await db.fetch_one(sql, *values)
