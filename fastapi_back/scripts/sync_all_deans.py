import asyncio
import bcrypt
import re
from app.config.db import db

def _hash(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt(10)).decode()

def slugify(text):
    return re.sub(r'[\s]+', '.', text.lower()).strip('.')

async def create_all_deans():
    try:
        await db.connect()
        hospitals = await db.query('SELECT id, name FROM hospital_tieups')
        
        credentials = []
        
        # Clear old test deans to avoid email conflicts
        print("Cleaning up existing test deans...")
        await db.execute("DELETE FROM deans")
        
        for h in hospitals:
            h_id = h['id']
            h_name = h['name']
            
            clean_name = slugify(h_name)
            email = f"dean.{clean_name}@medichain.com"
            password = f"mc.{clean_name}.123"
            
            hashed_pw = _hash(password)
            
            try:
                await db.execute('INSERT INTO deans (name, email, password, hospital_id) VALUES ($1, $2, $3, $4)', 
                                 f"Dean of {h_name}", email, hashed_pw, h_id)
                print(f"Created: {h_name} -> {email}")
                credentials.append({
                    "hospital": h_name,
                    "email": email,
                    "password": password
                })
            except Exception as e:
                print(f"Failed for {h_name}: {e}")

        # Save to markdown format
        with open("all_deans_credentials.md", "w", encoding="utf-8") as f:
            f.write("### 🏥 All Hospital DEAN Credentials\n\n")
            f.write("| Hospital Name | Email | Password | Access Level |\n")
            f.write("| :--- | :--- | :--- | :--- |\n")
            for c in credentials:
                f.write(f"| **{c['hospital']}** | `{c['email']}` | `{c['password']}` | Hospital Controller |\n")
            
        print("\nSuccess! Credentials saved to all_deans_credentials.md")

    except Exception as e:
        print(f"Global Error: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(create_all_deans())
