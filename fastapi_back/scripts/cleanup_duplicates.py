import asyncio
import json
from app.config.db import db

async def cleanup():
    await db.connect()
    # Find duplicates by name and email
    duplicates = await db.fetch_all("""
        SELECT name, email, count(*) 
        FROM doctors 
        GROUP BY name, email 
        HAVING count(*) > 1
    """)
    
    if not duplicates:
        print("No exact name/email duplicates found in doctors table.")
    else:
        print(f"Found {len(duplicates)} duplicate doctor entries. Cleaning up...")
        for dup in duplicates:
            # Keep the one with the lowest ID
            rows = await db.fetch_all("SELECT id FROM doctors WHERE name = $1 AND email = $2 ORDER BY id ASC", dup['name'], dup['email'])
            to_delete = [r['id'] for r in rows[1:]]
            if to_delete:
                print(f"Deleting duplicate IDs for {dup['name']}: {to_delete}")
                await db.execute("DELETE FROM doctors WHERE id = ANY($1)", to_delete)

    # Same for hospital_tieup_doctors
    duplicates_emb = await db.fetch_all("""
        SELECT name, hospital_tieup_id, count(*) 
        FROM hospital_tieup_doctors 
        GROUP BY name, hospital_tieup_id 
        HAVING count(*) > 1
    """)
    
    if not duplicates_emb:
        print("No exact name/hospital duplicates found in hospital_tieup_doctors.")
    else:
        print(f"Found {len(duplicates_emb)} duplicate embedded doctor entries. Cleaning up...")
        for dup in duplicates_emb:
            rows = await db.fetch_all("SELECT id FROM hospital_tieup_doctors WHERE name = $1 AND hospital_tieup_id = $2 ORDER BY id ASC", dup['name'], dup['hospital_tieup_id'])
            to_delete = [r['id'] for r in rows[1:]]
            if to_delete:
                print(f"Deleting duplicate IDs for {dup['name']} in hospital {dup['hospital_tieup_id']}: {to_delete}")
                await db.execute("DELETE FROM hospital_tieup_doctors WHERE id = ANY($1)", to_delete)

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(cleanup())
