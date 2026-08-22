from app.config.db import db
from datetime import datetime

async def create_lab_booking(data: dict):
    sql = """
        INSERT INTO lab_bookings (
            user_id, lab_name, full_name, test_name, dob, phone, email, preferred_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    """
    values = [
        data.get('userId'),
        data.get('labName'),
        data.get('fullName'),
        data.get('testName'),
        data.get('dob'),
        data.get('phone'),
        data.get('email'),
        data.get('preferredDate'),
        data.get('notes')
    ]
    return await db.fetch_one(sql, *values)

async def get_lab_bookings_by_user_id(user_id: int):
    sql = 'SELECT * FROM lab_bookings WHERE user_id = $1 ORDER BY created_at DESC'
    return await db.fetch_all(sql, user_id)

async def get_lab_booking_by_id(booking_id: int):
    sql = 'SELECT * FROM lab_bookings WHERE id = $1 LIMIT 1'
    return await db.fetch_one(sql, booking_id)

async def cancel_lab_booking(booking_id: int):
    sql = "UPDATE lab_bookings SET cancelled = true, status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *"
    return await db.fetch_one(sql, booking_id)
