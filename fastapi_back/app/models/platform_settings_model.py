from typing import Any, Optional

from app.config.db import db

DEFAULTS = {
    "system_name": "MedClues",
    "email_notifications": True,
    "maintenance_mode": False,
    "audit_log_retention_days": 30,
}


async def ensure_platform_settings_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS platform_settings (
            id                       INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            system_name              VARCHAR(120) NOT NULL DEFAULT 'MedClues',
            email_notifications      BOOLEAN NOT NULL DEFAULT TRUE,
            maintenance_mode         BOOLEAN NOT NULL DEFAULT FALSE,
            audit_log_retention_days INT NOT NULL DEFAULT 30,
            updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await db.execute(
        """
        INSERT INTO platform_settings (id)
        VALUES (1)
        ON CONFLICT (id) DO NOTHING
        """
    )


def _row_to_dict(row) -> dict[str, Any]:
    if not row:
        return {**DEFAULTS}
    updated = row["updated_at"]
    return {
        "system_name": row["system_name"] or DEFAULTS["system_name"],
        "email_notifications": bool(row["email_notifications"]),
        "maintenance_mode": bool(row["maintenance_mode"]),
        "audit_log_retention_days": int(row["audit_log_retention_days"] or 30),
        "updated_at": updated.isoformat() if updated else None,
    }


async def get_settings() -> dict[str, Any]:
    try:
        row = await db.fetch_row("SELECT * FROM platform_settings WHERE id = 1")
        return _row_to_dict(row)
    except Exception:
        return {**DEFAULTS}


async def is_maintenance_mode() -> bool:
    try:
        row = await db.fetch_row(
            "SELECT maintenance_mode FROM platform_settings WHERE id = 1"
        )
        return bool(row["maintenance_mode"]) if row else False
    except Exception:
        return False


async def email_notifications_enabled() -> bool:
    try:
        row = await db.fetch_row(
            "SELECT email_notifications FROM platform_settings WHERE id = 1"
        )
        return bool(row["email_notifications"]) if row else True
    except Exception:
        return True


async def update_settings(
    *,
    system_name: Optional[str] = None,
    email_notifications: Optional[bool] = None,
    maintenance_mode: Optional[bool] = None,
    audit_log_retention_days: Optional[int] = None,
) -> dict[str, Any]:
    current = await get_settings()
    name = (system_name if system_name is not None else current["system_name"] or "").strip()
    if not name:
        name = DEFAULTS["system_name"]
    name = name[:120]

    emails_on = (
        bool(email_notifications)
        if email_notifications is not None
        else current["email_notifications"]
    )
    maint = (
        bool(maintenance_mode)
        if maintenance_mode is not None
        else current["maintenance_mode"]
    )

    retention = (
        int(audit_log_retention_days)
        if audit_log_retention_days is not None
        else int(current["audit_log_retention_days"])
    )
    retention = max(1, min(3650, retention))

    row = await db.fetch_row(
        """
        INSERT INTO platform_settings (
            id, system_name, email_notifications, maintenance_mode,
            audit_log_retention_days, updated_at
        )
        VALUES (1, $1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
            system_name = EXCLUDED.system_name,
            email_notifications = EXCLUDED.email_notifications,
            maintenance_mode = EXCLUDED.maintenance_mode,
            audit_log_retention_days = EXCLUDED.audit_log_retention_days,
            updated_at = NOW()
        RETURNING *
        """,
        name,
        emails_on,
        maint,
        retention,
    )
    return _row_to_dict(row)
