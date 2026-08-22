"""Verify migration 038_pharmacy_pharmasync_connect is applied."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.db import db


async def main() -> None:
    await db.connect()
    rows = await db.query(
        "SELECT version, applied_at FROM schema_migrations WHERE version = $1",
        "038_pharmacy_pharmasync_connect",
    )
    print("migration:", rows)
    cols = await db.query(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pharmacies'
          AND column_name = ANY($1::text[])
        ORDER BY column_name
        """,
        [
            "manager_name",
            "email",
            "phone",
            "address",
            "license_number",
            "partner_pharmacy_ref",
            "connection_status",
        ],
    )
    print("columns:", [r["column_name"] for r in cols])
    await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
