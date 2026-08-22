"""Apply pending SQL migrations. Usage: python scripts/run_migrations.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.db import db
from app.db.migration_runner import run_pending_migrations


async def main() -> None:
    ok = await db.connect()
    if not ok:
        print("ERROR: Could not connect to PostgreSQL.")
        sys.exit(1)
    applied = await run_pending_migrations()
    if applied:
        print(f"Applied {len(applied)} migration(s): {', '.join(applied)}")
    else:
        print("No pending migrations.")
    await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
