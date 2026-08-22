import asyncio
from app.config.db import db

async def main():
    await db.connect()
    
    # Count of standalone doctors
    doctors_count = await db.fetch_row("SELECT count(*) FROM doctors")
    print("Standalone Doctors count in 'doctors' table:", dict(doctors_count))
    
    # Count of tie-up doctors
    tieup_count = await db.fetch_row("SELECT count(*) FROM hospital_tieup_doctors")
    print("Tie-up Doctors count in 'hospital_tieup_doctors' table:", dict(tieup_count))
    
    # Active distinct doctors in front-end context
    # Let's count standard doctors linked to the top 10 hospitals
    hospitals = await db.fetch_all("SELECT id FROM hospital_tieups ORDER BY id ASC LIMIT 10")
    hospital_ids = [h['id'] for h in hospitals]
    
    print(f"Top 10 Hospital IDs: {hospital_ids}")
    
    docs_main = await db.fetch_all("SELECT id, name, hospital_id FROM doctors WHERE hospital_id = ANY($1)", hospital_ids)
    print(f"Standalone doctors in top 10 hospitals: {len(docs_main)}")
    
    docs_tied = await db.fetch_all("SELECT id, name, hospital_tieup_id FROM hospital_tieup_doctors WHERE hospital_tieup_id = ANY($1)", hospital_ids)
    print(f"Hospital tie-up doctors in top 10 hospitals: {len(docs_tied)}")
    
    # Combined deduplication like the frontend context
    combined = []
    seen = set()
    
    for d in docs_main:
        name = d['name'].strip().lower()
        key = f"{name}_main"
        if key not in seen:
            combined.append(d)
            seen.add(key)
            
    for d in docs_tied:
        name = d['name'].strip().lower()
        key = f"{name}_tied"
        if key not in seen:
            combined.append(d)
            seen.add(key)
            
    print(f"Total Combined Doctors in Context: {len(combined)}")
    
    # Let's see ALL doctors in 'doctors' table and 'hospital_tieup_doctors' table regardless of hospital limitations
    all_main_docs = await db.fetch_all("SELECT name FROM doctors")
    all_tied_docs = await db.fetch_all("SELECT name FROM hospital_tieup_doctors")
    
    all_seen = set()
    for d in all_main_docs:
        all_seen.add(d['name'].strip().lower())
    for d in all_tied_docs:
        all_seen.add(d['name'].strip().lower())
        
    print(f"Total Unique Doctors in Entire DB: {len(all_seen)}")
    
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
