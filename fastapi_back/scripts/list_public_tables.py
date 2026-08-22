import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
import asyncpg

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


async def main() -> None:
    url = os.environ["DATABASE_URL"]
    print("connecting...")
    conn = await asyncio.wait_for(
        asyncpg.connect(url, ssl="require", timeout=20, statement_cache_size=0),
        timeout=30,
    )
    print("connected")
    rows = await conn.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
    )
    print("count", len(rows))
    print(",".join(r["tablename"] for r in rows))
    for name in ("users", "doctors", "appointments", "hospital_tieups"):
        exists = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1)",
            name,
        )
        print(name, exists)
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
