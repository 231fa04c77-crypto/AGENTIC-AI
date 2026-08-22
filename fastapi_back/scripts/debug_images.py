import asyncio
from app.config.db import db

async def list_docs():
    await db.connect()
    docs = await db.fetch_all("SELECT name, image FROM doctors WHERE image IS NOT NULL")
    tied = await db.fetch_all("SELECT name, image FROM hospital_tieup_doctors WHERE image IS NOT NULL")
    
    print("\n--- STANDALONE DOCTORS ---")
    for d in docs:
        print(f"{d['name']} : {d['image']}")
        
    print("\n--- TIE-UP DOCTORS ---")
    for d in tied:
        print(f"{d['name']} : {d['image']}")
        
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(list_docs())
