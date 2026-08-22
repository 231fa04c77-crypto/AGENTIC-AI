import json
from app.config.db import db
from datetime import datetime

async def get_all_blood_banks():
    sql = "SELECT * FROM blood_banks ORDER BY created_at DESC"
    return await db.fetch_all(sql)

async def get_blood_bank_by_id(bank_id: int):
    sql = "SELECT * FROM blood_banks WHERE id = $1"
    return await db.fetch_one(sql, bank_id)

async def create_blood_bank(data: dict):
    sql = """
        INSERT INTO blood_banks (name, location, city, latitude, longitude, partner_type, available_blood, image)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    """
    values = [
        data.get('name'), 
        data.get('location'), 
        data.get('city'), 
        data.get('latitude'), 
        data.get('longitude'),
        data.get('partnerType', 'normal'), 
        json.dumps(data.get('availableBlood', {})), 
        data.get('image')
    ]
    return await db.fetch_one(sql, *values)

async def update_blood_bank(bank_id: int, data: dict):
    fields = []
    values = []
    param_count = 1

    for key, value in data.items():
        if value is not None:
            if key == 'availableBlood':
                value = json.dumps(value)
            
            # Map camelCase to snake_case for DB
            db_key = "".join(["_" + c.lower() if c.isupper() else c for c in key]).lstrip("_")
            fields.append(f"{db_key} = ${param_count}")
            values.append(value)
            param_count += 1

    if not fields:
        return None
    
    fields.append(f"updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE blood_banks SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(bank_id)

    return await db.fetch_one(sql, *values)

async def delete_blood_bank(bank_id: int):
    sql = "DELETE FROM blood_banks WHERE id = $1 RETURNING *"
    return await db.fetch_one(sql, bank_id)
