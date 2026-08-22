import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    try:
        conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
        print("Connected directly to PostgreSQL")
        res = await conn.execute('DELETE FROM hospital_tieup_doctors WHERE id = 74 OR id = 72')
        print(f"Delete result: {res}")
        await conn.close()
        print("Deduplication complete")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
