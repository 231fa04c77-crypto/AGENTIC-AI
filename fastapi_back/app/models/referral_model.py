from typing import Optional, List, Dict, Any
from app.config.db import db
from datetime import datetime


async def ensure_referral_columns() -> None:
    await db.execute("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS specialist_appointment_id INTEGER")


async def create_referral(
    patient_id: int,
    ordered_by: int,
    hospital_id: Optional[int],
    from_dept: Optional[str],
    to_dept: str,
    reason: str,
    notes: Optional[str] = None,
    assigned_to: Optional[int] = None,
) -> Dict[str, Any]:
    await ensure_referral_columns()
    sql = """
        INSERT INTO referrals (patient_id, ordered_by, hospital_id, from_dept, to_dept, reason, notes, assigned_to, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING *
    """
    return await db.fetch_row(
        sql, patient_id, ordered_by, hospital_id, from_dept, to_dept, reason, notes, assigned_to
    )


async def get_referral_by_id(referral_id: int) -> Optional[Dict[str, Any]]:
    sql = "SELECT * FROM referrals WHERE id = $1"
    return await db.fetch_row(sql, referral_id)


async def update_referral(referral_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
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
    sql = f"UPDATE referrals SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(referral_id)

    return await db.fetch_row(sql, *values)


async def get_referrals_by_patient(patient_id: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT r.*,
               sd.name AS specialist_name,
               sd.speciality AS specialist_speciality,
               rd.name AS referring_doctor_name
        FROM referrals r
        LEFT JOIN doctors sd ON sd.id = r.assigned_to
        LEFT JOIN doctors rd ON rd.id = r.ordered_by
        WHERE r.patient_id = $1
        ORDER BY r.created_at DESC
    """
    return await db.query(sql, patient_id)


async def get_referrals_for_specialist(doctor_id: int, status: Optional[str] = None) -> List[Dict[str, Any]]:
    sql = """
        SELECT r.*,
               u.name AS patient_name,
               u.phone AS patient_phone,
               rd.name AS referring_doctor_name,
               rd.speciality AS referring_speciality
        FROM referrals r
        JOIN users u ON u.id = r.patient_id
        JOIN doctors rd ON rd.id = r.ordered_by
        WHERE r.assigned_to = $1
    """
    params: list = [int(doctor_id)]
    if status:
        sql += " AND r.status = $2"
        params.append(status)
    else:
        sql += " AND r.status != 'COMPLETED'"
    sql += " ORDER BY r.created_at DESC"
    return await db.query(sql, *params)


async def get_referrals_queue(hospital_id: Optional[int] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    sql = """
        SELECT r.*, u.name as patient_name, u.phone as patient_phone,
               d.name as doctor_name, sd.name as specialist_name
        FROM referrals r
        JOIN users u ON r.patient_id = u.id
        JOIN doctors d ON r.ordered_by = d.id
        LEFT JOIN doctors sd ON sd.id = r.assigned_to
        WHERE 1=1
    """
    params = []
    param_idx = 1
    if hospital_id is not None:
        sql += f" AND r.hospital_id = ${param_idx}"
        params.append(hospital_id)
        param_idx += 1
    if status is not None:
        sql += f" AND r.status = ${param_idx}"
        params.append(status)
        param_idx += 1
    else:
        sql += " AND r.status != 'COMPLETED'"

    sql += " ORDER BY r.created_at ASC"
    return await db.query(sql, *params)


async def get_active_referrals() -> List[Dict[str, Any]]:
    sql = "SELECT * FROM referrals WHERE status != 'COMPLETED'"
    return await db.query(sql)
