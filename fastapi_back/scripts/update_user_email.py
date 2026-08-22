import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.config.db import db

async def update():
    await db.connect()
    # Update specifically for Shaik Javed Ali
    r = await db.execute("UPDATE users SET email = 'shaikjavedali19@gmail.com' WHERE name ILIKE '%Shaik Javed Ali%'")
    print(f"✅ Successfully updated {r} user email(s) to shaikjavedali19@gmail.com")
    
    # Confirm
    user = await db.fetch_one("SELECT id, name, email FROM users WHERE name ILIKE '%Shaik Javed Ali%'")
    if user:
        print(f"Current Data in DB: ID: {user['id']}, Name: {user['name']}, Email: {user['email']}")
    
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(update())
