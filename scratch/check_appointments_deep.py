import asyncio
import os
import sys

sys.path.append(os.getcwd())

from app.config.db import db

async def check():
    await db.connect()
    try:
        res = await db.fetch_row("SELECT pg_typeof(doctor_id) as type FROM appointments LIMIT 1")
        if res:
             print(f"ACTUAL PG TYPE: {res['type']}")
        
        # Check if any row has 'emb_'
        # We need to cast it to text or use a column that is text
        # If doctor_id is integer, this will error if we compare to string without cast
        try:
            res2 = await db.fetch_all("SELECT doctor_id FROM appointments WHERE doctor_id::text LIKE 'emb_%'")
            print(f"Rows with 'emb_': {len(res2)}")
        except Exception as e:
            print(f"Error checking for 'emb_': {e}")
            
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(check())
