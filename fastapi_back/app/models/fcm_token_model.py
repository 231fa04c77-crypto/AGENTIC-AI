from typing import List, Optional

from app.config.db import db


async def ensure_fcm_tokens_table():
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS user_fcm_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            fcm_token TEXT NOT NULL,
            platform VARCHAR(16) DEFAULT 'android',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (user_id, fcm_token)
        )
        """
    )
    await db.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id
            ON user_fcm_tokens (user_id)
        """
    )


async def upsert_token(user_id: int, fcm_token: str, platform: str = "android"):
    await db.fetch_row(
        """
        INSERT INTO user_fcm_tokens (user_id, fcm_token, platform, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, fcm_token)
        DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
        RETURNING *
        """,
        int(user_id),
        fcm_token.strip(),
        (platform or "android").lower()[:16],
    )


async def delete_token(user_id: int, fcm_token: str):
    await db.execute(
        "DELETE FROM user_fcm_tokens WHERE user_id = $1 AND fcm_token = $2",
        int(user_id),
        fcm_token.strip(),
    )


async def delete_tokens(user_id: int, tokens: List[str]):
    if not tokens:
        return
    await db.execute(
        "DELETE FROM user_fcm_tokens WHERE user_id = $1 AND fcm_token = ANY($2::text[])",
        int(user_id),
        tokens,
    )


async def get_tokens_for_user(user_id: int) -> List[str]:
    rows = await db.query(
        "SELECT fcm_token FROM user_fcm_tokens WHERE user_id = $1",
        int(user_id),
    )
    return [r["fcm_token"] for r in rows if r.get("fcm_token")]
