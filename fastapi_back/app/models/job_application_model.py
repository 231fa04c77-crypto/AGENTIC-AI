from app.config.db import db
from datetime import datetime

async def get_all_job_applications():
    sql = "SELECT *, id as _id, resume_url as resume_file_path, position as role_applied, cover_letter as coverLetter FROM job_applications ORDER BY created_at DESC"
    return await db.fetch_all(sql)

async def get_job_application_by_id(application_id: int):
    sql = "SELECT *, id as _id, resume_url as resume_file_path, position as role_applied, cover_letter as coverLetter FROM job_applications WHERE id = $1"
    return await db.fetch_one(sql, application_id)

async def search_job_applications(query_text: str):
    sql = """
        SELECT *, id as _id, resume_url as resume_file_path, position as role_applied, cover_letter as coverLetter FROM job_applications 
        WHERE 
            name ILIKE $1 OR 
            email ILIKE $1 OR 
            position ILIKE $1 OR
            skills ILIKE $1 OR
            city ILIKE $1
        ORDER BY created_at DESC
    """
    return await db.fetch_all(sql, f"%{query_text}%")

async def create_job_application(data: dict):
    sql = """
        INSERT INTO job_applications (
            name, email, phone, position, resume_url, 
            city, qualification, experience, skills, cover_letter, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *, id as _id, resume_url as resume_file_path, position as role_applied, cover_letter as coverLetter
    """
    values = [
        data.get('name'),
        data.get('email'),
        data.get('phone'),
        data.get('role_applied') or data.get('position'), 
        data.get('resume_file_path') or data.get('resume_url'),
        data.get('city'),
        data.get('qualification'),
        data.get('experience'),
        data.get('skills'),
        data.get('coverLetter') or data.get('cover_letter', ''),
        data.get('status', 'Pending')
    ]
    return await db.fetch_one(sql, *values)

async def update_job_application_status(application_id: int, status: str):
    sql = "UPDATE job_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *"
    return await db.fetch_one(sql, status, application_id)

async def delete_job_application(application_id: int):
    sql = "DELETE FROM job_applications WHERE id = $1 RETURNING *"
    return await db.fetch_one(sql, application_id)
