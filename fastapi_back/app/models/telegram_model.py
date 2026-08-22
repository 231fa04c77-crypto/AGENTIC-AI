"""Telegram account linking (patient chat_id ↔ PMS user)."""

from typing import Any, Dict, Optional

from app.config.db import db


async def ensure_telegram_schema() -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS telegram_user_links (
            chat_id BIGINT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            telegram_username TEXT,
            linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id)
        )
        """
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_telegram_user_links_user_id ON telegram_user_links(user_id)"
    )
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS telegram_link_codes (
            code TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ NOT NULL
        )
        """
    )


async def get_link_by_chat_id(chat_id: int) -> Optional[Dict[str, Any]]:
    sql = """
        SELECT l.chat_id, l.user_id, l.telegram_username, l.linked_at,
               u.name, u.email, u.phone, u.role
        FROM telegram_user_links l
        JOIN users u ON u.id = l.user_id
        WHERE l.chat_id = $1
    """
    return await db.fetch_row(sql, chat_id)


async def get_link_by_user_id(user_id: int) -> Optional[Dict[str, Any]]:
    sql = "SELECT * FROM telegram_user_links WHERE user_id = $1"
    return await db.fetch_row(sql, user_id)


async def link_chat_to_user(
    chat_id: int,
    user_id: int,
    telegram_username: Optional[str] = None,
) -> Dict[str, Any]:
    await db.execute(
        "DELETE FROM telegram_user_links WHERE user_id = $1 AND chat_id <> $2",
        int(user_id),
        int(chat_id),
    )
    sql = """
        INSERT INTO telegram_user_links (chat_id, user_id, telegram_username)
        VALUES ($1, $2, $3)
        ON CONFLICT (chat_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            telegram_username = EXCLUDED.telegram_username,
            linked_at = CURRENT_TIMESTAMP
        RETURNING *
    """
    return await db.fetch_row(sql, chat_id, user_id, telegram_username)


async def unlink_chat(chat_id: int) -> bool:
    row = await db.fetch_row(
        "DELETE FROM telegram_user_links WHERE chat_id = $1 RETURNING chat_id",
        chat_id,
    )
    return row is not None


async def unlink_user(user_id: int) -> bool:
    row = await db.fetch_row(
        "DELETE FROM telegram_user_links WHERE user_id = $1 RETURNING user_id",
        int(user_id),
    )
    return row is not None


async def create_link_code(user_id: int, code: str, expires_at) -> None:
    await db.execute(
        "DELETE FROM telegram_link_codes WHERE user_id = $1",
        int(user_id),
    )
    await db.execute(
        """
        INSERT INTO telegram_link_codes (code, user_id, expires_at)
        VALUES ($1, $2, $3)
        """,
        code,
        int(user_id),
        expires_at,
    )


async def consume_link_code(code: str) -> Optional[int]:
    row = await db.fetch_row(
        """
        DELETE FROM telegram_link_codes
        WHERE code = $1 AND expires_at > NOW()
        RETURNING user_id
        """,
        code.strip(),
    )
    if not row:
        return None
    return int(row["user_id"])
