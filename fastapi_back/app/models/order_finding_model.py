import json
from typing import Optional, List, Dict, Any
from app.config.db import db


def _as_json(value: Any) -> Any:
    if value is None:
        return {}
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return {}
    return {}


async def create_finding(
    entity_type: str,
    entity_id: int,
    patient_id: int,
    message: str,
    priority: str,
    assigned_role: str,
    finding_type: Optional[str] = None,
    evidence: Optional[Dict[str, Any]] = None,
    recommended_action: Optional[str] = None,
) -> Dict[str, Any]:
    evidence_obj = evidence or {}

    if finding_type and await is_finding_dismissed(entity_type, entity_id, finding_type):
        return {}

    if finding_type:
        check_sql = """
            SELECT * FROM order_findings
            WHERE entity_type = $1 AND entity_id = $2 AND status = 'OPEN' AND finding_type = $3
            LIMIT 1
        """
        existing = await db.fetch_row(check_sql, entity_type, entity_id, finding_type)
        if existing:
            return dict(existing)
    else:
        check_sql = """
            SELECT * FROM order_findings
            WHERE entity_type = $1 AND entity_id = $2 AND status = 'OPEN' AND message = $3
            LIMIT 1
        """
        existing = await db.fetch_row(check_sql, entity_type, entity_id, message)
        if existing:
            return dict(existing)

    sql = """
        INSERT INTO order_findings (
            entity_type, entity_id, patient_id, message, priority, status, assigned_role,
            finding_type, evidence, recommended_action, review_decision
        )
        VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7, $8, $9, 'PENDING')
        RETURNING *
    """
    row = await db.fetch_row(
        sql,
        entity_type,
        entity_id,
        patient_id,
        message,
        priority,
        assigned_role,
        finding_type,
        json.dumps(evidence_obj),
        recommended_action,
    )
    return dict(row) if row else {}


async def get_finding_by_id(finding_id: int) -> Optional[Dict[str, Any]]:
    sql = "SELECT * FROM order_findings WHERE id = $1"
    row = await db.fetch_row(sql, finding_id)
    return dict(row) if row else None


async def is_finding_dismissed(
    entity_type: str,
    entity_id: int,
    finding_type: Optional[str],
) -> bool:
    """True if staff rejected this finding and the entity has not changed since."""
    if not finding_type:
        return False
    sql = """
        SELECT reviewed_at FROM order_findings
        WHERE entity_type = $1 AND entity_id = $2 AND finding_type = $3
          AND review_decision = 'REJECTED' AND status = 'RESOLVED'
        ORDER BY reviewed_at DESC NULLS LAST
        LIMIT 1
    """
    row = await db.fetch_row(sql, entity_type, entity_id, finding_type)
    if not row or not row.get("reviewed_at"):
        return False
    rejected_at = row["reviewed_at"]
    entity_updated = await _entity_updated_at(entity_type, entity_id)
    if entity_updated and entity_updated > rejected_at:
        return False
    return True


async def _entity_updated_at(entity_type: str, entity_id: int):
    table = {
        "investigation": "investigations",
        "referral": "referrals",
        "followup": "followups",
        "pharmacy": "pharmacy_orders",
        "appointment": "appointments",
    }.get(entity_type)
    if not table:
        return None
    sql = f"SELECT updated_at FROM {table} WHERE id = $1"
    row = await db.fetch_row(sql, entity_id)
    return row.get("updated_at") if row else None


async def get_recent_reviews_for_patient(patient_id: int, limit: int = 8) -> List[Dict[str, Any]]:
    sql = """
        SELECT f.*, d.name AS reviewer_name
        FROM order_findings f
        LEFT JOIN doctors d ON f.reviewed_by = d.id
        WHERE f.patient_id = $1
          AND f.review_decision IN ('APPROVED', 'REJECTED', 'MODIFIED')
          AND f.reviewed_at IS NOT NULL
        ORDER BY f.reviewed_at DESC
        LIMIT $2
    """
    rows = await db.query(sql, patient_id, int(limit))
    return [normalize_finding(dict(x)) for x in rows]


async def update_finding_status(finding_id: int, status: str) -> Optional[Dict[str, Any]]:
    sql = """
        UPDATE order_findings
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
    """
    row = await db.fetch_row(sql, status, finding_id)
    return dict(row) if row else None


