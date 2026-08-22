import asyncio
from app.controllers import hospital_controller
from app.config.db import db

async def verify():
    try:
        await db.connect()
        # Aster Ramesh Hospital is ID 32 in previous report
        res = await hospital_controller.get_hospital_tieup_details(32)
        if res['success']:
            hospital = res['hospital']
            print(f"Hospital: {hospital['name']}")
            print(f"Doctor Count: {len(hospital['doctors'])}")
            for doc in hospital['doctors']:
                print(f" - {doc['name']} (Image: {doc['image']})")
        else:
            print(f"Error: {res['message']}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(verify())
