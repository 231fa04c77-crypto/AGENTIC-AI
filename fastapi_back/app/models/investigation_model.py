from typing import Optional, List, Dict, Any
from app.config.db import db
from datetime import datetime

async def ensure_investigation_columns() -> None:
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS result_summary TEXT")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS review_notes TEXT")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS next_step VARCHAR(32)")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS accepted_by INTEGER")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS published_by INTEGER")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS report_uploaded_at TIMESTAMPTZ")
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS report_public_id TEXT")
    await db.execute(
        "ALTER TABLE investigations ADD COLUMN IF NOT EXISTS report_review_status VARCHAR(20) DEFAULT 'PENDING'"
    )
    await db.execute("ALTER TABLE investigations ADD COLUMN IF NOT EXISTS reviewed_by INTEGER")


async def create_investigation(
    patient_id: int,
    ordered_by: int,
    hospital_id: Optional[int],
    test_name: str,
    priority: str,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    sql = """
        INSERT INTO investigations (patient_id, ordered_by, hospital_id, test_name, priority, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'ORDERED')
        RETURNING *
    """
    return await db.fetch_row(sql, patient_id, ordered_by, hospital_id, test_name, priority, notes)

async def get_investigation_by_id(investigation_id: int) -> Optional[Dict[str, Any]]:
    sql = "SELECT * FROM investigations WHERE id = $1"
    return await db.fetch_row(sql, investigation_id)

async def update_investigation(investigation_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    fields = []
    values = []
    param_count = 1

    # Map keys directly to DB columns
    for key, value in update_data.items():
        fields.append(f"{key} = ${param_count}")
        values.append(value)
        param_count += 1

    if not fields:
        return None

    fields.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE investigations SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(investigation_id)

    return await db.fetch_row(sql, *values)

async def get_investigations_by_patient(patient_id: int) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM investigations WHERE patient_id = $1 ORDER BY created_at DESC"
    return await db.query(sql, patient_id)

async def get_lab_queue(hospital_id: Optional[int] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    sql = """
        SELECT i.*, u.name as patient_name, u.phone as patient_phone, d.name as doctor_name
        FROM investigations i
        JOIN users u ON i.patient_id = u.id
        JOIN doctors d ON i.ordered_by = d.id
        WHERE 1=1
    """
    params = []
    param_idx = 1
    if hospital_id is not None:
        sql += f" AND i.hospital_id = ${param_idx}"
        params.append(hospital_id)
        param_idx += 1
    if status is not None:
        sql += f" AND i.status = ${param_idx}"
        params.append(status)
        param_idx += 1
    else:
        # Default queue excludes reviewed investigations
        sql += " AND i.status != 'REVIEWED'"
    
    sql += " ORDER BY i.created_at ASC"
    return await db.query(sql, *params)

async def get_active_investigations() -> List[Dict[str, Any]]:
    """Returns all investigations that are not yet REVIEWED for the monitoring service."""
    sql = "SELECT * FROM investigations WHERE status != 'REVIEWED'"
    return await db.query(sql)
