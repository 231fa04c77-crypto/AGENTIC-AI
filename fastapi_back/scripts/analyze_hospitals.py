import asyncio
from app.config.db import db

async def analyze():
    try:
        await db.connect()
        output = []
        output.append("Connected to DB")
        
        # Check hospital_tieups and their tied doctors
        sql = """
            SELECT h.id, h.name, 
                   COUNT(d.id) as total_doctors,
                   COUNT(CASE WHEN d.image LIKE '%ui-avatars.com%' OR d.image LIKE '%placeholder%' OR d.image = '' OR d.image IS NULL THEN 1 END) as filtered_out
            FROM hospital_tieups h
            LEFT JOIN hospital_tieup_doctors d ON h.id = d.hospital_tieup_id
            GROUP BY h.id, h.name
        """
        results = await db.fetch_all(sql)
        
        output.append("\n--- Hospital Tie-up Analysis ---")
        header = f"{'ID':<5} {'Name':<40} {'Total':<10} {'Filtered':<10} {'Visible':<10}"
        output.append(header)
        for r in results:
            total = r['total_doctors']
            filtered = r['filtered_out']
            visible = total - filtered
            line = f"{r['id']:<5} {r['name']:<40} {total:<10} {filtered:<10} {visible:<10}"
            output.append(line)
            
        with open('analysis_report.txt', 'w', encoding='utf-8') as f:
            f.write('\n'.join(output))
        print("Report written to analysis_report.txt")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(analyze())
