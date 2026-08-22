from app.config.db import db
from datetime import datetime

async def get_all_specialties():
    sql = 'SELECT * FROM specialties ORDER BY specialty_name ASC'
    return await db.fetch_all(sql)

async def get_specialty_by_name(name: str):
    sql = 'SELECT * FROM specialties WHERE specialty_name ILIKE $1'
    return await db.fetch_one(sql, f"%{name}%")

async def get_specialty_by_id(specialty_id: int):
    sql = 'SELECT * FROM specialties WHERE id = $1'
    return await db.fetch_one(sql, specialty_id)

async def create_specialty(data: dict):
    sql = """
        INSERT INTO specialties (specialty_name, helpline_number, availability, status, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    """
    values = [
        data.get('specialtyName'),
        data.get('helplineNumber'),
        data.get('availability', '24x7'),
        data.get('status', 'Active'),
        data.get('updatedBy')
    ]
    return await db.fetch_one(sql, *values)

async def update_specialty(specialty_id: int, data: dict):
    sql = """
        UPDATE specialties SET
            specialty_name = COALESCE($1, specialty_name),
            helpline_number = COALESCE($2, helpline_number),
            availability = COALESCE($3, availability),
            status = COALESCE($4, status),
            updated_by = COALESCE($5, updated_by),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
    """
    values = [
        data.get('specialtyName'),
        data.get('helplineNumber'),
        data.get('availability'),
        data.get('status'),
        data.get('updatedBy'),
        specialty_id
    ]
    return await db.fetch_one(sql, *values)

async def delete_specialty(specialty_id: int):
    sql = 'DELETE FROM specialties WHERE id = $1 RETURNING *'
    return await db.fetch_one(sql, specialty_id)
