import asyncio
import os
import sys

sys.path.append(os.getcwd())

from app.config.db import db

async def check_data():
    await db.connect()
    try:
        sql = "SELECT doctor_id FROM appointments LIMIT 10"
        rows = await db.fetch_all(sql)
        for row in rows:
            val = row['doctor_id']
            print(f"Value: {val}, Type: {type(val)}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(check_data())
