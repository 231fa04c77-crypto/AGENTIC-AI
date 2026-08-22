import asyncio
import os
import sys

# Add the project root to PYTHONPATH
sys.path.append(os.getcwd())

from app.config.db import db

async def check_schema():
    await db.connect()
    try:
        sql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'appointments'"
        rows = await db.fetch_all(sql)
        for row in rows:
            print(f"{row['column_name']}: {row['data_type']}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(check_schema())
