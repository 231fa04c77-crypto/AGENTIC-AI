import asyncio
import bcrypt
from app.config.db import db

def _hash(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt(10)).decode()

async def setup_multi_hospital():
    try:
        await db.connect()
        hospitals = await db.query('SELECT id, name FROM hospital_tieups LIMIT 2')
        if len(hospitals) < 2: return
        
        h1, h2 = hospitals[0], hospitals[1]
        await db.execute('DELETE FROM deans WHERE email IN ($1, $2)', "dean.hospital1@medichain.com", "dean.hospital2@medichain.com")
        
        # Insert DEAN 1
        await db.execute('INSERT INTO deans (name, email, password, hospital_id) VALUES ($1, $2, $3, $4)', 
                         f"Dean of {h1['name']}", "dean.hospital1@medichain.com", _hash("hospital1"), h1['id'])
        
        # Insert DEAN 2
        await db.execute('INSERT INTO deans (name, email, password, hospital_id) VALUES ($1, $2, $3, $4)', 
                         f"Dean of {h2['name']}", "dean.hospital2@medichain.com", _hash("hospital2"), h2['id'])

        docs1 = await db.query('SELECT name FROM doctors WHERE hospital_id = $1', h1['id'])
        docs2 = await db.query('SELECT name FROM doctors WHERE hospital_id = $1', h2['id'])

        with open("credentials_report.txt", "w", encoding="utf-8") as f:
            f.write(f"HOSPITAL 1: {h1['name']} (ID: {h1['id']})\n")
            f.write(f"Email: dean.hospital1@medichain.com\n")
            f.write(f"Password: hospital1\n")
            f.write(f"Doctors: {', '.join([d['name'] for d in docs1])}\n")
            f.write("\n" + "-"*40 + "\n")
            f.write(f"HOSPITAL 2: {h2['name']} (ID: {h2['id']})\n")
            f.write(f"Email: dean.hospital2@medichain.com\n")
            f.write(f"Password: hospital2\n")
            f.write(f"Doctors: {', '.join([d['name'] for d in docs2])}\n")

    except Exception as e:
        with open("error.log", "w") as f: f.write(str(e))
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(setup_multi_hospital())
