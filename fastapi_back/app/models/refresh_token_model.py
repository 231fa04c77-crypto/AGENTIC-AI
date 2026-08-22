from datetime import datetime
from typing import Optional

from app.config.db import db


async def ensure_refresh_tokens_table() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id              BIGSERIAL PRIMARY KEY,
            user_id         VARCHAR(128) NOT NULL,
            role            VARCHAR(32)  NOT NULL CHECK (role IN ('patient', 'doctor', 'dean', 'admin')),
            token_hash      VARCHAR(128) NOT NULL,
            expires_at      TIMESTAMPTZ  NOT NULL,
            revoked_at      TIMESTAMPTZ,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            device_info     TEXT,
            ip_address      VARCHAR(45),
            CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
        )
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_role
            ON refresh_tokens (user_id, role)
            WHERE revoked_at IS NULL
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
            ON refresh_tokens (expires_at)
            WHERE revoked_at IS NULL
        """
    )


async def store_token(
    *,
    user_id: str,
    role: str,
    token_hash: str,
    expires_at: datetime,
    device_info: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    await db.execute(
        """
        INSERT INTO refresh_tokens (user_id, role, token_hash, expires_at, device_info, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        user_id,
        role,
        token_hash,
        expires_at,
        device_info,
        ip_address,
    )


async def find_by_hash(token_hash: str) -> Optional[dict]:
    row = await db.fetch_row(
        """
        SELECT id, user_id, role, token_hash, expires_at, revoked_at
        FROM refresh_tokens
        WHERE token_hash = $1
        LIMIT 1
        """,
        token_hash,
    )
    return dict(row) if row else None


async def find_active_by_hash(token_hash: str) -> Optional[dict]:
    row = await find_by_hash(token_hash)
    if not row or row.get("revoked_at"):
        return None
    return row


async def revoke_by_hash(token_hash: str) -> None:
    await db.execute(
        """
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE token_hash = $1 AND revoked_at IS NULL
        """,
        token_hash,
    )


async def revoke_all_for_user(user_id: str, role: str) -> None:
    await db.execute(
        """
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1 AND role = $2 AND revoked_at IS NULL
        """,
        user_id,
        role,
    )
