import asyncio
from app.config.db import db

async def get_hospital_doctor_list():
    try:
        await db.connect()
        
        # Fetch all hospitals
        hospitals = await db.fetch_all("SELECT id, name FROM hospital_tieups ORDER BY name")
        
        # Fetch all "real" doctors assigned to hospitals
        # We need to check both the 'doctors' table and 'hospital_tieup_doctors' table
        
        output = []
        for h in hospitals:
            hospital_id = h['id']
            hospital_name = h['name']
            
            # Types of doctors:
            # 1. Doctors from 'doctors' table linked via hospital_id
            docs_main = await db.fetch_all("SELECT name, speciality as specialization FROM doctors WHERE hospital_id = $1", hospital_id)
            
            # 2. Doctors from 'hospital_tieup_doctors' table
            docs_tied = await db.fetch_all("SELECT name, specialization FROM hospital_tieup_doctors WHERE hospital_tieup_id = $1", hospital_id)
            
            all_docs = []
            seen = set()
            
            for d in docs_main:
                name = d['name'].strip()
                if name.lower() not in seen:
                    all_docs.append({"name": name, "dept": d['specialization']})
                    seen.add(name.lower())
            
            for d in docs_tied:
                name = d['name'].strip()
                if name.lower() not in seen:
                    all_docs.append({"name": name, "dept": d['specialization']})
                    seen.add(name.lower())
            
            output.append({
                "hospital": hospital_name,
                "doctors": all_docs
            })
            
        return output
            
    except Exception as e:
        print(f"Error: {e}")
        return []
    finally:
        await db.disconnect()

async def main():
    data = await get_hospital_doctor_list()
    if not data:
        print("No data found")
        return
        
    lines = []
    for item in data:
        lines.append(f"### {item['hospital']}")
        if not item['doctors']:
            lines.append("  * (No doctors found)")
        for doc in item['doctors']:
            lines.append(f"  * {doc['name']} - {doc['dept']}")
        lines.append("")
        
    with open('hospital_doctor_list_utf8.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print("List written to hospital_doctor_list_utf8.txt")

if __name__ == "__main__":
    asyncio.run(main())
