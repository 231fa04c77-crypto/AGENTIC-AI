import asyncio
import os
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.append(os.getcwd())

from app.config.db import db
from app.config.config import settings

async def create_tables():
    print("--- 🐘 MediChain+ Super Admin Table Setup ---")
    
    connected = await db.connect()
    if not connected:
        print("❌ Could not connect to PostgreSQL.")
        return

    try:
        # Create job_applications table
        # We include some extra fields from the frontend to ensure no data loss, 
        # but keep core fields as requested.
        print("Creating job_applications table...")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS job_applications (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                position TEXT NOT NULL, -- This is 'role_applied' in frontend
                resume_url TEXT,
                city TEXT,
                qualification TEXT,
                experience TEXT,
                skills TEXT,
                cover_letter TEXT,
                status TEXT DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ job_applications table ready.")

        # Create super_appointments table (Naming it super_appointments to avoid conflict with existing 'appointments' table)
        print("Creating super_appointments table...")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS super_appointments (
                id SERIAL PRIMARY KEY,
                user_name TEXT NOT NULL,
                email TEXT NOT NULL,
                appointment_date DATE NOT NULL,
                appointment_time TIME NOT NULL,
                service_type TEXT NOT NULL,
                status TEXT DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ super_appointments table ready.")

    except Exception as e:
        print(f"❌ Error creating tables: {e}")
    finally:
        await db.disconnect()

    print("\n--- 🏁 Setup Finished ---")

if __name__ == "__main__":
    asyncio.run(create_tables())
