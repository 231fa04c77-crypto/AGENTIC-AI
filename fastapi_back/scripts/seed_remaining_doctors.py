import asyncio
from app.config.db import db
import random

async def seed_doctors():
    try:
        await db.connect()
        print("Connected to DB")
        
        # Mapping of hospital names to their expected doctor specializations
        hospital_specializations = {
            "Vision Eye Institute": "Ophthalmologist",
            "Mind Clinic": "Psychiatrist",
            "Digestive Health Center": "Gastroenterologist",
            "Brain & Spine Institute": "Neurologist",
            "Bone & Joint Center": "Orthopedic Surgeon",
            "Women Health Clinic": "Gynecologist",
            "Skin Care Center": "Dermatologist",
            "Ear Nose Throat Hospital": "ENT Specialist",
            "City General Hospital": "General Physician",
            "Kids Care Hospital": "Pediatrician",
            "Heart Care Hospital": "Cardiologist",
            "Smile Dental Clinic": "Dentist"
        }
        
        # Sample doctor names to rotate through
        doctor_names = [
            "Dr. Arun Kumar", "Dr. S. K. Sharma", "Dr. Priya Reddy", "Dr. Rahul Verma",
            "Dr. Sneha Kapoor", "Dr. Vikram Singh", "Dr. Anjali Gupta", "Dr. Rajesh Iyer",
            "Dr. Meera Nair", "Dr. Aditya Joshi", "Dr. Kavita Rao", "Dr. Sanjay Dutt"
        ]
        
        # Check which hospitals have 0 doctors
        hospitals = await db.fetch_all("SELECT id, name FROM hospital_tieups")
        
        for h in hospitals:
            h_id = h['id']
            h_name = h['name']
            
            # Count doctors in both tables
            res1 = await db.fetch_one("SELECT COUNT(*) FROM doctors WHERE hospital_id = $1", h_id)
            count1 = res1[0] if res1 else 0
            
            res2 = await db.fetch_one("SELECT COUNT(*) FROM hospital_tieup_doctors WHERE hospital_tieup_id = $1", h_id)
            count2 = res2[0] if res2 else 0
            
            if (count1 + count2) == 0:
                print(f"Seeding doctors for {h_name} (ID: {h_id})...")
                
                spec = hospital_specializations.get(h_name, "Medical Specialist")
                
                # Add 2 doctors for each empty hospital
                for i in range(2):
                    name = f"{random.choice(doctor_names)} {chr(65+i)}"
                    # Use a UI-Avatar for simplicity
                    clean_name = name.replace('Dr. ', '').strip()
                    image = f"https://ui-avatars.com/api/?name={clean_name.replace(' ', '+')}&background=667eea&color=fff"
                    
                    sql = """
                        INSERT INTO hospital_tieup_doctors (
                            hospital_tieup_id, name, qualification, specialization, experience, image, available
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """
                    await db.execute(sql, h_id, name, "MBBS, MD", spec, f"{random.randint(5, 15)} Years", image, True)
                    
                print(f"✅ Added 2 doctors to {h_name}")
            else:
                print(f"Skipping {h_name}, already has {count1+count2} doctors.")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(seed_doctors())
