"""Verify pharmacy/medical migrations against DATABASE_URL (no secrets printed)."""
from __future__ import annotations

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()


async def main() -> int:
    url = os.getenv("DATABASE_URL")
    if not url:
        print("RESULT: NO_DATABASE_URL")
        return 2
    try:
        import asyncpg
    except ImportError:
        print("RESULT: asyncpg missing")
        return 2

    conn = await asyncpg.connect(url)
    try:
        rows = await conn.fetch(
            "SELECT version FROM schema_migrations "
            "WHERE version LIKE '032%' OR version LIKE '037%' ORDER BY version"
        )
        versions = [r["version"] for r in rows]
        print("schema_migrations:", versions or "NONE")

        ph = await conn.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='pharmacy_orders' AND column_name = ANY($1::text[]) ORDER BY 1",
            ["is_sandbox", "parent_order_id", "refill_of_consultation_id"],
        )
        print("pharmacy_orders cols:", [r["column_name"] for r in ph])

        mk = await conn.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='medical_knowledge' AND column_name = ANY($1::text[]) ORDER BY 1",
            ["keyword", "immediate_action", "do_not", "source"],
        )
        print("medical_knowledge cols:", [r["column_name"] for r in mk])

        ok_ph = len(ph) >= 3
        ok_mk = len(mk) >= 1  # at least keyword
        if ok_ph and ok_mk:
            print("RESULT: OK")
            return 0
        print("RESULT: MISSING_COLUMNS")
        return 1
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
