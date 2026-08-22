import asyncio
import os
import re
import bcrypt
from app.config.db import db

# Helper to generate password hash
def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')

def clean_doctor_name(name: str) -> str:
    """Strip Dr. prefix and return trimmed name."""
    clean = name.strip()
    if clean.lower().startswith("dr."):
        clean = clean[3:].strip()
    elif clean.lower().startswith("dr "):
        clean = clean[2:].strip()
    return clean

def generate_email_from_name(name: str) -> str:
    """Generate a clean, professional email from a doctor name."""
    clean = clean_doctor_name(name).lower()
    # Remove degree info inside parentheses if present (e.g. Dr. Kishore Reddy (MBBS))
    clean = re.sub(r'\(.*?\)', '', clean).strip()
    # Replace spaces and multiple dots with a single dot
    clean = re.sub(r'[\s\._]+', '.', clean)
    # Remove any special characters except dots
    clean = re.sub(r'[^a-z\.]', '', clean)
    # Strip leading/trailing dots
    clean = clean.strip('.')
    return f"dr.{clean}@medichain.com"

async def sync():
    try:
        await db.connect()
        print("Connected to PostgreSQL")
        
        # 1. Fetch all hospitals for lookup
        hospitals = await db.fetch_all("SELECT id, name FROM hospital_tieups ORDER BY id")
        hosp_map = {h['id']: h['name'] for h in hospitals}
        print(f"Loaded {len(hospitals)} hospitals")
        
        # 2. Fetch all tie-up/embedded doctors
        emb_docs = await db.fetch_all("SELECT * FROM hospital_tieup_doctors")
        print(f"Loaded {len(emb_docs)} hospital tie-up doctors")
        
        # 3. Process and merge doctors to identify the 34 unique physical doctors
        unique_doctors = {}
        
        # First pass: Load tie-up doctors (they are the primary hospital rosters)
        for doc in emb_docs:
            name = doc['name']
            clean_key = clean_doctor_name(name).lower()
            
            # Use tie-up doc info as baseline
            unique_doctors[clean_key] = {
                "name": name,
                "speciality": doc.get('specialization') or doc.get('speciality') or 'General Medicine',
                "degree": doc.get('qualification') or doc.get('degree') or 'MBBS, MD',
                "experience": doc.get('experience') or '8 Years',
                "about": doc.get('about') or f"Senior medical specialist in {doc.get('specialization', 'healthcare')}.",
                "fees": doc.get('fees') or 500,
                "image": doc.get('image'),
                "available": doc.get('available', True),
                "hospital_id": doc.get('hospital_tieup_id'),
                "slots_booked": doc.get('slots_booked') or '{}',
                "source": "tie-up"
            }
            
        # Second pass: Fetch existing records in standard doctors table to check for emails/passwords
        std_docs = await db.fetch_all("SELECT * FROM doctors")
        print(f"Loaded {len(std_docs)} standard doctor login accounts")
        
        for doc in std_docs:
            name = doc['name']
            clean_key = clean_doctor_name(name).lower()
            
            # Check if this doctor is already matched
            if clean_key in unique_doctors:
                # Keep their existing clean email if valid (not containing pms.local or placeholder doc_)
                email = doc['email']
                is_placeholder = "pms.local" in email or "placeholder" in email or "doc_" in email or ".." in email
                
                if not is_placeholder:
                    unique_doctors[clean_key]["email"] = email
                
                # Copy standard doctors attributes
                unique_doctors[clean_key]["existing_id"] = doc['id']
                unique_doctors[clean_key]["fees"] = doc['fees'] or unique_doctors[clean_key]["fees"]
                unique_doctors[clean_key]["image"] = doc['image'] or unique_doctors[clean_key]["image"]
                unique_doctors[clean_key]["available"] = doc['available']
                unique_doctors[clean_key]["slots_booked"] = doc['slots_booked'] or unique_doctors[clean_key]["slots_booked"]
            else:
                # Standalone doctor not in tie-ups list (if any)
                unique_doctors[clean_key] = {
                    "name": name,
                    "email": doc['email'],
                    "speciality": doc['speciality'],
                    "degree": doc['degree'],
                    "experience": doc['experience'],
                    "about": doc['about'],
                    "fees": doc['fees'],
                    "image": doc['image'],
                    "available": doc['available'],
                    "hospital_id": doc['hospital_id'],
                    "slots_booked": doc['slots_booked'] or '{}',
                    "existing_id": doc['id'],
                    "source": "standalone"
                }

        # 4. Standardize emails and write credentials to table
        sync_password = "mc.doctor.123"
        hashed_password = get_password_hash(sync_password)
        
        credentials_list = []
        
        print("\n=== STARTING SYNCHRONIZATION ===")
        for key, doc_info in unique_doctors.items():
            name = doc_info["name"]
            
            # Determine/Generate clean email
            if "email" not in doc_info:
                generated_email = generate_email_from_name(name)
                # Keep original special emails like Gmail if they existed
                doc_info["email"] = generated_email
            else:
                # Clean up weird double dot emails
                email = doc_info["email"]
                if ".." in email or "pms.local" in email or "placeholder" in email or "doc_" in email:
                    doc_info["email"] = generate_email_from_name(name)
            
            email = doc_info["email"]
            hosp_name = hosp_map.get(doc_info["hospital_id"], "MediChain Care")
            
            # Upsert into 'doctors' table
            if "existing_id" in doc_info:
                # Update existing doctor login account with standard email, hashed password, and synchronized attributes
                sql_update = """
                    UPDATE doctors 
                    SET email = $1, password = $2, hospital_id = $3, speciality = $4, degree = $5,
                        experience = $6, about = $7, fees = $8, image = $9, available = $10,
                        address_line1 = 'Consultation Wing', address_line2 = $11
                    WHERE id = $12
                """
                await db.execute(
                    sql_update, 
                    email, 
                    hashed_password, 
                    doc_info["hospital_id"], 
                    doc_info["speciality"], 
                    doc_info["degree"],
                    doc_info["experience"], 
                    doc_info["about"], 
                    doc_info["fees"], 
                    doc_info["image"], 
                    doc_info["available"],
                    hosp_name,
                    doc_info["existing_id"]
                )
                print(f"Updated login account for: {name} | Email: {email}")
            else:
                import time
                now_ms = int(time.time() * 1000)
                # Insert missing doctor login account
                sql_insert = """
                    INSERT INTO doctors (
                        name, email, password, speciality, degree, experience, about, fees,
                        image, available, hospital_id, address_line1, address_line2, slots_booked, date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Consultation Wing', $12, $13, $14)
                    RETURNING id
                """
                new_row = await db.fetch_row(
                    sql_insert,
                    name,
                    email,
                    hashed_password,
                    doc_info["speciality"],
                    doc_info["degree"],
                    doc_info["experience"],
                    doc_info["about"],
                    doc_info["fees"],
                    doc_info["image"],
                    doc_info["available"],
                    doc_info["hospital_id"],
                    hosp_name,
                    doc_info["slots_booked"],
                    now_ms
                )
                doc_info["existing_id"] = new_row["id"]
                print(f"Created missing login account for: {name} | Email: {email}")
                
            credentials_list.append({
                "hospital": hosp_name,
                "name": name,
                "email": email,
                "password": sync_password,
                "speciality": doc_info["speciality"]
            })
            
        # 5. Build credentials markdown table
        lines = [
            "### 🩺 All Doctors Login Credentials\n",
            "This table lists the clean, verified login credentials for all unique doctors registered on the platform. Use these to log in successfully to the **Doctor Portal**.\n",
            "| Hospital Name | Doctor Name | Email | Password | Specialization |",
            "| :--- | :--- | :--- | :--- | :--- |"
        ]
        
        # Sort credentials by hospital, then by doctor name
        sorted_creds = sorted(credentials_list, key=lambda c: (c['hospital'], c['name']))
        for c in sorted_creds:
            lines.append(f"| **{c['hospital']}** | {c['name']} | `{c['email']}` | `{c['password']}` | {c['speciality']} |")
            
        out_path = os.path.normpath(
            os.path.join(os.path.dirname(__file__), "..", "..", "docs", "dev", "all_doctors_credentials.md")
        )
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
            
        print("\n[SUCCESS] Doctor credentials synchronized successfully!")
        print(f"Total Unique Doctors listed: {len(sorted_creds)}")
        print(f"Credentials file written to {out_path}")

    except Exception as e:
        print(f"Error during synchronization: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(sync())
