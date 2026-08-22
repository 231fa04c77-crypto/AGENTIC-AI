"""Department model — manages departments and doctor-department assignments."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.config.db import db


# ─── Departments ─────────────────────────────────────────────────────────────

async def get_departments_by_hospital(hospital_id: int) -> List[Dict[str, Any]]:
    return await db.query(
        "SELECT * FROM departments WHERE hospital_id = $1 ORDER BY name ASC",
        int(hospital_id),
    )


async def get_department_by_id(department_id: int) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        "SELECT * FROM departments WHERE id = $1",
        int(department_id),
    )


async def create_department(hospital_id: int, name: str, description: Optional[str] = None) -> Optional[Dict[str, Any]]:
    return await db.fetch_row(
        """
        INSERT INTO departments (hospital_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING *
        """,
        int(hospital_id),
        name.strip(),
        description,
    )


async def update_department(department_id: int, name: Optional[str] = None, description: Optional[str] = None) -> Optional[Dict[str, Any]]:
    fields = []
    values: list = []
    idx = 1
    if name is not None:
        fields.append(f"name = ${idx}")
        values.append(name.strip())
        idx += 1
    if description is not None:
        fields.append(f"description = ${idx}")
        values.append(description)
        idx += 1
    if not fields:
        return None
    fields.append(f"updated_at = NOW()")
    values.append(int(department_id))
    return await db.fetch_row(
        f"UPDATE departments SET {', '.join(fields)} WHERE id = ${idx} RETURNING *",
        *values,
    )


async def delete_department(department_id: int) -> None:
    await db.execute("DELETE FROM departments WHERE id = $1", int(department_id))


# ─── Doctor-Department Junction ───────────────────────────────────────────────

async def get_departments_for_doctor(doctor_id: int) -> List[Dict[str, Any]]:
    """Return all departments a doctor is assigned to, with department metadata."""
    return await db.query(
        """
        SELECT d.*, dd.is_hod
        FROM departments d
        JOIN doctor_departments dd ON dd.department_id = d.id
        WHERE dd.doctor_id = $1
        ORDER BY d.name ASC
        """,
        int(doctor_id),
    )


async def get_doctors_in_department(department_id: int) -> List[Dict[str, Any]]:
    """Return all doctors assigned to a department with their basic details."""
    return await db.query(
        """
        SELECT doc.id, doc.name, doc.speciality, doc.image, doc.available, dd.is_hod
        FROM doctors doc
        JOIN doctor_departments dd ON dd.doctor_id = doc.id
        WHERE dd.department_id = $1
        ORDER BY dd.is_hod DESC, doc.name ASC
        """,
        int(department_id),
    )


async def assign_doctor_to_department(doctor_id: int, department_id: int, is_hod: bool = False) -> None:
    """Assign a doctor to a department. Idempotent: ON CONFLICT does nothing."""
    await db.execute(
        """
        INSERT INTO doctor_departments (doctor_id, department_id, is_hod)
        VALUES ($1, $2, $3)
        ON CONFLICT (doctor_id, department_id) DO UPDATE SET is_hod = EXCLUDED.is_hod
        """,
        int(doctor_id),
        int(department_id),
        bool(is_hod),
    )


async def remove_doctor_from_department(doctor_id: int, department_id: int) -> None:
    await db.execute(
        "DELETE FROM doctor_departments WHERE doctor_id = $1 AND department_id = $2",
        int(doctor_id),
        int(department_id),
    )


async def set_doctor_departments(doctor_id: int, department_ids: List[int]) -> None:
    """Replace all department assignments for a doctor. Atomic: delete then insert."""
    await db.execute(
        "DELETE FROM doctor_departments WHERE doctor_id = $1",
        int(doctor_id),
    )
    for dept_id in department_ids:
        await assign_doctor_to_department(doctor_id, int(dept_id))
