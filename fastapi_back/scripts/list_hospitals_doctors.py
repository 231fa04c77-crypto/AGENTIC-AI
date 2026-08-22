import asyncio
from app.config.db import db

async def list_data():
    try:
        await db.connect()
        print("Connected to DB")
        hospitals = await db.query('SELECT id, name FROM hospital_tieups LIMIT 5')
        doctors = await db.query('SELECT id, name, hospital_id FROM doctors LIMIT 10')
        
        print("\n--- HOSPITALS ---")
        for h in hospitals:
            print(f"ID: {h['id']}, Name: {h['name']}")
            
        print("\n--- DOCTORS ---")
        for d in doctors:
            print(f"ID: {d['id']}, Name: {d['name']}, Hospital ID: {d['hospital_id']}")
            
    except Exception as e:
        print(f"Error: {str(e).encode('ascii', 'ignore').decode()}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(list_data())
