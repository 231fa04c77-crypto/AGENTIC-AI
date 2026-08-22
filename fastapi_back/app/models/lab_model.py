import json
from app.config.db import db
from datetime import datetime

async def get_all_labs():
    sql = "SELECT * FROM labs ORDER BY created_at DESC"
    return await db.fetch_all(sql)

async def get_lab_by_id(lab_id: int):
    sql = "SELECT * FROM labs WHERE id = $1"
    return await db.fetch_one(sql, lab_id)

async def create_lab(data: dict):
    sql = """
        INSERT INTO labs (name, location, city, latitude, longitude, rating, verified, services, open_now, partner_type, image)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    """
    values = [
        data.get('name'), 
        data.get('location'), 
        data.get('city'), 
        data.get('latitude'), 
        data.get('longitude'),
        data.get('rating', 0), 
        data.get('verified', False), 
        json.dumps(data.get('services', [])),
        data.get('openNow', True),
        data.get('partnerType', 'normal'),
        data.get('image')
    ]
    return await db.fetch_one(sql, *values)

async def update_lab(lab_id: int, data: dict):
    fields = []
    values = []
    param_count = 1

    for key, value in data.items():
        if value is not None:
            if key == 'services':
                value = json.dumps(value)
            
            # Map camelCase to snake_case for DB
            db_key = "".join(["_" + c.lower() if c.isupper() else c for c in key]).lstrip("_")
            fields.append(f"{db_key} = ${param_count}")
            values.append(value)
            param_count += 1

    if not fields:
        return None
    
    fields.append(f"updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE labs SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(lab_id)

    return await db.fetch_one(sql, *values)

async def delete_lab(lab_id: int):
    sql = "DELETE FROM labs WHERE id = $1 RETURNING *"
    return await db.fetch_one(sql, lab_id)
