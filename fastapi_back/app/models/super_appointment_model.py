from app.config.db import db
from datetime import datetime
from typing import Dict, Any

async def get_all_super_appointments():
    sql = "SELECT * FROM super_appointments ORDER BY created_at DESC"
    return await db.query(sql)

async def create_super_appointment(data: Dict[str, Any]):
    sql = """
        INSERT INTO super_appointments (
            user_name, email, appointment_date, appointment_time, service_type, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """
    # Parse date and time if they are strings
    app_date = data.get('appointment_date')
    app_time = data.get('appointment_time')
    
    values = [
        data.get('user_name'),
        data.get('email'),
        app_date,
        app_time,
        data.get('service_type'),
        data.get('status', 'Pending')
    ]
    return await db.fetch_row(sql, *values)

async def update_super_appointment_status(appointment_id: int, status: str):
    sql = "UPDATE super_appointments SET status = $1 WHERE id = $2 RETURNING *"
    return await db.fetch_row(sql, status, appointment_id)

async def delete_super_appointment(appointment_id: int):
    sql = "DELETE FROM super_appointments WHERE id = $1 RETURNING *"
    return await db.fetch_row(sql, appointment_id)
