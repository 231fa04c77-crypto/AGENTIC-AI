"""Apply 002_user_onboarding.sql to PostgreSQL."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config.db import db

MIGRATION_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_completed BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0",
]


async def main() -> None:
    ok = await db.connect()
    if not ok:
        print("ERROR: Could not connect to PostgreSQL.")
        sys.exit(1)

    for sql in MIGRATION_STATEMENTS:
        await db.execute(sql)
        print(f"OK: {sql[:60]}...")

    # Only backfill rows that have never been touched (new column defaults).
    await db.execute(
        """
        UPDATE users SET
          onboarding_completed = COALESCE(onboarding_completed, FALSE),
          tutorial_completed = COALESCE(tutorial_completed, FALSE),
          emergency_contact_completed = COALESCE(emergency_contact_completed, FALSE),
          profile_completed = COALESCE(profile_completed, FALSE),
          onboarding_step = COALESCE(onboarding_step, 0)
        WHERE onboarding_completed IS NULL
           OR tutorial_completed IS NULL
        """
    )
    print("OK: column defaults applied")

    await db.disconnect()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(main())
