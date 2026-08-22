import json
from typing import Any, Optional

from app.config.db import db


async def ensure_audit_logs_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id          BIGSERIAL PRIMARY KEY,
            actor_id    BIGINT,
            actor_role  VARCHAR(32),
            action      VARCHAR(64) NOT NULL,
            resource    VARCHAR(128) NOT NULL,
            resource_id VARCHAR(64),
            ip_address  VARCHAR(45),
            user_agent  TEXT,
            metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_audit_resource
            ON audit_logs (resource, resource_id)
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_audit_actor
            ON audit_logs (actor_id, created_at DESC)
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_audit_action_created
            ON audit_logs (action, created_at DESC)
        """
    )


async def insert_log(
    *,
    action: str,
    resource: str,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    await db.execute(
        """
        INSERT INTO audit_logs (
            actor_id, actor_role, action, resource, resource_id,
            ip_address, user_agent, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        """,
        actor_id,
        actor_role,
        action[:64],
        resource[:128],
        str(resource_id)[:64] if resource_id is not None else None,
        (ip_address or "")[:45] or None,
        (user_agent or "")[:500] or None,
        json.dumps(metadata or {}),
    )


async def purge_older_than(days: int) -> int:
    """Delete audit rows older than ``days``. Returns deleted count."""
    days = max(1, min(3650, int(days)))
    try:
        result = await db.execute(
            """
            DELETE FROM audit_logs
            WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
            """,
            days,
        )
        # asyncpg returns e.g. "DELETE 12"
        if isinstance(result, str) and result.startswith("DELETE "):
            return int(result.split()[-1])
        return 0
    except Exception:
        return 0
