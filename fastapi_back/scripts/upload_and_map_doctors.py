import asyncio
import os
import sys
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

# Ensure app is in path
sys.path.append(os.getcwd())

from app.config.db import db
from app.config.config import settings

# Load env
load_dotenv()

# Cloudinary Config
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET') or os.getenv('CLOUDINARY_SECRET_KEY'),
    secure=True
)

FEMALE_NAMES = [
    'priya', 'meena', 'shreya', 'deepa', 'preeti', 'kavita', 'haritha', 'padma', 
    'sridevi', 'bhavani', 'anitha', 'devi', 'nair', 'pratima', 'sunita', 'geeta', 
    'ananya', 'pooja', 'kiran', 'aditi', 'divya', 'rhea', 'sneha', 'neha', 'tanvi'
]

async def upload_images_to_cloudinary():
    print("--- 1. Scanning and Uploading Doctor Images to Cloudinary ---")
    
    # 1. Scanning local uploads/doctors
    local_doctors_dir = os.path.join("uploads", "doctors")
    local_images = []
    if os.path.exists(local_doctors_dir):
        for f in os.listdir(local_doctors_dir):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                local_images.append({
                    'path': os.path.join(local_doctors_dir, f),
                    'gender': 'female' if 'doctor_f' in f.lower() else 'male'
                })
    print(f"Found {len(local_images)} standard local template images.")

    # 2. Scanning frontend Doctors_list
    frontend_doctors_dir = os.path.join("..", "frontend", "src", "assets", "Doctors_list")
    frontend_images = []
    if os.path.exists(frontend_doctors_dir):
        for hospital_folder in os.listdir(frontend_doctors_dir):
            hosp_path = os.path.join(frontend_doctors_dir, hospital_folder)
            if os.path.isdir(hosp_path):
                for f in os.listdir(hosp_path):
                    if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                        # Infer gender from filename
                        name_lower = f.lower()
                        is_female = any(fn in name_lower for fn in FEMALE_NAMES)
                        frontend_images.append({
                            'path': os.path.join(hosp_path, f),
                            'gender': 'female' if is_female else 'male'
                        })
    print(f"Found {len(frontend_images)} hospital-specific doctor images in frontend.")

    all_scanned = local_images + frontend_images
    print(f"Total doctor images found to upload: {len(all_scanned)}")

    # Upload to Cloudinary with tags so we can track them
    male_urls = []
    female_urls = []

    for idx, item in enumerate(all_scanned):
        print(f"[{idx+1}/{len(all_scanned)}] Uploading {os.path.basename(item['path'])} ({item['gender']})...")
        try:
            filename_slug = os.path.splitext(os.path.basename(item['path']))[0]
            upload_result = cloudinary.uploader.upload(
                item['path'],
                folder="doctors/profiles",
                public_id=f"doc_profile_{filename_slug}",
                tags=["pms_doctor_profile"],
                overwrite=True
            )
            secure_url = upload_result['secure_url']
            if item['gender'] == 'female':
                female_urls.append(secure_url)
            else:
                male_urls.append(secure_url)
        except Exception as e:
            print(f"Failed to upload {item['path']}: {e}")

    print(f"\nUpload Completed! Uploaded {len(male_urls)} Male images and {len(female_urls)} Female images.")
    return male_urls, female_urls

async def run_mapping():
    # 1. First upload/ensure Cloudinary images are populated
    male_urls, female_urls = await upload_images_to_cloudinary()
    
    if not male_urls or not female_urls:
        print("Error: Could not retrieve doctor profile images from Cloudinary.")
        return

    # 2. Database Inventory
    await db.connect()
    
    # Standalone Doctors
    db_doctors = await db.fetch_all("SELECT id, name FROM doctors")
    # Hospital Tie-up Doctors
    db_tied_doctors = await db.fetch_all("SELECT id, name FROM hospital_tieup_doctors")
    
    all_docs = []
    for d in db_doctors:
        all_docs.append({'id': d['id'], 'name': d['name'], 'table': 'doctors'})
    for d in db_tied_doctors:
        all_docs.append({'id': d['id'], 'name': d['name'], 'table': 'hospital_tieup_doctors'})

    print(f"\n--- 2. Database Mapping for {len(all_docs)} Doctors ---")

    male_idx = 0
    female_idx = 0
    mappings_count = 0

    for doc in all_docs:
        name_lower = doc['name'].lower()
        # Infer gender
        is_female = any(fn in name_lower for fn in FEMALE_NAMES)
        gender = 'female' if is_female else 'male'
        
        if gender == 'female':
            assigned_url = female_urls[female_idx % len(female_urls)]
            female_idx += 1
        else:
            assigned_url = male_urls[male_idx % len(male_urls)]
            male_idx += 1
            
        print(f"Mapping Doctor: {doc['name']} ({gender}) -> {os.path.basename(assigned_url)}")
        await db.execute(f"UPDATE {doc['table']} SET image = $1 WHERE id = $2", assigned_url, doc['id'])
        mappings_count += 1

    print(f"\nSuccessfully updated {mappings_count} doctors in DB with gender-appropriate actual profiles!")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(run_mapping())
