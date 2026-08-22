"""Human-readable public identifiers (PAT00000125, APT202600001, etc.)."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.config.db import db

# Words ignored when deriving a hospital short-code so initials stay meaningful.
_HOSP_CODE_STOPWORDS = {"the", "of", "and", "&"}


async def _ensure_public_id_sequence_unique():
    try:
        await db.execute(
            """
            DELETE FROM public_id_sequences a
            USING public_id_sequences b
            WHERE a.ctid > b.ctid AND a.scope = b.scope
            """
        )
    except Exception:
        pass
    await db.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_public_id_sequences_scope
            ON public_id_sequences (scope)
        """
    )


async def _next_sequence(scope: str) -> int:
    sql = """
        INSERT INTO public_id_sequences (scope, last_value, updated_at)
        VALUES ($1, 1, NOW())
        ON CONFLICT (scope) DO UPDATE
        SET last_value = public_id_sequences.last_value + 1,
            updated_at = NOW()
        RETURNING last_value
        """
    try:
        row = await db.fetch_row(sql, scope)
    except Exception as exc:
        if "no unique or exclusion constraint" not in str(exc).lower():
            raise
        await _ensure_public_id_sequence_unique()
        row = await db.fetch_row(sql, scope)
    return int(row["last_value"])


async def new_patient_public_id() -> str:
    return f"PAT{await _next_sequence('PAT'):08d}"


async def new_doctor_public_id() -> str:
    return f"DOC{await _next_sequence('DOC'):08d}"


async def new_dean_public_id() -> str:
    return f"DEA{await _next_sequence('DEA'):08d}"


async def new_admin_public_id() -> str:
    return f"ADM{await _next_sequence('ADM'):08d}"


def hospital_short_code(name: str | None, hospital_id: int | None = None) -> str:
    """Derive a stable uppercase short-code from a hospital name.

    Multi-word names use the leading initials (``Guntur General Hospital`` ->
    ``GGH``); single-word names use the first three letters (``Zenith`` ->
    ``ZEN``). Falls back to ``H{id}`` when nothing usable is present.
    """
    words = [w for w in re.findall(r"[A-Za-z]+", name or "") if w.lower() not in _HOSP_CODE_STOPWORDS]
    if len(words) >= 2:
        return "".join(w[0] for w in words).upper()[:5]
    if len(words) == 1:
        return words[0][:3].upper()
    return f"H{hospital_id or 0}"


async def new_receptionist_public_id(hospital_id: int | None, hospital_name: str | None = None) -> str:
    """Hospital-scoped receptionist id, e.g. ``GGH-REC01`` (sequence per hospital)."""
    code = hospital_short_code(hospital_name, hospital_id)
    scope = f"REC-{hospital_id}" if hospital_id else "REC-GLOBAL"
    seq = await _next_sequence(scope)
    return f"{code}-REC{seq:02d}"


def _year(year: int | None) -> int:
    return int(year or datetime.now(timezone.utc).year)


async def new_appointment_public_id(year: int | None = None) -> str:
    yr = _year(year)
    return f"APT{yr}{await _next_sequence(f'APT{yr}'):05d}"


async def new_payment_public_id(year: int | None = None) -> str:
    yr = _year(year)
    return f"PAY{yr}{await _next_sequence(f'PAY{yr}'):05d}"


async def new_health_record_public_id(year: int | None = None) -> str:
    yr = _year(year)
    return f"REC{yr}{await _next_sequence(f'REC{yr}'):05d}"


async def ensure_public_id_schema() -> None:
    """Idempotent for fresh installs before migration 013 runs."""
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS public_id_sequences (
            scope       VARCHAR(32) PRIMARY KEY,
            last_value  BIGINT NOT NULL DEFAULT 0,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    for table in (
        "users",
        "doctors",
        "deans",
        "admins",
        "appointments",
        "payment_transactions",
        "health_records",
    ):
        await db.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS public_id VARCHAR(20)"
        )


# ── Emergency Partner Platform IDs ──────────────────────────────────────────


async def new_partner_public_id() -> str:
    """E.g. PRT00000001 — identifies a registered partner org."""
    return f"PRT{await _next_sequence('PRT'):08d}"


async def new_pharmacy_order_public_id() -> str:
    """E.g. PHO00000001 — patient pharmacy medicine order."""
    return f"PHO{await _next_sequence('PHO'):08d}"


async def new_emergency_case_public_id() -> str:
    """E.g. MED-EMG-20260711-00001 — daily sequential counter per date."""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    seq = await _next_sequence(f"EMG{today}")
    return f"MED-EMG-{today}-{seq:05d}"

