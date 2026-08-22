import asyncio
import os
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.append(os.getcwd())

from app.config.db import db
from app.config.config import settings

async def apply_schema():
    print("--- 🐘 MediChain+ Database Setup ---")
    
    if not settings.DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in .env")
        return

    print(f"Connecting to: {settings.DATABASE_URL[:20]}...[HIDDEN]")
    
    connected = await db.connect()
    if not connected:
        print("❌ Could not connect to PostgreSQL. Check your credentials.")
        return

    schema_path = Path("database_schema.sql")
    if not schema_path.exists():
        print(f"❌ Error: {schema_path} does not exist.")
        return

    print(f"Reading schema from {schema_path}...")
    with open(schema_path, "r", encoding="utf-8") as f:
        sql = f.read()

    print("Executing SQL commands...")
    try:
        # 1. Main Schema
        await db.execute(sql)
        print("✅ Schema applied successfully!")

        # 2. Seed Data
        seed_path = Path("seed_data.sql")
        if seed_path.exists():
            print(f"Applying seed data from {seed_path}...")
            with open(seed_path, "r", encoding="utf-8") as f:
                seed_sql = f.read()
            await db.execute(seed_sql)
            print("✅ Seed data applied successfully!")
        
    except Exception as e:
        print(f"❌ Error applying schema: {e}")
    finally:
        await db.disconnect()

    print("\n--- 🏁 Setup Finished ---")

if __name__ == "__main__":
    asyncio.run(apply_schema())
