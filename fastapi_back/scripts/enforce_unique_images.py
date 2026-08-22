import os
import asyncio
import cloudinary
import cloudinary.api
import cloudinary.uploader
from app.config.config import settings
from app.config.db import db
from dotenv import load_dotenv

load_dotenv()

async def enforce_unique_images():
    # 1. Setup Cloudinary
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )

    print("--- 1. Cloudinary Inventory ---")
    try:
        # Get all resources
        resources = cloudinary.api.resources(type="upload", max_results=500)
        cloudinary_images = resources.get('resources', [])
        
        # Filter for valid image formats and exclude user-profiles, health-records, and job-applications
        filtered_images = []
        for img in cloudinary_images:
            pub_id = img.get('public_id', '')
            fmt = img.get('format', '').lower()
            if fmt in ('jpg', 'jpeg', 'png', 'webp'):
                if not any(folder in pub_id for folder in ('health-records', 'user-profiles', 'job-applications')):
                    filtered_images.append(img)
                    
        available_urls = [img['secure_url'] for img in filtered_images]
        print(f"Available Cloudinary Images (Filtered): {len(available_urls)}")
    except Exception as e:
        print(f"Error accessing Cloudinary: {e}")
        return

    # 2. Database Inventory
    await db.connect()
    
    # Standalone Doctors
    db_doctors = await db.fetch_all("SELECT id, name, image FROM doctors")
    # Hospital Tie-up Doctors
    db_tied_doctors = await db.fetch_all("SELECT id, name, image FROM hospital_tieup_doctors")
    
    all_docs = []
    for d in db_doctors:
        all_docs.append({'type': 'Standalone', 'id': d['id'], 'name': d['name'], 'image': d['image'], 'table': 'doctors'})
    for d in db_tied_doctors:
        all_docs.append({'type': 'Tie-up', 'id': d['id'], 'name': d['name'], 'image': d['image'], 'table': 'hospital_tieup_doctors'})

    print(f"Total Doctors in DB: {len(all_docs)}")

    # 3. Processing & Enforcement
    assigned_images = set()
    doctors_fixed = 0
    doctors_cleared = 0
    duplicate_fixes = 0

    # Step A: Identify valid mappings and clear invalid ones
    valid_docs = []
    to_fix_docs = []

    for doc in all_docs:
        img = str(doc['image'] or '')
        is_cloudinary = "res.cloudinary.com" in img
        
        if is_cloudinary and img not in assigned_images:
            # Valid unique assignment
            assigned_images.add(img)
            valid_docs.append(doc)
        else:
            # Duplicate Cloudinary or Local/Broken link/GitHub URL
            to_fix_docs.append(doc)
            # Clear invalid/reused links from DB immediately to enforce strictness
            await db.execute(f"UPDATE {doc['table']} SET image = NULL WHERE id = $1", doc['id'])
            doctors_cleared += 1
            if is_cloudinary and img in assigned_images:
                duplicate_fixes += 1

    print(f"Existing Valid Mappings Kept: {len(valid_docs)}")
    print(f"Invalid/Duplicate Links Cleared: {doctors_cleared}")

    # Step B: Reassign available Cloudinary images to doctors with NULL images
    remaining_cloudinary = [url for url in available_urls if url not in assigned_images]
    print(f"Remaining Unique Images available in Cloudinary: {len(remaining_cloudinary)}")

    mapping_count = 0
    for doc in to_fix_docs:
        if remaining_cloudinary:
            new_img = remaining_cloudinary.pop(0)
            await db.execute(f"UPDATE {doc['table']} SET image = $1 WHERE id = $2", new_img, doc['id'])
            assigned_images.add(new_img)
            mapping_count += 1
        else:
            # No more unique images left
            pass

    print(f"New Unique Mappings assigned: {mapping_count}")
    
    # Final Tally
    final_doctors = await db.fetch_all("SELECT id, name, image FROM doctors")
    final_tied = await db.fetch_all("SELECT id, name, image FROM hospital_tieup_doctors")
    
    total_with_images = sum(1 for d in final_doctors if d['image']) + sum(1 for d in final_tied if d['image'])
    total_missing = (len(final_doctors) + len(final_tied)) - total_with_images

    print(f"\n--- Final Enforcement Report ---")
    print(f"Total Doctors: {len(all_docs)}")
    print(f"Successfully Mapped with UNIQUE Cloudinary Images: {total_with_images}")
    print(f"Doctors MISSING Images (Unique images exhausted): {total_missing}")
    print(f"Local/Broken links removed: {doctors_cleared - duplicate_fixes}")
    print(f"Duplicate Image usages fixed: {duplicate_fixes}")

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(enforce_unique_images())
