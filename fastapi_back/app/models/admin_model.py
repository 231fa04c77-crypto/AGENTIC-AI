from typing import Optional, Dict, Any
from app.config.db import db

async def get_admin_by_email(email: str):
    sql = 'SELECT * FROM admins WHERE email = $1'
    return await db.fetch_row(sql, email)

async def create_admin(email: str, password_hash: str):
    from app.services import public_id_service

    public_id = await public_id_service.new_admin_public_id()
    sql = 'INSERT INTO admins (email, password, public_id) VALUES ($1, $2, $3) RETURNING *'
    return await db.fetch_row(sql, email, password_hash, public_id)

async def get_all_admins():
    sql = 'SELECT id, email, public_id, created_at FROM admins ORDER BY id'
    return await db.query(sql)


async def get_dashboard_stats():
    # Execute count queries
    users_row = await db.fetch_row('SELECT count(*) FROM users')
    doctors_row = await db.fetch_row('SELECT count(*) FROM doctors')
    apps_row = await db.fetch_row('SELECT count(*) FROM appointments')
    hosp_row = await db.fetch_row('SELECT count(*) FROM hospitals')

    return {
        "users": int(users_row['count'] or 0),
        "doctors": int(doctors_row['count'] or 0),
        "appointments": int(apps_row['count'] or 0),
        "hospitals": int(hosp_row['count'] or 0)
    }
