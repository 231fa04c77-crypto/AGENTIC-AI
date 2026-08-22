import asyncio
import httpx
from app.config.db import db
from app.config.config import settings

async def sync_images_with_cloudinary():
    await db.connect()
    print("--- Starting Image Sync & Validation ---")
    
    # 1. Fetch all doctors and tied-up doctors
    docs = await db.fetch_all("SELECT id, name, image FROM doctors WHERE image IS NOT NULL")
    tied_docs = await db.fetch_all("SELECT id, name, image FROM hospital_tieup_doctors WHERE image IS NOT NULL")
    
    all_to_check = []
    for d in docs: all_to_check.append({'table': 'doctors', 'id': d['id'], 'name': d['name'], 'url': d['image']})
    for d in tied_docs: all_to_check.append({'table': 'hospital_tieup_doctors', 'id': d['id'], 'name': d['name'], 'url': d['image']})

    print(f"Checking {len(all_to_check)} doctor images...")

    async with httpx.AsyncClient(timeout=10.0) as client:
        fixed_count = 0
        for doc in all_to_check:
            url = doc['url']
            
            if not url.startswith('http'):
                continue

            try:
                response = await client.head(url)
                
                if response.status_code == 404:
                    print(f"[CLEANUP] Deleted image for {doc['name']} (ID: {doc['id']})")
                    await db.execute(f"UPDATE {doc['table']} SET image = NULL WHERE id = $1", doc['id'])
                    fixed_count += 1
            except Exception as e:
                print(f"[ERROR] checking {doc['name']}: {str(e)}")

    print(f"\n--- Sync Complete ---")
    print(f"Total Ghost Images Cleaned: {fixed_count}")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(sync_images_with_cloudinary())