async def update_finding_review(
    finding_id: int,
    *,
    status: Optional[str] = None,
    review_decision: Optional[str] = None,
    reviewed_by: Optional[int] = None,
    resolution_note: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    fields = ["updated_at = CURRENT_TIMESTAMP"]
    values: List[Any] = []
    idx = 1
    if status is not None:
        fields.append(f"status = ${idx}")
        values.append(status)
        idx += 1
    if review_decision is not None:
        fields.append(f"review_decision = ${idx}")
        values.append(review_decision)
        idx += 1
        fields.append("reviewed_at = CURRENT_TIMESTAMP")
    if reviewed_by is not None:
        fields.append(f"reviewed_by = ${idx}")
        values.append(reviewed_by)
        idx += 1
    if resolution_note is not None:
        fields.append(f"resolution_note = ${idx}")
        values.append(resolution_note)
        idx += 1
    values.append(finding_id)
    sql = f"UPDATE order_findings SET {', '.join(fields)} WHERE id = ${idx} RETURNING *"
    row = await db.fetch_row(sql, *values)
    return dict(row) if row else None


async def get_findings_by_patient(patient_id: int) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM order_findings WHERE patient_id = $1 ORDER BY created_at DESC"
    rows = await db.query(sql, patient_id)
    return [dict(x) for x in rows]


async def get_open_findings_by_patient(patient_id: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT * FROM order_findings
        WHERE patient_id = $1 AND status = 'OPEN'
        ORDER BY created_at DESC
    """
    rows = await db.query(sql, patient_id)
    return [dict(x) for x in rows]


async def get_all_open_findings(limit: int = 200) -> List[Dict[str, Any]]:
    sql = """
        SELECT f.*
        FROM order_findings f
        WHERE f.status = 'OPEN'
        ORDER BY f.created_at DESC
        LIMIT $1
    """
    rows = await db.query(sql, int(limit))
    return [dict(x) for x in rows]


async def get_open_findings_by_role(assigned_role: str) -> List[Dict[str, Any]]:
    sql = """
        SELECT f.*, u.name as patient_name
        FROM order_findings f
        JOIN users u ON f.patient_id = u.id
        WHERE f.status = 'OPEN' AND f.assigned_role = $1
        ORDER BY f.created_at DESC
    """
    rows = await db.query(sql, assigned_role)
    return [dict(x) for x in rows]


async def get_open_findings_for_doctor(doctor_id: int) -> List[Dict[str, Any]]:
    """Get all open findings for investigations, referrals, or followups ordered by the given doctor."""
    sql = """
        SELECT f.*, u.name as patient_name
        FROM order_findings f
        JOIN users u ON f.patient_id = u.id
        LEFT JOIN investigations i ON f.entity_type = 'investigation' AND f.entity_id = i.id
        LEFT JOIN referrals r ON f.entity_type = 'referral' AND f.entity_id = r.id
        LEFT JOIN followups fo ON f.entity_type = 'followup' AND f.entity_id = fo.id
        WHERE f.status = 'OPEN'
          AND (i.ordered_by = $1 OR r.ordered_by = $1 OR fo.ordered_by = $1)
        ORDER BY
          CASE f.priority
            WHEN 'HIGH' THEN 1
            WHEN 'MEDIUM' THEN 2
            WHEN 'LOW' THEN 3
            ELSE 4
          END ASC,
          f.created_at DESC
    """
    rows = await db.query(sql, doctor_id)
    return [dict(x) for x in rows]


async def get_attention_patient_ids(doctor_id: Optional[int] = None, hospital_id: Optional[int] = None) -> List[int]:
    sql = """
        SELECT DISTINCT f.patient_id
        FROM order_findings f
        LEFT JOIN investigations i ON f.entity_type = 'investigation' AND f.entity_id = i.id
        LEFT JOIN referrals r ON f.entity_type = 'referral' AND f.entity_id = r.id
        LEFT JOIN followups fo ON f.entity_type = 'followup' AND f.entity_id = fo.id
        WHERE f.status = 'OPEN'
    """
    params: List[Any] = []
    idx = 1
    if doctor_id is not None:
        sql += f" AND (i.ordered_by = ${idx} OR r.ordered_by = ${idx} OR fo.ordered_by = ${idx})"
        params.append(doctor_id)
        idx += 1
    if hospital_id is not None:
        sql += (
            f" AND (i.hospital_id = ${idx} OR r.hospital_id = ${idx} OR fo.hospital_id = ${idx}"
            f" OR f.patient_id IN (SELECT user_id FROM appointments WHERE hospital_id = ${idx}))"
        )
        params.append(hospital_id)
    rows = await db.query(sql, *params)
    return [int(r["patient_id"]) for r in rows]


def normalize_finding(row: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(row)
    out["evidence"] = _as_json(out.get("evidence"))
    return out
