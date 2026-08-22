import os
import asyncio
import cloudinary
import cloudinary.api
from app.config.config import settings
from app.config.db import db
from dotenv import load_dotenv

load_dotenv()

async def deep_audit_images():
    # 1. Setup Cloudinary
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )

    print("--- 1. Cloudinary Analysis ---")
    try:
        # Get all resources in the 'doctors' folder or just all images if no folder structure
        # Note: listing requires the Admin API which might have rate limits, but for this audit we need it.
        resources = cloudinary.api.resources(type="upload", prefix="doctors/", max_results=500)
        cloudinary_images = resources.get('resources', [])
        
        # If 'doctors/' prefix didn't return much, try a broader search or just use what we have
        if not cloudinary_images:
            resources = cloudinary.api.resources(type="upload", max_results=500)
            cloudinary_images = resources.get('resources', [])

        total_cloudinary_images = len(cloudinary_images)
        cloudinary_urls = [img['secure_url'] for img in cloudinary_images]
        cloudinary_public_ids = [img['public_id'] for img in cloudinary_images]
        
        print(f"Total images found in Cloudinary: {total_cloudinary_images}")
    except Exception as e:
        print(f"Error accessing Cloudinary API: {e}")
        cloudinary_images = []
        total_cloudinary_images = 0
        cloudinary_urls = []

    # 2. Database Analysis
    await db.connect()
    
    # Standalone Doctors
    db_doctors = await db.fetch_all("SELECT id, name, image FROM doctors")
    # Hospital Tie-up Doctors
    db_tied_doctors = await db.fetch_all("SELECT id, name, image FROM hospital_tieup_doctors")
    
    all_docs = []
    for d in db_doctors:
        all_docs.append({'type': 'Standalone', 'id': d['id'], 'name': d['name'], 'image': d['image']})
    for d in db_tied_doctors:
        all_docs.append({'type': 'Tie-up', 'id': d['id'], 'name': d['name'], 'image': d['image']})

    total_doctors_db = len(all_docs)
    print(f"\n--- 2. Database Analysis ---")
    print(f"Total doctor records in DB: {total_doctors_db}")

    # 3. Mapping and Verification
    image_to_doctors = {}
    doctors_without_images = []
    local_image_doctors = []
    cloudinary_image_doctors = []
    placeholder_image_doctors = []

    for doc in all_docs:
        img = doc['image']
        if not img or img.strip() == "" or "placeholder" in str(img).lower():
            doctors_without_images.append(doc)
        else:
            if img not in image_to_doctors:
                image_to_doctors[img] = []
            image_to_doctors[img].append(doc)
            
            if "res.cloudinary.com" in str(img):
                cloudinary_image_doctors.append(doc)
            elif "localhost" in str(img) or "uploads/" in str(img):
                local_image_doctors.append(doc)
            else:
                placeholder_image_doctors.append(doc)

    duplicate_image_usage = {url: docs for url, docs in image_to_doctors.items() if len(docs) > 1}
    
    unique_images_in_db = len(image_to_doctors)
    total_reused_images = len(duplicate_image_usage)
    doctors_sharing_images = sum(len(docs) for docs in duplicate_image_usage.values())

    # Check Cloudinary usage
    used_cloudinary_urls = set()
    for url in image_to_doctors.keys():
        if "res.cloudinary.com" in str(url):
            used_cloudinary_urls.add(url)
    
    unused_cloudinary_images = [url for url in cloudinary_urls if url not in used_cloudinary_urls]

    print(f"\n--- 3. Audit Results ---")
    print(f"Unique image URLs used in DB: {unique_images_in_db}")
    print(f"Doctors with NO image/placeholder: {len(doctors_without_images)}")
    print(f"Doctors using LOCAL/Broken links: {len(local_image_doctors)}")
    print(f"Doctors using CLOUDINARY: {len(cloudinary_image_doctors)}")
    print(f"Images REUSED by multiple doctors: {total_reused_images}")
    print(f"Total doctors SHARING images: {doctors_sharing_images}")
    print(f"Cloudinary images NOT linked to any DB record: {len(unused_cloudinary_images)}")

    print(f"\n--- 4. Detailed Mismatches ---")
    if duplicate_image_usage:
        print("Example of Reused Images:")
        count = 0
        for url, docs in duplicate_image_usage.items():
            if count < 5:
                doc_names = ", ".join([f"{d['name']} (ID:{d['id']})" for d in docs])
                print(f"- Image [{url}] used by: {doc_names}")
                count += 1
    
    if local_image_doctors:
        print("\nExample of Broken/Local Links (Needs fix):")
        for d in local_image_doctors[:5]:
            print(f"- {d['name']} (ID:{d['id']}) -> {d['image']}")

    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(deep_audit_images())
