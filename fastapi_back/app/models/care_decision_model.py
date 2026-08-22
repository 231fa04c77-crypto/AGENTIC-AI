from typing import Any, Dict, Optional

from app.config.db import db


async def ensure_care_decisions_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS care_decisions (
            patient_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            investigation_required BOOLEAN,
            referral_required BOOLEAN,
            specialist_required BOOLEAN,
            treatment_notes TEXT,
            decided_by INTEGER,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


async def get_for_patient(patient_id: int) -> Optional[Dict[str, Any]]:
    row = await db.fetch_row(
        "SELECT * FROM care_decisions WHERE patient_id = $1",
        int(patient_id),
    )
    return dict(row) if row else None


async def upsert(
    patient_id: int,
    *,
    investigation_required: Optional[bool] = None,
    referral_required: Optional[bool] = None,
    specialist_required: Optional[bool] = None,
    treatment_notes: Optional[str] = None,
    decided_by: Optional[int] = None,
) -> Dict[str, Any]:
    await ensure_care_decisions_table()
    existing = await get_for_patient(patient_id) or {}
    inv = existing.get("investigation_required") if investigation_required is None else investigation_required
    ref = existing.get("referral_required") if referral_required is None else referral_required
    spec = existing.get("specialist_required") if specialist_required is None else specialist_required
    notes = treatment_notes if treatment_notes is not None else existing.get("treatment_notes")
    by = decided_by if decided_by is not None else existing.get("decided_by")
    row = await db.fetch_row(
        """
        INSERT INTO care_decisions (
            patient_id, investigation_required, referral_required, specialist_required,
            treatment_notes, decided_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (patient_id) DO UPDATE SET
            investigation_required = EXCLUDED.investigation_required,
            referral_required = EXCLUDED.referral_required,
            specialist_required = EXCLUDED.specialist_required,
            treatment_notes = EXCLUDED.treatment_notes,
            decided_by = EXCLUDED.decided_by,
            updated_at = NOW()
        RETURNING *
        """,
        int(patient_id),
        inv,
        ref,
        spec,
        notes,
        int(by) if by is not None else None,
    )
    return dict(row) if row else {}
