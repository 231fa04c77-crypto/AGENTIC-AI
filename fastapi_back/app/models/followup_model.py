from typing import Optional, List, Dict, Any
from app.config.db import db
from datetime import date, datetime

async def ensure_followup_columns() -> None:
    await db.execute("ALTER TABLE followups ADD COLUMN IF NOT EXISTS notes TEXT")
    await db.execute("ALTER TABLE followups ADD COLUMN IF NOT EXISTS reason TEXT")


async def create_followup(
    patient_id: int,
    ordered_by: int,
    hospital_id: Optional[int],
    due_date: date,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    instructions: Optional[str] = None,
) -> Dict[str, Any]:
    await ensure_followup_columns()
    sql = """
        INSERT INTO followups (patient_id, ordered_by, hospital_id, due_date, reason, notes, instructions, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED')
        RETURNING *
    """
    return await db.fetch_row(
        sql, patient_id, ordered_by, hospital_id, due_date, reason, notes, instructions
    )

async def get_followup_by_id(followup_id: int) -> Optional[Dict[str, Any]]:
    sql = "SELECT * FROM followups WHERE id = $1"
    return await db.fetch_row(sql, followup_id)

async def update_followup(followup_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    fields = []
    values = []
    param_count = 1

    for key, value in update_data.items():
        fields.append(f"{key} = ${param_count}")
        values.append(value)
        param_count += 1

    if not fields:
        return None

    fields.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE followups SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(followup_id)

    return await db.fetch_row(sql, *values)

async def get_followups_by_patient(patient_id: int) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM followups WHERE patient_id = $1 ORDER BY created_at DESC"
    return await db.query(sql, patient_id)

async def get_followups_queue(hospital_id: Optional[int] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    sql = """
        SELECT f.*, u.name as patient_name, u.phone as patient_phone, d.name as doctor_name
        FROM followups f
        JOIN users u ON f.patient_id = u.id
        JOIN doctors d ON f.ordered_by = d.id
        WHERE 1=1
    """
    params = []
    param_idx = 1
    if hospital_id is not None:
        sql += f" AND f.hospital_id = ${param_idx}"
        params.append(hospital_id)
        param_idx += 1
    if status is not None:
        sql += f" AND f.status = ${param_idx}"
        params.append(status)
        param_idx += 1
    else:
        # Default queue excludes completed followups
        sql += " AND f.status != 'COMPLETED'"
    
    sql += " ORDER BY f.due_date ASC"
    return await db.query(sql, *params)

async def get_active_followups() -> List[Dict[str, Any]]:
    """Returns all followups that are not completed."""
    sql = "SELECT * FROM followups WHERE status != 'COMPLETED'"
    return await db.query(sql)
